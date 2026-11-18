// Estados de carga de TODA la app (pedido de Ale, 2026-11-18: "un loading
// unificado para todo y el skeleton no tan estático, todo más profesional").
//
// - [Skeleton]: el "hueso" gris con un brillo que lo recorre (antes solo
//   cambiaba de tono, muy quieto). Todos los huesos de una pantalla nacen en
//   el mismo cuadro, así que el brillo pasa por todos a la vez.
// - [ListSkeleton] / [AnalysisSkeleton] / [ProductGridSkeleton] /
//   [StorefrontSkeleton] / [ProductPageSkeleton]: la silueta de lo que viene
//   (tarjetas con su foto y sus renglones), no bloques lisos.
// - [AppSpinner]: la única ruedita, para esperas cortas (botones, hojas).

import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

/// Desliza el brillo de izquierda a derecha según [t] (0 → 1).
class _Sweep extends GradientTransform {
  const _Sweep(this.t);
  final double t;

  @override
  Matrix4? transform(Rect bounds, {TextDirection? textDirection}) =>
      Matrix4.translationValues(bounds.width * (t * 2.4 - 1.2), 0, 0);
}

/// Bloque gris con un brillo que lo recorre mientras carga (esqueleto).
class Skeleton extends StatefulWidget {
  const Skeleton({super.key, this.height = 16, this.width, this.radius = 12});
  final double height;
  final double? width;
  final double radius;

  @override
  State<Skeleton> createState() => _SkeletonState();
}

class _SkeletonState extends State<Skeleton> with SingleTickerProviderStateMixin {
  // Se crea en initState (y no al primer uso): con "reducir movimiento" nunca
  // se usa, y crearlo recién en dispose rompía al desmontar la pantalla.
  late final AnimationController _ctl;

  @override
  void initState() {
    super.initState();
    _ctl = AnimationController(vsync: this, duration: const Duration(milliseconds: 1350))..repeat();
  }

  @override
  void dispose() {
    _ctl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    final base = c.surface2;
    final shine = Color.lerp(c.surface3, c.text, 0.07)!;
    final radius = BorderRadius.circular(widget.radius);
    // "Reducir movimiento" del teléfono: el hueso queda quieto.
    if (MediaQuery.disableAnimationsOf(context)) {
      return Container(
        height: widget.height,
        width: widget.width,
        decoration: BoxDecoration(color: base, borderRadius: radius),
      );
    }
    return AnimatedBuilder(
      animation: _ctl,
      builder: (_, _) => Container(
        height: widget.height,
        width: widget.width,
        decoration: BoxDecoration(
          borderRadius: radius,
          gradient: LinearGradient(
            colors: [base, shine, base],
            stops: const [0.25, 0.5, 0.75],
            // Curva suave: arranca y termina despacio, no como una barra.
            transform: _Sweep(Curves.easeInOut.transform(_ctl.value)),
          ),
        ),
      ),
    );
  }
}

/// Renglón de texto en espera: ocupa [fraction] del ancho disponible.
class _Line extends StatelessWidget {
  const _Line(this.fraction, {this.height = 12});
  final double fraction;
  final double height;

  @override
  Widget build(BuildContext context) => FractionallySizedBox(
        widthFactor: fraction,
        alignment: Alignment.centerLeft,
        child: Skeleton(height: height, radius: 6),
      );
}

/// La silueta de una tarjeta de lista: foto a la izquierda y renglones.
class _CardSkeleton extends StatelessWidget {
  const _CardSkeleton({required this.height, required this.index});
  final double height;
  final int index;

