import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../../core/providers.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/common.dart';
import '../../../core/widgets/modals.dart';
import '../../../core/widgets/photo_gallery.dart';
import '../admin_module.dart';
import '../admin_widgets.dart';
import '../filamentos/shared_widgets.dart';
import 'arreglo_form_screen.dart';
import 'arreglos_api.dart';
import 'arreglos_models.dart';

/// Color de cada estado (el mismo criterio que el resto del panel: lo que
/// espera en amarillo, lo que avanza en azul, lo terminado en verde).
Color fixStatusColor(FixStatus s) => switch (s) {
      FixStatus.pending => Brand.warning,
      FixStatus.inProgress => Brand.info,
      FixStatus.done => Brand.success,
    };

IconData fixStatusIcon(FixStatus s) => switch (s) {
      FixStatus.pending => Icons.schedule_rounded,
      FixStatus.inProgress => Icons.build_rounded,
      FixStatus.done => Icons.check_circle_rounded,
    };

/// Arreglos: lo que el equipo pide arreglar o mejorar (de la app, de la web o
/// del taller), con fotos, y la respuesta del dueño. (Se abre desde "Más".)
class AdminArreglosScreen extends ConsumerWidget {
  const AdminArreglosScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final me = ref.watch(meProvider).value;
    final canCreate = me?.can('arreglos', 'crear') ?? false;
    final data = ref.watch(arreglosProvider);

    return AdminModuleScaffold(
      title: 'Arreglos',
      permission: 'arreglos',
      what: 'los arreglos',
      actions: [
        IconButton(
          tooltip: 'Actualizar',
          icon: const Icon(Icons.refresh_rounded),
          onPressed: () => ref.invalidate(arreglosProvider),
        ),
      ],
      // Con los datos cargados: el formulario necesita el tope de fotos.
      floatingActionButton: canCreate && data.hasValue
          ? FloatingActionButton.extended(
              heroTag: 'nuevo-arreglo',
              onPressed: () => _create(context, data.value!.maxImages),
              icon: const Icon(Icons.add_rounded),
              label: const Text('Nuevo arreglo'),
            )
          : null,
      body: data.when(
        loading: () => const ListSkeleton(rows: 4, height: 130),
        error: (e, _) => ErrorView(message: '$e', onRetry: () => ref.invalidate(arreglosProvider)),
        data: (d) => _ArreglosBody(data: d),
      ),
    );
  }
}

/// Abre el alta; al volver muestra el aviso que devuelve el formulario
/// ("Arreglo cargado", o cuántas fotos no subieron).
Future<void> _create(BuildContext context, int maxImages) async {
  final notice = await Navigator.of(context).push<String>(
    MaterialPageRoute(builder: (_) => ArregloFormScreen(maxImages: maxImages)),
  );
  if (notice == null || !context.mounted) return;
  showToast(context, notice);
}

class _ArreglosBody extends ConsumerStatefulWidget {
  const _ArreglosBody({required this.data});
  final ArreglosData data;

  @override
  ConsumerState<_ArreglosBody> createState() => _ArreglosBodyState();
}

class _ArreglosBodyState extends ConsumerState<_ArreglosBody> {
  FixFilter _filter = FixFilter.open;

  /// Arreglo que se está borrando (su botón muestra el círculo).
  String? _deletingId;

  Future<void> _refresh() async {
    ref.invalidate(arreglosProvider);
    try {
      await ref.read(arreglosProvider.future);
    } catch (_) {}
  }

  Future<void> _reply(Arreglo a) async {
    final saved = await showAppSheet<bool>(
      context,
      builder: (_) => ArregloReplySheet(arreglo: a, data: widget.data),
    );
    if (saved == true && mounted) showToast(context, 'Arreglo actualizado');
  }

