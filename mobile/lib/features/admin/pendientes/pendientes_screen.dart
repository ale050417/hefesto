import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../../core/providers.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/common.dart';
import '../admin_widgets.dart';
import '../filamentos/shared_widgets.dart';
import 'pendientes_api.dart';
import 'pendientes_models.dart';

/// Entrada a los pendientes, arriba de la lista de Ventas: una sola fila
/// ("Pendientes del equipo · 3") para no enterrar las ventas. Si la lista no
/// se pudo traer, la fila queda igual (sin número) y se abre para reintentar.
class PendientesEntry extends ConsumerWidget {
  const PendientesEntry({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.hc;
    final data = ref.watch(pendientesProvider).value;
    final count = data?.open.length;
    return AdminCard(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      // Sobre la barra del panel (navegador raíz), igual que "Nueva venta".
      onTap: () => Navigator.of(context, rootNavigator: true).push(
        MaterialPageRoute<void>(builder: (_) => const PendientesScreen()),
      ),
      child: Row(
        children: [
          Icon(Icons.checklist_rounded, size: 20, color: (count ?? 0) > 0 ? Brand.gold : c.textDim),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              pendientesEntryLabel(count),
              style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14),
            ),
          ),
          Icon(Icons.chevron_right_rounded, color: c.textFaint),
        ],
      ),
    );
  }
}

/// "Pendientes del equipo": se anota lo que falta, cualquiera lo tilda, y lo
/// borra quien lo anotó (o quien puede eliminar pedidos). Espejo de la tarjeta
/// de Pedidos de la web.
class PendientesScreen extends ConsumerWidget {
  const PendientesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final me = ref.watch(meProvider).value;
    if (me != null && !me.can('pedidos', 'ver')) {
      return Scaffold(
        appBar: AppBar(title: const Text('Pendientes del equipo')),
        body: const AccessDenied(what: 'los pendientes'),
      );
    }
    final data = ref.watch(pendientesProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Pendientes del equipo')),
      body: data.when(
        loading: () => const ListSkeleton(rows: 5, height: 64),
        error: (e, _) => ErrorView(message: '$e', onRetry: () => ref.invalidate(pendientesProvider)),
        data: (d) => _PendientesBody(
          data: d,
          canWrite: me?.can('pedidos', 'crear') ?? false,
          canDelete: me?.can('pedidos', 'eliminar') ?? false,
        ),
      ),
    );
  }
}

class _PendientesBody extends ConsumerStatefulWidget {
  const _PendientesBody({required this.data, required this.canWrite, required this.canDelete});
  final PendientesData data;

  /// Permiso pedidos/crear: anotar y tildar.
  final bool canWrite;

  /// Permiso pedidos/eliminar: borrar también los de otros.
  final bool canDelete;

  @override
  ConsumerState<_PendientesBody> createState() => _PendientesBodyState();
}

class _PendientesBodyState extends ConsumerState<_PendientesBody> {
  final _text = TextEditingController();
  final _focus = FocusNode();
  bool _adding = false;
  String? _addError;
  bool _showDone = false;

  /// Pendientes con un cambio en viaje: no se pueden volver a tocar.
  final _busy = <String>{};

  @override
  void dispose() {
    _text.dispose();
    _focus.dispose();
    super.dispose();
  }

  Future<void> _refresh() async {
    ref.invalidate(pendientesProvider);
    try {
      await ref.read(pendientesProvider.future);
    } catch (_) {
      // El error lo muestra la pantalla.
    }
  }

