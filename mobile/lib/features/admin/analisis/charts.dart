// Gráficos propios (CustomPaint) del análisis: barras comparativas por mes,
// líneas, dona y barra apilada de reparto. Sin dependencias nuevas. Los colores
// salen de `Brand` / `context.hc`, así se ven bien en los 3 temas.

import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../core/format.dart';
import '../../../core/theme/app_theme.dart';
import 'analysis_widgets.dart';
import 'ar_number.dart';

enum MonthlyChartMode { bars, lines }

/// Ingresos por mes: año elegido (dorado) contra el anterior (gris), en barras o
/// líneas, con lectura de cada mes al tocar o arrastrar.
class MonthlyChart extends StatefulWidget {
  const MonthlyChart({
    super.key,
    required this.current,
    required this.previous,
    required this.year,
    required this.prevYear,
    this.mode = MonthlyChartMode.bars,
    this.currentUntil = 12,
    this.height = 190,
  });

  final List<double> current;
  final List<double> previous;
  final int year;
  final int prevYear;
  final MonthlyChartMode mode;

  /// Meses del año elegido que ya pasaron (1..12): la línea no baja a cero en
  /// los meses que todavía no llegaron.
  final int currentUntil;
  final double height;

  @override
  State<MonthlyChart> createState() => _MonthlyChartState();
}

class _MonthlyChartState extends State<MonthlyChart> {
  int? _selected;

  void _pick(Offset local, double width) {
    final i = ((local.dx / width) * 12).floor().clamp(0, 11);
    if (i != _selected) setState(() => _selected = i);
  }

