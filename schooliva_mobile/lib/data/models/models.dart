class RoleProfile {
  const RoleProfile({
    required this.schoolId,
    required this.schoolName,
    required this.roleName,
  });

  final String schoolId;
  final String schoolName;
  final String roleName;

  factory RoleProfile.fromMap(Map<String, dynamic> map) {
    return RoleProfile(
      schoolId: map['school_id']?.toString() ?? '',
      schoolName: (map['schools'] is Map<String, dynamic>)
          ? (map['schools']['name'] ?? 'School').toString()
          : (map['school_name'] ?? 'School').toString(),
      roleName: (map['roles'] is Map<String, dynamic>)
          ? (map['roles']['name'] ?? 'Member').toString()
          : (map['role_name'] ?? 'Member').toString(),
    );
  }
}

class TimetableEntry {
  const TimetableEntry({
    required this.id,
    required this.day,
    required this.startTime,
    required this.endTime,
    required this.subject,
    required this.teacher,
    required this.room,
  });

  final String id;
  final String day;
  final String startTime;
  final String endTime;
  final String subject;
  final String teacher;
  final String room;

  factory TimetableEntry.fromMap(Map<String, dynamic> map) {
    final subject = map['subjects'];
    final teacher = map['teachers'];
    return TimetableEntry(
      id: map['id']?.toString() ?? '',
      day: _dayLabel(map['day_of_week'] ?? 0),
      startTime: (map['starts_at'] ?? '').toString().substring(0, 5),
      endTime: (map['ends_at'] ?? '').toString().substring(0, 5),
      subject: _relationshipName(subject, 'name') ?? 'Subject',
      teacher: _teacherName(teacher),
      room: (map['room'] ?? '-').toString(),
    );
  }

  static String _dayLabel(int value) {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    if (value <= 0 || value > days.length) return '—';
    return days[value - 1];
  }

  static String? _relationshipName(dynamic value, String key) {
    if (value is Map<String, dynamic>) return (value[key] ?? '').toString();
    if (value is List && value.isNotEmpty) {
      final item = value.first;
      if (item is Map<String, dynamic>) return (item[key] ?? '').toString();
    }
    return null;
  }

  static String _teacherName(dynamic value) {
    if (value is Map<String, dynamic>) {
      final first = (value['first_name'] ?? '').toString();
      final last = (value['last_name'] ?? '').toString();
      return '$first $last'.trim();
    }
    if (value is List && value.isNotEmpty) {
      final item = value.first;
      if (item is Map<String, dynamic>) return _teacherName(item);
    }
    return 'Teacher';
  }
}

class AttendanceRecord {
  const AttendanceRecord({
    required this.id,
    required this.date,
    required this.status,
    required this.studentName,
  });

  final String id;
  final String date;
  final String status;
  final String studentName;

  factory AttendanceRecord.fromMap(Map<String, dynamic> map) {
    final student = map['students'];
    final first = (student is Map<String, dynamic>) ? (student['first_name'] ?? '').toString() : '';
    final last = (student is Map<String, dynamic>) ? (student['last_name'] ?? '').toString() : '';
    return AttendanceRecord(
      id: map['id']?.toString() ?? '',
      date: (map['attendance_date'] ?? '').toString(),
      status: (map['status'] ?? 'present').toString(),
      studentName: '$first $last'.trim().isNotEmpty ? '$first $last'.trim() : 'Student',
    );
  }
}

class AssignmentItem {
  const AssignmentItem({
    required this.id,
    required this.title,
    required this.subject,
    required this.dueDate,
    required this.status,
  });

  final String id;
  final String title;
  final String subject;
  final String dueDate;
  final String status;

  factory AssignmentItem.fromMap(Map<String, dynamic> map) {
    final subject = map['subjects'];
    return AssignmentItem(
      id: map['id']?.toString() ?? '',
      title: (map['title'] ?? 'Assignment').toString(),
      subject: (subject is Map<String, dynamic>) ? (subject['name'] ?? 'Subject').toString() : 'Subject',
      dueDate: (map['due_date'] ?? '').toString(),
      status: (map['status'] ?? 'open').toString(),
    );
  }
}

class ExamSummary {
  const ExamSummary({
    required this.id,
    required this.name,
    required this.status,
    required this.startsOn,
    required this.endsOn,
  });

  final String id;
  final String name;
  final String status;
  final String startsOn;
  final String endsOn;

