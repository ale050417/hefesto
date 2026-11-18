import 'package:flutter/material.dart';

import '../../../core/api/api_client.dart';
import '../../../core/theme/app_theme.dart';
import 'ar_number.dart';

const List<String> kMonthShort = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic', //
];

const List<String> kMonthLong = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', //
  'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

/// Paleta de series (reparto, categorías…). Sale solo de la marca: el violeta es
/// una mezcla de dos colores de `Brand`, así no hay colores a mano.
List<Color> chartPalette() => [
      Brand.gold,
      Brand.info,
      Brand.success,
      Color.lerp(Brand.info, Brand.danger, 0.5)!,
      Brand.warning,
      Brand.danger,
    ];

/// Mensaje legible de cualquier error (el de la API ya viene en castellano).
String errorMessage(Object e, {String fallback = 'No pudimos completar la operación. Probá de nuevo.'}) =>
    e is ApiException ? e.message : fallback;

void showSnack(BuildContext context, String message) {
  ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(SnackBar(content: Text(message)));
}

/// Confirmación para acciones destructivas. Devuelve true si confirmó.
Future<bool> confirmDialog(
  BuildContext context, {
  required String title,
  required String message,
  String confirmLabel = 'Eliminar',
  bool destructive = true,
}) async {
  final ok = await showDialog<bool>(
    context: context,
    builder: (ctx) => AlertDialog(
      // Desplazable (2026-11-14, pedido de Ale: que los modales se vean bien):
      // un nombre larguísimo o la letra grande en un teléfono chico cortaban el
      // mensaje por la mitad, sin forma de leer el resto.
      scrollable: true,
      title: Text(title),
      content: Text(message),
      // Mismos botones que el resto de las confirmaciones de la app: "Cancelar"
      // de texto y la acción llena (roja si destruye algo).
      actions: [
        TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancelar')),
        FilledButton(
          style: destructive
              ? FilledButton.styleFrom(backgroundColor: Brand.danger, foregroundColor: Colors.white)
              : null,
          onPressed: () => Navigator.pop(ctx, true),
          child: Text(confirmLabel),
        ),
      ],
    ),
  );
  return ok ?? false;
}

/// Fila de chips para elegir un período / filtro (año, rango de días, mes…).
class PeriodChips<T> extends StatelessWidget {
  const PeriodChips({
    super.key,
    required this.options,
    required this.selected,
    required this.onSelected,
    this.scroll = false,
  });

  /// (valor, texto).
  final List<(T, String)> options;
  final T selected;
  final ValueChanged<T> onSelected;

  /// true = una sola fila que se desliza (muchos meses).
  final bool scroll;

  @override
  Widget build(BuildContext context) {
    final chips = [
      for (final o in options)
        ChoiceChip(
          label: Text(o.$2),
          selected: o.$1 == selected,
          onSelected: (_) => onSelected(o.$1),
        ),
    ];
    if (scroll) {
      return SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Row(
          children: [
            for (final chip in chips) Padding(padding: const EdgeInsets.only(right: 8), child: chip),
          ],
        ),
      );
    }
    return Wrap(spacing: 8, runSpacing: 4, children: chips);
  }
}

/// Título + subtítulo de una tarjeta de análisis (con acción opcional a la derecha).
class CardHeader extends StatelessWidget {
  const CardHeader(this.title, {super.key, this.subtitle, this.trailing});
  final String title;
  final String? subtitle;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15)),
                if (subtitle != null) ...[
                  const SizedBox(height: 2),
                  Text(subtitle!, style: TextStyle(fontSize: 12, color: c.textFaint, height: 1.35)),
                ],
              ],
            ),
          ),
          if (trailing != null) ...[const SizedBox(width: 8), trailing!],
        ],
      ),
    );
  }
}

