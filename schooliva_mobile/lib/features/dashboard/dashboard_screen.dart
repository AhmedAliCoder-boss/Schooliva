import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/providers.dart';
import 'records_screen.dart';

class DashboardScreen extends ConsumerWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final roleProfileAsync = ref.watch(currentRoleProfileProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Schooliva'),
        actions: [
          IconButton(
            onPressed: () => _showSignOutDialog(context, ref),
            icon: const Icon(Icons.logout_rounded),
            tooltip: 'Sign out',
          ),
        ],
      ),
      body: roleProfileAsync.when(
        data: (profile) {
          if (profile == null || profile.schoolId.isEmpty) {
            return const _MessageState(message: 'No school role is assigned to this account.');
          }
          return _RoleDashboard(profile: profile);
        },
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, stackTrace) => Center(
          child: _MessageState(message: 'Unable to load your profile. Check your connection and try again.'),
        ),
      ),
    );
  }

  Future<void> _showSignOutDialog(BuildContext context, WidgetRef ref) async {
    final shouldSignOut = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Sign out?'),
        content: const Text('You will need to sign in again to access school data.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('Sign out')),
        ],
      ),
    );
    if (shouldSignOut == true) {
      await ref.read(schoolivaRepositoryProvider).signOut();
    }
  }
}

class _RoleDashboard extends ConsumerWidget {
  const _RoleDashboard({required this.profile});

  final dynamic profile;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final roleName = profile.roleName.toString();
    final summaryAsync = ref.watch(dashboardSummaryProvider(profile.schoolId));
    return summaryAsync.when(
      data: (summary) => RefreshIndicator(
        onRefresh: () => ref.refresh(dashboardSummaryProvider(profile.schoolId).future),
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Text('Welcome back', style: Theme.of(context).textTheme.titleMedium?.copyWith(color: const Color(0xFF4B5A56))),
            const SizedBox(height: 6),
            Text(profile.schoolName, style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w700)),
            const SizedBox(height: 6),
            Text(_roleLabel(roleName), style: Theme.of(context).textTheme.bodyMedium),
            const SizedBox(height: 20),
            _SummaryGrid(roleName: roleName, summary: summary),
            const SizedBox(height: 20),
            _SectionCard(title: _sectionTitleForRole(roleName), body: _sectionDescriptionForRole(roleName)),
            const SizedBox(height: 16),
            FilledButton.icon(
              onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => RecordsScreen(profile: profile))),
              icon: const Icon(Icons.view_list_rounded),
              label: const Text('Open school records'),
            ),
          ],
        ),
      ),
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (_, _) => const _MessageState(message: 'Dashboard data is temporarily unavailable.'),
    );
  }

  String _roleLabel(String roleName) => roleName.replaceAll('_', ' ').split(' ').map((word) => word.isEmpty ? word : '${word[0].toUpperCase()}${word.substring(1)}').join(' ');

  String _sectionTitleForRole(String roleName) {
    if (roleName.toLowerCase().contains('teacher')) return 'Teacher overview';
    if (roleName.toLowerCase().contains('parent')) return 'Parent overview';
    return 'Student overview';
  }

  String _sectionDescriptionForRole(String roleName) {
    if (roleName.toLowerCase().contains('teacher')) return 'Review assigned classes, today\'s timetable, open assignments, and upcoming exams.';
    if (roleName.toLowerCase().contains('parent')) return 'Track linked children, assignment updates, and recent attendance from your school account.';
    return 'Check today\'s timetable, open assignments, notifications, and your school activity.';
  }
}

class _SummaryGrid extends StatelessWidget {
  const _SummaryGrid({required this.roleName, required this.summary});

  final String roleName;
  final Map<String, dynamic> summary;

  @override
  Widget build(BuildContext context) {
    final stats = _statsForRole(roleName, summary);
    return GridView.count(
      crossAxisCount: 2,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      mainAxisSpacing: 12,
      crossAxisSpacing: 12,
      childAspectRatio: 1.6,
      children: stats
          .map(
            (item) => _MetricCard(
              label: item.label,
              value: item.value,
              icon: item.icon,
            ),
          )
          .toList(),
    );
  }