  Future<void> _add() async {
    if (_adding) return;
    final error = validateTaskBody(_text.text, maxLength: widget.data.maxLength);
    if (error != null) {
      // Vacío: no es un error que haya que gritar, simplemente no se anota.
      if (_text.text.trim().isNotEmpty) setState(() => _addError = error);
      return;
    }
    final container = ProviderScope.containerOf(context, listen: false);
    setState(() {
      _adding = true;
      _addError = null;
    });
    try {
      await ref.read(pendientesApiProvider).create(_text.text);
      invalidatePendientes(container);
      if (!mounted) return;
      // Se suelen anotar varios seguidos: el campo queda listo para el próximo.
      _text.clear();
      _focus.requestFocus();
    } on ApiException catch (e) {
      if (mounted) setState(() => _addError = e.message);
    } catch (_) {
      if (mounted) setState(() => _addError = 'No pudimos anotarlo. Probá de nuevo.');
    } finally {
      if (mounted) setState(() => _adding = false);
    }
  }

  Future<void> _toggle(TeamTask t, bool toDone) async {
    if (_busy.contains(t.id)) return;
    final messenger = ScaffoldMessenger.of(context);
    final container = ProviderScope.containerOf(context, listen: false);
    setState(() => _busy.add(t.id));
    String? message;
    try {
      await ref.read(pendientesApiProvider).setDone(t.id, toDone);
      if (toDone) message = 'Pendiente hecho';
    } on ApiException catch (e) {
      message = e.message;
    } catch (_) {
      message = 'No pudimos guardar el cambio. Probá de nuevo.';
    } finally {
      // También si falló: otro del equipo pudo haberlo borrado o tildado.
      invalidatePendientes(container);
      if (mounted) setState(() => _busy.remove(t.id));
    }
    if (message != null) {
      messenger
        ..hideCurrentSnackBar()
        ..showSnackBar(SnackBar(content: Text(message)));
    }
  }

