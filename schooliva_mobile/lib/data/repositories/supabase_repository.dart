import 'package:supabase_flutter/supabase_flutter.dart';

import '../models/models.dart';

class SupabaseSchoolivaRepository {
  SupabaseSchoolivaRepository(this._supabase);

  final SupabaseClient _supabase;

  Stream<AuthState> get authStateChanges => _supabase.auth.onAuthStateChange;

  Future<void> signIn({required String email, required String password}) async {
    await _supabase.auth.signInWithPassword(email: email.trim(), password: password);
  }

  Future<void> signOut() => _supabase.auth.signOut();

  Future<Map<String, dynamic>> dashboardSummary(String schoolId) async {
    final response = await _supabase.rpc(
      'dashboard_summary',
      params: {'target_school_id': schoolId},
    );

    if (response is! Map) {
      throw const FormatException('The dashboard response was invalid.');
    }
    return Map<String, dynamic>.from(response);
  }

  Future<RoleProfile?> currentRoleProfile() async {
    final user = _supabase.auth.currentUser;
    if (user == null) return null;

    final response = await _supabase
        .from('user_roles')
      .select('school_id, roles(name, slug), schools(name)')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();

    if (response == null) {
      return null;
    }
    return RoleProfile.fromMap(response);
  }

  Future<List<TimetableEntry>> timetableForStudent(String schoolId) async {
    final data = await _supabase
        .from('timetable_entries')
        .select('id, day_of_week, starts_at, ends_at, room, subjects(name), teachers(first_name,last_name), classes(name), sections(name)')
        .eq('school_id', schoolId)
        .eq('status', 'active')
        .order('day_of_week')
        .order('starts_at');

    return (data as List).map((row) => TimetableEntry.fromMap(row)).toList();
  }

  Future<List<AttendanceRecord>> attendanceForStudent(String schoolId) async {
    final data = await _supabase
        .from('student_attendance')
        .select('id, attendance_date, status, students(first_name,last_name)')
        .eq('school_id', schoolId)
        .order('attendance_date', ascending: false)
        .limit(20);

    return (data as List).map((row) => AttendanceRecord.fromMap(row)).toList();
  }

  Future<List<AssignmentItem>> assignmentsForStudent(String schoolId) async {
    final data = await _supabase
        .from('assignments')
        .select('id, title, due_date, status, subjects(name)')
        .eq('school_id', schoolId)
        .order('due_date', ascending: false)
        .limit(20);

    return (data as List).map((row) => AssignmentItem.fromMap(row)).toList();
  }

  Future<List<ExamSummary>> examsForStudent(String schoolId) async {
    final data = await _supabase
        .from('exams')
        .select('id, name, status, starts_on, ends_on')
        .eq('school_id', schoolId)
        .order('starts_on', ascending: false)
        .limit(20);

    return (data as List).map((row) => ExamSummary.fromMap(row)).toList();
  }

  Future<List<ResultSummary>> resultsForStudent(String schoolId) async {
    final data = await _supabase
        .from('marks')
        .select('id, grade, percentage, exams(name)')
        .eq('school_id', schoolId)
        .order('created_at', ascending: false)
        .limit(20);

    return (data as List).map((row) => ResultSummary.fromMap(row)).toList();
  }

  Future<List<NotificationItem>> notificationsForStudent(String schoolId) async {
    final data = await _supabase
        .from('notifications')
        .select('id, title, message, created_at, read_at')
        .eq('school_id', schoolId)
        .eq('recipient_profile_id', _supabase.auth.currentUser!.id)
        .order('created_at', ascending: false)
        .limit(20);

    return (data as List).map((row) => NotificationItem.fromMap(row)).toList();
  }

  Future<TeacherDashboardData> teacherDashboard(String schoolId) async {
    final timetableFuture = _supabase
      .from('timetable_entries')
      .select(
        'id, day_of_week, starts_at, ends_at, room, subjects(name), teachers(first_name,last_name), classes(name), sections(name)',
      )
      .eq('school_id', schoolId)
      .eq('status', 'active')
      .order('day_of_week')
      .order('starts_at')
      .limit(30);

    final attendanceFuture = _supabase
      .from('student_attendance')
      .select('id, attendance_date, status, students(first_name,last_name)')
      .eq('school_id', schoolId)
      .order('attendance_date', ascending: false)
      .limit(20);

    final assignmentsFuture = _supabase
      .from('assignments')
      .select('id, title, due_date, status, subjects(name)')
      .eq('school_id', schoolId)
      .order('due_date', ascending: false)
      .limit(20);

    final examsFuture = _supabase
      .from('exams')
      .select('id, name, status, starts_on, ends_on')
      .eq('school_id', schoolId)
      .order('starts_on', ascending: false)
      .limit(20);

    final notificationsFuture = _supabase
      .from('notifications')
      .select('id, title, message, created_at, read_at')
      .eq('school_id', schoolId)
      .order('created_at', ascending: false)
      .limit(20);

    final responses = await Future.wait([
      timetableFuture,
      attendanceFuture,
      assignmentsFuture,
      examsFuture,
      notificationsFuture,
    ]);

    return TeacherDashboardData(
      timetable: (responses[0] as List).map((row) => TimetableEntry.fromMap(row)).toList(),
      attendance: (responses[1] as List).map((row) => AttendanceRecord.fromMap(row)).toList(),
      assignments: (responses[2] as List).map((row) => AssignmentItem.fromMap(row)).toList(),
      exams: (responses[3] as List).map((row) => ExamSummary.fromMap(row)).toList(),
      notifications: (responses[4] as List).map((row) => NotificationItem.fromMap(row)).toList(),
    );
  }