  List<_MetricItem> _statsForRole(String roleName, Map<String, dynamic> summary) {
    final role = roleName.toLowerCase();
    if (role.contains('teacher')) {
      return [
        _MetricItem(label: 'Assigned classes', value: '${summary['assigned_classes'] ?? 0}', icon: Icons.class_rounded),
        _MetricItem(label: 'Today\'s classes', value: '${summary['today_timetable'] ?? 0}', icon: Icons.calendar_month_rounded),
        _MetricItem(label: 'Assignments', value: '${summary['assignments'] ?? 0}', icon: Icons.assignment_rounded),
        _MetricItem(label: 'Upcoming exams', value: '${summary['upcoming_exams'] ?? 0}', icon: Icons.event_rounded),
      ];
    }
    if (role.contains('parent')) {
      return [
        _MetricItem(label: 'Children', value: '${summary['children'] ?? 0}', icon: Icons.family_restroom_rounded),
        _MetricItem(label: 'Open assignments', value: '${summary['unread_assignments'] ?? 0}', icon: Icons.assignment_rounded),
        _MetricItem(label: 'Absences', value: '${summary['children_absence_last_30'] ?? 0}', icon: Icons.event_busy_rounded),
        _MetricItem(label: 'Unread alerts', value: '${summary['unread_notifications'] ?? 0}', icon: Icons.notifications_active_rounded),
      ];
    }
    return [
      _MetricItem(label: 'Today\'s classes', value: '${summary['today_timetable'] ?? 0}', icon: Icons.calendar_month_rounded),
      _MetricItem(label: 'Open assignments', value: '${summary['open_assignments'] ?? 0}', icon: Icons.task_alt_rounded),
      _MetricItem(label: 'Unread alerts', value: '${summary['unread_notifications'] ?? 0}', icon: Icons.notifications_active_rounded),
      _MetricItem(label: 'Role', value: 'Student', icon: Icons.school_rounded),
    ];
    /* switch (roleName.toLowerCase()) {
      case 'teacher':
        return const [
          _MetricItem(label: 'Classes', value: '12', icon: Icons.class_rounded),
          _MetricItem(label: 'Attendance', value: '96%', icon: Icons.fact_check_rounded),
          _MetricItem(label: 'Assignments', value: '08', icon: Icons.assignment_rounded),
          _MetricItem(label: 'Alerts', value: '03', icon: Icons.notifications_active_rounded),
        ];
      case 'parent':
        return const [
          _MetricItem(label: 'Children', value: '02', icon: Icons.family_restroom_rounded),
          _MetricItem(label: 'Fee due', value: 'NGN 48k', icon: Icons.account_balance_wallet_rounded),
          _MetricItem(label: 'Absences', value: '01', icon: Icons.event_busy_rounded),
          _MetricItem(label: 'Messages', value: '07', icon: Icons.message_rounded),
        ];
      case 'student':
      default:
        return const [
          _MetricItem(label: 'Timetable', value: '06', icon: Icons.calendar_month_rounded),
          _MetricItem(label: 'Attendance', value: '94%', icon: Icons.check_circle_rounded),
          _MetricItem(label: 'Assignments', value: '05', icon: Icons.task_alt_rounded),
          _MetricItem(label: 'Results', value: 'A-', icon: Icons.auto_graph_rounded),
        ];
    } */
  }
}

class _MetricItem {
  const _MetricItem({
    required this.label,
    required this.value,
    required this.icon,
  });

  final String label;
  final String value;
  final IconData icon;
}

class _MetricCard extends StatelessWidget {
  const _MetricCard({
    required this.label,
    required this.value,
    required this.icon,
  });

  final String label;
  final String value;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, color: const Color(0xFF1F5B4E)),
            const SizedBox(height: 10),
            Text(
              value,
              style: Theme.of(context).textTheme.titleLarge?.copyWith(
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              label,
              style: Theme.of(context).textTheme.bodyMedium,
            ),
          ],
        ),
      ),
    );
  }
}

class _MessageState extends StatelessWidget {
  const _MessageState({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) => Center(child: Padding(padding: const EdgeInsets.all(24), child: Text(message, textAlign: TextAlign.center)));
}

class _SectionCard extends StatelessWidget {
  const _SectionCard({
    required this.title,
    required this.body,
  });

  final String title;
  final String body;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              title,
              style: Theme.of(context).textTheme.titleLarge?.copyWith(
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 10),
            Text(
              body,
              style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                color: const Color(0xFF45615D),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
