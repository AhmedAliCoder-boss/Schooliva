'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { requireAdmissionContext, type AdmissionAction } from '@/lib/admissions/context';
import { postgresUuidSchema } from '@/lib/admissions/schemas';

const applicationSchema = z.object({
  applicantName: z.string().trim().min(2).max(160),
  dateOfBirth: z.string().optional().default(''),
  gender: z.enum(['male', 'female', 'non_binary', 'prefer_not_to_say']),
  phone: z.string().trim().max(40).optional().default(''),
  email: z.union([z.literal(''), z.string().trim().email().max(254)]).optional().default(''),
  guardianName: z.string().trim().max(160).optional().default(''),
  guardianPhone: z.string().trim().max(40).optional().default(''),
  guardianRelationship: z.enum(['father', 'mother', 'guardian', 'other']).optional().default('guardian'),
  address: z.string().trim().max(2000).optional().default(''),
  classId: postgresUuidSchema.or(z.literal('')).optional().default(''),
  sessionId: postgresUuidSchema.or(z.literal('')).optional().default(''),
  source: z.enum(['website', 'walk_in', 'referral', 'social_media', 'other']),
  notes: z.string().trim().max(4000).optional().default(''),
});

const statuses = ['draft', 'submitted', 'under_review', 'documents_pending', 'test_pending', 'interview_pending', 'approved', 'rejected', 'waitlisted', 'admitted', 'converted_to_student'] as const;
const stageStatuses = ['not_started', 'pending', 'verified', 'rejected'] as const;

export type CreateAdmissionState = { error: string; step?: number } | undefined;

function admissionSaveError(code: string | undefined) {
  if (code === '42501') {
    return 'Your account does not have permission to create admissions. Ask a school administrator to enable Admissions access.';
  }
  if (code === '23505') {
    return 'The application number conflicted with another application. Please submit again.';
  }
  if (code === '23503') {
    return 'The selected class or academic session is no longer available. Refresh the form and select it again.';
  }
  if (code === '22P02' || code === '23514' || code === '23502') {
    return 'Some application details were not accepted. Review the form and try again.';
  }
  if (code && ['PGRST204', '42703', '42P01'].includes(code)) {
    return 'The admissions database setup is incomplete. Ask your administrator to apply the Admissions module migrations.';
  }
  return 'The application could not be saved. Your entered details are still here; please try again or contact your administrator.';
}

function readApplicationData(formData: FormData) {
  const raw = formData.get('applicationData');
  if (typeof raw !== 'string') return null;
  try {
    return applicationSchema.safeParse(JSON.parse(raw));
  } catch {
    return null;
  }
}

