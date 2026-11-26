import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/providers.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/common.dart';
import '../../../core/widgets/file_attach.dart';
import '../../../core/widgets/modals.dart';
import '../../../core/widgets/photo_gallery.dart';
import '../../../core/widgets/photo_picker.dart';
import '../admin_widgets.dart';
import '../filamentos/shared_widgets.dart';
import 'consulta_answer_screen.dart';
import 'consulta_chat.dart';
import 'consultas_api.dart';
import 'consultas_models.dart';
import 'consultas_screen.dart' show inquiryStatusColor, inquiryStatusIcon;
import 'consultas_widgets.dart';

/// Lo que se le avisa a quien cotiza cuando la cotización queda guardada.
const quoteCreatedNotice = 'Cotización creada: el pedido quedó pendiente de pago';

/// "14:03"
String chatTime(DateTime d) => '${d.hour.toString().padLeft(2, '0')}:${d.minute.toString().padLeft(2, '0')}';

/// Rótulo del separador de día: "Hoy", "Ayer" o "miércoles 25 de noviembre".
String chatDayLabel(DateTime day, {DateTime? now}) {
  final today = DateUtils.dateOnly(now ?? DateTime.now());
  final d = DateUtils.dateOnly(day);
  if (d == today) return 'Hoy';
  if (d == today.subtract(const Duration(days: 1))) return 'Ayer';
  return formatLongDay(d);
}

/// Chat en vivo de una consulta (pedido de Ale, 2026-11-25): la vendedora y el
/// operador se escriben acá, con texto y fotos, hasta dejar definido lo que
/// quiere el cliente. Después el operador toca "Crear cotización" y el pedido
/// queda en pendiente de pago.
class ConsultaChatScreen extends ConsumerStatefulWidget {
  const ConsultaChatScreen({super.key, required this.consulta});
  final Consulta consulta;

  @override
  ConsumerState<ConsultaChatScreen> createState() => _ConsultaChatScreenState();
}

class _ConsultaChatScreenState extends ConsumerState<ConsultaChatScreen> {
  final _text = TextEditingController();
  final _scroll = ScrollController();
  late final AppLifecycleListener _lifecycle;

  /// Foto elegida para el próximo mensaje (va con o sin texto).
  PickedPhoto? _photo;

  /// Llegó algo nuevo mientras se leían mensajes viejos: se ofrece bajar.
  bool _newBelow = false;

  /// Una llave por mensaje, para saber dónde quedó dibujado cada globo.
  final _bubbleKeys = <String, GlobalKey>{};

  String get _id => widget.consulta.id;
  ConsultaChatController get _chat => ref.read(consultaChatProvider(_id).notifier);

  @override
  void initState() {
    super.initState();
    // En segundo plano no se piden novedades; al volver, enseguida.
    _lifecycle = AppLifecycleListener(
      onStateChange: (state) {
        if (state == AppLifecycleState.resumed) {
          _chat.resume();
        } else {
          _chat.pause();
        }
      },
    );
    _text.addListener(_onTyped);
    _scroll.addListener(_onScrolled);
  }

  @override
  void dispose() {
    _lifecycle.dispose();
    _text.dispose();
    _scroll.dispose();
    super.dispose();
  }

  // El botón de enviar se prende y se apaga según haya algo escrito.
  void _onTyped() => setState(() {});

  /// La lista va al revés (lo último abajo): 0 = el final de la conversación.
  bool get _atBottom => !_scroll.hasClients || _scroll.position.pixels < 80;

  void _onScrolled() {
    if (_newBelow && _atBottom) setState(() => _newBelow = false);
  }

  void _toBottom({bool animate = true}) {
    if (!_scroll.hasClients) return;
    if (animate) {
      _scroll.animateTo(0, duration: const Duration(milliseconds: 220), curve: Curves.easeOut);
    } else {
      _scroll.jumpTo(0);
    }
    if (_newBelow) setState(() => _newBelow = false);
  }

