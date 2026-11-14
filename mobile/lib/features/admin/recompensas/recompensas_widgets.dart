import 'package:flutter/material.dart';

import '../../../core/theme/app_theme.dart';
import '../admin_widgets.dart';
import 'recompensas_models.dart';

/// Una recompensa del catálogo.
class RewardCard extends StatelessWidget {
  const RewardCard({
    super.key,
    required this.reward,
    required this.canEdit,
    required this.canDelete,
    required this.onMenu,
    this.onTap,
  });
  final Reward reward;
  final bool canEdit;
  final bool canDelete;
  final VoidCallback? onTap;
  final ValueChanged<String> onMenu;

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    final r = reward;
    final color = r.type.color;
    final hasMenu = canEdit || canDelete;
    return AdminCard(
      onTap: onTap,
      padding: const EdgeInsets.fromLTRB(14, 12, 4, 12),
      child: Opacity(
        opacity: r.isActive ? 1 : 0.65,
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(13),
              ),
              child: Icon(r.type.icon, size: 22, color: color),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    r.title,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14.5),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    r.benefitLabel,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(fontSize: 12.5, color: c.textDim),
                  ),
                  if (r.description != null) ...[
                    const SizedBox(height: 2),
                    Text(
                      r.description!,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(fontSize: 12, color: c.textFaint, height: 1.3),
                    ),
                  ],
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 6,
                    runSpacing: 6,
                    crossAxisAlignment: WrapCrossAlignment.center,
                    children: [
                      _TypePill(r.type),
                      if (!r.isActive) const MiniTag('Pausada', icon: Icons.pause_rounded),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Padding(
                  padding: EdgeInsets.only(right: hasMenu ? 0 : 10),
                  child: Text.rich(
                    TextSpan(
                      children: [
                        TextSpan(
                          text: '${r.costPoints}',
                          style: const TextStyle(
                            fontFamily: 'Orbitron',
                            fontWeight: FontWeight.w800,
                            fontSize: 17,
                            color: Brand.gold,
                          ),
                        ),
                        TextSpan(text: ' pts', style: TextStyle(fontSize: 11, color: c.textFaint)),
                      ],
                    ),
                  ),
                ),
                if (hasMenu)
                  PopupMenuButton<String>(
                    tooltip: 'Acciones de la recompensa',
                    padding: EdgeInsets.zero,
                    icon: Icon(Icons.more_vert_rounded, color: c.textDim),
                    onSelected: onMenu,
                    itemBuilder: (_) => [
                      if (canEdit)
                        const PopupMenuItem(value: 'edit', child: _MenuRow(Icons.edit_rounded, 'Editar')),
                      if (canEdit)
                        PopupMenuItem(
                          value: 'toggle',
                          child: _MenuRow(
                            r.isActive ? Icons.pause_circle_outline_rounded : Icons.play_circle_outline_rounded,
                            r.isActive ? 'Pausar' : 'Activar',
                          ),
                        ),
                      if (canDelete)
                        const PopupMenuItem(
                          value: 'delete',
                          child: _MenuRow(Icons.delete_outline_rounded, 'Eliminar', danger: true),
                        ),
                    ],
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _MenuRow extends StatelessWidget {
  const _MenuRow(this.icon, this.label, {this.danger = false});
  final IconData icon;
  final String label;
  final bool danger;

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    return Row(
      children: [
        Icon(icon, size: 19, color: danger ? Brand.danger : c.textDim),
        const SizedBox(width: 12),
        Flexible(child: Text(label, style: TextStyle(color: danger ? Brand.danger : c.text))),
      ],
    );
  }
}

class _TypePill extends StatelessWidget {
  const _TypePill(this.type);
  final RewardType type;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
        decoration: BoxDecoration(
          color: type.color.withValues(alpha: 0.15),
          borderRadius: BorderRadius.circular(99),
        ),
        child: Text(
          type.label,
          style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: type.color),
        ),
      );
}
