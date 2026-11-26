import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../../core/widgets/photo_picker.dart';
import 'consultas_api.dart';
import 'consultas_models.dart';

/// Un mensaje que se está mandando (o que no salió): se dibuja al final del
/// chat con "enviando…" o con el aviso y "Reintentar".
class OutgoingMessage {
  const OutgoingMessage({
    required this.localId,
    required this.body,
    this.photo,
    this.failed = false,
    this.error,
  });

  final String localId;
  final String body;
  final PickedPhoto? photo;

  /// No salió: queda a la vista para reintentar o descartar.
  final bool failed;

  /// Motivo del servidor (o de la conexión) cuando falló.
  final String? error;

  OutgoingMessage copyWith({required bool failed, String? error}) =>
      OutgoingMessage(localId: localId, body: body, photo: photo, failed: failed, error: error);
}

/// Estado del chat de UNA consulta.
class ConsultaChatState {
  const ConsultaChatState({
    this.loading = true,
    this.loadError,
    this.messages = const [],
    this.outbox = const [],
    this.maxLength = defaultChatMaxLength,
  });

  /// Primera carga en curso.
  final bool loading;

  /// La primera carga falló (sin conexión, sin permiso): se ofrece reintentar.
  final String? loadError;

  /// Mensajes ya guardados en el servidor, el más viejo primero.
  final List<ChatMessage> messages;

  /// Lo que se está mandando o no salió, en el orden en que se escribió.
  final List<OutgoingMessage> outbox;
  final int maxLength;

  bool get isEmpty => messages.isEmpty && outbox.isEmpty;

  ConsultaChatState copyWith({
    bool? loading,
    String? Function()? loadError,
    List<ChatMessage>? messages,
    List<OutgoingMessage>? outbox,
    int? maxLength,
  }) =>
      ConsultaChatState(
        loading: loading ?? this.loading,
        loadError: loadError == null ? this.loadError : loadError(),
        messages: messages ?? this.messages,
        outbox: outbox ?? this.outbox,
        maxLength: maxLength ?? this.maxLength,
      );
}

/// Chat en vivo de una consulta (pedido de Ale, 2026-11-25): carga la
/// conversación, pide las novedades cada [pollEvery] mientras la pantalla está
/// abierta y la app al frente, y manda los mensajes mostrando "enviando…"
/// hasta que el servidor responde.
class ConsultaChatController extends Notifier<ConsultaChatState> {
  ConsultaChatController(this.inquiryId);
  final String inquiryId;

  /// Cada cuánto se piden los mensajes nuevos con el chat abierto.
  static const pollEvery = Duration(seconds: 4);

  Timer? _timer;
  bool _fetching = false;
  bool _loaded = false;
  int _nextLocalId = 0;

  /// Fecha del último mensaje que llegó POR EL LISTADO (`after` del próximo
  /// pedido). No avanza con lo que devuelve el envío propio: si lo hiciera, un
  /// mensaje de otra persona guardado un instante antes quedaría sin llegar.
  DateTime? _cursor;

  @override
  ConsultaChatState build() {
    ref.onDispose(_stop);
    _start();
    // La primera carga, apenas termine de armarse el provider.
    Future.microtask(refresh);
    return const ConsultaChatState();
  }

  ConsultasApi get _api => ref.read(consultasApiProvider);

  void _start() {
    _timer ??= Timer.periodic(pollEvery, (_) => refresh());
  }

  void _stop() {
    _timer?.cancel();
    _timer = null;
  }

  /// La app pasó a segundo plano: se dejan de pedir novedades.
  void pause() => _stop();

  /// La app volvió al frente: novedades ya mismo y de nuevo cada [pollEvery].
  void resume() {
    if (!ref.mounted) return;
    // Si la primera carga falló, se retoma solo con "Reintentar".
    if (state.loadError != null) return;
    _start();
    refresh();
  }

  /// "Reintentar" de la primera carga.
  void retry() {
    if (!ref.mounted) return;
    state = state.copyWith(loading: true, loadError: () => null);
    _start();
    refresh();
  }

  /// Pide la conversación entera (la primera vez) o solo lo nuevo.
  Future<void> refresh() async {
    if (_fetching || !ref.mounted) return;
    _fetching = true;
    final first = !_loaded;
    try {
      final page = await _api.messages(inquiryId, after: first ? null : _cursor);
      if (!ref.mounted) return;
      _loaded = true;
      for (final m in page.items) {
        final at = m.createdAt;
        if (at != null && (_cursor == null || at.isAfter(_cursor!))) _cursor = at;
      }
      state = state.copyWith(
        loading: false,
        loadError: () => null,
        messages: mergeChatMessages(state.messages, page.items),
        maxLength: page.maxLength,
      );
    } catch (e) {
      if (!ref.mounted) return;
      // Un pedido de novedades que falla (se cortó la señal) no tapa el chat:
      // se vuelve a intentar en el próximo. La primera carga sí se avisa.
      if (first) {
        _stop();
        state = state.copyWith(
          loading: false,
          loadError: () => e is ApiException ? e.message : 'No pudimos cargar el chat. Probá de nuevo.',
        );
      }
    } finally {
      _fetching = false;
    }
  }

  /// Manda texto, una foto o las dos cosas. Aparece enseguida al final del
  /// chat como "enviando…".
  void send(String body, {PickedPhoto? photo}) {
    final text = body.trim();
    if (text.isEmpty && photo == null) return;
    final out = OutgoingMessage(localId: 'local-${_nextLocalId++}', body: text, photo: photo);
    state = state.copyWith(outbox: [...state.outbox, out]);
    _deliver(out);
  }

  /// Vuelve a intentar un mensaje que no salió.
  void retrySend(String localId) {
    final out = state.outbox.where((o) => o.localId == localId && o.failed).firstOrNull;
    if (out == null) return;
    final again = out.copyWith(failed: false);
    _replace(again);
    _deliver(again);
  }

  /// Saca de la lista un mensaje que no salió.
  void discard(String localId) {
    state = state.copyWith(outbox: [
      for (final o in state.outbox)
        if (o.localId != localId) o,
    ]);
  }

  void _replace(OutgoingMessage out) {
    state = state.copyWith(outbox: [
      for (final o in state.outbox) o.localId == out.localId ? out : o,
    ]);
  }

  Future<void> _deliver(OutgoingMessage out) async {
    try {
      final sent = await _api.sendMessage(inquiryId, body: out.body, photo: out.photo);
      if (!ref.mounted) return;
      state = state.copyWith(
        messages: mergeChatMessages(state.messages, [sent]),
        outbox: [
          for (final o in state.outbox)
            if (o.localId != out.localId) o,
        ],
      );
    } catch (e) {
      if (!ref.mounted) return;
      _replace(out.copyWith(
        failed: true,
        error: e is ApiException ? e.message : 'No se pudo enviar. Revisá tu conexión.',
      ));
    }
  }
}

/// Chat de una consulta, por su id. Vive mientras la pantalla está abierta.
final consultaChatProvider = NotifierProvider.autoDispose
    .family<ConsultaChatController, ConsultaChatState, String>(ConsultaChatController.new);
