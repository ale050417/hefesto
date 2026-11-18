import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart' show DateFormat;

import '../../core/format.dart';
import '../../core/providers.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/common.dart';

// Los esqueletos y la ruedita son de toda la app (core); se re-exportan para
// las pantallas del panel que solo importan este archivo.
export '../../core/widgets/skeleton.dart';
import 'admin_models.dart';
import 'sale_status.dart';

String formatDateTime(DateTime d) => DateFormat("d MMM · HH:mm", 'es_AR').format(d);
String formatDay(DateTime d) => DateFormat("d MMM", 'es_AR').format(d);
String formatLongDay(DateTime d) => DateFormat("EEEE d 'de' MMMM", 'es_AR').format(d);

/// Barra superior de las pantallas del panel: logo + título + salir a la tienda.
class AdminAppBar extends ConsumerWidget implements PreferredSizeWidget {
  const AdminAppBar({super.key, required this.title, this.actions = const []});
  final String title;
  final List<Widget> actions;

  @override
  Size get preferredSize => const Size.fromHeight(kToolbarHeight + 4);

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final logo = ref.watch(homeProvider).value?.brand.logoUrl;
    return AppBar(
      titleSpacing: 16,
      title: Row(
        children: [
          BrandLogo(url: logo, size: 38),
          const SizedBox(width: 10),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text(
                'PANEL',
                style: TextStyle(
                  fontFamily: 'Orbitron',
                  fontSize: 9,
                  letterSpacing: 2.4,
                  fontWeight: FontWeight.w800,
                  color: Brand.gold,
                ),
              ),
              Text(title, style: Theme.of(context).textTheme.titleLarge),
            ],
          ),
        ],
      ),
      actions: [
        ...actions,
        IconButton(
          tooltip: 'Volver a la tienda',
          icon: const Icon(Icons.storefront_rounded),
          onPressed: () => context.go('/cuenta'),
        ),
        const SizedBox(width: 4),
      ],
    );
  }
}

/// Píldora de estado (color propio de cada estado).
class StatusChip extends StatelessWidget {
  const StatusChip(this.status, {super.key, this.large = false});
  final SaleStatus status;
  final bool large;

  @override
  Widget build(BuildContext context) {
    final c = status.color;
    return Container(
      padding: EdgeInsets.symmetric(horizontal: large ? 12 : 9, vertical: large ? 6 : 3),
      decoration: BoxDecoration(
        color: c.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(99),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(status.icon, size: large ? 16 : 12, color: c),
          SizedBox(width: large ? 6 : 4),
          Text(
            status.label,
            style: TextStyle(
              fontSize: large ? 13 : 11,
              fontWeight: FontWeight.w700,
              color: c,
            ),
          ),
        ],
      ),
    );
  }
}

/// Etiqueta neutra chica (origen, medio de pago…).
class MiniTag extends StatelessWidget {
  const MiniTag(this.text, {super.key, this.icon});
  final String text;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: c.surface2,
        borderRadius: BorderRadius.circular(99),
        border: Border.all(color: c.border),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[Icon(icon, size: 11, color: c.textDim), const SizedBox(width: 4)],
          // Una categoría o referencia larga se corta con "…" en vez de
          // desbordar la tarjeta que la contiene.
          Flexible(
            child: Text(
              text,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(fontSize: 11, color: c.textDim, fontWeight: FontWeight.w600),
            ),
          ),
        ],
      ),
    );
  }
}

