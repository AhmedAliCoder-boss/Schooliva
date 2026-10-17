create sequence if not exists public.platform_contract_number_seq;

create or replace function public.assign_platform_contract_number()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  candidate_number text;
begin
  if new.contract_number is null or btrim(new.contract_number) = '' then
    loop
      candidate_number :=
        'SC-' || to_char(coalesce(new.start_date, current_date), 'YY') || '-' ||
        lpad(nextval('public.platform_contract_number_seq')::text, 4, '0');

      exit when not exists (
        select 1
        from public.platform_contracts pc
        where pc.school_id = new.school_id
          and pc.contract_number = candidate_number
      );
    end loop;

    new.contract_number := candidate_number;
  end if;

  return new;
end;
$$;

drop trigger if exists platform_contracts_assign_number on public.platform_contracts;
create trigger platform_contracts_assign_number
before insert on public.platform_contracts
for each row execute function public.assign_platform_contract_number();

revoke all on sequence public.platform_contract_number_seq from public, anon, authenticated;
revoke all on function public.assign_platform_contract_number() from public, anon, authenticated;
