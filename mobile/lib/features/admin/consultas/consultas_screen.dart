import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../../core/providers.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/common.dart';
import '../../../core/widgets/file_attach.dart';
import '../../../core/widgets/modals.dart';
import '../../../core/widgets/photo_gallery.dart';
import '../../../core/widgets/photo_picker.dart';
import '../admin_module.dart';
import '../admin_widgets.dart';
import '../filamentos/shared_widgets.dart';
import 'consulta_answer_screen.dart';
import 'consulta_chat_screen.dart';
import 'consulta_form_screen.dart';
import 'consultas_api.dart';
import 'consultas_models.dart';
import 'consultas_widgets.dart';

/// Color de cada estado: lo que falta cotizar en amarillo, lo cotizado (espera
/// la seña) en azul, lo confirmado en verde y lo que no se hizo, apagado.
Color inquiryStatusColor(InquiryStatus s, HefestoColors c) => switch (s) {
      InquiryStatus.pending => Brand.warning,
      InquiryStatus.answered => Brand.info,
      InquiryStatus.confirmed => Brand.success,
      InquiryStatus.cancelled => c.textDim,
    };

IconData inquiryStatusIcon(InquiryStatus s) => switch (s) {
      InquiryStatus.pending => Icons.schedule_rounded,
      InquiryStatus.answered => Icons.mark_chat_read_rounded,
      InquiryStatus.confirmed => Icons.check_circle_rounded,
      InquiryStatus.cancelled => Icons.cancel_outlined,
    };

/// Consultas: atención al cliente carga lo que pregunta la gente y conversa
/// con el operador en el chat de la consulta; el operador crea la cotización
/// (ahí se arma el pedido en "pendiente de pago" y el mensaje para el
/// cliente); atención al cliente lo manda y, cuando el cliente seña, confirma
/// (el pedido pasa a confirmado) o marca que no se hizo. (Se abre desde "Más".)
class AdminConsultasScreen extends ConsumerWidget {
  const AdminConsultasScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final me = ref.watch(meProvider).value;
    final canCreate = me?.can('consultas', 'crear') ?? false;
    final data = ref.watch(consultasProvider);

    return AdminModuleScaffold(
      title: 'Consultas',
      permission: 'consultas',
      what: 'las consultas',
      actions: [
        IconButton(
          tooltip: 'Actualizar',
          icon: const Icon(Icons.refresh_rounded),
          onPressed: () => ref.invalidate(consultasProvider),
        ),
      ],
      // Con los datos cargados: el formulario necesita los topes de fotos y archivos.
      floatingActionButton: canCreate && data.hasValue
          ? FloatingActionButton.extended(
              heroTag: 'nueva-consulta',
              onPressed: () => _create(context, data.value!),
              icon: const Icon(Icons.add_rounded),
              label: const Text('Nueva consulta'),
            )
          : null,
      body: data.when(
        loading: () => const ListSkeleton(rows: 4, height: 150),
        error: (e, _) => ErrorView(message: '$e', onRetry: () => ref.invalidate(consultasProvider)),
        data: (d) => _ConsultasBody(data: d),
      ),
    );
  }
}

/// Abre el alta; al volver muestra el aviso que devuelve el formulario
/// ("Consulta cargada", o cuántas fotos o archivos no subieron).
Future<void> _create(BuildContext context, ConsultasData d) async {
  final notice = await Navigator.of(context).push<String>(
    MaterialPageRoute(
      builder: (_) => ConsultaFormScreen(maxImages: d.maxImages, maxFiles: d.maxFiles),
    ),
  );
  if (notice == null || !context.mounted) return;
  showToast(context, notice);
}

class _ConsultasBody extends ConsumerStatefulWidget {
  const _ConsultasBody({required this.data});
  final ConsultasData data;

  @override
  ConsumerState<_ConsultasBody> createState() => _ConsultasBodyState();
}

class _ConsultasBodyState extends ConsumerState<_ConsultasBody> {
  InquiryFilter _filter = InquiryFilter.open;

  /// Consulta con una acción en curso (sus botones se apagan).
  String? _busyId;