/// Tarjeta de superficie con borde (base de casi todo el panel).
class AdminCard extends StatelessWidget {
  const AdminCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(16),
    this.onTap,
    this.accent,
  });
  final Widget child;
  final EdgeInsetsGeometry padding;
  final VoidCallback? onTap;
  final Color? accent;

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    final radius = BorderRadius.circular(20);
    return Material(
      color: accent == null ? c.surface1 : accent!.withValues(alpha: 0.08),
      borderRadius: radius,
      child: InkWell(
        borderRadius: radius,
        onTap: onTap,
        child: Container(
          padding: padding,
          decoration: BoxDecoration(
            borderRadius: radius,
            border: Border.all(color: accent == null ? c.border : accent!.withValues(alpha: 0.35)),
          ),
          // El tema deja el texto por defecto "apagado"; en las tarjetas los
          // títulos tienen que verse brillantes (lo secundario fija su color).
          child: DefaultTextStyle.merge(style: TextStyle(color: c.text), child: child),
        ),
      ),
    );
  }
}

/// Título de sección del panel ("ÚLTIMOS PEDIDOS" + acción opcional).
class AdminSectionTitle extends StatelessWidget {
  const AdminSectionTitle(this.text, {super.key, this.action, this.onAction});
  final String text;
  final String? action;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    return Padding(
      padding: const EdgeInsets.fromLTRB(4, 26, 0, 10),
      child: Row(
        children: [
          Expanded(
            child: Text(
              text.toUpperCase(),
              style: TextStyle(
                fontFamily: 'Orbitron',
                fontSize: 10.5,
                letterSpacing: 2,
                fontWeight: FontWeight.w700,
                color: c.textFaint,
              ),
            ),
          ),
          if (action != null)
            GestureDetector(
              onTap: onAction,
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 4, horizontal: 4),
                child: Text(
                  action!,
                  style: const TextStyle(
                    color: Brand.gold,
                    fontWeight: FontWeight.w700,
                    fontSize: 12.5,
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

/// Fila de una venta (listado y "últimos pedidos").
class SaleTile extends StatelessWidget {
  const SaleTile({super.key, required this.row, required this.onTap});
  final SaleRow row;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    final name = row.customerName ?? 'Sin nombre';
    return AdminCard(
      onTap: onTap,
      padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 42,
            height: 42,
            decoration: BoxDecoration(
              color: row.status.color.withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(13),
            ),
            child: Icon(row.status.icon, size: 21, color: row.status.color),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        name,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14.5),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Text(
                      formatPrice(row.total),
                      style: const TextStyle(
                        fontFamily: 'Orbitron',
                        fontWeight: FontWeight.w700,
                        fontSize: 13.5,
                        color: Brand.gold,
                      ),
                    ),
                  ],
                ),
                if (row.label.isNotEmpty) ...[
                  const SizedBox(height: 2),
                  Text(
                    row.label,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(fontSize: 12.5, color: c.textDim),
                  ),
                ],
                const SizedBox(height: 8),
                Wrap(
                  spacing: 6,
                  runSpacing: 6,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    StatusChip(row.status),
                    MiniTag(
                      row.isManual ? 'Mostrador' : (row.ref ?? 'Tienda'),
                      icon: row.isManual ? Icons.point_of_sale_rounded : Icons.shopping_bag_outlined,
                    ),
                    Text(
                      formatDay(row.date),
                      style: TextStyle(fontSize: 11.5, color: c.textFaint),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Tarjeta de número grande (KPI).
class KpiTile extends StatelessWidget {
  const KpiTile({
    super.key,
    required this.icon,
    required this.label,
    required this.value,
    this.color = Brand.gold,
    this.onTap,
    this.hint,
  });
  final IconData icon;
  final String label;
  final String value;
  final Color color;
  final VoidCallback? onTap;
  final String? hint;

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    return AdminCard(
      onTap: onTap,
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 34,
            height: 34,
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(11),
            ),
            child: Icon(icon, size: 18, color: color),
          ),
          const SizedBox(height: 12),
          FittedBox(
            fit: BoxFit.scaleDown,
            alignment: Alignment.centerLeft,
            child: Text(
              value,
              style: const TextStyle(
                fontFamily: 'Orbitron',
                fontWeight: FontWeight.w800,
                fontSize: 21,
              ),
            ),
          ),
          const SizedBox(height: 2),
          Text(label, style: TextStyle(fontSize: 12.5, color: c.textDim, fontWeight: FontWeight.w600)),
          if (hint != null)
            Text(hint!, style: TextStyle(fontSize: 11, color: c.textFaint)),
        ],
      ),
    );
  }
}

/// Aviso de "sin acceso" (el servidor negó el permiso o el rol no alcanza).
class AccessDenied extends StatelessWidget {
  const AccessDenied({super.key, this.what = 'esta sección'});
  final String what;

  @override
  Widget build(BuildContext context) => EmptyView(
        icon: Icons.lock_outline_rounded,
        title: 'Sin acceso',
        subtitle: 'Tu cuenta no tiene permiso para ver $what. '
            'Pedíselo a un administrador desde Configuración → Roles.',
      );
}

/// Gráfico de ingresos diarios (barras doradas) con lectura al tocar o arrastrar
/// (fecha + monto del día).
class RevenueChart extends StatefulWidget {
  const RevenueChart({super.key, required this.points, this.height = 150});
  final List<RevenuePoint> points;
  final double height;

  @override
  State<RevenueChart> createState() => _RevenueChartState();
}

class _RevenueChartState extends State<RevenueChart> {
  int? _selected;

  void _pick(Offset local, double width) {
    final n = widget.points.length;
    if (n < 2) return;
    final i = ((local.dx / width) * n).floor().clamp(0, n - 1);
    if (i != _selected) setState(() => _selected = i);
  }

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    final pts = widget.points;
    if (pts.length < 2) return SizedBox(height: widget.height);
    final sel = _selected;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          height: 20,
          child: sel == null
              ? Text('Tocá el gráfico para ver cada día',
                  style: TextStyle(fontSize: 11.5, color: c.textFaint))
              : Text.rich(
                  TextSpan(children: [
                    TextSpan(
                      text: '${formatDay(pts[sel].date)}  ',
                      style: TextStyle(color: c.textDim, fontWeight: FontWeight.w600),
                    ),
                    TextSpan(
                      text: formatPrice(pts[sel].total),
                      style: const TextStyle(color: Brand.gold, fontWeight: FontWeight.w800),
                    ),
                  ]),
                  style: const TextStyle(fontSize: 12.5),
                ),
        ),
        const SizedBox(height: 6),
        LayoutBuilder(
          builder: (context, box) => GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTapDown: (d) => _pick(d.localPosition, box.maxWidth),
            onHorizontalDragStart: (d) => _pick(d.localPosition, box.maxWidth),
            onHorizontalDragUpdate: (d) => _pick(d.localPosition, box.maxWidth),
            onTapUp: (_) {},
            child: CustomPaint(
              size: Size(box.maxWidth, widget.height),
              painter: _ChartPainter(
                points: pts,
                selected: sel,
                grid: c.border,
                label: c.textFaint,
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _ChartPainter extends CustomPainter {
  _ChartPainter({
    required this.points,
    required this.selected,
    required this.grid,
    required this.label,
  });
  final List<RevenuePoint> points;
  final int? selected;
  final Color grid;
  final Color label;

  @override
  void paint(Canvas canvas, Size size) {
    const bottomPad = 18.0;
    final h = size.height - bottomPad;
    final maxV = math.max(points.map((p) => p.total).reduce(math.max), 1.0);
    final n = points.length;

    final gridPaint = Paint()
      ..color = grid
      ..strokeWidth = 1;
    for (var k = 0; k <= 3; k++) {
      final gy = h * k / 3;
      canvas.drawLine(Offset(0, gy), Offset(size.width, gy), gridPaint);
    }

    // Barras: un día sin ventas es una marquita, no una curva que cae.
    final slot = size.width / n;
    final barW = slot * 0.62;
    for (var i = 0; i < n; i++) {
      final v = points[i].total;
      final isSel = selected == i;
      final dim = selected != null && !isSel;
      final bh = v <= 0 ? 2.0 : math.max((v / maxV) * (h - 6), 4.0);
      final left = slot * i + (slot - barW) / 2;
      final rect = RRect.fromRectAndCorners(
        Rect.fromLTWH(left, h - bh, barW, bh),
        topLeft: const Radius.circular(3.5),
        topRight: const Radius.circular(3.5),
        bottomLeft: const Radius.circular(1),
        bottomRight: const Radius.circular(1),
      );
      final paint = Paint();
      if (v <= 0) {
        paint.color = grid.withValues(alpha: 0.5);
      } else {
        paint.shader = LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [
            (isSel ? Brand.goldBright : Brand.gold).withValues(alpha: dim ? 0.4 : 1),
            Brand.goldDeep.withValues(alpha: dim ? 0.3 : 0.85),
          ],
        ).createShader(rect.outerRect);
      }
      canvas.drawRRect(rect, paint);
    }

    // Etiquetas de fecha: primero, medio y último.
    for (final idx in {0, n ~/ 2, n - 1}) {
      final tp = TextPainter(
        text: TextSpan(
          text: formatDay(points[idx].date),
          style: TextStyle(fontSize: 10, color: label, fontFamily: 'Sora'),
        ),
        textDirection: TextDirection.ltr,
      )..layout();
      final dx = (slot * idx + slot / 2 - tp.width / 2).clamp(0.0, size.width - tp.width);
      tp.paint(canvas, Offset(dx, h + 5));
    }
  }

  @override
  bool shouldRepaint(_ChartPainter old) =>
      old.points != points || old.selected != selected || old.grid != grid;
}

/// Píldora de color con un rótulo (estado de un arreglo o de una consulta,
/// "Urgente"…). Mismo dibujo que [StatusChip], para estados que no son de venta.
class TonePill extends StatelessWidget {
  const TonePill(this.text, {super.key, required this.color, this.icon});
  final String text;
  final Color color;
  final IconData? icon;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.15),
          borderRadius: BorderRadius.circular(99),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (icon != null) ...[Icon(icon, size: 12, color: color), const SizedBox(width: 4)],
            Flexible(
              child: Text(
                text,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: color),
              ),
            ),
          ],
        ),
      );
}

