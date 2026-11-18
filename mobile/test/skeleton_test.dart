import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hefesto/core/theme/app_theme.dart';
import 'package:hefesto/core/widgets/skeleton.dart';

// Loading unificado (pedido de Ale, 2026-11-18): el esqueleto se mueve y las
// pantallas de carga tienen la silueta de lo que viene.
void main() {
  Future<void> show(WidgetTester tester, Widget child, {bool reduceMotion = false}) {
    tester.view.devicePixelRatio = 1;
    tester.view.physicalSize = const Size(392, 880);
    addTearDown(tester.view.reset);
    return tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.of(HefestoThemeMode.dark),
        builder: (context, app) => MediaQuery(
          data: MediaQuery.of(context).copyWith(disableAnimations: reduceMotion),
          child: app!,
        ),
        home: Scaffold(body: child),
      ),
    );
  }

  Gradient? gradientOf(WidgetTester tester) {
    final box = tester.widget<Container>(
      find.descendant(of: find.byType(Skeleton).first, matching: find.byType(Container)),
    );
    return (box.decoration! as BoxDecoration).gradient;
  }

  testWidgets('el hueso tiene un brillo que avanza con el tiempo', (tester) async {
    await show(tester, const Center(child: Skeleton(height: 40, width: 200)));
    final a = gradientOf(tester)!.transform!.transform(const Rect.fromLTWH(0, 0, 200, 40))!;
    await tester.pump(const Duration(milliseconds: 500));
    final b = gradientOf(tester)!.transform!.transform(const Rect.fromLTWH(0, 0, 200, 40))!;
    expect(b.getTranslation().x, greaterThan(a.getTranslation().x));
  });

  testWidgets('con "reducir movimiento" queda quieto', (tester) async {
    await show(tester, const Center(child: Skeleton(height: 40, width: 200)), reduceMotion: true);
    expect(gradientOf(tester), isNull);
  });

  testWidgets('las siluetas entran en un teléfono sin desbordar', (tester) async {
    for (final screen in <Widget>[
      const ListSkeleton(rows: 6, height: 64),
      const ListSkeleton(rows: 4, height: 150),
      const AnalysisSkeleton(cards: 5),
      const StorefrontSkeleton(),
      const ProductPageSkeleton(),
      ProductGridSkeleton(
        delegate: const SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: 2, childAspectRatio: 0.7),
      ),
      const LoadingView(label: 'Abriendo el panel…'),
    ]) {
      await show(tester, screen);
      await tester.pump(const Duration(milliseconds: 300));
      expect(tester.takeException(), isNull, reason: '${screen.runtimeType}');
    }
    expect(find.text('Abriendo el panel…'), findsOneWidget);
  });
}