  /// Algo se sumó al chat. Si se está mirando el final (o lo mandó uno mismo),
  /// se baja a lo nuevo; si se están leyendo mensajes viejos, la lista queda
  /// donde estaba y aparece "Mensajes nuevos".
  void _onChatChanged(ConsultaChatState? before, ConsultaChatState now) {
    final sentMine = now.outbox.length > (before?.outbox.length ?? 0);
    final arrived = now.messages.length > (before?.messages.length ?? 0);
    if (!sentMine && !arrived) return;
    if (!_scroll.hasClients) return;
    if (sentMine || _atBottom) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _toBottom();
      });
      return;
    }
    // Un envío propio que terminó solo cambia "enviando…" por la hora: la
    // lista no crece y no hay nada que acomodar.
    if ((before?.outbox.length ?? 0) != now.outbox.length) return;
    // Lo nuevo entra por abajo y puede empujar lo que se estaba leyendo: se
    // toma un mensaje que está en pantalla y, ya dibujado lo nuevo, se lo
    // devuelve al mismo lugar.
    final anchor = _visibleMessage();
    final was = anchor?.localToGlobal(Offset.zero).dy;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted || !_scroll.hasClients) return;
      if (anchor != null && was != null && anchor.attached) {
        final moved = was - anchor.localToGlobal(Offset.zero).dy;
        if (moved.abs() > 0.5) _scroll.jumpTo(_scroll.position.pixels + moved);
      }
      if (!_newBelow) setState(() => _newBelow = true);
    });
  }

  /// El globo ya dibujado que está más cerca del medio de la pantalla.
  RenderBox? _visibleMessage() {
    final screen = context.findRenderObject();
    if (screen is! RenderBox || !screen.hasSize) return null;
    final middle = screen.localToGlobal(Offset(0, screen.size.height / 2)).dy;
    RenderBox? best;
    var bestDistance = double.infinity;
    for (final key in _bubbleKeys.values) {
      final box = key.currentContext?.findRenderObject();
      if (box is! RenderBox || !box.attached || !box.hasSize) continue;
      final distance = (box.localToGlobal(Offset.zero).dy - middle).abs();
      if (distance < bestDistance) {
        best = box;
        bestDistance = distance;
      }
    }
    return best;
  }

  Future<void> _pickPhoto() async {
    final res = await pickOnePhoto(context, ref, title: 'Mandar una foto');
    if (!mounted) return;
    if (res.error != null) {
      showToast(context, res.error!);
    } else if (res.photo != null) {
      setState(() => _photo = res.photo);
    }
  }

  void _send() {
    final text = _text.text.trim();
    final photo = _photo;
    if (text.isEmpty && photo == null) return;
    _chat.send(text, photo: photo);
    _text.clear();
    setState(() => _photo = null);
  }

  /// La consulta al día: si el listado ya se volvió a pedir (p. ej. después de
  /// cotizar), se usa esa; si no, la que abrió la pantalla.
  ({Consulta consulta, String statusLabel}) _current() {
    final data = ref.watch(consultasProvider).value;
    final q = data?.items.where((i) => i.id == _id).firstOrNull ?? widget.consulta;
    return (consulta: q, statusLabel: data?.labelOf(q.status) ?? q.status.defaultLabel);
  }

  void _summary(Consulta q, String statusLabel) {
    FocusManager.instance.primaryFocus?.unfocus();
    showAppSheet<void>(
      context,
      builder: (_) => ConsultaSummarySheet(consulta: q, statusLabel: statusLabel),
    );
  }

  Future<void> _quote(Consulta q) async {
    FocusManager.instance.primaryFocus?.unfocus();
    final saved = await Navigator.of(context).push<bool>(
      MaterialPageRoute(builder: (_) => ConsultaAnswerScreen(consulta: q)),
    );
    if (saved == true && mounted) showToast(context, quoteCreatedNotice);
  }

  void _openPhoto(List<String> urls, String url) {
    final i = urls.indexOf(url);
    Navigator.of(context, rootNavigator: true).push<void>(
      MaterialPageRoute(builder: (_) => PhotoViewerScreen(urls: urls, initial: i < 0 ? 0 : i)),
    );
  }

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    final (consulta: q, :statusLabel) = _current();
    final chat = ref.watch(consultaChatProvider(_id));
    ref.listen(consultaChatProvider(_id), _onChatChanged);
    final me = ref.watch(meProvider).value;
    final canEdit = me?.can('consultas', 'editar') ?? false;
    final keyboardOpen = MediaQuery.viewInsetsOf(context).bottom > 0;
    final customer = q.customerName.isEmpty ? 'Sin nombre' : q.customerName;
    final canSend = chat.loadError == null && (_text.text.trim().isNotEmpty || _photo != null);

    return Scaffold(
      appBar: AppBar(
        titleSpacing: 0,
        // Tocar el encabezado abre el resumen de la consulta.
        title: InkWell(
          onTap: () => _summary(q, statusLabel),
          borderRadius: BorderRadius.circular(10),
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 4, horizontal: 4),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  customer,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: c.text, height: 1.2),
                ),
                Text(
                  q.heading.isEmpty ? 'Sin título' : q.heading,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(fontSize: 12, fontWeight: FontWeight.w500, color: c.textDim, height: 1.25),
                ),
              ],
            ),
          ),
        ),
        actions: [
          IconButton(
            tooltip: 'Ver la consulta',
            icon: const Icon(Icons.info_outline_rounded),
            onPressed: () => _summary(q, statusLabel),
          ),
        ],
      ),
      body: SafeArea(
        child: Column(
          children: [
            // Con el teclado abierto el lugar es para la conversación.
            if (!keyboardOpen && q.isOpen && (canEdit || q.awaitingDeposit))
              _QuoteBar(consulta: q, onQuote: canEdit ? () => _quote(q) : null),
            Expanded(
              child: Stack(
                children: [
                  Positioned.fill(child: _conversation(chat)),
                  if (_newBelow)
                    Positioned(
                      bottom: 8,
                      left: 0,
                      right: 0,
                      child: Center(
                        child: FilledButton.tonalIcon(
                          onPressed: _toBottom,
                          icon: const Icon(Icons.arrow_downward_rounded, size: 18),
                          label: const Text('Mensajes nuevos'),
                        ),
                      ),
                    ),
                ],
              ),
            ),
            _InputBar(
              controller: _text,
              maxLength: chat.maxLength,
              photo: _photo,
              onPickPhoto: _pickPhoto,
              onRemovePhoto: () => setState(() => _photo = null),
              onSend: canSend ? _send : null,
            ),
          ],
        ),
      ),
    );
  }

  Widget _conversation(ConsultaChatState chat) {
    if (chat.loading) return const Center(child: SizedBox.square(dimension: 26, child: AppSpinner()));
    if (chat.loadError != null) return ErrorView(message: chat.loadError!, onRetry: _chat.retry);
    if (chat.isEmpty) {
      return const EmptyView(
        icon: Icons.forum_outlined,
        title: 'Todavía no hay mensajes.',
        subtitle: 'Escribile al equipo por acá.',
      );
    }

    // De arriba hacia abajo: separador de cada día, mensajes y, al final, lo
    // que se está mandando.
    final entries = <Widget>[];
    final photos = [
      for (final m in chat.messages)
        if (m.image != null) m.image!,
    ];
    ChatMessage? previous;
    for (final m in chat.messages) {
      final at = m.createdAt;
      final newDay = at != null &&
          (previous?.createdAt == null || !DateUtils.isSameDay(previous!.createdAt, at));
      if (newDay) entries.add(_DaySeparator(chatDayLabel(at)));
      entries.add(_MessageBubble(
        key: _bubbleKeys.putIfAbsent(m.id, () => GlobalKey(debugLabel: 'msg-${m.id}')),
        mine: m.mine,
        // El nombre, una vez por tanda de mensajes de la misma persona.
        author: m.mine || (!newDay && previous != null && !previous.mine && previous.author == m.author)
            ? null
            : m.author,
        body: m.body,
        photo: m.image == null
            ? null
            : Semantics(
                button: true,
                label: 'Foto de ${m.mine ? 'tu mensaje' : m.author}',
                child: GestureDetector(
                  onTap: () => _openPhoto(photos, m.image!),
                  child: SizedBox.square(dimension: _photoSize, child: NetImage(m.image!, radius: 10)),
                ),
              ),
        footer: Text(
          at == null ? '' : chatTime(at),
          style: TextStyle(fontSize: 10.5, color: context.hc.textFaint),
        ),
      ));
      previous = m;
    }
    for (final o in chat.outbox) {
      entries.add(_OutgoingBubble(
        key: ValueKey('out-${o.localId}'),
        message: o,
        onRetry: () => _chat.retrySend(o.localId),
        onDiscard: () => _chat.discard(o.localId),
      ));
    }

    // Al revés (lo último abajo, pegado a la barra de escribir: así el teclado
    // no lo tapa) y, si la conversación es corta, arrancando desde arriba.
    return Align(
      alignment: Alignment.topCenter,
      child: ListView.builder(
        controller: _scroll,
        reverse: true,
        shrinkWrap: true,
        padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
        itemCount: entries.length,
        itemBuilder: (_, i) => entries[entries.length - 1 - i],
      ),
    );
  }
}