  Future<void> _refresh() async {
    ref.invalidate(consultasProvider);
    try {
      await ref.read(consultasProvider.future);
    } catch (_) {}
  }

  Future<void> _answer(Consulta q) async {
    final saved = await Navigator.of(context).push<bool>(
      MaterialPageRoute(builder: (_) => ConsultaAnswerScreen(consulta: q)),
    );
    if (saved == true && mounted) showToast(context, quoteCreatedNotice);
  }

  /// Abre el chat de la consulta. Al volver se pide de nuevo el listado: leer
  /// el chat lo marcó como leído y puede haber cambiado la cotización.
  Future<void> _chat(Consulta q) async {
    final container = ProviderScope.containerOf(context, listen: false);
    await Navigator.of(context).push<void>(
      MaterialPageRoute(builder: (_) => ConsultaChatScreen(consulta: q)),
    );
    invalidateConsultas(container);
  }

  /// Corre una acción sobre [q] y avisa cómo salió (abajo, como aviso breve).
  /// La acción devuelve el texto del aviso.
  Future<void> _run(
    Consulta q,
    Future<String> Function() action,
    String fallback, {
    void Function(ProviderContainer) refresh = invalidateConsultas,
  }) async {
    if (_busyId != null) return;
    final messenger = ScaffoldMessenger.of(context);
    final container = ProviderScope.containerOf(context, listen: false);
    setState(() => _busyId = q.id);
    String message;
    try {
      message = await action();
      refresh(container);
    } on ApiException catch (e) {
      message = e.message;
    } catch (_) {
      message = fallback;
    } finally {
      if (mounted) setState(() => _busyId = null);
    }
    messenger
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(message)));
  }

  /// "No se hizo" y "Reabrir" (confirmar va por su hoja: pide cómo paga). El
  /// pedido pendiente acompaña a la cotización: se cancela con "No se hizo" y
  /// vuelve a esperar el pago al reabrir, así que también se refresca Ventas.
  Future<void> _move(Consulta q, InquiryMove to) => _run(
        q,
        () async {
          await ref.read(consultasApiProvider).move(q.id, to);
          if (to == InquiryMove.reopen) return 'Consulta reabierta';
          return q.hasOrder || q.awaitingDeposit
              ? 'Quedó como "No se hizo" y se canceló el pedido pendiente'
              : 'Quedó como "No se hizo"';
        },
        'No pudimos cambiar el estado. Probá de nuevo.',
        refresh: invalidateConsultaConfirmed,
      );

  /// El cliente señó: el pedido pasa a confirmado. Se pregunta antes y se
  /// elige cómo pagó.
  Future<void> _confirm(Consulta q) async {
    if (_busyId != null) return;
    final ok = await showAppSheet<bool>(
      context,
      builder: (_) => ConfirmOrderSheet(consulta: q, data: widget.data),
    );
    if (ok == true && mounted) showToast(context, 'Confirmado: el pedido pasó a producción');
  }

  Future<void> _delete(Consulta q) async {
    if (_busyId != null) return;
    final extras = q.images.isNotEmpty || q.files.isNotEmpty;
    final ok = await confirmDialog(
      context,
      title: '¿Eliminar la consulta de ${q.customerName.isEmpty ? 'este cliente' : q.customerName}?',
      message: extras
          ? 'Se borran "${q.heading}" y sus adjuntos. No se puede deshacer.'
          : 'Se borra "${q.heading}". No se puede deshacer.',
      confirmLabel: 'Eliminar',
      destructive: true,
    );
    if (!ok || !mounted) return;
    await _run(
      q,
      () async {
        await ref.read(consultasApiProvider).delete(q.id);
        return 'Consulta eliminada';
      },
      'No pudimos eliminar la consulta. Probá de nuevo.',
    );
  }

  /// "Adjuntar" en una consulta abierta: elige qué sumar y lo sube en el momento.
  Future<void> _attach(Consulta q, {required bool photos}) async {
    if (_busyId != null) return;
    final what = await showAppSheet<AttachKind>(
      context,
      builder: (_) => AttachSheet(consulta: q, photos: photos),
    );
    if (what == null || !mounted) return;
    final d = widget.data;
    final isFile = what == AttachKind.file;
    final max = isFile ? d.maxFiles : d.maxImages;
    final room = max - (isFile ? q.files.length : q.images.length);
    if (room <= 0) {
      showToast(context, isFile ? 'Ya tiene el máximo de $max archivos.' : 'Ya tiene el máximo de $max fotos.');
      return;
    }
    final api = ref.read(consultasApiProvider);
    final photoSource = ref.read(photoSourceProvider);
    final fileSource = ref.read(attachmentSourceProvider);
    await _run(
      q,
      () async {
        // Motivo del servidor, para mostrarlo tal cual cuando falla uno solo.
        String? reason;
        void onError(Object e) => reason = e is ApiException ? e.message : null;
        final int total;
        final int failed;
        final String? skipped;
        if (isFile) {
          final res = filterAttachments(await fileSource.pick(), room: room, max: max);
          skipped = res.notice;
          total = res.ok.length;
          failed = await uploadOneByOne<PickedAttachment>(res.ok, (f) => api.addFile(q.id, f), onError: onError);
        } else {
          final picked = what == AttachKind.camera
              ? [?await photoSource.fromCamera()]
              : await photoSource.fromGallery();
          final res = filterPhotos(picked, room: room, max: max);
          skipped = res.notice;
          total = res.ok.length;
          failed = await uploadOneByOne<PickedPhoto>(res.ok, (p) => api.addImage(q.id, p), onError: onError);
        }
        if (total == 0) return skipped ?? 'No se adjuntó nada.';
        final done = total - failed;
        final String result;
        if (failed == 0) {
          result = isFile
              ? (done == 1 ? 'Archivo adjuntado' : '$done archivos adjuntados')
              : (done == 1 ? 'Foto adjuntada' : '$done fotos adjuntadas');
        } else if (total == 1 && reason != null) {
          result = reason!;
        } else {
          result = (isFile ? attachmentFailureNotice(failed, total) : uploadFailureNotice(failed, total))!;
        }
        return skipped == null ? result : '$result $skipped';
      },
      'No pudimos adjuntar. Probá de nuevo.',
    );
  }

  @override
  Widget build(BuildContext context) {
    final d = widget.data;
    final me = ref.watch(meProvider).value;
    final canEdit = me?.can('consultas', 'editar') ?? false;
    final canDelete = me?.can('consultas', 'eliminar') ?? false;
    final canCreate = me?.can('consultas', 'crear') ?? false;
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
                for (final (i, f) in InquiryFilter.values.indexed) ...[
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
                icon: Icons.forum_outlined,
                title: 'Todavía no hay consultas',
                subtitle: canCreate
                    ? 'Cuando un cliente pregunte por algo, cargalo acá con «Nueva consulta»: '
                        'lo charlás con el taller por el chat y te pasan la cotización.'
                    : 'Cuando atención al cliente cargue una consulta, aparece acá para cotizarla.',
              ),
            )
          else if (items.isEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 24),
              child: EmptyView(
                icon: _filter == InquiryFilter.open ? Icons.verified_rounded : Icons.inbox_outlined,
                title: _filter == InquiryFilter.open ? 'No hay consultas abiertas' : 'Nada en esta vista',
                subtitle: _filter == InquiryFilter.open
                    ? 'Todo cotizado y cerrado.'
                    : 'Probá con otro filtro.',
              ),
            )
          else
            for (final q in items) ...[
              _ConsultaCard(
                consulta: q,
                statusLabel: d.labelOf(q.status),
                busy: _busyId == q.id,
                // El chat: quien carga consultas o quien las cotiza (regla del servidor).
                onChat: canCreate || canEdit ? () => _chat(q) : null,
                // Crear / cambiar la cotización: el operador, mientras siga abierta.
                onAnswer: canEdit && q.isOpen ? () => _answer(q) : null,
                // Adjuntar mientras siga abierta: quien la cargó (con `crear`) o
                // quien puede responderla. Las fotos piden `crear` en el
                // servidor; un audio o archivo también lo sube quien responde.
                onAttach: q.isOpen && (canEdit || (canCreate && q.mine))
                    ? () => _attach(q, photos: canCreate)
                    : null,
                // Cerrar o reabrir: quien carga las consultas (atención al cliente).
                onConfirm: canCreate && q.status == InquiryStatus.answered ? () => _confirm(q) : null,
                onCancel: canCreate && q.isOpen ? () => _move(q, InquiryMove.cancel) : null,
                // Solo lo que no se hizo: una confirmada ya tiene su pedido en producción.
                onReopen: canCreate && q.canReopen ? () => _move(q, InquiryMove.reopen) : null,
                onDelete: q.deletableBy(canDelete: canDelete) ? () => _delete(q) : null,
              ),
              const SizedBox(height: 10),
            ],
        ],
      ),
    );
  }
}