export async function createAdmission(
  _previousState: CreateAdmissionState,
  formData: FormData,
): Promise<CreateAdmissionState> {
  const parsed = readApplicationData(formData);
  const submitStatus = z.enum(['draft', 'submitted']).safeParse(formData.get('status'));
  if (!parsed) {
    return { error: 'The application details could not be read. Please review the form and try again.' };
  }
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    const field = firstIssue?.path[0];
    const fieldLabels: Record<string, string> = {
      applicantName: 'Applicant full name',
      dateOfBirth: 'Date of birth',
      gender: 'Gender',
      phone: 'Applicant phone',
      email: 'Applicant email',
      guardianName: 'Parent / guardian name',
      guardianPhone: 'Guardian phone',
      guardianRelationship: 'Relationship to student',
      address: 'Home address',
      classId: 'Applying for class',
      sessionId: 'Academic session',
      source: 'Application source',
      notes: 'Additional notes',
    };
    const step = ['applicantName', 'dateOfBirth', 'gender', 'phone', 'email'].includes(String(field))
      ? 0
      : ['guardianName', 'guardianPhone', 'guardianRelationship', 'address'].includes(String(field))
        ? 1
        : 2;
    return {
      error: firstIssue
        ? `${fieldLabels[String(field)] ?? 'Application details'}: ${firstIssue.message}`
        : 'Please review the application details and try again.',
      step,
    };
  }
  if (!submitStatus.success) {
    return { error: 'Choose Save as draft or Submit application to continue.', step: 3 };
  }

  const { supabase, schoolId, user } = await requireAdmissionContext('create');
  if (parsed.data.classId) {
    const { data: schoolClass, error } = await supabase.from('classes').select('id').eq('id', parsed.data.classId).eq('school_id', schoolId).maybeSingle();
    if (error) {
      console.error('Could not validate the selected admission class.', error);
      return { error: 'The selected class could not be verified. Please try again.', step: 2 };
    }
    if (!schoolClass) return { error: 'The selected class is no longer available. Please choose another class.', step: 2 };
  }
  if (parsed.data.sessionId) {
    const { data: session, error } = await supabase.from('academic_sessions').select('id').eq('id', parsed.data.sessionId).eq('school_id', schoolId).maybeSingle();
    if (error) {
      console.error('Could not validate the selected admission academic session.', error);
      return { error: 'The selected academic session could not be verified. Please try again.', step: 2 };
    }
    if (!session) return { error: 'The selected academic session is no longer available. Please choose another session.', step: 2 };
  }

  const applicationNumber = `APP-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${crypto.randomUUID().toUpperCase()}`;
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
    guardian_relationship: parsed.data.guardianRelationship,
    applied_class_id: parsed.data.classId || null,
    academic_session_id: parsed.data.sessionId || null,
    application_source: parsed.data.source,
    status: submitStatus.data,
    notes: parsed.data.notes || null,
    created_by: user.id,
  }).select('id').single();

  if (error || !admission) {
    console.error('Could not create the admission application.', error ?? new Error('No application was returned after insert.'));
    return { error: `${admissionSaveError(error?.code)} Your entered details are still here.` };
  }
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
    guardianRelationship: formData.get('guardianRelationship') ?? 'guardian',
    address: formData.get('address') ?? '',
    classId: formData.get('classId') ?? '',
    sessionId: formData.get('sessionId') ?? '',
    source: formData.get('source'),
    notes: formData.get('notes') ?? '',
  });
  if (!id.success || !parsed.success) redirect('/admissions/applications?error=invalid-application');

  const { supabase, schoolId } = await requireAdmissionContext(['update', 'review']);
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
    guardian_relationship: parsed.data.guardianRelationship,
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
  const sectionId = postgresUuidSchema.or(z.literal('')).safeParse(formData.get('sectionId') ?? '');
  if (!id.success || !status.success || !sectionId.success) redirect('/admissions/applications?error=invalid-status');
  const requiredPermission: AdmissionAction | AdmissionAction[] = status.data === 'submitted'
    ? ['create', 'review', 'update']
    : status.data === 'approved'
      ? ['approve', 'review']
      : statusPermission(status.data);
  const { supabase, schoolId } = await requireAdmissionContext(requiredPermission);
  const { data: admission } = await supabase.from('admissions').select('status').eq('id', id.data).eq('school_id', schoolId).maybeSingle();
  if (!admission || !nextStatuses[String(admission.status)]?.includes(status.data)) {
    redirect(`/admissions/${id.data}?error=invalid-transition`);
  }

  if (status.data === 'converted_to_student') {
    const { data: fullAdmission, error: fullAdmissionError } = await supabase.from('admissions')
      .select('id,application_number,applicant_name,date_of_birth,gender,phone,email,address,guardian_name,guardian_phone,guardian_relationship,student_photo_url,applied_class_id,academic_session_id,school_id')
      .eq('id', id.data)
      .eq('school_id', schoolId)
      .maybeSingle();
    if (fullAdmissionError) {
      console.error('Could not load the admitted application for student creation.', fullAdmissionError);
      redirect(`/admissions/${id.data}?error=student-conversion-failed`);
    }
    if (!fullAdmission) redirect(`/admissions/${id.data}?error=application-not-found`);

    if (!fullAdmission.applied_class_id || !fullAdmission.academic_session_id) {
      redirect(`/admissions/${id.data}?error=student-class-required`);
    }
    if (!sectionId.data) redirect(`/admissions/${id.data}?error=student-section-required`);
    const { data: section, error: sectionError } = await supabase
      .from('sections')
      .select('id')
      .eq('id', sectionId.data)
      .eq('class_id', fullAdmission.applied_class_id)
      .eq('school_id', schoolId)
      .eq('status', 'active')
      .maybeSingle();
    if (sectionError) {
      console.error('Could not verify the selected student section.', sectionError);
      redirect(`/admissions/${id.data}?error=student-enrollment-failed`);
    }
    if (!section) redirect(`/admissions/${id.data}?error=student-section-invalid`);

    const nameParts = String(fullAdmission.applicant_name).trim().split(/\s+/);
    const firstName = nameParts[0] || 'Applicant';
    const lastName = nameParts.slice(1).join(' ') || firstName;
    const admissionNumber = `ADM-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${crypto.randomUUID().toUpperCase()}`;
    const { data: student, error: studentError } = await supabase.from('students').insert({
      school_id: schoolId,
      admission_number: admissionNumber,
      first_name: firstName,
      last_name: lastName,
      date_of_birth: fullAdmission.date_of_birth,
      gender: fullAdmission.gender === 'prefer_not_to_say' ? 'undisclosed' : fullAdmission.gender,
      phone: fullAdmission.phone,
      email: fullAdmission.email,
      address: fullAdmission.address,
      emergency_contact_name: fullAdmission.guardian_name,
      emergency_contact_phone: fullAdmission.guardian_phone,
      emergency_contact_relationship: fullAdmission.guardian_relationship,
      photo_path: fullAdmission.student_photo_url,
      admission_date: new Date().toISOString().slice(0, 10),
      status: 'active',
      is_active: true,
    }).select('id').single();
    if (studentError || !student) {
      console.error('Could not create student from admitted application.', studentError ?? new Error('No student record was returned.'));
      redirect(`/admissions/${id.data}?error=student-conversion-failed`);
    }

    const { error: enrollmentError } = await supabase.from('student_enrollments').insert({
      school_id: schoolId,
      student_id: student.id,
      academic_session_id: fullAdmission.academic_session_id,
      class_id: fullAdmission.applied_class_id,
      section_id: section.id,
      enrolled_on: new Date().toISOString().slice(0, 10),
      status: 'active',
    });
    if (enrollmentError) {
      console.error('Student record was created but its initial enrollment failed.', enrollmentError);
      const { error: cleanupError } = await supabase.from('students').delete().eq('id', student.id).eq('school_id', schoolId);
      if (cleanupError) {
        console.error('Could not clean up the incomplete student after enrollment failed.', cleanupError);
        redirect(`/admissions/${id.data}?error=conversion-cleanup-failed`);
      }
      redirect(`/admissions/${id.data}?error=student-enrollment-failed`);
    }

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
  if (status.data === 'converted_to_student') {
    revalidatePath('/students');
  }
  revalidatePath(`/admissions/${id.data}`);
  redirect(`/admissions/${id.data}?success=${status.data === 'converted_to_student' ? 'student-created' : 'status-updated'}`);
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

  const { supabase, schoolId } = await requireAdmissionContext(['manage_documents', 'create', 'update']);
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

export async function uploadAdmissionPhoto(formData: FormData) {
  const id = postgresUuidSchema.safeParse(formData.get('admissionId'));
  const file = formData.get('photo');
  if (!id.success || !(file instanceof File) || file.size === 0) redirect('/admissions/applications?error=invalid-photo');
  if (file.size > 5 * 1024 * 1024) redirect(`/admissions/${id.data}?error=photo-too-large`);
  const extensions: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
  const extension = extensions[file.type];
  if (!extension) redirect(`/admissions/${id.data}?error=invalid-photo-type`);

  const { supabase, schoolId } = await requireAdmissionContext(['manage_documents', 'create', 'update']);
  const { data: admission, error: admissionError } = await supabase
    .from('admissions')
    .select('id,student_photo_url')
    .eq('id', id.data)
    .eq('school_id', schoolId)
    .maybeSingle();
  if (admissionError) {
    console.error('Could not load admission before photo upload.', admissionError);
    redirect(`/admissions/${id.data}?error=photo-record-failed`);
  }
  if (!admission) redirect('/admissions/applications?error=application-not-found');

  const storagePath = `${schoolId}/${id.data}/photo-${crypto.randomUUID()}.${extension}`;
  const { error: uploadError } = await supabase.storage.from('admission-documents').upload(storagePath, file, {
    contentType: file.type,
    upsert: false,
  });
  if (uploadError) {
    console.error('Could not upload admission photo.', uploadError);
    redirect(`/admissions/${id.data}?error=photo-upload-failed`);
  }

  const { error: updateError } = await supabase
    .from('admissions')
    .update({ student_photo_url: storagePath })
    .eq('id', id.data)
    .eq('school_id', schoolId);
  if (updateError) {
    const { error: cleanupError } = await supabase.storage.from('admission-documents').remove([storagePath]);
    if (cleanupError) {
      console.error('Admission photo update failed and the new upload could not be removed.', { updateError, cleanupError });
      redirect(`/admissions/${id.data}?error=photo-cleanup-failed`);
    }
    console.error('Could not save admission photo path.', updateError);
    redirect(`/admissions/${id.data}?error=photo-record-failed`);
  }

  const oldPath = admission.student_photo_url;
  if (oldPath?.startsWith(`${schoolId}/${id.data}/`) && oldPath !== storagePath) {
    const { error: removeError } = await supabase.storage.from('admission-documents').remove([oldPath]);
    if (removeError) {
      console.error('Admission photo was replaced but the old file could not be removed.', removeError);
      redirect(`/admissions/${id.data}?error=old-photo-cleanup-failed`);
    }
  }

  revalidatePath(`/admissions/${id.data}`);
  redirect(`/admissions/${id.data}?success=photo-uploaded`);
}

export async function updateAdmissionDocument(formData: FormData) {
  const id = postgresUuidSchema.safeParse(formData.get('admissionId'));
  const documentId = postgresUuidSchema.safeParse(formData.get('documentId'));
  const status = z.enum(stageStatuses).safeParse(formData.get('status'));
  if (!id.success || !documentId.success || !status.success) redirect('/admissions/applications?error=invalid-document');
  const { supabase, schoolId } = await requireAdmissionContext('manage_documents');
  const { data: admission, error: admissionError } = await supabase.from('admissions').select('id').eq('id', id.data).eq('school_id', schoolId).maybeSingle();
  if (admissionError) {
    console.error('Could not verify the school admission before document review.', admissionError);
    redirect(`/admissions/${id.data}?error=document-review-failed`);
  }
  if (!admission) redirect('/admissions/applications?error=application-not-found');
  const { data: updatedDocument, error: updateError } = await supabase
    .from('admission_documents')
    .update({ status: status.data })
    .eq('id', documentId.data)
    .eq('admission_id', id.data)
    .select('id,status')
    .maybeSingle();
  if (updateError) {
    console.error('Could not update admission document review status.', updateError);
    redirect(`/admissions/${id.data}?error=document-review-failed`);
  }
  if (!updatedDocument) {
    console.error('Admission document review update matched no row.', { admissionId: id.data, documentId: documentId.data });
    redirect(`/admissions/${id.data}?error=document-not-updated`);
  }

  const { data: documents, error: listError } = await supabase.from('admission_documents').select('status').eq('admission_id', id.data);
  if (listError) {
    console.error('Document status was saved but document statuses could not be refreshed.', listError);
    redirect(`/admissions/${id.data}?error=document-review-saved-refresh-failed`);
  }
  const documentStatus = !documents?.length
    ? 'not_started'
    : documents.some((document) => document.status === 'rejected')
      ? 'rejected'
      : documents.every((document) => document.status === 'verified')
        ? 'verified'
        : 'pending';
  const { error: stageError } = await supabase.from('admissions').update({ documents_status: documentStatus }).eq('id', id.data).eq('school_id', schoolId);
  if (stageError) {
    console.error('Document status was saved but the overall document stage could not be updated.', stageError);
    redirect(`/admissions/${id.data}?error=document-review-stage-failed`);
  }
  revalidatePath('/admissions');
  revalidatePath('/admissions/applications');
  revalidatePath(`/admissions/${id.data}`);
  redirect(`/admissions/${id.data}?success=document-reviewed-${status.data}`);
}

export async function deleteAdmission(formData: FormData) {
  const id = z.string().uuid().safeParse(formData.get('admissionId'));
  const confirmation = z.literal('DELETE').safeParse(formData.get('confirmation'));
  if (!id.success || !confirmation.success) redirect('/admissions/applications?error=invalid-application');
  const { supabase, schoolId } = await requireAdmissionContext('delete');
  const { data: admission } = await supabase.from('admissions').select('student_id,student_photo_url').eq('id', id.data).eq('school_id', schoolId).maybeSingle();
  if (!admission) redirect('/admissions/applications?error=application-not-found');
  if (admission.student_id) redirect(`/admissions/${id.data}?error=converted-application-cannot-delete`);

  const { data: documents, error: listError } = await supabase.from('admission_documents').select('storage_path').eq('admission_id', id.data);
  if (listError) redirect(`/admissions/${id.data}?error=documents-load-failed`);
  const paths = (documents ?? []).map((document) => document.storage_path);
  if (admission.student_photo_url?.startsWith(`${schoolId}/${id.data}/`)) paths.push(admission.student_photo_url);
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