const double _photoSize = 190;

/// Franja de arriba del chat: el pedido pendiente de pago (si ya se cotizó) y,
/// para quien cotiza, el botón de crear o cambiar la cotización.
class _QuoteBar extends StatelessWidget {
  const _QuoteBar({required this.consulta, required this.onQuote});
  final Consulta consulta;

  /// Null = quien mira no cotiza (solo ve el aviso del pedido).
  final VoidCallback? onQuote;

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    final q = consulta;
    final quoted = q.awaitingDeposit;
    final total = q.orderTotal;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(14, 10, 14, 12),
      decoration: BoxDecoration(
        color: c.surface1,
        border: Border(bottom: BorderSide(color: c.border)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (quoted)
            Row(
              children: [
                const Icon(Icons.hourglass_top_rounded, size: 16, color: Brand.info),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    total == null
                        ? 'Pedido pendiente de pago'
                        : 'Pedido pendiente de pago · ${formatConsultaMoney(total)}',
                    style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: c.text),
                  ),
                ),
              ],
            )
          else
            Text(
              'Cuando esté todo definido, creá la cotización: el pedido queda en pendiente de pago.',
              style: TextStyle(fontSize: 12.5, color: c.textDim, height: 1.35),
            ),
          if (onQuote != null) ...[
            const SizedBox(height: 10),
            GoldButton(
              label: quoted ? 'Cambiar cotización' : 'Crear cotización',
              icon: Icons.request_quote_rounded,
              onPressed: onQuote,
            ),
          ],
        ],
      ),
    );
  }
}

