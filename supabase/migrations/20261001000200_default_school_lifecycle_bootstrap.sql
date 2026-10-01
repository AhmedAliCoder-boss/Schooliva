insert into public.school_storage_quotas (school_id, quota_bytes, warning_threshold, is_active)
select s.id, 1073741824, 0.80, true
from public.schools s
left join public.school_storage_quotas sq on sq.school_id = s.id
where sq.school_id is null
on conflict (school_id) do nothing;

insert into public.school_trials (school_id, trial_name, status, starts_on, ends_on, seats, notes)
select s.id,
       'Onboarding Trial',
       'pending',
       current_date,
       current_date + interval '30 days',
       25,
       'Initial onboarding trial created automatically for the school.'
from public.schools s
left join public.school_trials st on st.school_id = s.id and st.trial_name = 'Onboarding Trial'
where st.id is null
on conflict (school_id, trial_name) do nothing;

insert into public.platform_contracts (school_id, contract_number, plan_name, pricing_model, monthly_amount, status, start_date, end_date, renewal_date, metadata)
select s.id,
       'CT-' || to_char(current_date, 'YYYYMMDD') || '-' || substr(md5(random()::text), 1, 6),
       'Starter',
       'monthly',
       0,
       'draft',
       current_date,
       null,
       null,
       jsonb_build_object('source', 'backfill', 'created_by', null)
from public.schools s
left join public.platform_contracts pc on pc.school_id = s.id and pc.plan_name = 'Starter'
where pc.id is null
on conflict (school_id, contract_number) do nothing;