  double _at(List<double> a, int i) => i < a.length ? a[i] : 0;

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    final sel = _selected;
    final until = widget.currentUntil.clamp(1, 12);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Wrap(
          spacing: 16,
          runSpacing: 4,
          children: [
            LegendDot(c.textFaint, '${widget.prevYear}'),
            LegendDot(Brand.gold, '${widget.year}'),
          ],
        ),
        const SizedBox(height: 8),
        SizedBox(
          // Alto fijo (así el gráfico no salta al tocarlo), pero acompaña a la
          // letra del sistema: con letra grande las dos líneas desbordaban.
          height: MediaQuery.textScalerOf(context).scale(38),
          child: sel == null
              ? Align(
                  alignment: Alignment.centerLeft,
                  child: Text('Tocá el gráfico para ver cada mes',
                      style: TextStyle(fontSize: 11.5, color: c.textFaint)),
                )
              : Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(kMonthLong[sel],
                        style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: c.textDim)),
                    Text.rich(
                      TextSpan(children: [
                        TextSpan(
                          text: formatPrice(_at(widget.current, sel)),
                          style: const TextStyle(color: Brand.gold, fontWeight: FontWeight.w800),
                        ),
                        TextSpan(
                          text: '   ${widget.prevYear}: ${formatPrice(_at(widget.previous, sel))}',
                          style: TextStyle(color: c.textDim, fontWeight: FontWeight.w600),
                        ),
                      ]),
                      style: const TextStyle(fontSize: 12.5),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
        ),
        const SizedBox(height: 6),
        LayoutBuilder(
          builder: (context, box) => GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTapDown: (d) => _pick(d.localPosition, box.maxWidth),
            onHorizontalDragStart: (d) => _pick(d.localPosition, box.maxWidth),
            onHorizontalDragUpdate: (d) => _pick(d.localPosition, box.maxWidth),
            child: CustomPaint(
              size: Size(box.maxWidth, widget.height),
              painter: _MonthlyPainter(
                current: widget.current,
                previous: widget.previous,
                mode: widget.mode,
                currentUntil: until,
                selected: sel,
                grid: c.border,
                label: c.textFaint,
                labelStrong: c.text,
                prevColor: c.textFaint,
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _MonthlyPainter extends CustomPainter {
  _MonthlyPainter({
    required this.current,
    required this.previous,
    required this.mode,
    required this.currentUntil,
    required this.selected,
    required this.grid,
    required this.label,
    required this.labelStrong,
    required this.prevColor,
  });

  final List<double> current;
  final List<double> previous;
  final MonthlyChartMode mode;
  final int currentUntil;
  final int? selected;
  final Color grid;
  final Color label;
  final Color labelStrong;
  final Color prevColor;

  double _v(List<double> a, int i) => i < a.length ? math.max(0, a[i]) : 0;

  void _text(Canvas canvas, String text, Offset at, {Color? color, double size = 9.5, bool center = false, bool bold = false}) {
    final tp = TextPainter(
      text: TextSpan(
        text: text,
        style: TextStyle(
          fontSize: size,
          color: color ?? label,
          fontFamily: 'Sora',
          fontWeight: bold ? FontWeight.w800 : FontWeight.w500,
        ),
      ),
      textDirection: TextDirection.ltr,
    )..layout();
    tp.paint(canvas, center ? Offset(at.dx - tp.width / 2, at.dy) : at);
  }

  @override
  void paint(Canvas canvas, Size size) {
    const topPad = 14.0;
    const bottomPad = 18.0;
    final h = size.height - bottomPad;
    final chartH = h - topPad;
    var maxV = 1.0;
    for (var i = 0; i < 12; i++) {
      maxV = math.max(maxV, math.max(_v(current, i), _v(previous, i)));
    }
    final slot = size.width / 12;

    final gridPaint = Paint()
      ..color = grid
      ..strokeWidth = 1;
    for (var k = 0; k <= 3; k++) {
      final gy = topPad + chartH * k / 3;
      canvas.drawLine(Offset(0, gy), Offset(size.width, gy), gridPaint);
    }
    _text(canvas, formatArCompactMoney(maxV), const Offset(0, 0));

    double yOf(double v) => topPad + chartH - (v / maxV) * chartH;

    if (mode == MonthlyChartMode.bars) {
      final barW = math.min(12.0, slot * 0.36);
      for (var i = 0; i < 12; i++) {
        final center = slot * i + slot / 2;
        final isSel = selected == i;
        final dim = selected != null && !isSel;
        // Año anterior (izquierda) y elegido (derecha).
        for (final entry in [(0, previous, false), (1, current, true)]) {
          final v = _v(entry.$2, i);
          if (v <= 0) continue;
          final bh = math.max((v / maxV) * chartH, 3.0);
          final left = entry.$1 == 0 ? center - barW - 1 : center + 1;
          final rect = RRect.fromRectAndCorners(
            Rect.fromLTWH(left, h - bh, barW, bh),
            topLeft: const Radius.circular(3),
            topRight: const Radius.circular(3),
          );
          final paint = Paint();
          if (entry.$3) {
            paint.shader = LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [
                (isSel ? Brand.goldBright : Brand.gold).withValues(alpha: dim ? 0.4 : 1),
                Brand.goldDeep.withValues(alpha: dim ? 0.3 : 0.85),
              ],
            ).createShader(rect.outerRect);
          } else {
            paint.color = prevColor.withValues(alpha: dim ? 0.25 : (isSel ? 0.7 : 0.5));
          }
          canvas.drawRRect(rect, paint);
        }
      }
    } else {
      Path pathOf(List<double> a, int count) {
        final p = Path();
        for (var i = 0; i < count; i++) {
          final pt = Offset(slot * i + slot / 2, yOf(_v(a, i)));
          i == 0 ? p.moveTo(pt.dx, pt.dy) : p.lineTo(pt.dx, pt.dy);
        }
        return p;
      }

      // Año anterior: línea gris.
      canvas.drawPath(
        pathOf(previous, 12),
        Paint()
          ..color = prevColor.withValues(alpha: 0.7)
          ..style = PaintingStyle.stroke
          ..strokeWidth = 2
          ..strokeJoin = StrokeJoin.round,
      );
      // Año elegido: relleno suave + línea dorada, solo hasta el mes en curso.
      final cur = pathOf(current, currentUntil);
      final area = Path.from(cur)
        ..lineTo(slot * (currentUntil - 1) + slot / 2, topPad + chartH)
        ..lineTo(slot / 2, topPad + chartH)
        ..close();
      canvas.drawPath(
        area,
        Paint()
          ..shader = LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [Brand.gold.withValues(alpha: 0.28), Brand.gold.withValues(alpha: 0.02)],
          ).createShader(Rect.fromLTWH(0, topPad, size.width, chartH)),
      );
      canvas.drawPath(
        cur,
        Paint()
          ..color = Brand.gold
          ..style = PaintingStyle.stroke
          ..strokeWidth = 2.6
          ..strokeCap = StrokeCap.round
          ..strokeJoin = StrokeJoin.round,
      );
      for (var i = 0; i < currentUntil; i++) {
        final pt = Offset(slot * i + slot / 2, yOf(_v(current, i)));
        canvas.drawCircle(pt, selected == i ? 5 : 2.6, Paint()..color = Brand.gold);
      }
      final s = selected;
      if (s != null) {
        final x = slot * s + slot / 2;
        canvas.drawLine(Offset(x, topPad), Offset(x, h), gridPaint..color = grid.withValues(alpha: 0.9));
        canvas.drawCircle(Offset(x, yOf(_v(previous, s))), 4, Paint()..color = prevColor);
      }
    }

    for (var i = 0; i < 12; i++) {
      _text(
        canvas,
        kMonthShort[i],
        Offset(slot * i + slot / 2, h + 5),
        center: true,
        color: selected == i ? labelStrong : label,
        bold: selected == i,
      );
    }
  }

  @override
  bool shouldRepaint(_MonthlyPainter old) =>
      old.current != current ||
      old.previous != previous ||
      old.mode != mode ||
      old.selected != selected ||
      old.currentUntil != currentUntil ||
      old.grid != grid ||
      old.label != label;
}

/// Una porción de la dona.
class DonutSlice {
  const DonutSlice(this.label, this.value, this.color);
  final String label;
  final double value;
  final Color color;
}

/// Dona con lectura al tocar una porción (o su fila de la leyenda).
class DonutChart extends StatefulWidget {
  const DonutChart({super.key, required this.slices, this.size = 176, this.centerLabel = 'Total'});
  final List<DonutSlice> slices;
  final double size;
  final String centerLabel;

  @override
  State<DonutChart> createState() => _DonutChartState();
}

class _DonutChartState extends State<DonutChart> {
  int? _selected;

  double get _total => widget.slices.fold(0.0, (a, s) => a + math.max(0, s.value));

  int? _hit(Offset local) {
    final r = widget.size / 2;
    final d = local - Offset(r, r);
    final dist = d.distance;
    if (dist < r * 0.52 || dist > r + 6) return null;
    var angle = math.atan2(d.dy, d.dx) + math.pi / 2;
    if (angle < 0) angle += 2 * math.pi;
    final total = _total;
    if (total <= 0) return null;
    var acc = 0.0;
    for (var i = 0; i < widget.slices.length; i++) {
      acc += math.max(0, widget.slices[i].value) / total * 2 * math.pi;
      if (angle <= acc) return i;
    }
    return null;
  }

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    final total = _total;
    final sel = _selected != null && _selected! < widget.slices.length ? _selected : null;
    return Column(
      children: [
        Center(
          child: SizedBox(
            width: widget.size,
            height: widget.size,
            child: GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTapDown: (d) => setState(() {
                final h = _hit(d.localPosition);
                _selected = h == _selected ? null : h;
              }),
              child: Stack(
                alignment: Alignment.center,
                children: [
                  CustomPaint(
                    size: Size.square(widget.size),
                    painter: _DonutPainter(slices: widget.slices, selected: sel, track: c.surface3),
                  ),
                  Padding(
                    padding: EdgeInsets.all(widget.size * 0.24),
                    child: FittedBox(
                      fit: BoxFit.scaleDown,
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            sel == null ? widget.centerLabel : widget.slices[sel].label,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(fontSize: 11.5, color: c.textDim, fontWeight: FontWeight.w600),
                          ),
                          Text(
                            sel == null
                                ? formatArCompactMoney(total)
                                : formatArPercent(total > 0 ? widget.slices[sel].value / total * 100 : 0),
                            style: const TextStyle(fontFamily: 'Orbitron', fontWeight: FontWeight.w800, fontSize: 18),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
        const SizedBox(height: 14),
        for (var i = 0; i < widget.slices.length; i++)
          InkWell(
            borderRadius: BorderRadius.circular(10),
            onTap: () => setState(() => _selected = _selected == i ? null : i),
            // Cada fila se toca: mínimo 44 dp de alto (medían 33).
            child: Container(
              constraints: const BoxConstraints(minHeight: 44),
              alignment: Alignment.centerLeft,
              padding: const EdgeInsets.symmetric(vertical: 7, horizontal: 4),
              child: Row(
                children: [
                  Container(
                    width: 11,
                    height: 11,
                    decoration: BoxDecoration(color: widget.slices[i].color, borderRadius: BorderRadius.circular(3.5)),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      widget.slices[i].label,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: sel == i ? FontWeight.w800 : FontWeight.w600,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Text(formatPrice(widget.slices[i].value),
                      style: TextStyle(fontSize: 12.5, color: c.textDim, fontWeight: FontWeight.w600)),
                  SizedBox(
                    width: 46,
                    child: Text(
                      formatArPercent(total > 0 ? widget.slices[i].value / total * 100 : 0, maxDecimals: 0),
                      textAlign: TextAlign.right,
                      style: TextStyle(fontSize: 12, color: c.textFaint, fontWeight: FontWeight.w700),
                    ),
                  ),
                ],
              ),
            ),
          ),
      ],
    );
  }
}

class _DonutPainter extends CustomPainter {
  _DonutPainter({required this.slices, required this.selected, required this.track});
  final List<DonutSlice> slices;
  final int? selected;
  final Color track;

  @override
  void paint(Canvas canvas, Size size) {
    final total = slices.fold(0.0, (a, s) => a + math.max(0, s.value));
    const stroke = 24.0;
    final rect = Rect.fromCircle(
      center: size.center(Offset.zero),
      radius: size.width / 2 - stroke / 2 - 3,
    );
    if (total <= 0) {
      canvas.drawArc(
        rect,
        0,
        2 * math.pi,
        false,
        Paint()
          ..color = track
          ..style = PaintingStyle.stroke
          ..strokeWidth = stroke,
      );
      return;
    }
    // Una porción sola ocupa todo el círculo (sin hueco).
    final gap = slices.where((s) => s.value > 0).length > 1 ? 0.03 : 0.0;
    var start = -math.pi / 2;
    for (var i = 0; i < slices.length; i++) {
      final v = math.max(0, slices[i].value);
      if (v <= 0) continue;
      final sweep = v / total * 2 * math.pi;
      final isSel = selected == i;
      final dim = selected != null && !isSel;
      canvas.drawArc(
        rect,
        start + gap / 2,
        math.max(sweep - gap, 0.001),
        false,
        Paint()
          ..color = slices[i].color.withValues(alpha: dim ? 0.35 : 1)
          ..style = PaintingStyle.stroke
          ..strokeWidth = isSel ? stroke + 6 : stroke,
      );
      start += sweep;
    }
  }

  @override
  bool shouldRepaint(_DonutPainter old) =>
      old.slices != slices || old.selected != selected || old.track != track;
}

/// Barra horizontal apilada (origen de ventas, reparto entre socios…).
class ShareBar extends StatelessWidget {
  const ShareBar({super.key, required this.parts, this.height = 12});

  /// (valor, color). Los valores en 0 no se dibujan.
  final List<(double, Color)> parts;
  final double height;

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    final visible = parts.where((p) => p.$1 > 0).toList();
    return ClipRRect(
      borderRadius: BorderRadius.circular(99),
      child: SizedBox(
        height: height,
        child: visible.isEmpty
            ? Container(color: c.surface3)
            : Row(
                children: [
                  for (var i = 0; i < visible.length; i++) ...[
                    if (i > 0) const SizedBox(width: 2),
                    Expanded(
                      flex: math.max((visible[i].$1 * 1000).round(), 1),
                      child: Container(color: visible[i].$2),
                    ),
                  ],
                ],
              ),
      ),
    );
  }
}