class _DaySeparator extends StatelessWidget {
  const _DaySeparator(this.label);
  final String label;

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Center(
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
          decoration: BoxDecoration(
            color: c.surface2,
            borderRadius: BorderRadius.circular(999),
            border: Border.all(color: c.border),
          ),
          child: Text(
            label,
            style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w600, color: c.textDim),
          ),
        ),
      ),
    );
  }
}

/// Un globo del chat: los propios a la derecha, los del resto a la izquierda
/// con el nombre de quien escribió.
class _MessageBubble extends StatelessWidget {
  const _MessageBubble({
    super.key,
    required this.mine,
    required this.body,
    required this.footer,
    this.author,
    this.photo,
    this.below,
  });

  final bool mine;
  final String? author;
  final String body;
  final Widget? photo;

  /// Renglón chico de abajo: la hora, "enviando…" o por qué no salió.
  final Widget footer;

  /// Debajo del globo (los botones de un mensaje que no salió).
  final Widget? below;

  Future<void> _copy(BuildContext context) async {
    await Clipboard.setData(ClipboardData(text: body));
    if (context.mounted) showToast(context, 'Mensaje copiado');
  }

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    final width = MediaQuery.sizeOf(context).width;
    const round = Radius.circular(16);
    const tail = Radius.circular(4);
    return Padding(
      padding: EdgeInsets.only(top: author != null ? 8 : 3, bottom: 3),
      child: Column(
        crossAxisAlignment: mine ? CrossAxisAlignment.end : CrossAxisAlignment.start,
        children: [
          ConstrainedBox(
            constraints: BoxConstraints(maxWidth: width * 0.8),
            // Mantener apretado copia el texto (una medida, un color).
            child: GestureDetector(
              onLongPress: body.isEmpty ? null : () => _copy(context),
              child: Container(
              padding: const EdgeInsets.fromLTRB(10, 8, 10, 6),
              decoration: BoxDecoration(
                color: mine ? Brand.gold.withValues(alpha: 0.16) : c.surface2,
                border: Border.all(color: mine ? Brand.gold.withValues(alpha: 0.38) : c.border),
                borderRadius: BorderRadius.only(
                  topLeft: round,
                  topRight: round,
                  bottomLeft: mine ? round : tail,
                  bottomRight: mine ? tail : round,
                ),
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (author != null) ...[
                    Text(
                      author!,
                      style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Brand.gold),
                    ),
                    const SizedBox(height: 3),
                  ],
                  if (photo != null) ...[
                    photo!,
                    SizedBox(height: body.isEmpty ? 4 : 6),
                  ],
                  if (body.isNotEmpty)
                    Text(body, style: TextStyle(fontSize: 14, color: c.text, height: 1.35)),
                  const SizedBox(height: 2),
                  Align(alignment: Alignment.centerRight, widthFactor: 1, child: footer),
                ],
              ),
            ),
            ),
          ),
          ?below,
        ],
      ),
    );
  }
}