/// Variación porcentual con flecha y color (verde sube, rojo baja).
class DeltaPill extends StatelessWidget {
  const DeltaPill(this.pct, {super.key, this.label});
  final double? pct;
  final String? label;

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    final v = pct;
    if (v == null) {
      return Text('Sin datos del año anterior', style: TextStyle(fontSize: 11.5, color: c.textFaint));
    }
    final up = v >= 0;
    final color = v == 0 ? c.textDim : (up ? Brand.success : Brand.danger);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.14),
        borderRadius: BorderRadius.circular(99),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(v == 0 ? Icons.remove_rounded : (up ? Icons.trending_up_rounded : Icons.trending_down_rounded),
              size: 14, color: color),
          const SizedBox(width: 4),
          Flexible(
            child: Text(
              '${up && v > 0 ? '+' : ''}${formatArPercent(v)}${label == null ? '' : ' $label'}',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w800, color: color),
            ),
          ),
        ],
      ),
    );
  }
}

class LegendDot extends StatelessWidget {
  const LegendDot(this.color, this.label, {super.key});
  final Color color;
  final String label;

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 10,
          height: 10,
          decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(3)),
        ),
        const SizedBox(width: 6),
        Text(label, style: TextStyle(fontSize: 11.5, color: c.textDim, fontWeight: FontWeight.w600)),
      ],
    );
  }
}

/// Fila de ranking: posición, nombre, detalle y una barra proporcional.
class RankedRow extends StatelessWidget {
  const RankedRow({
    super.key,
    required this.rank,
    required this.title,
    required this.value,
    required this.fraction,
    this.subtitle,
    this.color = Brand.gold,
  });

  final int rank;
  final String title;
  final String value;
  final String? subtitle;

  /// 0..1 respecto del mayor de la lista.
  final double fraction;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 7),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 22,
                height: 22,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.16),
                  borderRadius: BorderRadius.circular(7),
                ),
                child: Text('$rank',
                    style: TextStyle(
                      fontFamily: 'Orbitron',
                      fontSize: 10.5,
                      fontWeight: FontWeight.w800,
                      color: color,
                    )),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5)),
                    if (subtitle != null)
                      Text(subtitle!, style: TextStyle(fontSize: 11.5, color: c.textFaint)),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Text(value,
                  style: const TextStyle(fontFamily: 'Orbitron', fontWeight: FontWeight.w700, fontSize: 12.5)),
            ],
          ),
          const SizedBox(height: 6),
          ClipRRect(
            borderRadius: BorderRadius.circular(99),
            child: Stack(
              children: [
                Container(height: 6, color: c.surface3),
                FractionallySizedBox(
                  widthFactor: fraction.clamp(0.02, 1.0),
                  child: Container(height: 6, color: color),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Cartel de aviso dentro de una pantalla (info / advertencia).
class NoticeBanner extends StatelessWidget {
  const NoticeBanner(this.text, {super.key, this.icon = Icons.info_outline_rounded, this.color = Brand.info});
  final String text;
  final IconData icon;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.10),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: color.withValues(alpha: 0.35)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 18, color: color),
          const SizedBox(width: 10),
          Expanded(child: Text(text, style: TextStyle(fontSize: 12.5, color: c.text, height: 1.4))),
        ],
      ),
    );
  }
}

/// Fila de 2 KPIs de igual alto (se achican sin desbordar a 360dp).
class KpiRow extends StatelessWidget {
  const KpiRow({super.key, required this.left, this.right});
  final Widget left;
  final Widget? right;

  @override
  Widget build(BuildContext context) => IntrinsicHeight(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Expanded(child: left),
            const SizedBox(width: 12),
            Expanded(child: right ?? const SizedBox.shrink()),
          ],
        ),
      );
}

/// Acomoda tarjetas KPI de a dos por fila (la última queda sola si son impares).
class KpiPairs extends StatelessWidget {
  const KpiPairs(this.tiles, {super.key});
  final List<Widget> tiles;

  @override
  Widget build(BuildContext context) => Column(
        children: [
          for (var i = 0; i < tiles.length; i += 2) ...[
            if (i > 0) const SizedBox(height: 12),
            KpiRow(left: tiles[i], right: i + 1 < tiles.length ? tiles[i + 1] : null),
          ],
        ],
      );
}