  Future<void> _delete(TeamTask t) async {
    if (_busy.contains(t.id)) return;
    final ok = await confirmDialog(
      context,
      title: '¿Borrar este pendiente?',
      message: t.body,
      confirmLabel: 'Borrar',
      destructive: true,
    );
    if (!ok || !mounted) return;
    final messenger = ScaffoldMessenger.of(context);
    final container = ProviderScope.containerOf(context, listen: false);
    setState(() => _busy.add(t.id));
    String message;
    try {
      await ref.read(pendientesApiProvider).delete(t.id);
      message = 'Pendiente borrado';
    } on ApiException catch (e) {
      message = e.message;
    } catch (_) {
      message = 'No pudimos borrarlo. Probá de nuevo.';
    } finally {
      invalidatePendientes(container);
      if (mounted) setState(() => _busy.remove(t.id));
    }
    messenger
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(message)));
  }

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    final d = widget.data;
    return SafeArea(
      child: Column(
        children: [
          Expanded(
            child: RefreshIndicator(
              color: Brand.gold,
              onRefresh: _refresh,
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
                keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
                children: [
                  Padding(
                    padding: const EdgeInsets.fromLTRB(4, 0, 4, 8),
                    child: Text(
                      pendientesCountLabel(d.open.length),
                      style: TextStyle(fontSize: 12.5, color: c.textFaint),
                    ),
                  ),
                  if (d.open.isEmpty)
                    Padding(
                      padding: const EdgeInsets.fromLTRB(4, 4, 4, 12),
                      child: Text(
                        'No hay pendientes. Acá se anota lo que falta: un pedido sin cargar, '
                        'una cotización por mandar, un caso que quedó colgado.',
                        style: TextStyle(fontSize: 13.5, color: c.textDim, height: 1.4),
                      ),
                    )
                  else
                    AdminCard(
                      padding: const EdgeInsets.symmetric(vertical: 4),
                      child: Column(
                        children: [
                          for (var i = 0; i < d.open.length; i++) ...[
                            if (i > 0) Divider(height: 1, color: c.border),
                            _row(d.open[i], isDone: false),
                          ],
                        ],
                      ),
                    ),
                  if (d.done.isNotEmpty) ...[
                    const SizedBox(height: 8),
                    Align(
                      alignment: Alignment.centerLeft,
                      child: TextButton.icon(
                        onPressed: () => setState(() => _showDone = !_showDone),
                        icon: Icon(_showDone ? Icons.expand_less_rounded : Icons.expand_more_rounded),
                        label: Text('Hechos (${d.done.length})'),
                      ),
                    ),
                    if (_showDone)
                      AdminCard(
                        padding: const EdgeInsets.symmetric(vertical: 4),
                        child: Column(
                          children: [
                            for (var i = 0; i < d.done.length; i++) ...[
                              if (i > 0) Divider(height: 1, color: c.border),
                              _row(d.done[i], isDone: true),
                            ],
                          ],
                        ),
                      ),
                  ],
                ],
              ),
            ),
          ),
          // Anotar va fijo abajo (pegado al teclado cuando se abre): con una
          // lista larga, arriba quedaba fuera de la vista.
          if (widget.canWrite) _addBar(c, d.maxLength),
        ],
      ),
    );
  }

  Widget _addBar(HefestoColors c, int maxLength) => Material(
        color: c.surface1,
        child: Container(
          decoration: BoxDecoration(border: Border(top: BorderSide(color: c.border))),
          padding: const EdgeInsets.fromLTRB(16, 10, 8, 10),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (_addError != null) ...[
                Padding(
                  padding: const EdgeInsets.only(right: 8, bottom: 8),
                  child: InlineError(_addError!),
                ),
              ],
              Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _text,
                      focusNode: _focus,
                      enabled: !_adding,
                      textCapitalization: TextCapitalization.sentences,
                      // Una línea que crece: un pendiente largo se lee entero
                      // mientras se escribe. "Enviar" en el teclado lo anota.
                      minLines: 1,
                      maxLines: 3,
                      textInputAction: TextInputAction.send,
                      inputFormatters: [LengthLimitingTextInputFormatter(maxLength)],
                      onChanged: (_) => setState(() => _addError = null),
                      onSubmitted: (_) => _add(),
                      decoration: const InputDecoration(hintText: 'Anotá un pendiente'),
                    ),
                  ),
                  const SizedBox(width: 4),
                  IconButton(
                    tooltip: 'Anotar',
                    onPressed: _adding || _text.text.trim().isEmpty ? null : _add,
                    icon: _adding
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(strokeWidth: 2, color: Brand.gold),
                          )
                        : const Icon(Icons.send_rounded),
                  ),
                ],
              ),
            ],
          ),
        ),
      );

  Widget _row(TeamTask t, {required bool isDone}) {
    final c = context.hc;
    final busy = _busy.contains(t.id);
    final meta = [
      t.author,
      if (t.createdAt != null) formatDateTime(t.createdAt!),
      if (isDone && t.doneBy != null)
        'lo tildó ${t.doneBy}${t.doneAt != null ? ' el ${formatDateTime(t.doneAt!)}' : ''}',
    ].join(' · ');
    return Padding(
      key: ValueKey('pendiente-${t.id}'),
      padding: const EdgeInsets.fromLTRB(2, 2, 2, 2),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Checkbox(
            value: isDone,
            semanticLabel: isDone ? 'Volver a pendiente: ${t.body}' : 'Marcar hecho: ${t.body}',
            onChanged: widget.canWrite && !busy ? (v) => _toggle(t, v ?? !isDone) : null,
          ),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 10),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    t.body,
                    style: TextStyle(
                      fontSize: 14,
                      height: 1.35,
                      color: isDone ? c.textDim : c.text,
                      decoration: isDone ? TextDecoration.lineThrough : null,
                    ),
                  ),
                  const SizedBox(height: 3),
                  Text(meta, style: TextStyle(fontSize: 11.5, color: c.textFaint, height: 1.3)),
                ],
              ),
            ),
          ),
          if (t.deletableBy(canDelete: widget.canDelete))
            IconButton(
              tooltip: 'Borrar pendiente',
              onPressed: busy ? null : () => _delete(t),
              icon: const Icon(Icons.close_rounded, size: 20),
            )
          else
            const SizedBox(width: 8),
        ],
      ),
    );
  }
}