  factory ExamSummary.fromMap(Map<String, dynamic> map) {
    return ExamSummary(
      id: map['id']?.toString() ?? '',
      name: (map['name'] ?? 'Exam').toString(),
      status: (map['status'] ?? 'draft').toString(),
      startsOn: (map['starts_on'] ?? '').toString(),
      endsOn: (map['ends_on'] ?? '').toString(),
    );
  }
}

class NotificationItem {
  const NotificationItem({
    required this.id,
    required this.title,
    required this.message,
    required this.createdAt,
    required this.read,
  });

  final String id;
  final String title;
  final String message;
  final String createdAt;
  final bool read;

  factory NotificationItem.fromMap(Map<String, dynamic> map) {
    return NotificationItem(
      id: map['id']?.toString() ?? '',
      title: (map['title'] ?? 'Notification').toString(),
      message: (map['message'] ?? '').toString(),
      createdAt: (map['created_at'] ?? '').toString(),
      read: map['read_at'] != null,
    );
  }
}

class ResultSummary {
  const ResultSummary({
    required this.id,
    required this.examName,
    required this.grade,
    required this.percentage,
  });

  final String id;
  final String examName;
  final String grade;
  final String percentage;

  factory ResultSummary.fromMap(Map<String, dynamic> map) {
    final exam = map['exams'];
    return ResultSummary(
      id: map['id']?.toString() ?? '',
      examName: (exam is Map<String, dynamic>) ? (exam['name'] ?? 'Exam').toString() : 'Exam',
      grade: (map['grade'] ?? 'N/A').toString(),
      percentage: (map['percentage'] ?? '0').toString(),
    );
  }
}

class FeeInvoice {
  const FeeInvoice({
    required this.id,
    required this.invoiceNumber,
    required this.amount,
    required this.status,
  });

  final String id;
  final String invoiceNumber;
  final String amount;
  final String status;

  factory FeeInvoice.fromMap(Map<String, dynamic> map) {
    return FeeInvoice(
      id: map['id']?.toString() ?? '',
      invoiceNumber: (map['invoice_number'] ?? 'Invoice').toString(),
      amount: (map['remaining_amount'] ?? map['total'] ?? '0').toString(),
      status: (map['status'] ?? 'unpaid').toString(),
    );
  }
}

class ChildSummary {
  const ChildSummary({
    required this.id,
    required this.name,
    required this.admissionNumber,
    required this.status,
  });

  final String id;
  final String name;
  final String admissionNumber;
  final String status;

  factory ChildSummary.fromMap(Map<String, dynamic> map) {
    final student = map['students'];
    final first = (student is Map<String, dynamic>) ? (student['first_name'] ?? '').toString() : '';
    final last = (student is Map<String, dynamic>) ? (student['last_name'] ?? '').toString() : '';
    return ChildSummary(
      id: map['student_id']?.toString() ?? '',
      name: '$first $last'.trim().isNotEmpty ? '$first $last'.trim() : 'Student',
      admissionNumber: (student is Map<String, dynamic>) ? (student['admission_number'] ?? '').toString() : '',
      status: (student is Map<String, dynamic>) ? (student['status'] ?? '').toString() : '',
    );
  }
}

class TeacherDashboardData {
  const TeacherDashboardData({
    required this.timetable,
    required this.attendance,
    required this.assignments,
    required this.exams,
    required this.notifications,
  });

  final List<TimetableEntry> timetable;
  final List<AttendanceRecord> attendance;
  final List<AssignmentItem> assignments;
  final List<ExamSummary> exams;
  final List<NotificationItem> notifications;
}

class ParentDashboardData {
  const ParentDashboardData({
    required this.children,
    required this.attendance,
    required this.fees,
    required this.results,
    required this.assignments,
    required this.notifications,
  });

  final List<ChildSummary> children;
  final List<AttendanceRecord> attendance;
  final List<FeeInvoice> fees;
  final List<ResultSummary> results;
  final List<AssignmentItem> assignments;
  final List<NotificationItem> notifications;
}

class StudentDashboardData {
  const StudentDashboardData({
    required this.timetable,
    required this.attendance,
    required this.assignments,
    required this.exams,
    required this.results,
    required this.notifications,
  });

  final List<TimetableEntry> timetable;
  final List<AttendanceRecord> attendance;
  final List<AssignmentItem> assignments;
  final List<ExamSummary> exams;
  final List<ResultSummary> results;
  final List<NotificationItem> notifications;
}