  Future<ParentDashboardData> parentDashboard(String schoolId) async {
    final user = _supabase.auth.currentUser;
    if (user == null) {
      return const ParentDashboardData(
        children: [],
        attendance: [],
        fees: [],
        results: [],
        assignments: [],
        notifications: [],
      );
    }

    final parentResult = await _supabase
        .from('parents')
        .select('id')
        .eq('profile_id', user.id)
        .maybeSingle();

    if (parentResult == null) {
      return const ParentDashboardData(
        children: [],
        attendance: [],
        fees: [],
        results: [],
        assignments: [],
        notifications: [],
      );
    }

    final parentId = parentResult['id'];
    final linkedChildren = await _supabase
        .from('student_parents')
        .select('student_id, students(first_name,last_name,admission_number,status)')
        .eq('parent_id', parentId)
        .eq('school_id', schoolId)
        .limit(20);

    final children = (linkedChildren as List).map((row) => ChildSummary.fromMap(row)).toList();

    final childIds = children.map((child) => child.id).where((id) => id.isNotEmpty).toList();

    final attendanceFuture = childIds.isEmpty
      ? Future.value(<Map<String, dynamic>>[])
      : _supabase
        .from('student_attendance')
        .select('id, attendance_date, status, students(first_name,last_name)')
        .eq('school_id', schoolId)
        .filter('student_id', 'in', '(${childIds.join(',')})');

    final feesFuture = childIds.isEmpty
      ? Future.value(<Map<String, dynamic>>[])
      : _supabase
        .from('fee_invoices')
        .select('id, invoice_number, total, remaining_amount, status')
        .eq('school_id', schoolId)
        .filter('student_id', 'in', '(${childIds.join(',')})');

    final resultsFuture = childIds.isEmpty
      ? Future.value(<Map<String, dynamic>>[])
      : _supabase
        .from('marks')
        .select('id, grade, percentage, exams(name)')
        .eq('school_id', schoolId)
        .filter('student_id', 'in', '(${childIds.join(',')})');

    final assignmentsFuture = _supabase
      .from('assignments')
      .select('id, title, due_date, status, subjects(name)')
      .eq('school_id', schoolId)
      .order('due_date', ascending: false)
      .limit(20);

    final notificationsFuture = _supabase
      .from('notifications')
      .select('id, title, message, created_at, read_at')
      .eq('school_id', schoolId)
      .order('created_at', ascending: false)
      .limit(20);

    final responses = await Future.wait([
      attendanceFuture,
      feesFuture,
      resultsFuture,
      assignmentsFuture,
      notificationsFuture,
    ]);

    return ParentDashboardData(
      children: children,
      attendance: (responses[0] as List).map((row) => AttendanceRecord.fromMap(row)).toList(),
      fees: (responses[1] as List).map((row) => FeeInvoice.fromMap(row)).toList(),
      results: (responses[2] as List).map((row) => ResultSummary.fromMap(row)).toList(),
      assignments: (responses[3] as List).map((row) => AssignmentItem.fromMap(row)).toList(),
      notifications: (responses[4] as List).map((row) => NotificationItem.fromMap(row)).toList(),
    );
  }

  Future<StudentDashboardData> studentDashboard(String schoolId, String studentId) async {
    final timetableFuture = _supabase
      .from('timetable_entries')
      .select(
        'id, day_of_week, starts_at, ends_at, room, subjects(name), teachers(first_name,last_name), classes(name), sections(name)',
      )
      .eq('school_id', schoolId)
      .eq('status', 'active')
      .order('day_of_week')
      .order('starts_at')
      .limit(30);

    final attendanceFuture = _supabase
      .from('student_attendance')
      .select('id, attendance_date, status, students(first_name,last_name)')
      .eq('school_id', schoolId)
      .eq('student_id', studentId)
      .order('attendance_date', ascending: false)
      .limit(20);

    final assignmentsFuture = _supabase
      .from('assignments')
      .select('id, title, due_date, status, subjects(name)')
      .eq('school_id', schoolId)
      .order('due_date', ascending: false)
      .limit(20);

    final examsFuture = _supabase
      .from('exams')
      .select('id, name, status, starts_on, ends_on')
      .eq('school_id', schoolId)
      .order('starts_on', ascending: false)
      .limit(20);

    final resultsFuture = _supabase
      .from('marks')
      .select('id, grade, percentage, exams(name)')
      .eq('school_id', schoolId)
      .eq('student_id', studentId)
      .order('created_at', ascending: false)
      .limit(20);

    final notificationsFuture = _supabase
      .from('notifications')
      .select('id, title, message, created_at, read_at')
      .eq('school_id', schoolId)
      .order('created_at', ascending: false)
      .limit(20);

    final responses = await Future.wait([
      timetableFuture,
      attendanceFuture,
      assignmentsFuture,
      examsFuture,
      resultsFuture,
      notificationsFuture,
    ]);

    return StudentDashboardData(
      timetable: (responses[0] as List).map((row) => TimetableEntry.fromMap(row)).toList(),
      attendance: (responses[1] as List).map((row) => AttendanceRecord.fromMap(row)).toList(),
      assignments: (responses[2] as List).map((row) => AssignmentItem.fromMap(row)).toList(),
      exams: (responses[3] as List).map((row) => ExamSummary.fromMap(row)).toList(),
      results: (responses[4] as List).map((row) => ResultSummary.fromMap(row)).toList(),
      notifications: (responses[5] as List).map((row) => NotificationItem.fromMap(row)).toList(),
    );
  }
}