class _ConsultaCard extends StatelessWidget {
  const _ConsultaCard({
    required this.consulta,
    required this.statusLabel,
    required this.busy,
    required this.onChat,
    required this.onAnswer,
    required this.onAttach,
    required this.onConfirm,
    required this.onCancel,
    required this.onReopen,
    required this.onDelete,
  });
  final Consulta consulta;
  final String statusLabel;
  final bool busy;
  final VoidCallback? onChat;
  final VoidCallback? onAnswer;
  final VoidCallback? onAttach;
  final VoidCallback? onConfirm;
  final VoidCallback? onCancel;
  final VoidCallback? onReopen;
  final VoidCallback? onDelete;

  Future<void> _openFile(BuildContext context, ConsultaFile f) async {
    // Fuera de la app (reproductor, visor de PDF del teléfono).
    final ok = await openUrl(f.url);
    if (!ok && context.mounted) showToast(context, 'No pudimos abrir el archivo.');
  }

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    final q = consulta;
    final loaded = q.createdAt == null
        ? 'Cargó ${q.author}'
        : 'Cargó ${q.author} · ${formatDateTime(q.createdAt!)}';
    final hasActions = onChat != null ||
        onAnswer != null ||
        onAttach != null ||
        onConfirm != null ||
        onCancel != null ||
        onReopen != null ||
        onDelete != null;
    VoidCallback? unlessBusy(VoidCallback? f) => busy ? null : f;

