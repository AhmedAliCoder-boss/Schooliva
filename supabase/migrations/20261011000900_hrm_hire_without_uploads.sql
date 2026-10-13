do $$
declare
  v_function_definition text;
  v_required_upload_check text := $check$
  if p_photo_path is null
     or p_documents is null
     or jsonb_typeof(p_documents) <> 'array'
     or not (p_documents @> '[{"document_type":"national_id"}]'::jsonb)
     or not (p_documents @> '[{"document_type":"qualification"}]'::jsonb) then
    raise exception 'Employee photo, national ID, and qualification documents are required.';
  end if;
$check$;
  v_optional_upload_check text := $check$
  if p_documents is null or jsonb_typeof(p_documents) <> 'array' then
    raise exception 'Employee documents must be provided as an array.';
  end if;
$check$;
begin
  select pg_get_functiondef(
    'public.complete_hrm_hire(uuid, uuid, text, jsonb)'::regprocedure
  )
    into v_function_definition;

  if position(v_required_upload_check in v_function_definition) = 0 then
    raise exception 'The expected required-upload validation was not found in complete_hrm_hire.';
  end if;

  execute replace(v_function_definition, v_required_upload_check, v_optional_upload_check);
end;
$$;
