create or replace function public.export_school_backup(target_school_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  school_record jsonb;
  table_record record;
  table_rows jsonb;
  school_tables jsonb;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required'
      using errcode = '42501';
  end if;

  if not public.has_permission(target_school_id, 'school_setup', 'manage') then
    raise exception 'School settings permission required'
      using errcode = '42501';
  end if;

  select to_jsonb(s)
  into school_record
  from public.schools as s
  where s.id = target_school_id;

  if school_record is null then
    raise exception 'School not found'
      using errcode = 'P0002';
  end if;

  school_tables := jsonb_build_object('schools', jsonb_build_array(school_record));

  for table_record in
    select cols.table_name
    from information_schema.columns as cols
    join information_schema.tables as rels
      on rels.table_schema = cols.table_schema
      and rels.table_name = cols.table_name
    where cols.table_schema = 'public'
      and cols.column_name = 'school_id'
      and cols.udt_schema = 'pg_catalog'
      and cols.udt_name = 'uuid'
      and rels.table_type = 'BASE TABLE'
      and cols.table_name <> 'schools'
    order by cols.table_name
  loop
    execute format(
      'select coalesce(jsonb_agg(to_jsonb(row_data)), ''[]''::jsonb)
       from public.%I as row_data
       where row_data.school_id = $1',
      table_record.table_name
    )
    into table_rows
    using target_school_id;

    school_tables := school_tables || jsonb_build_object(table_record.table_name, table_rows);
  end loop;

  return jsonb_build_object(
    'format', 'schooliva-school-database-backup-v1',
    'school_id', target_school_id,
    'exported_at', statement_timestamp(),
    'scope', jsonb_build_object(
      'database_tables', 'All public tables with a UUID school_id column, plus this school record',
      'excluded', jsonb_build_array(
        'Supabase Storage file contents',
        'Authentication credentials and project-level configuration',
        'Rows that are not scoped by this school_id'
      )
    ),
    'tables', school_tables
  );
end;
$$;

revoke all on function public.export_school_backup(uuid) from public, anon;
grant execute on function public.export_school_backup(uuid) to authenticated;

comment on function public.export_school_backup(uuid) is
  'Exports database rows for one school only; requires school_setup:manage and intentionally excludes Storage objects and Auth credentials.';

create or replace function public.restore_school_backup(
  target_school_id uuid,
  backup_document jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  backup_table record;
  primary_key_columns text[];
  primary_key_sql text;
  insert_columns_sql text;
  restored_columns_sql text;
  update_columns_sql text;
  sequence_name text;
  primary_key_column text;
  restored_rows bigint;
  total_rows bigint := 0;
  restored_tables jsonb := '{}'::jsonb;
  has_school_id boolean;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required'
      using errcode = '42501';
  end if;

  if not public.has_permission(target_school_id, 'school_setup', 'manage') then
    raise exception 'School settings permission required'
      using errcode = '42501';
  end if;

  if not public.has_permission(target_school_id, 'users', 'manage')
     or not public.has_permission(target_school_id, 'roles', 'manage') then
    raise exception 'User and role management permissions required to restore a school backup'
      using errcode = '42501';
  end if;

  if backup_document->>'format' is distinct from 'schooliva-school-database-backup-v1'
     or backup_document->>'school_id' is distinct from target_school_id::text
     or jsonb_typeof(backup_document->'tables') is distinct from 'object'
     or jsonb_typeof(backup_document->'tables'->'schools') is distinct from 'array' then
    raise exception 'Backup format or school does not match the selected school'
      using errcode = '22023';
  end if;

  if jsonb_array_length(backup_document->'tables'->'schools') <> 1
     or backup_document->'tables'->'schools'->0->>'id' is distinct from target_school_id::text then
    raise exception 'Backup format or school does not match the selected school'
      using errcode = '22023';
  end if;

  for backup_table in
    with recursive
    requested_tables as (
      select entry.key as table_name, entry.value as rows
      from jsonb_each(backup_document->'tables') as entry
    ),
    foreign_keys as (
      select child.relname::text as child_table, parent.relname::text as parent_table
      from pg_constraint as constraint_info
      join pg_class as child on child.oid = constraint_info.conrelid
      join pg_namespace as child_schema on child_schema.oid = child.relnamespace
      join pg_class as parent on parent.oid = constraint_info.confrelid
      join pg_namespace as parent_schema on parent_schema.oid = parent.relnamespace
      where constraint_info.contype = 'f'
        and child_schema.nspname = 'public'
        and parent_schema.nspname = 'public'
        and child.relname <> parent.relname
        and child.relname in (select table_name from requested_tables)
        and parent.relname in (select table_name from requested_tables)
    ),
    dependency_walk(start_table, current_table, depth, path) as (
      select requested.table_name, requested.table_name, 0, array[requested.table_name]::text[]
      from requested_tables as requested
      union all
      select walk.start_table, foreign_keys.parent_table, walk.depth + 1, walk.path || foreign_keys.parent_table
      from dependency_walk as walk
      join foreign_keys on foreign_keys.child_table = walk.current_table
      where not foreign_keys.parent_table = any(walk.path)
    ),
    dependency_ranks as (
      select start_table, max(depth) as dependency_rank
      from dependency_walk
      group by start_table
    )
    select requested_tables.table_name, requested_tables.rows
    from requested_tables
    join dependency_ranks on dependency_ranks.start_table = requested_tables.table_name
    order by dependency_ranks.dependency_rank, requested_tables.table_name
  loop
    if jsonb_typeof(backup_table.rows) <> 'array' then
      raise exception 'Backup table % must contain an array of rows', backup_table.table_name
        using errcode = '22023';
    end if;

    if exists (
      select 1
      from jsonb_array_elements(backup_table.rows) as row_data(value)
      where jsonb_typeof(row_data.value) is distinct from 'object'
    ) then
      raise exception 'Backup table % contains a row that is not an object', backup_table.table_name
        using errcode = '22023';
    end if;

    if backup_table.table_name = 'schools' then
      has_school_id := false;
    else
      select exists (
        select 1
        from information_schema.columns as cols
        join information_schema.tables as rels
          on rels.table_schema = cols.table_schema
          and rels.table_name = cols.table_name
        where cols.table_schema = 'public'
          and cols.table_name = backup_table.table_name
          and cols.column_name = 'school_id'
          and cols.udt_schema = 'pg_catalog'
          and cols.udt_name = 'uuid'
          and rels.table_type = 'BASE TABLE'
      )
      into has_school_id;

      if not has_school_id then
        raise exception 'Backup table % is not a supported school-scoped table', backup_table.table_name
          using errcode = '22023';
      end if;

      if exists (
        select 1
        from jsonb_array_elements(backup_table.rows) as row_data(value)
        where row_data.value->>'school_id' is distinct from target_school_id::text
      ) then
        raise exception 'Backup table % contains a row from another school', backup_table.table_name
          using errcode = '22023';
      end if;
    end if;

    if backup_table.table_name = 'schools'
       and exists (
         select 1
         from jsonb_array_elements(backup_table.rows) as row_data(value)
         where row_data.value->>'id' is distinct from target_school_id::text
       ) then
      raise exception 'Backup contains a different school record'
        using errcode = '22023';
    end if;

    if jsonb_array_length(backup_table.rows) = 0 then
      restored_tables := restored_tables || jsonb_build_object(backup_table.table_name, 0);
      continue;
    end if;

    select array_agg(attribute.attname::text order by key_column.ordinality)
    into primary_key_columns
    from pg_index as index_info
    cross join lateral unnest(index_info.indkey) with ordinality as key_column(attnum, ordinality)
    join pg_attribute as attribute
      on attribute.attrelid = index_info.indrelid
      and attribute.attnum = key_column.attnum
    where index_info.indrelid = to_regclass(format('public.%I', backup_table.table_name))
      and index_info.indisprimary
      and key_column.ordinality <= index_info.indnkeyatts;

    if primary_key_columns is null or cardinality(primary_key_columns) = 0 then
      raise exception 'Backup table % has no supported primary key', backup_table.table_name
        using errcode = '22023';
    end if;

    select
      string_agg(format('%I', cols.column_name), ', ' order by cols.ordinal_position),
      string_agg(format('restored_rows.%I', cols.column_name), ', ' order by cols.ordinal_position),
      string_agg(
        format('%I = excluded.%I', cols.column_name, cols.column_name),
        ', ' order by cols.ordinal_position
      ) filter (where not (cols.column_name = any(primary_key_columns)))
    into insert_columns_sql, restored_columns_sql, update_columns_sql
    from information_schema.columns as cols
    where cols.table_schema = 'public'
      and cols.table_name = backup_table.table_name
      and cols.is_generated = 'NEVER'
      and exists (
        select 1
        from jsonb_object_keys(backup_table.rows->0) as backup_key(column_name)
        where backup_key.column_name = cols.column_name
      );

    if insert_columns_sql is null
       or exists (
         select 1
         from unnest(primary_key_columns) as primary_key(column_name)
         where not exists (
           select 1
           from jsonb_object_keys(backup_table.rows->0) as backup_key(column_name)
           where backup_key.column_name = primary_key.column_name
         )
       ) then
      raise exception 'Backup table % does not contain the columns required to restore its primary key', backup_table.table_name
        using errcode = '22023';
    end if;

    select string_agg(format('%I', primary_key.column_name), ', ')
    into primary_key_sql
    from unnest(primary_key_columns) as primary_key(column_name);

    if update_columns_sql is null then
      execute format(
        'insert into public.%I (%s) overriding system value
         select %s
         from jsonb_populate_recordset(null::public.%I, $1) as restored_rows
         on conflict (%s) do nothing',
        backup_table.table_name,
        insert_columns_sql,
        restored_columns_sql,
        backup_table.table_name,
        primary_key_sql
      )
      using backup_table.rows;
    else
      execute format(
        'insert into public.%I (%s) overriding system value
         select %s
         from jsonb_populate_recordset(null::public.%I, $1) as restored_rows
         on conflict (%s) do update set %s',
        backup_table.table_name,
        insert_columns_sql,
        restored_columns_sql,
        backup_table.table_name,
        primary_key_sql,
        update_columns_sql
      )
      using backup_table.rows;
    end if;

    get diagnostics restored_rows = row_count;
    total_rows := total_rows + restored_rows;
    restored_tables := restored_tables || jsonb_build_object(backup_table.table_name, restored_rows);

    foreach primary_key_column in array primary_key_columns
    loop
      sequence_name := pg_get_serial_sequence(
        format('public.%I', backup_table.table_name),
        primary_key_column
      );

      if sequence_name is not null then
        execute format(
          'select setval($1, greatest(nextval($1), coalesce(max(%I)::bigint, 1)), true)
           from public.%I',
          primary_key_column,
          backup_table.table_name
        )
        using sequence_name::regclass;
      end if;
    end loop;
  end loop;

  return jsonb_build_object(
    'restored_rows', total_rows,
    'tables', restored_tables,
    'mode', 'merge-by-primary-key'
  );
end;
$$;

revoke all on function public.restore_school_backup(uuid, jsonb) from public, anon;
grant execute on function public.restore_school_backup(uuid, jsonb) to authenticated;

comment on function public.restore_school_backup(uuid, jsonb) is
  'Merges rows from a school-scoped database backup by primary key; requires school_setup:manage and never deletes records.';