  Future<void> _delete(Arreglo a) async {
    if (_deletingId != null) return;
    final ok = await confirmDialog(
      context,
      title: '¿Eliminar "${a.title}"?',
      message: a.images.isEmpty
          ? 'Se borra el arreglo. No se puede deshacer.'
          : 'Se borran el arreglo y sus fotos. No se puede deshacer.',
      confirmLabel: 'Eliminar',
      destructive: true,
    );
    if (!ok || !mounted) return;
    final messenger = ScaffoldMessenger.of(context);
    final container = ProviderScope.containerOf(context, listen: false);
    setState(() => _deletingId = a.id);
    String message;
    try {
      await ref.read(arreglosApiProvider).delete(a.id);
      invalidateArreglos(container);
      message = 'Arreglo eliminado';
    } on ApiException catch (e) {
      message = e.message;
    } catch (_) {
      message = 'No pudimos eliminar el arreglo. Probá de nuevo.';
    } finally {
      if (mounted) setState(() => _deletingId = null);
    }
    messenger
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(message)));
  }

  @override
  Widget build(BuildContext context) {
    final d = widget.data;
    final me = ref.watch(meProvider).value;
    final canEdit = me?.can('arreglos', 'editar') ?? false;
    final canDelete = me?.can('arreglos', 'eliminar') ?? false;
    final canCreate = me?.can('arreglos', 'crear') ?? false;
    final items = d.items.where(_filter.matches).toList();

    return RefreshIndicator(
      color: Brand.gold,
      onRefresh: _refresh,
      child: ListView(
        // 96 = lugar para el botón flotante.
        padding: const EdgeInsets.fromLTRB(16, 4, 16, 96),
        children: [
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: [
                for (final (i, f) in FixFilter.values.indexed) ...[
                  if (i > 0) const SizedBox(width: 8),
                  ChoiceChip(
                    label: Text('${f.label} (${d.count(f)})'),
                    selected: _filter == f,
                    onSelected: (_) => setState(() => _filter = f),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(height: 14),
          if (d.items.isEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 24),
              child: EmptyView(
                icon: Icons.build_circle_outlined,
                title: 'Todavía no hay arreglos',
                subtitle: canCreate
                    ? 'Cuando algo no funcione o se pueda mejorar, cargalo acá con «Nuevo arreglo».'
                    : 'Cuando el equipo cargue algo para arreglar, aparece acá.',
              ),
            )
          else if (items.isEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 24),
              child: EmptyView(
                icon: _filter == FixFilter.open ? Icons.verified_rounded : Icons.inbox_outlined,
                title: _filter == FixFilter.open ? '¡Todo resuelto!' : 'Nada en esta vista',
                subtitle: _filter == FixFilter.open
                    ? 'No queda nada por arreglar.'
                    : 'Probá con otro filtro.',
              ),
            )
          else
            for (final a in items) ...[
              _ArregloCard(
                arreglo: a,
                statusLabel: d.labelOf(a.status),
                onReply: canEdit ? () => _reply(a) : null,
                onDelete: a.deletableBy(canDelete: canDelete) ? () => _delete(a) : null,
                deleting: _deletingId == a.id,
              ),
              const SizedBox(height: 10),
            ],
        ],
      ),
    );
  }
}

