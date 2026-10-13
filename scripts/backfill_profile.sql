DO $$
DECLARE
  p_school_id uuid := '20000000-0000-0000-0000-000000000001';
  p_account_user_id uuid := '1e329e31-55bd-476a-b17f-4f13782dba68';
  v_school record;
  v_prefix text;
  v_counter integer;
  v_application_user_id text;
BEGIN
  SELECT * INTO v_school FROM public.schools WHERE id = p_school_id;
  v_prefix := upper(left(coalesce((
    SELECT string_agg(left(regexp_replace(word, '[^A-Za-z0-9]', '', 'g'), 1), '')
      FROM regexp_split_to_table(trim(v_school.name), '\s+') as word
     WHERE regexp_replace(word, '[^A-Za-z0-9]', '', 'g') <> ''
  ), 'SCH'), 16));
  IF v_prefix = '' THEN v_prefix := 'SCH'; END IF;
  INSERT INTO public.hrm_user_id_sequences (prefix, next_value)
    VALUES (v_prefix, 2)
    ON CONFLICT (prefix) DO UPDATE
      SET next_value = public.hrm_user_id_sequences.next_value + 1
    RETURNING next_value - 1 INTO v_counter;
  LOOP
    IF v_counter > 9999 THEN RAISE EXCEPTION 'The school User ID sequence is full. Contact support.'; END IF;
    v_application_user_id := v_prefix || lpad(v_counter::text, 4, '0');
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.profiles WHERE lower(application_user_id) = lower(v_application_user_id)
    );
    INSERT INTO public.hrm_user_id_sequences (prefix, next_value)
      VALUES (v_prefix, v_counter + 2)
    ON CONFLICT (prefix) DO UPDATE
      SET next_value = greatest(public.hrm_user_id_sequences.next_value, v_counter + 2);
    v_counter := v_counter + 1;
  END LOOP;
  INSERT INTO public.profiles (id, application_user_id, account_status, is_active, created_at)
    VALUES (p_account_user_id, v_application_user_id, 'active', true, timezone('utc', now()))
    ON CONFLICT (id) DO UPDATE SET application_user_id = EXCLUDED.application_user_id;
  UPDATE public.staff SET profile_id = p_account_user_id WHERE id = 'c28e70b0-9be9-4a07-8e7d-5b00a66db324';
  UPDATE public.hrm_candidates SET hired_application_user_id = v_application_user_id WHERE id = 'aaeda2ac-fb41-42ad-9898-d6c67fd19422';
END$$;
