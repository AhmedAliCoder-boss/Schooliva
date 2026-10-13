export type TeacherSubjectAssignment = {
  teacher_id: string;
  academic_session_id: string | null;
  subject_id: string | null;
  class_id: string | null;
};

export function getAssignedTeacherIds(
  assignments: TeacherSubjectAssignment[],
  academicSessionId: string,
  subjectId: string,
  classId: string,
) {
  return new Set(assignments
    .filter((assignment) => assignment.academic_session_id === academicSessionId
      && assignment.subject_id === subjectId
      && (assignment.class_id === null || assignment.class_id === classId))
    .map((assignment) => assignment.teacher_id));
}