    return AdminCard(
      padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            q.heading.isEmpty ? 'Sin título' : q.heading,
            style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14.5, height: 1.25),
          ),
          const SizedBox(height: 8),
          if (q.status == InquiryStatus.confirmed && q.hasOrder)
            // Confirmada con pedido creado: se dice entero (en renglones si
            // hace falta), no en una píldora que lo cortaría.
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Padding(
                  padding: EdgeInsets.only(top: 1),
                  child: Icon(Icons.check_circle_rounded, size: 15, color: Brand.success),
                ),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    '$statusLabel · el pedido ya está en Pedidos',
                    style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: Brand.success),
                  ),
                ),
              ],
            )
          else
            TonePill(
              statusLabel,
              color: inquiryStatusColor(q.status, c),
              icon: inquiryStatusIcon(q.status),
            ),
          const SizedBox(height: 8),
          _IconLine(Icons.person_outline_rounded, q.customerName.isEmpty ? 'Sin nombre' : q.customerName),
          if (q.customerPhone != null) ...[
            const SizedBox(height: 3),
            _IconLine(Icons.phone_outlined, q.customerPhone!),
          ],
          const SizedBox(height: 4),
          Text(loaded, style: TextStyle(fontSize: 11.5, color: c.textFaint)),
          if (q.description.isNotEmpty) ...[
            const SizedBox(height: 8),
            ExpandableText(
              q.description,
              style: TextStyle(fontSize: 13.5, color: c.textDim, height: 1.4),
            ),
          ],
          if (q.images.isNotEmpty) ...[
            const SizedBox(height: 10),
            PhotoStrip(urls: q.images),
          ],
          // Audios, videos y PDF: se abren fuera de la app.
          for (final f in q.files) ...[
            const SizedBox(height: 8),
            AttachmentRow(
              icon: attachmentIcon(f.type),
              name: f.name,
              trailing: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 10),
                child: Icon(Icons.open_in_new_rounded, size: 18, color: c.textFaint),
              ),
              onTap: () => _openFile(context, f),
            ),
          ],
          if (q.awaitingDeposit) ...[
            const SizedBox(height: 10),
            PendingOrderBanner(consulta: q),
          ],
          if (q.message != null) ...[
            const SizedBox(height: 10),
            ConsultaMessageBlock(consulta: q),
          ],
          if (hasActions) ...[
            const SizedBox(height: 8),
            // Wrap: los botones que no entran en el renglón bajan al siguiente.
            Wrap(
              spacing: 8,
              runSpacing: 4,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                if (onConfirm != null)
                  FilledButton.icon(
                    onPressed: unlessBusy(onConfirm),
                    icon: const Icon(Icons.check_rounded, size: 18),
                    label: const Text('Señó · Confirmar pedido'),
                  ),
                if (onChat != null)
                  // El chat no espera a la acción en curso: es otra pantalla.
                  ConsultaChatButton(key: ValueKey('chat-${q.id}'), consulta: q, onPressed: onChat),
                if (onAnswer != null)
                  q.message == null
                      ? FilledButton.icon(
                          onPressed: unlessBusy(onAnswer),
                          icon: const Icon(Icons.request_quote_rounded, size: 18),
                          label: const Text('Crear cotización'),
                        )
                      : OutlinedButton.icon(
                          onPressed: unlessBusy(onAnswer),
                          icon: const Icon(Icons.edit_outlined, size: 18),
                          label: const Text('Cambiar cotización'),
                        ),
                if (onAttach != null)
                  OutlinedButton.icon(
                    onPressed: unlessBusy(onAttach),
                    icon: const Icon(Icons.attach_file_rounded, size: 18),
                    label: const Text('Adjuntar'),
                  ),
                if (onCancel != null)
                  OutlinedButton.icon(
                    onPressed: unlessBusy(onCancel),
                    icon: const Icon(Icons.close_rounded, size: 18),
                    label: const Text('No se hizo'),
                  ),
                if (onReopen != null)
                  OutlinedButton.icon(
                    onPressed: unlessBusy(onReopen),
                    icon: const Icon(Icons.undo_rounded, size: 18),
                    label: const Text('Reabrir'),
                  ),
                if (onDelete != null)
                  TextButton.icon(
                    onPressed: unlessBusy(onDelete),
                    style: TextButton.styleFrom(foregroundColor: Brand.danger),
                    icon: const Icon(Icons.delete_outline_rounded, size: 18),
                    label: const Text('Eliminar'),
                  ),
                if (busy)
                  const SizedBox(
                    width: 18,
                    height: 18,
                    child: AppSpinner(),
                  ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

/// Ícono chico + un dato (cliente, teléfono).
class _IconLine extends StatelessWidget {
  const _IconLine(this.icon, this.text);
  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(top: 2),
          child: Icon(icon, size: 15, color: c.textDim),
        ),
        const SizedBox(width: 6),
        Expanded(
          child: Text(text, style: TextStyle(fontSize: 13, color: c.text, fontWeight: FontWeight.w600)),
        ),
      ],
    );
  }
}

