import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../data/models/models.dart';
import '../data/repositories/supabase_repository.dart';

final schoolivaRepositoryProvider = Provider<SupabaseSchoolivaRepository>((ref) {
  try {
    return SupabaseSchoolivaRepository(Supabase.instance.client);
  } catch (_) {
    throw StateError('Supabase is not initialized yet.');
  }
});

final currentUserProvider = Provider<User?>((ref) {
  try {
    return Supabase.instance.client.auth.currentUser;
  } catch (_) {
    return null;
  }
});

final authStateProvider = StreamProvider<User?>((ref) {
  try {
    final client = Supabase.instance.client;
    return client.auth.onAuthStateChange.map((state) => state.session?.user);
  } catch (_) {
    return Stream<User?>.value(null);
  }
});

final currentRoleProfileProvider = FutureProvider<RoleProfile?>((ref) async {
  try {
    final repository = ref.read(schoolivaRepositoryProvider);
    return await repository.currentRoleProfile();
  } on StateError {
    return null;
  }
});

final dashboardSummaryProvider = FutureProvider.autoDispose
    .family<Map<String, dynamic>, String>((ref, schoolId) async {
  final repository = ref.read(schoolivaRepositoryProvider);
  return repository.dashboardSummary(schoolId);
});
