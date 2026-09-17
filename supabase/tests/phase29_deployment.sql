begin;

select plan(11);

select is((select public from storage.buckets where id = 'private-documents'), false, 'private documents bucket is not public');
select is((select public from storage.buckets where id = 'generated-certificates'), false, 'generated certificates bucket is not public');
select is((select public from storage.buckets where id = 'assignment-files'), false, 'assignment files bucket is not public');
select is((select public from storage.buckets where id = 'assignment-submissions'), false, 'assignment submissions bucket is not public');
select is((select public from storage.buckets where id = 'leave-attachments'), false, 'leave attachments bucket is not public');

select ok(exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'Owners and authorized users can read private documents'), 'private document read policy exists');
select ok(exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'Authorized users can upload private documents'), 'private document upload policy exists');
select ok(exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'Teachers can upload assignment files'), 'assignment upload policy exists');
select ok(exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'Students can upload submission files'), 'submission upload policy exists');
select ok(exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'Authorized users can upload certificates'), 'certificate upload policy exists');
select ok(exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'Authorized users can read leave attachments'), 'leave attachment read policy exists');

select * from finish();
rollback;
