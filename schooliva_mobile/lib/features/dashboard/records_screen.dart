import 'package:flutter/material.dart';

import '../../data/models/models.dart';
import '../../data/repositories/supabase_repository.dart';
import '../../core/providers.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class RecordsScreen extends ConsumerWidget {
  const RecordsScreen({super.key, required this.profile});

  final dynamic profile;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final repository = ref.read(schoolivaRepositoryProvider);
    final role = profile.roleName.toString().toLowerCase();

    return Scaffold(
      appBar: AppBar(title: const Text('School records')),
      body: FutureBuilder<_RecordsData>(
        future: _loadRecords(repository, role, profile.schoolId),
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError) {
            return const Center(child: Text('Records could not be loaded. Check your connection and try again.'));
          }
          final records = snapshot.data!;
          return RefreshIndicator(
            onRefresh: () async {
              await _loadRecords(repository, role, profile.schoolId);
            },
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                if (records.timetable.isNotEmpty) _RecordSection(title: 'Timetable', children: records.timetable.map(_timetableTile).toList()),
                if (records.assignments.isNotEmpty) _RecordSection(title: 'Assignments', children: records.assignments.map(_assignmentTile).toList()),
                if (records.exams.isNotEmpty) _RecordSection(title: 'Exams', children: records.exams.map(_examTile).toList()),
                if (records.attendance.isNotEmpty) _RecordSection(title: 'Attendance', children: records.attendance.map(_attendanceTile).toList()),
                if (records.results.isNotEmpty) _RecordSection(title: 'Results', children: records.results.map(_resultTile).toList()),
                if (records.fees.isNotEmpty) _RecordSection(title: 'Fees', children: records.fees.map(_feeTile).toList()),
                if (records.children.isNotEmpty) _RecordSection(title: 'Children', children: records.children.map(_childTile).toList()),
                if (records.notifications.isNotEmpty) _RecordSection(title: 'Notifications', children: records.notifications.map(_notificationTile).toList()),
                if (records.isEmpty) const Padding(padding: EdgeInsets.all(32), child: Center(child: Text('No records are available yet.'))),
              ],
            ),
          );
        },
      ),
    );
  }

  Future<_RecordsData> _loadRecords(SupabaseSchoolivaRepository repository, String role, String schoolId) async {
    if (role.contains('teacher')) {
      final data = await repository.teacherDashboard(schoolId);
      return _RecordsData(timetable: data.timetable, attendance: data.attendance, assignments: data.assignments, exams: data.exams, notifications: data.notifications);
    }
    if (role.contains('parent')) {
      final data = await repository.parentDashboard(schoolId);
      return _RecordsData(children: data.children, attendance: data.attendance, fees: data.fees, results: data.results, assignments: data.assignments, notifications: data.notifications);
    }
    final timetable = await repository.timetableForStudent(schoolId);
    final assignments = await repository.assignmentsForStudent(schoolId);
    final exams = await repository.examsForStudent(schoolId);
    final results = await repository.resultsForStudent(schoolId);
    final notifications = await repository.notificationsForStudent(schoolId);
    return _RecordsData(timetable: timetable, assignments: assignments, exams: exams, results: results, notifications: notifications);
  }

  Widget _timetableTile(TimetableEntry item) => ListTile(leading: const Icon(Icons.schedule_rounded), title: Text(item.subject), subtitle: Text('${item.day}  ${item.startTime} - ${item.endTime}  |  ${item.room}'));
  Widget _assignmentTile(AssignmentItem item) => ListTile(leading: const Icon(Icons.assignment_outlined), title: Text(item.title), subtitle: Text('${item.subject}  |  Due ${item.dueDate}'), trailing: Text(item.status));
  Widget _examTile(ExamSummary item) => ListTile(leading: const Icon(Icons.event_note_rounded), title: Text(item.name), subtitle: Text('${item.startsOn} - ${item.endsOn}'), trailing: Text(item.status));
  Widget _attendanceTile(AttendanceRecord item) => ListTile(leading: const Icon(Icons.fact_check_outlined), title: Text(item.studentName), subtitle: Text(item.date), trailing: Text(item.status));
  Widget _resultTile(ResultSummary item) => ListTile(leading: const Icon(Icons.auto_graph_rounded), title: Text(item.examName), subtitle: Text('${item.percentage}%'), trailing: Text(item.grade));
  Widget _feeTile(FeeInvoice item) => ListTile(leading: const Icon(Icons.account_balance_wallet_outlined), title: Text(item.invoiceNumber), subtitle: Text(item.amount), trailing: Text(item.status));
  Widget _childTile(ChildSummary item) => ListTile(leading: const Icon(Icons.person_outline_rounded), title: Text(item.name), subtitle: Text(item.admissionNumber), trailing: Text(item.status));
  Widget _notificationTile(NotificationItem item) => ListTile(leading: Icon(item.read ? Icons.notifications_none : Icons.notifications_active), title: Text(item.title), subtitle: Text(item.message));
}

class _RecordsData {
  const _RecordsData({this.timetable = const [], this.attendance = const [], this.assignments = const [], this.exams = const [], this.results = const [], this.fees = const [], this.children = const [], this.notifications = const []});

  final List<TimetableEntry> timetable;
  final List<AttendanceRecord> attendance;
  final List<AssignmentItem> assignments;
  final List<ExamSummary> exams;
  final List<ResultSummary> results;
  final List<FeeInvoice> fees;
  final List<ChildSummary> children;
  final List<NotificationItem> notifications;

  bool get isEmpty => timetable.isEmpty && attendance.isEmpty && assignments.isEmpty && exams.isEmpty && results.isEmpty && fees.isEmpty && children.isEmpty && notifications.isEmpty;
}

class _RecordSection extends StatelessWidget {
  const _RecordSection({required this.title, required this.children});

  final String title;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Padding(padding: const EdgeInsets.only(top: 8, bottom: 8), child: Text(title, style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w700))),
      Card(child: Column(children: children)),
      const SizedBox(height: 12),
    ]);
  }
}
