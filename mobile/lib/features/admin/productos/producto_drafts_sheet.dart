import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/modals.dart';
import '../admin_widgets.dart';
import 'catalogo_ui.dart';
import 'producto_drafts.dart';
import 'producto_drafts_provider.dart';

/// Hoja "Borradores sin guardar": los productos que se empezaron a cargar y no
/// se llegaron a crear. Devuelve el que se eligió para continuar (null = se
/// cerró sin elegir).
Future<ProductDraft?> showProductDraftsSheet(BuildContext context) =>
    showAppSheet<ProductDraft>(context, builder: (_) => const _DraftsSheet());

class _DraftsSheet extends ConsumerWidget {
  const _DraftsSheet();

  Future<void> _delete(BuildContext context, WidgetRef ref, ProductDraft draft) async {
    final ok = await confirmDialog(
      context,
      title: '¿Eliminar este borrador?',
      message: 'Se pierde lo que habías cargado de "${draft.title}". No se puede deshacer.',
      confirmLabel: 'Eliminar borrador',
      destructive: true,
    );
    if (!ok || !context.mounted) return;
    ref.read(productDraftsProvider.notifier).remove(draft.id);
    // Sin borradores la hoja no tiene nada que mostrar.
    if (ref.read(productDraftsProvider).drafts.isEmpty) Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.hc;
    final drafts = ref.watch(productDraftsProvider).drafts;
    final now = DateTime.now();
    return SheetBody(
      title: 'Borradores sin guardar',
      subtitle: 'Productos que empezaste a cargar y todavía no creaste. '
          'Quedan guardados solo en este teléfono.',
      children: [
        for (final draft in drafts) ...[
          AdminCard(
            padding: const EdgeInsets.fromLTRB(14, 12, 10, 8),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  draft.title,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14.5, height: 1.25),
                ),
                const SizedBox(height: 2),
                Text(
                  [
                    'Guardado ${draftAgo(draft.updatedAt, now)}',
                    ?draft.fields.categoryLabel,
                  ].join(' · '),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(fontSize: 12, color: c.textDim, height: 1.3),
                ),
                const SizedBox(height: 6),
                // Wrap y no Row: con letra grande los dos botones no entran
                // lado a lado en un teléfono angosto.
                Align(
                  alignment: Alignment.centerRight,
                  child: Wrap(
                    spacing: 8,
                    runSpacing: 4,
                    alignment: WrapAlignment.end,
                    children: [
                      TextButton.icon(
                        onPressed: () => _delete(context, ref, draft),
                        icon: const Icon(Icons.delete_outline_rounded, size: 18),
                        label: const Text('Eliminar'),
                      ),
                      OutlinedButton.icon(
                        onPressed: () => Navigator.of(context).pop(draft),
                        icon: const Icon(Icons.edit_rounded, size: 18),
                        label: const Text('Continuar'),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 10),
        ],
      ],
    );
  }
}