/// Un mensaje propio que todavía no está en el servidor: "enviando…" o, si no
/// salió, el motivo con "Reintentar" y "Descartar".
class _OutgoingBubble extends StatelessWidget {
  const _OutgoingBubble({super.key, required this.message, required this.onRetry, required this.onDiscard});
  final OutgoingMessage message;
  final VoidCallback onRetry;
  final VoidCallback onDiscard;

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    final o = message;
    final color = o.failed ? Brand.danger : c.textFaint;
    return _MessageBubble(
      mine: true,
      body: o.body,
      photo: o.photo == null
          ? null
          : Opacity(
              opacity: o.failed ? 1 : 0.6,
              child: ClipRRect(
                borderRadius: BorderRadius.circular(10),
                child: Image.memory(
                  o.photo!.bytes,
                  width: _photoSize,
                  height: _photoSize,
                  fit: BoxFit.cover,
                  gaplessPlayback: true,
                ),
              ),
            ),
      footer: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(o.failed ? Icons.error_outline_rounded : Icons.schedule_rounded, size: 12, color: color),
          const SizedBox(width: 4),
          Flexible(
            child: Text(
              o.failed ? (o.error ?? 'No se envió') : 'enviando…',
              style: TextStyle(fontSize: 10.5, color: color, fontWeight: o.failed ? FontWeight.w600 : null),
            ),
          ),
        ],
      ),
      below: o.failed
          ? Wrap(
              alignment: WrapAlignment.end,
              children: [
                TextButton.icon(
                  onPressed: onRetry,
                  icon: const Icon(Icons.refresh_rounded, size: 18),
                  label: const Text('Reintentar'),
                ),
                TextButton(onPressed: onDiscard, child: const Text('Descartar')),
              ],
            )
          : null,
    );
  }
}

/// Barra de escribir, pegada arriba del teclado: foto, texto y enviar.
class _InputBar extends StatelessWidget {
  const _InputBar({
    required this.controller,
    required this.maxLength,
    required this.photo,
    required this.onPickPhoto,
    required this.onRemovePhoto,
    required this.onSend,
  });

