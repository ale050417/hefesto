import 'package:flutter/material.dart';

import 'clientes_models.dart';

/// Píldora con el nivel del cliente (VIP / Frecuente / Nuevo).
class TierChip extends StatelessWidget {
  const TierChip(this.tier, {super.key, this.large = false});
  final CustomerTier tier;
  final bool large;

  @override
  Widget build(BuildContext context) {
    final color = tier.color;
    return Container(
      padding: EdgeInsets.symmetric(horizontal: large ? 12 : 9, vertical: large ? 6 : 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(99),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(tier.icon, size: large ? 16 : 12, color: color),
          SizedBox(width: large ? 6 : 4),
          Text(
            tier.label,
            style: TextStyle(fontSize: large ? 13 : 11, fontWeight: FontWeight.w700, color: color),
          ),
        ],
      ),
    );
  }
}
