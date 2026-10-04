'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { requireAdmissionContext, type AdmissionAction } from '@/lib/admissions/context';

const applicationSchema = z.object({
  applicantName: z.string().trim().min(2).max(160),
  dateOfBirth: z.string().optional().default(''),
  gender: z.enum(['male', 'female', 'non_binary', 'prefer_not_to_say']),
  phone: z.string().trim().max(40).optional().default(''),
  email: z.union([z.literal(''), z.string().trim().email().max(254)]).optional().default(''),
  guardianName: z.string().trim().max(160).optional().default(''),
  guardianPhone: z.string().trim().max(40).optional().default(''),
  address: z.string().trim().max(2000).optional().default(''),
  classId: z.string().uuid().or(z.literal('')).optional().default(''),
  sessionId: z.string().uuid().or(z.literal('')).optional().default(''),
  source: z.enum(['website', 'walk_in', 'referral', 'social_media', 'other']),
  notes: z.string().trim().max(4000).optional().default(''),
});

const statuses = ['draft', 'submitted', 'under_review', 'documents_pending', 'test_pending', 'interview_pending', 'approved', 'rejected', 'waitlisted', 'admitted', 'converted_to_student'] as const;
const stageStatuses = ['not_started', 'pending', 'verified', 'rejected'] as const;

function readApplicationData(formData: FormData) {
  const raw = formData.get('applicationData');
  if (typeof raw !== 'string') return null;
  try {
    return applicationSchema.safeParse(JSON.parse(raw));
  } catch {
    return null;
  }
}

