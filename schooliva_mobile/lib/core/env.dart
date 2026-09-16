import 'package:flutter_dotenv/flutter_dotenv.dart';

class AppEnv {
    static String get supabaseUrl => _required('NEXT_PUBLIC_SUPABASE_URL');

    static String get supabaseAnonKey => _required('NEXT_PUBLIC_SUPABASE_ANON_KEY');

  static String get siteUrl =>
      dotenv.env['NEXT_PUBLIC_SITE_URL'] ?? 'http://localhost:3000';

    static String _required(String key) {
        final value = dotenv.env[key]?.trim();
        if (value == null || value.isEmpty) {
            throw StateError('Missing $key. Configure the mobile .env file.');
        }
        return value;
    }
}
