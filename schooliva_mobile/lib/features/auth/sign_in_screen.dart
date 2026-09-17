import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/providers.dart';

class SignInScreen extends ConsumerStatefulWidget {
  const SignInScreen({super.key});

  @override
  ConsumerState<SignInScreen> createState() => _SignInScreenState();
}

class _SignInScreenState extends ConsumerState<SignInScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _isSubmitting = false;
  bool _obscurePassword = true;
  String? _errorMessage;

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _signIn() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _isSubmitting = true;
      _errorMessage = null;
    });
    try {
      await ref.read(schoolivaRepositoryProvider).signIn(
            email: _emailController.text,
            password: _passwordController.text,
          );
    } catch (error) {
      if (mounted) setState(() => _errorMessage = _friendlyError(error));
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  String _friendlyError(Object error) {
    final message = error.toString();
    if (message.contains('Invalid login credentials')) return 'The email or password is incorrect.';
    if (message.contains('Email not confirmed')) return 'Confirm your email address before signing in.';
    return 'Sign in could not be completed. Check your connection and try again.';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Form(
                key: _formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Container(
                      width: 88,
                      height: 88,
                      decoration: BoxDecoration(color: const Color(0xFF1F5B4E), borderRadius: BorderRadius.circular(26)),
                      child: const Icon(Icons.school_rounded, size: 48, color: Colors.white),
                    ),
                    const SizedBox(height: 24),
                    const Text('Schooliva', style: TextStyle(fontSize: 32, fontWeight: FontWeight.w700)),
                    const SizedBox(height: 8),
                    Text('Sign in to your school workspace', style: Theme.of(context).textTheme.titleMedium),
                    const SizedBox(height: 28),
                    TextFormField(
                      controller: _emailController,
                      keyboardType: TextInputType.emailAddress,
                      decoration: const InputDecoration(labelText: 'Email address', prefixIcon: Icon(Icons.email_outlined)),
                      validator: (value) => value == null || !value.contains('@') ? 'Enter a valid email address' : null,
                    ),
                    const SizedBox(height: 14),
                    TextFormField(
                      controller: _passwordController,
                      obscureText: _obscurePassword,
                      decoration: InputDecoration(
                        labelText: 'Password',
                        prefixIcon: const Icon(Icons.lock_outline_rounded),
                        suffixIcon: IconButton(
                          tooltip: _obscurePassword ? 'Show password' : 'Hide password',
                          onPressed: () => setState(() => _obscurePassword = !_obscurePassword),
                          icon: Icon(_obscurePassword ? Icons.visibility_outlined : Icons.visibility_off_outlined),
                        ),
                      ),
                      validator: (value) => value == null || value.length < 6 ? 'Enter at least 6 characters' : null,
                    ),
                    if (_errorMessage != null) ...[
                      const SizedBox(height: 14),
                      Text(_errorMessage!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
                    ],
                    const SizedBox(height: 24),
                    FilledButton.icon(
                      onPressed: _isSubmitting ? null : _signIn,
                      icon: _isSubmitting
                          ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                          : const Icon(Icons.login_rounded),
                      label: Text(_isSubmitting ? 'Signing in...' : 'Continue to Schooliva'),
                    ),
                    const SizedBox(height: 12),
                    TextButton(onPressed: _isSubmitting ? null : () {}, child: const Text('Forgot your password?')),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