  // Anchos distintos por fila: una lista de renglones idénticos se ve armada.
  static const _titles = [0.62, 0.78, 0.5, 0.7];
  static const _subs = [0.4, 0.34, 0.46, 0.3];

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    final thumb = (height - 24).clamp(0, 68).toDouble();
    return Container(
      height: height,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: c.surface1,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: c.border),
      ),
      child: Row(
        children: [
          if (thumb >= 36) ...[
            Skeleton(height: thumb, width: thumb, radius: 14),
            const SizedBox(width: 12),
          ],
          Expanded(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _Line(_titles[index % _titles.length], height: 13),
                if (height >= 60) ...[
                  const SizedBox(height: 8),
                  _Line(_subs[index % _subs.length], height: 10),
                ],
                if (height >= 112) ...[
                  const SizedBox(height: 12),
                  const Row(
                    children: [
                      Skeleton(height: 20, width: 64, radius: 99),
                      SizedBox(width: 6),
                      Skeleton(height: 20, width: 46, radius: 99),
                    ],
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Esqueleto de lista (varias tarjetas) para mientras carga.
class ListSkeleton extends StatelessWidget {
  const ListSkeleton({super.key, this.rows = 5, this.height = 92});
  final int rows;
  final double height;

  @override
  Widget build(BuildContext context) => Semantics(
        label: 'Cargando',
        child: ListView(
          physics: const NeverScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
          children: [
            for (var i = 0; i < rows; i++) ...[
              _CardSkeleton(height: height, index: i),
              const SizedBox(height: 10),
            ],
          ],
        ),
      );
}

/// Esqueleto de pantalla de análisis: una fila de números y tarjetas de gráfico.
class AnalysisSkeleton extends StatelessWidget {
  const AnalysisSkeleton({super.key, this.cards = 4});
  final int cards;

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    Widget card(double height, Widget child) => Container(
          height: height,
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: c.surface1,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: c.border),
          ),
          child: child,
        );
    return Semantics(
      label: 'Cargando',
      child: ListView(
        physics: const NeverScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
        children: [
          for (var i = 0; i < cards; i++) ...[
            if (i == 0)
              // Los números de arriba (dos indicadores lado a lado).
              Row(
                children: [
                  for (var k = 0; k < 2; k++) ...[
                    if (k > 0) const SizedBox(width: 12),
                    Expanded(
                      child: card(
                        96,
                        const Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [_Line(0.5, height: 10), SizedBox(height: 10), _Line(0.8, height: 20)],
                        ),
                      ),
                    ),
                  ],
                ],
              )
            else
              card(
                150,
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _Line(i.isEven ? 0.45 : 0.6, height: 12),
                    const SizedBox(height: 12),
                    const Expanded(child: Skeleton(height: double.infinity, radius: 12)),
                  ],
                ),
              ),
            const SizedBox(height: 12),
          ],
        ],
      ),
    );
  }
}

/// La silueta de una tarjeta de producto de la tienda: foto, nombre y precio.
class ProductCardSkeleton extends StatelessWidget {
  const ProductCardSkeleton({super.key});

  @override
  Widget build(BuildContext context) => const Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(child: Skeleton(height: double.infinity, radius: 18)),
          SizedBox(height: 10),
          _Line(0.85, height: 12),
          SizedBox(height: 7),
          _Line(0.45, height: 14),
          SizedBox(height: 4),
        ],
      );
}

/// Grilla de productos en espera (catálogo). [delegate] es la misma grilla que
/// usan las tarjetas reales, para que al cargar nada cambie de lugar.
class ProductGridSkeleton extends StatelessWidget {
  const ProductGridSkeleton({super.key, required this.delegate, this.count = 6});
  final SliverGridDelegate delegate;
  final int count;

  @override
  Widget build(BuildContext context) => Semantics(
        label: 'Cargando productos',
        child: GridView.builder(
          physics: const NeverScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
          gridDelegate: delegate,
          itemCount: count,
          itemBuilder: (_, _) => const ProductCardSkeleton(),
        ),
      );
}

/// El inicio de la tienda en espera: banner, categorías y una fila de productos.
class StorefrontSkeleton extends StatelessWidget {
  const StorefrontSkeleton({super.key});

