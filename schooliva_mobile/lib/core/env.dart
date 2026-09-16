import 'package:flutter_dotenv/flutter_dotenv.dart';

class AppEnv {
  static String get supabaseUrl =>
      dotenv.env['NEXT_PUBLIC_SUPABASE_URL'] ?? 'https://gaougbjiefachkeznlpp.supabase.co';

  static String get supabaseAnonKey =>
      dotenv.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'] ??
      'sb_publishable_8Qrpvdfuf1OhFalL7i9Ucg_q0rIA3NB';

  static String get siteUrl =>
      dotenv.env['NEXT_PUBLIC_SITE_URL'] ?? 'http://localhost:3000';
}
