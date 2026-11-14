import 'package:flutter/material.dart';

import '../../../core/theme/app_theme.dart';
import '../admin_widgets.dart' show formatDateTime;
import 'filamentos_format.dart';
import 'filamentos_models.dart';

/// Una fila del historial de movimientos: ícono por motivo, qué pasó, de qué
/// pedido/venta/pieza vino, cuándo y los gramos con signo.
class MovementTile extends StatelessWidget {
  const MovementTile(this.m, {super.key, this.showFilament = true});
  final FilamentMovement m;

  /// En el historial general se aclara de qué carrete es; en el de un solo
  /// carrete sobra.
  final bool showFilament;

  static IconData iconFor(String reason) => switch (reason) {
        'order' => Icons.shopping_bag_outlined,
        'manual_sale' => Icons.point_of_sale_rounded,
        'failure' => Icons.report_gmailerrorred_rounded,
        'adjust' => Icons.tune_rounded,
        'restore' => Icons.undo_rounded,
        _ => Icons.swap_vert_rounded,
      };

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    final color = m.isDown ? Brand.warning : Brand.success;
    final subtitle = [
      if (showFilament) '${m.material} · ${m.color}',
      if (m.ref != null) m.ref!,
    ].join(' · ');
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 10),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.14),
              borderRadius: BorderRadius.circular(11),
            ),
            child: Icon(iconFor(m.reason), size: 18, color: color),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  m.reasonLabel,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5),
                ),
                if (subtitle.isNotEmpty)
                  Text(
                    subtitle,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(fontSize: 12, color: c.textDim),
                  ),
                if (m.createdAt != null)
                  Text(
                    formatDateTime(m.createdAt!),
                    style: TextStyle(fontSize: 11, color: c.textFaint),
                  ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Text(
            formatDeltaGrams(m.deltaGrams),
            style: TextStyle(
              fontFamily: 'Orbitron',
              fontWeight: FontWeight.w800,
              fontSize: 13,
              color: color,
            ),
          ),
        ],
      ),
    );
  }
}