  final TextEditingController controller;
  final int maxLength;
  final PickedPhoto? photo;
  final VoidCallback onPickPhoto;
  final VoidCallback onRemovePhoto;
  final VoidCallback? onSend;

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    return Container(
      decoration: BoxDecoration(
        color: c.surface1,
        border: Border(top: BorderSide(color: c.border)),
      ),
      padding: const EdgeInsets.fromLTRB(4, 6, 6, 6),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (photo != null)
            Padding(
              padding: const EdgeInsets.fromLTRB(8, 2, 0, 6),
              child: Row(
                children: [
                  ClipRRect(
                    borderRadius: BorderRadius.circular(8),
                    child: Image.memory(photo!.bytes, width: 48, height: 48, fit: BoxFit.cover),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      'Foto lista para mandar',
                      style: TextStyle(fontSize: 12.5, color: c.textDim),
                    ),
                  ),
                  IconButton(
                    tooltip: 'Quitar la foto',
                    icon: const Icon(Icons.close_rounded),
                    onPressed: onRemovePhoto,
                  ),
                ],
              ),
            ),
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              IconButton(
                tooltip: 'Mandar una foto',
                icon: const Icon(Icons.photo_camera_outlined),
                onPressed: onPickPhoto,
              ),
              Expanded(
                child: TextField(
                  key: const Key('chat-input'),
                  controller: controller,
                  minLines: 1,
                  maxLines: 4,
                  keyboardType: TextInputType.multiline,
                  textCapitalization: TextCapitalization.sentences,
                  inputFormatters: [LengthLimitingTextInputFormatter(maxLength)],
                  decoration: const InputDecoration(
                    hintText: 'Escribí un mensaje…',
                    isDense: true,
                  ),
                ),
              ),
              const SizedBox(width: 4),
              IconButton.filled(
                tooltip: 'Enviar',
                icon: const Icon(Icons.send_rounded),
                onPressed: onSend,
              ),
            ],
          ),
        ],
      ),
    );
  }
}

/// Resumen de la consulta, a mano desde el encabezado del chat: qué pide el
/// cliente, cuánto, los detalles, las fotos de referencia y, si ya se cotizó,
/// el mensaje para mandarle.
class ConsultaSummarySheet extends StatelessWidget {
  const ConsultaSummarySheet({super.key, required this.consulta, required this.statusLabel});
  final Consulta consulta;
  final String statusLabel;

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    final q = consulta;
    final who = [
      q.customerName.isEmpty ? 'Sin nombre' : q.customerName,
      if (q.customerPhone != null) q.customerPhone!,
    ].join(' · ');
    return SheetBody(
      title: q.title.isEmpty ? 'Sin título' : q.title,
      subtitle: who,
      children: [
        const SizedBox(height: 12),
        TonePill(statusLabel, color: inquiryStatusColor(q.status, c), icon: inquiryStatusIcon(q.status)),
        const SizedBox(height: 14),
        const SectionLabel('Cantidad'),
        const SizedBox(height: 4),
        Text(
          q.quantity == 1 ? '1 unidad' : '${q.quantity} unidades',
          style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: c.text),
        ),
        if (q.description.isNotEmpty) ...[
          const SizedBox(height: 14),
          const SectionLabel('Detalles'),
          const SizedBox(height: 4),
          Text(q.description, style: TextStyle(fontSize: 13.5, color: c.textDim, height: 1.4)),
        ],
        if (q.images.isNotEmpty) ...[
          const SizedBox(height: 14),
          const SectionLabel('Fotos de referencia'),
          const SizedBox(height: 8),
          PhotoStrip(urls: q.images),
        ],
        for (final f in q.files) ...[
          const SizedBox(height: 8),
          AttachmentRow(
            icon: attachmentIcon(f.type),
            name: f.name,
            trailing: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 10),
              child: Icon(Icons.open_in_new_rounded, size: 18, color: c.textFaint),
            ),
            onTap: () async {
              final ok = await openUrl(f.url);
              if (!ok && context.mounted) showToast(context, 'No pudimos abrir el archivo.');
            },
          ),
        ],
        if (q.message != null) ...[
          const SizedBox(height: 14),
          if (q.awaitingDeposit) ...[
            PendingOrderBanner(consulta: q),
            const SizedBox(height: 10),
          ],
          ConsultaMessageBlock(consulta: q),
        ],
        const SizedBox(height: 4),
      ],
    );
  }
}
