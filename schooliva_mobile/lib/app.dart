import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'core/app_theme.dart';
import 'core/providers.dart';
import 'features/auth/sign_in_screen.dart';
import 'features/dashboard/dashboard_screen.dart';

class SchoolivaApp extends StatelessWidget {
  const SchoolivaApp({super.key});

  @override
  Widget build(BuildContext context) {
    return ProviderScope(
      child: MaterialApp(
        title: 'Schooliva',
        debugShowCheckedModeBanner: false,
        theme: SchoolivaTheme.light(),
        home: const AppGate(),
      ),
    );
  }
}

class AppGate extends ConsumerWidget {
  const AppGate({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authStateProvider);
    return authState.when(
      data: (user) => user == null ? const SignInScreen() : const DashboardScreen(),
      loading: () => const Scaffold(body: Center(child: CircularProgressIndicator())),
      error: (_, _) => const SignInScreen(),
    );
  }
}
