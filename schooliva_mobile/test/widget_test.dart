// This is a basic Flutter widget test.
//
// To perform an interaction with a widget in your test, use the WidgetTester
// utility in the flutter_test package. For example, you can send tap and scroll
// gestures. You can also use WidgetTester to find child widgets in the widget
// tree, read text, and verify that the values of widget properties are correct.

import 'package:flutter_test/flutter_test.dart';

import 'package:schooliva_mobile/app.dart';

void main() {
  testWidgets('Schooliva app loads the sign-in shell', (tester) async {
    await tester.pumpWidget(const SchoolivaApp());
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));

    expect(find.text('Schooliva'), findsWidgets);
    expect(find.text('Continue to Schooliva'), findsOneWidget);
  });
}