/// Texto de la hoja de confirmación: qué pedido se confirma y por cuánto.
String confirmOrderText(Consulta q) {
  final total = q.orderTotal;
  final amount = total == null ? '' : ', por ${formatConsultaMoney(total)}';
  return 'El cliente señó el pedido de ${q.customerName}: ${q.quantity} × ${q.title}$amount. '
      'El pedido pasa a confirmado y entra a la cola de impresión.';
}

/// Hoja de "Señó · Confirmar pedido": el pedido ya existe (pendiente de pago
/// desde la cotización) y acá pasa a confirmado y a la cola, así que se avisa
/// y se pregunta cómo pagó el cliente. Se cierra con `true` si confirmó.
class ConfirmOrderSheet extends ConsumerStatefulWidget {
  const ConfirmOrderSheet({super.key, required this.consulta, required this.data});
  final Consulta consulta;
  final ConsultasData data;

  @override
  ConsumerState<ConfirmOrderSheet> createState() => _ConfirmOrderSheetState();
}

class _ConfirmOrderSheetState extends ConsumerState<ConfirmOrderSheet> {
  // Por defecto el primero (transferencia), igual que el servidor.
  late String _method = widget.data.paymentMethods.first.$1;
  bool _saving = false;
  String? _error;

  Future<void> _confirm() async {
    if (_saving) return;
    final container = ProviderScope.containerOf(context, listen: false);
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await ref
          .read(consultasApiProvider)
          .move(widget.consulta.id, InquiryMove.confirm, paymentMethod: _method);
      // El pedido cambió de estado: además de las consultas, el inicio, Ventas y la cola.
      invalidateConsultaConfirmed(container);
      if (mounted) popIfCurrent(context, true);
    } on ApiException catch (e) {
      // En la hoja, no en un aviso: el aviso saldría DETRÁS de la hoja abierta.
      // (P. ej. si a la respuesta le falta el costo, o la consulta cambió.)
      if (mounted) setState(() => _error = e.message);
    } catch (_) {
      if (mounted) setState(() => _error = 'No pudimos confirmar. Probá de nuevo.');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    return SheetBody(
      title: 'Confirmar el pedido',
      footer: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (_error != null) ...[
            InlineError(_error!),
            const SizedBox(height: 10),
          ],
          GoldButton(
            label: 'Confirmar pedido',
            icon: Icons.check_rounded,
            loading: _saving,
            onPressed: _saving ? null : _confirm,
          ),
          const SizedBox(height: 4),
          TextButton(
            onPressed: _saving ? null : () => Navigator.of(context).pop(false),
            style: TextButton.styleFrom(minimumSize: const Size.fromHeight(46)),
            child: const Text('Todavía no'),
          ),
        ],
      ),
      children: [
        Text(
          confirmOrderText(widget.consulta),
          style: TextStyle(fontSize: 14, color: c.text, height: 1.45),
        ),
        const SizedBox(height: 18),
        const SectionLabel('¿Cómo paga?'),
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          runSpacing: 4,
          children: [
            for (final (key, label) in widget.data.paymentMethods)
              ChoiceChip(
                label: Text(label),
                selected: _method == key,
                onSelected: _saving ? null : (_) => setState(() => _method = key),
              ),
          ],
        ),
      ],
    );
  }
}