/// Texto largo de una tarjeta: muestra las primeras líneas y "Ver más" para
/// leerlo entero (una descripción puede tener hasta 4000 letras y la lista se
/// volvía interminable).
class ExpandableText extends StatefulWidget {
  const ExpandableText(this.text, {super.key, this.collapsedLines = 5, this.style});
  final String text;
  final int collapsedLines;
  final TextStyle? style;

  @override
  State<ExpandableText> createState() => _ExpandableTextState();
}

class _ExpandableTextState extends State<ExpandableText> {
  bool _open = false;

  @override
  Widget build(BuildContext context) {
    final style = DefaultTextStyle.of(context).style.merge(widget.style);
    return LayoutBuilder(
      builder: (context, box) {
        // ¿Entra en las líneas de la versión corta? Si entra, no hay botón.
        final painter = TextPainter(
          text: TextSpan(text: widget.text, style: style),
          maxLines: widget.collapsedLines,
          textDirection: Directionality.of(context),
          textScaler: MediaQuery.textScalerOf(context),
        )..layout(maxWidth: box.maxWidth);
        final long = painter.didExceedMaxLines;
        painter.dispose();
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              widget.text,
              style: widget.style,
              maxLines: _open ? null : widget.collapsedLines,
              overflow: _open ? TextOverflow.visible : TextOverflow.ellipsis,
            ),
            if (long)
              GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTap: () => setState(() => _open = !_open),
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 6),
                  child: Text(
                    _open ? 'Ver menos' : 'Ver más',
                    style: const TextStyle(color: Brand.gold, fontWeight: FontWeight.w700, fontSize: 12.5),
                  ),
                ),
              ),
          ],
        );
      },
    );
  }
}
