import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hefesto/core/theme/app_theme.dart';
import 'package:hefesto/core/widgets/frame_editor.dart';

// Acomodar una imagen arrastrándola (pedido de Ale, 2026-11-18).
void main() {
  group('encuadre "x% y%"', () {
    test('se lee y se escribe; lo raro vale el centro', () {
      expect(positionPercents('78% 0%'), (78.0, 0.0));
      expect(positionPercents(null), (50.0, 50.0));
      expect(positionPercents('center'), (50.0, 50.0));
      expect(positionPercents('140% -5%'), (100.0, 0.0));
      expect(formatPosition(78.4, 0), '78% 0%');
      expect(formatPosition(-3, 130), '0% 100%');
    });

    test('cuánto sobra de la imagen al llenar el recuadro', () {
      // Foto vertical en un banner apaisado: sobra en alto, no en ancho.
      final tall = coverOverflow(const Size(1000, 2000), const Size(320, 120));
      expect(tall.width, 0);
      expect(tall.height, closeTo(520, 0.01));
      // Foto apaisada en un recuadro cuadrado: sobra en ancho.
      final wide = coverOverflow(const Size(2000, 1000), const Size(300, 300));
      expect(wide.width, closeTo(300, 0.01));
      expect(wide.height, 0);
      // Misma forma: entra justa.
      expect(coverOverflow(const Size(1600, 600), const Size(320, 120)), Size.zero);
    });

    test('arrastrar: la imagen sigue al dedo y no se pasa de los bordes', () {
      const overflow = Size(0, 200);
      // 50 px hacia abajo = un cuarto de lo que sobra: se ve más de arriba.
      expect(dragPosition('50% 50%', const Offset(0, 50), overflow), '50% 25%');
      // Hacia arriba, más de abajo.
      expect(dragPosition('50% 50%', const Offset(0, -50), overflow), '50% 75%');
      // En el sentido en que no sobra nada, no se mueve.
      expect(dragPosition('50% 50%', const Offset(80, 0), overflow), '50% 50%');
      // Tope en los bordes.
      expect(dragPosition('50% 10%', const Offset(0, 500), overflow), '50% 0%');
      expect(dragPosition('50% 90%', const Offset(0, -500), overflow), '50% 100%');
    });
  });

  group('FramingBox', () {
    Future<void> show(WidgetTester tester, Widget child) => tester.pumpWidget(
          MaterialApp(
            theme: AppTheme.of(HefestoThemeMode.dark),
            home: Scaffold(
              // Dentro de una lista, como en las pantallas reales: el
              // recuadro tiene que ganarle al desplazamiento vertical.
              body: ListView(children: [child, const SizedBox(height: 2000)]),
            ),
          ),
        );

    testWidgets('se arrastra en vertical aunque esté dentro de una lista', (tester) async {
      var position = '50% 50%';
      await show(
        tester,
        StatefulBuilder(
          builder: (context, setState) => FramingBox(
            aspectRatio: 16 / 6,
            position: position,
            onChanged: (p) => setState(() => position = p),
          ),
        ),
      );
      expect(find.text('Arrastrá para acomodar'), findsOneWidget);
      await tester.drag(find.byType(FramingBox), const Offset(0, 60));
      await tester.pump();
      expect(positionPercents(position).$2, lessThan(50));
      expect(positionPercents(position).$1, 50);
      // La lista no se movió: el recuadro sigue arriba de todo.
      expect(tester.getTopLeft(find.byType(FramingBox)).dy, 0);
    });

    testWidgets('sin onChanged solo se mira: no hay cartel ni se mueve', (tester) async {
      await show(tester, const FramingBox(aspectRatio: 1, position: '50% 50%'));
      expect(find.text('Arrastrá para acomodar'), findsNothing);
    });
  });

  group('FrameEditorScreen', () {
    testWidgets('devuelve el encuadre nuevo; "Centrar" lo vuelve al medio', (tester) async {
      // Tamaño de teléfono (el lienzo de los tests es apaisado por defecto).
      tester.view.devicePixelRatio = 1;
      tester.view.physicalSize = const Size(392, 880);
      addTearDown(tester.view.reset);
      String? result = 'sin tocar';
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.of(HefestoThemeMode.dark),
          home: Builder(
            builder: (context) => Scaffold(
              body: Center(
                child: TextButton(
                  onPressed: () async {
                    result = await Navigator.of(context).push<String>(
                      MaterialPageRoute(
                        builder: (_) => const FrameEditorScreen(
                          title: 'Acomodar foto',
                          aspectRatio: 1,
                          initial: '50% 20%',
                        ),
                      ),
                    );
                  },
                  child: const Text('abrir'),
                ),
              ),
            ),
          ),
        ),
      );
      await tester.tap(find.text('abrir'));
      await tester.pumpAndSettle();
      expect(find.text('Acomodar foto'), findsOneWidget);
      await tester.tap(find.text('Centrar'));
      await tester.pump();
      await tester.tap(find.text('Guardar encuadre'));
      await tester.pumpAndSettle();
      expect(result, '50% 50%');
    });
  });
}