/// Qué se quiere adjuntar a una consulta abierta.
enum AttachKind { gallery, camera, file }

/// Hoja de "Adjuntar": foto de la galería, foto con la cámara, o audio /
/// archivo. Se cierra devolviendo lo elegido (la subida la hace el listado).
class AttachSheet extends StatelessWidget {
  const AttachSheet({super.key, required this.consulta, required this.photos});
  final Consulta consulta;

  /// ¿Puede sumar fotos? (piden `consultas/crear`; sin él, solo audio o archivo).
  final bool photos;

  @override
  Widget build(BuildContext context) {
    Widget option(AttachKind kind, IconData icon, String title, String subtitle) => ListTile(
          contentPadding: EdgeInsets.zero,
          leading: Icon(icon, color: Brand.gold),
          title: Text(title, style: const TextStyle(fontWeight: FontWeight.w600)),
          subtitle: Text(subtitle),
          onTap: () => Navigator.of(context).pop(kind),
        );
    return SheetBody(
      title: 'Adjuntar',
      subtitle: consulta.heading,
      children: [
        if (photos) ...[
          option(AttachKind.gallery, Icons.photo_library_outlined, 'Foto de la galería', 'Una o varias, ya guardadas en el teléfono'),
          option(AttachKind.camera, Icons.photo_camera_outlined, 'Sacar foto', 'Con la cámara, ahora'),
        ],
        option(AttachKind.file, Icons.attach_file_rounded, 'Audio o archivo', 'Audio, video corto o PDF (hasta 4 MB)'),
      ],
    );
  }
}