class _ArregloCard extends StatelessWidget {
  const _ArregloCard({
    required this.arreglo,
    required this.statusLabel,
    required this.onReply,
    required this.onDelete,
    required this.deleting,
  });
  final Arreglo arreglo;
  final String statusLabel;
  final VoidCallback? onReply;
  final VoidCallback? onDelete;
  final bool deleting;

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    final a = arreglo;
    final when = a.createdAt == null ? a.author : '${a.author} · ${formatDateTime(a.createdAt!)}';
    return AdminCard(
      accent: a.showUrgent ? Brand.danger : null,
      padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            a.title.isEmpty ? 'Sin título' : a.title,
            style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14.5, height: 1.25),
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 6,
            runSpacing: 6,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              TonePill(statusLabel, color: fixStatusColor(a.status), icon: fixStatusIcon(a.status)),
              if (a.showUrgent)
                const TonePill('Urgente', color: Brand.danger, icon: Icons.priority_high_rounded),
            ],
          ),
          const SizedBox(height: 6),
          Text(when, style: TextStyle(fontSize: 11.5, color: c.textFaint)),
          if (a.description.isNotEmpty) ...[
            const SizedBox(height: 8),
            ExpandableText(
              a.description,
              style: TextStyle(fontSize: 13.5, color: c.textDim, height: 1.4),
            ),
          ],
          if (a.images.isNotEmpty) ...[
            const SizedBox(height: 10),
            PhotoStrip(urls: a.images),
          ],
          if (a.ownerNote != null) ...[
            const SizedBox(height: 10),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: c.surface2,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: c.border),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const SectionLabel('Respuesta'),
                  const SizedBox(height: 6),
                  ExpandableText(
                    a.ownerNote!,
                    style: TextStyle(fontSize: 13.5, color: c.text, height: 1.4),
                  ),
                ],
              ),
            ),
          ],
          if (onReply != null || onDelete != null) ...[
            const SizedBox(height: 8),
            // Wrap: con letra grande en un teléfono angosto "Eliminar" baja de renglón.
            Wrap(
              spacing: 8,
              runSpacing: 4,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                if (onReply != null)
                  OutlinedButton.icon(
                    onPressed: deleting ? null : onReply,
                    icon: const Icon(Icons.reply_rounded, size: 18),
                    label: const Text('Responder / cambiar estado'),
                  ),
                if (onDelete != null)
                  TextButton.icon(
                    onPressed: deleting ? null : onDelete,
                    style: TextButton.styleFrom(foregroundColor: Brand.danger),
                    icon: deleting
                        ? const SizedBox(
                            width: 16,
                            height: 16,
                            child: AppSpinner(color: Brand.danger),
                          )
                        : const Icon(Icons.delete_outline_rounded, size: 18),
                    label: const Text('Eliminar'),
                  ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

/// Hoja del dueño: en qué estado queda el arreglo y qué responde.
/// Se cierra con `true` si guardó.
class ArregloReplySheet extends ConsumerStatefulWidget {
  const ArregloReplySheet({super.key, required this.arreglo, required this.data});
  final Arreglo arreglo;
  final ArreglosData data;

  @override
  ConsumerState<ArregloReplySheet> createState() => _ArregloReplySheetState();
}

class _ArregloReplySheetState extends ConsumerState<ArregloReplySheet> {
  late FixStatus _status = widget.arreglo.status;
  late final _note = TextEditingController(text: widget.arreglo.ownerNote ?? '');
  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    _note.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (_saving) return;
    if (_note.text.trim().length > 2000) {
      setState(() => _error = 'La respuesta puede tener hasta 2000 letras.');
      return;
    }
    final container = ProviderScope.containerOf(context, listen: false);
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await ref.read(arreglosApiProvider).update(widget.arreglo.id, _status, _note.text);
      invalidateArreglos(container);
      if (mounted) popIfCurrent(context, true);
    } on ApiException catch (e) {
      // En la hoja, no en un aviso: el aviso saldría DETRÁS de la hoja abierta.
      if (mounted) setState(() => _error = e.message);
    } catch (_) {
      if (mounted) setState(() => _error = 'No pudimos guardar. Probá de nuevo.');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return SheetBody(
      title: 'Responder / cambiar estado',
      subtitle: widget.arreglo.title,
      footer: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (_error != null) ...[
            InlineError(_error!),
            const SizedBox(height: 10),
          ],
          GoldButton(
            label: 'Guardar',
            icon: Icons.check_rounded,
            loading: _saving,
            onPressed: _saving ? null : _save,
          ),
        ],
      ),
      children: [
        const SectionLabel('Estado'),
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          runSpacing: 4,
          children: [
            for (final s in FixStatus.values)
              ChoiceChip(
                avatar: Icon(fixStatusIcon(s), size: 16, color: fixStatusColor(s)),
                label: Text(widget.data.labelOf(s)),
                selected: _status == s,
                onSelected: _saving ? null : (_) => setState(() => _status = s),
              ),
          ],
        ),
        const SizedBox(height: 16),
        TextField(
          controller: _note,
          enabled: !_saving,
          minLines: 3,
          maxLines: 6,
          maxLength: 2000,
          textCapitalization: TextCapitalization.sentences,
          onChanged: (_) {
            if (_error != null) setState(() => _error = null);
          },
          decoration: const InputDecoration(
            labelText: 'Respuesta (opcional)',
            hintText: 'Qué se hizo, o qué falta para resolverlo…',
            alignLabelWithHint: true,
          ),
        ),
      ],
    );
  }
}