  @override
  Widget build(BuildContext context) => Semantics(
        label: 'Cargando la tienda',
        child: ListView(
          physics: const NeverScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
          children: [
            const Row(
              children: [
                Skeleton(height: 36, width: 36, radius: 99),
                SizedBox(width: 10),
                Expanded(child: _Line(0.4, height: 14)),
                Skeleton(height: 36, width: 36, radius: 99),
              ],
            ),
            const SizedBox(height: 16),
            const AspectRatio(aspectRatio: 16 / 9, child: Skeleton(height: double.infinity, radius: 22)),
            const SizedBox(height: 20),
            SizedBox(
              height: 86,
              child: Row(
                children: [
                  for (var i = 0; i < 4; i++)
                    const Expanded(
                      child: Column(
                        children: [
                          Skeleton(height: 56, width: 56, radius: 99),
                          SizedBox(height: 8),
                          Skeleton(height: 9, width: 44, radius: 6),
                        ],
                      ),
                    ),
                ],
              ),
            ),
            const SizedBox(height: 14),
            const _Line(0.5, height: 16),
            const SizedBox(height: 14),
            SizedBox(
              height: 240,
              child: Row(
                children: [
                  for (var i = 0; i < 2; i++) ...[
                    if (i > 0) const SizedBox(width: 12),
                    const Expanded(child: ProductCardSkeleton()),
                  ],
                ],
              ),
            ),
          ],
        ),
      );
}

/// La ficha de un producto en espera: foto cuadrada, nombre, precio y texto.
class ProductPageSkeleton extends StatelessWidget {
  const ProductPageSkeleton({super.key});

  @override
  Widget build(BuildContext context) => Semantics(
        label: 'Cargando el producto',
        child: ListView(
          physics: const NeverScrollableScrollPhysics(),
          padding: EdgeInsets.zero,
          children: const [
            AspectRatio(aspectRatio: 1, child: Skeleton(height: double.infinity, radius: 0)),
            Padding(
              padding: EdgeInsets.fromLTRB(20, 20, 20, 0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _Line(0.3, height: 10),
                  SizedBox(height: 12),
                  _Line(0.8, height: 22),
                  SizedBox(height: 16),
                  _Line(0.4, height: 26),
                  SizedBox(height: 28),
                  _Line(1, height: 11),
                  SizedBox(height: 9),
                  _Line(0.94, height: 11),
                  SizedBox(height: 9),
                  _Line(0.6, height: 11),
                ],
              ),
            ),
          ],
        ),
      );
}

/// La única ruedita de la app, para esperas cortas (un botón que guarda, una
/// hoja que trae un dato). Mismo trazo y puntas redondeadas en todos lados;
/// el tamaño lo pone quien la usa y el color por defecto es el dorado.
class AppSpinner extends StatelessWidget {
  const AppSpinner({super.key, this.color, this.strokeWidth = 2.4});
  final Color? color;
  final double strokeWidth;

  @override
  Widget build(BuildContext context) => CircularProgressIndicator(
        strokeWidth: strokeWidth,
        strokeCap: StrokeCap.round,
        color: color ?? Brand.gold,
      );
}

/// Espera a pantalla (o sección) completa cuando no hay una silueta que
/// mostrar: la ruedita dorada sobre su pista, centrada.
class LoadingView extends StatelessWidget {
  const LoadingView({super.key, this.label});

  /// Qué se está esperando ("Abriendo el panel…"). Opcional.
  final String? label;

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          SizedBox.square(
            dimension: 34,
            child: CircularProgressIndicator(
              strokeWidth: 3,
              strokeCap: StrokeCap.round,
              color: Brand.gold,
              backgroundColor: c.surface3,
            ),
          ),
          if (label != null) ...[
            const SizedBox(height: 12),
            Text(label!, style: TextStyle(fontSize: 13, color: c.textDim)),
          ],
        ],
      ),
    );
  }
}