export async function createAdmission(formData: FormData) {
  const parsed = readApplicationData(formData);
  const submitStatus = z.enum(['draft', 'submitted']).safeParse(formData.get('status'));
  if (!parsed?.success || !submitStatus.success) redirect('/admissions/new?error=invalid-application');

  const { supabase, schoolId, user } = await requireAdmissionContext('create');
  if (parsed.data.classId) {
    const { data: schoolClass } = await supabase.from('classes').select('id').eq('id', parsed.data.classId).eq('school_id', schoolId).maybeSingle();
    if (!schoolClass) redirect('/admissions/new?error=invalid-class');
  }
  if (parsed.data.sessionId) {
    const { data: session } = await supabase.from('academic_sessions').select('id').eq('id', parsed.data.sessionId).eq('school_id', schoolId).maybeSingle();
    if (!session) redirect('/admissions/new?error=invalid-session');
  }

  const applicationNumber = `ADM-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  const { data: admission, error } = await supabase.from('admissions').insert({
    school_id: schoolId,
    application_number: applicationNumber,
    applicant_name: parsed.data.applicantName,
    date_of_birth: parsed.data.dateOfBirth || null,
    gender: parsed.data.gender,
    phone: parsed.data.phone || null,
    email: parsed.data.email || null,
    address: parsed.data.address || null,
    guardian_name: parsed.data.guardianName || null,
    guardian_phone: parsed.data.guardianPhone || null,
    applied_class_id: parsed.data.classId || null,
    academic_session_id: parsed.data.sessionId || null,
    application_source: parsed.data.source,
    status: submitStatus.data,
    notes: parsed.data.notes || null,
    created_by: user.id,
  }).select('id').single();

  if (error || !admission) redirect('/admissions/new?error=application-save-failed');
  revalidatePath('/admissions');
  revalidatePath('/admissions/applications');
  redirect(`/admissions/${admission.id}?success=application-created`);
}

export async function updateAdmission(formData: FormData) {
  const id = z.string().uuid().safeParse(formData.get('admissionId'));
  const parsed = applicationSchema.safeParse({
    applicantName: formData.get('applicantName'),
    dateOfBirth: formData.get('dateOfBirth') ?? '',
    gender: formData.get('gender'),
    phone: formData.get('phone') ?? '',
    email: formData.get('email') ?? '',
    guardianName: formData.get('guardianName') ?? '',
    guardianPhone: formData.get('guardianPhone') ?? '',
    address: formData.get('address') ?? '',
    classId: formData.get('classId') ?? '',
    sessionId: formData.get('sessionId') ?? '',
    source: formData.get('source'),
    notes: formData.get('notes') ?? '',
  });
  if (!id.success || !parsed.success) redirect('/admissions/applications?error=invalid-application');

  const { supabase, schoolId } = await requireAdmissionContext('update');
  if (parsed.data.classId) {
    const { data } = await supabase.from('classes').select('id').eq('id', parsed.data.classId).eq('school_id', schoolId).maybeSingle();
    if (!data) redirect(`/admissions/${id.data}?error=invalid-class`);
  }
  if (parsed.data.sessionId) {
    const { data } = await supabase.from('academic_sessions').select('id').eq('id', parsed.data.sessionId).eq('school_id', schoolId).maybeSingle();
    if (!data) redirect(`/admissions/${id.data}?error=invalid-session`);
  }

  const { error } = await supabase.from('admissions').update({
    applicant_name: parsed.data.applicantName,
    date_of_birth: parsed.data.dateOfBirth || null,
    gender: parsed.data.gender,
    phone: parsed.data.phone || null,
    email: parsed.data.email || null,
    guardian_name: parsed.data.guardianName || null,
    guardian_phone: parsed.data.guardianPhone || null,
    applied_class_id: parsed.data.classId || null,
    academic_session_id: parsed.data.sessionId || null,
    application_source: parsed.data.source,
    address: parsed.data.address || null,
    notes: parsed.data.notes || null,
    updated_at: new Date().toISOString(),
  }).eq('id', id.data).eq('school_id', schoolId);
  if (error) redirect(`/admissions/${id.data}?error=application-update-failed`);
  revalidatePath('/admissions');
  revalidatePath('/admissions/applications');
  revalidatePath(`/admissions/${id.data}`);
  redirect(`/admissions/${id.data}?success=application-updated`);
}

const nextStatuses: Record<string, string[]> = {
  draft: ['submitted'],
  submitted: ['under_review', 'documents_pending', 'rejected'],
  under_review: ['documents_pending', 'test_pending', 'interview_pending', 'approved', 'rejected', 'waitlisted'],
  documents_pending: ['under_review', 'test_pending', 'interview_pending', 'approved', 'rejected', 'waitlisted'],
  test_pending: ['under_review', 'interview_pending', 'approved', 'rejected', 'waitlisted'],
  interview_pending: ['under_review', 'approved', 'rejected', 'waitlisted'],
  approved: ['admitted', 'rejected'],
  waitlisted: ['admitted', 'rejected'],
  admitted: ['converted_to_student'],
};

function statusPermission(status: string): AdmissionAction {
  if (status === 'approved' || status === 'admitted' || status === 'converted_to_student') return 'approve';
  if (status === 'rejected') return 'reject';
  return 'review';
}

export async function updateAdmissionStatus(formData: FormData) {
  const id = z.string().uuid().safeParse(formData.get('admissionId'));
  const status = z.enum(statuses).safeParse(formData.get('status'));
  if (!id.success || !status.success) redirect('/admissions/applications?error=invalid-status');
  const { supabase, schoolId } = await requireAdmissionContext(status.data === 'submitted' ? ['create', 'review', 'update'] : statusPermission(status.data));
  const { data: admission } = await supabase.from('admissions').select('status').eq('id', id.data).eq('school_id', schoolId).maybeSingle();
  if (!admission || !nextStatuses[String(admission.status)]?.includes(status.data)) {
    redirect(`/admissions/${id.data}?error=invalid-transition`);
  }

  if (status.data === 'converted_to_student') {
    const { data: fullAdmission } = await supabase.from('admissions').select('id,application_number,applicant_name,date_of_birth,gender,phone,email,school_id').eq('id', id.data).eq('school_id', schoolId).maybeSingle();
    if (!fullAdmission) redirect(`/admissions/${id.data}?error=application-not-found`);
    const nameParts = String(fullAdmission.applicant_name).trim().split(/\s+/);
    const firstName = nameParts[0] || 'Applicant';
    const lastName = nameParts.slice(1).join(' ') || firstName;
    const { data: student, error: studentError } = await supabase.from('students').insert({
      school_id: schoolId,
      admission_number: fullAdmission.application_number,
      first_name: firstName,
      last_name: lastName,
      date_of_birth: fullAdmission.date_of_birth,
      gender: fullAdmission.gender === 'prefer_not_to_say' ? 'undisclosed' : fullAdmission.gender,
      phone: fullAdmission.phone,
      email: fullAdmission.email,
      admission_date: new Date().toISOString().slice(0, 10),
      status: 'active',
      is_active: true,
    }).select('id').single();
    if (studentError || !student) redirect(`/admissions/${id.data}?error=student-conversion-failed`);

    const { error: conversionError } = await supabase.from('admissions').update({ status: status.data, student_id: student.id }).eq('id', id.data).eq('school_id', schoolId);
    if (conversionError) {
      const { error: cleanupError } = await supabase.from('students').delete().eq('id', student.id).eq('school_id', schoolId);
      if (cleanupError) redirect(`/admissions/${id.data}?error=conversion-cleanup-failed`);
      redirect(`/admissions/${id.data}?error=student-conversion-failed`);
    }
  } else {
    const { error } = await supabase.from('admissions').update({ status: status.data }).eq('id', id.data).eq('school_id', schoolId);
    if (error) redirect(`/admissions/${id.data}?error=status-update-failed`);
  }

  revalidatePath('/admissions');
  revalidatePath('/admissions/applications');
  revalidatePath(`/admissions/${id.data}`);
  redirect(`/admissions/${id.data}?success=status-updated`);
}

export async function updateAdmissionStage(formData: FormData) {
  const id = z.string().uuid().safeParse(formData.get('admissionId'));
  const stage = z.enum(['documents', 'test', 'interview']).safeParse(formData.get('stage'));
  const status = z.enum(stageStatuses).safeParse(formData.get('stageStatus'));
  if (!id.success || !stage.success || !status.success) redirect('/admissions/applications?error=invalid-stage');
  const permission: AdmissionAction = stage.data === 'documents' ? 'manage_documents' : stage.data === 'test' ? 'manage_tests' : 'manage_interviews';
  const { supabase, schoolId } = await requireAdmissionContext(permission);
  const column = `${stage.data}_status`;
  const { error } = await supabase.from('admissions').update({ [column]: status.data }).eq('id', id.data).eq('school_id', schoolId);
  if (error) redirect(`/admissions/${id.data}?error=stage-update-failed`);
  revalidatePath(`/admissions/${id.data}`);
  redirect(`/admissions/${id.data}?success=stage-updated`);
}

export async function addAdmissionDocument(formData: FormData) {
  const id = z.string().uuid().safeParse(formData.get('admissionId'));
  const documentType = z.string().trim().min(2).max(80).safeParse(formData.get('documentType'));
  const file = formData.get('document');
  if (!id.success || !documentType.success || !(file instanceof File) || file.size === 0) redirect('/admissions/applications?error=invalid-document');
  if (file.size > 10 * 1024 * 1024) redirect(`/admissions/${id.data}?error=document-too-large`);
  const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
  if (!allowedTypes.includes(file.type)) redirect(`/admissions/${id.data}?error=invalid-document-type`);

  const { supabase, schoolId } = await requireAdmissionContext('manage_documents');
  const { data: admission } = await supabase.from('admissions').select('id').eq('id', id.data).eq('school_id', schoolId).maybeSingle();
  if (!admission) redirect('/admissions/applications?error=application-not-found');

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-120);
  const storagePath = `${schoolId}/${id.data}/${crypto.randomUUID()}-${safeName}`;
  const { error: uploadError } = await supabase.storage.from('admission-documents').upload(storagePath, file, { contentType: file.type, upsert: false });
  if (uploadError) redirect(`/admissions/${id.data}?error=document-upload-failed`);

  const { error: recordError } = await supabase.from('admission_documents').insert({
    admission_id: id.data,
    document_type: documentType.data,
    file_name: file.name,
    storage_path: storagePath,
  });
  if (recordError) {
    const { error: cleanupError } = await supabase.storage.from('admission-documents').remove([storagePath]);
    if (cleanupError) redirect(`/admissions/${id.data}?error=document-record-cleanup-failed`);
    redirect(`/admissions/${id.data}?error=document-record-failed`);
  }

  const { error: stageError } = await supabase.from('admissions').update({ documents_status: 'pending' }).eq('id', id.data).eq('school_id', schoolId);
  if (stageError) {
    const { error: recordCleanupError } = await supabase.from('admission_documents').delete().eq('admission_id', id.data).eq('storage_path', storagePath);
    const { error: fileCleanupError } = await supabase.storage.from('admission-documents').remove([storagePath]);
    if (recordCleanupError || fileCleanupError) redirect(`/admissions/${id.data}?error=document-stage-cleanup-failed`);
    redirect(`/admissions/${id.data}?error=document-stage-update-failed`);
  }

  revalidatePath(`/admissions/${id.data}`);
  redirect(`/admissions/${id.data}?success=document-added`);
}

export async function updateAdmissionDocument(formData: FormData) {
  const id = z.string().uuid().safeParse(formData.get('admissionId'));
  const documentId = z.string().uuid().safeParse(formData.get('documentId'));
  const status = z.enum(stageStatuses).safeParse(formData.get('status'));
  if (!id.success || !documentId.success || !status.success) redirect('/admissions/applications?error=invalid-document');
  const { supabase, schoolId } = await requireAdmissionContext('manage_documents');
  const { data: admission } = await supabase.from('admissions').select('id').eq('id', id.data).eq('school_id', schoolId).maybeSingle();
  if (!admission) redirect('/admissions/applications?error=application-not-found');
  const { error } = await supabase.from('admission_documents').update({ status: status.data }).eq('id', documentId.data).eq('admission_id', id.data);
  if (error) redirect(`/admissions/${id.data}?error=document-review-failed`);

  const { data: documents, error: listError } = await supabase.from('admission_documents').select('status').eq('admission_id', id.data);
  if (listError) redirect(`/admissions/${id.data}?error=document-review-saved-refresh-failed`);
  const documentStatus = !documents?.length
    ? 'not_started'
    : documents.some((document) => document.status === 'rejected')
      ? 'rejected'
      : documents.every((document) => document.status === 'verified')
        ? 'verified'
        : 'pending';
  const { error: stageError } = await supabase.from('admissions').update({ documents_status: documentStatus }).eq('id', id.data).eq('school_id', schoolId);
  if (stageError) redirect(`/admissions/${id.data}?error=document-review-stage-failed`);
  revalidatePath('/admissions');
  revalidatePath(`/admissions/${id.data}`);
  redirect(`/admissions/${id.data}?success=document-reviewed`);
}

export async function deleteAdmission(formData: FormData) {
  const id = z.string().uuid().safeParse(formData.get('admissionId'));
  const confirmation = z.literal('DELETE').safeParse(formData.get('confirmation'));
  if (!id.success || !confirmation.success) redirect('/admissions/applications?error=invalid-application');
  const { supabase, schoolId } = await requireAdmissionContext('delete');
  const { data: admission } = await supabase.from('admissions').select('student_id').eq('id', id.data).eq('school_id', schoolId).maybeSingle();
  if (!admission) redirect('/admissions/applications?error=application-not-found');
  if (admission.student_id) redirect(`/admissions/${id.data}?error=converted-application-cannot-delete`);

  const { data: documents, error: listError } = await supabase.from('admission_documents').select('storage_path').eq('admission_id', id.data);
  if (listError) redirect(`/admissions/${id.data}?error=documents-load-failed`);
  const paths = (documents ?? []).map((document) => document.storage_path);
  if (paths.length) {
    const { error: removeError } = await supabase.storage.from('admission-documents').remove(paths);
    if (removeError) redirect(`/admissions/${id.data}?error=documents-delete-failed`);
  }
  const { error } = await supabase.from('admissions').delete().eq('id', id.data).eq('school_id', schoolId);
  if (error) redirect(`/admissions/${id.data}?error=application-delete-failed`);
  revalidatePath('/admissions');
  revalidatePath('/admissions/applications');
  redirect('/admissions/applications?success=application-deleted');
}
