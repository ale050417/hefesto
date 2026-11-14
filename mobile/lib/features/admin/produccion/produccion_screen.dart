import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../../core/format.dart';
import '../../../core/providers.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/common.dart';
import '../../../core/widgets/modals.dart';
import '../admin_module.dart';
import '../admin_widgets.dart';
import '../filamentos/filamentos_format.dart';
import '../filamentos/shared_widgets.dart';
import '../sale_detail_screen.dart';
import '../sale_status.dart';
import 'produccion_api.dart';
import 'produccion_models.dart';

/// Cola de impresión: los pedidos online y las ventas de mostrador por etapa
/// (pendiente de pago → entregado), igual que el tablero de la web. Desde acá
/// se avanza cada trabajo de etapa; confirmar el pago descuenta el filamento.
/// (Pantalla de entrada del módulo; se abre desde "Más".)
class AdminProduccionScreen extends ConsumerWidget {
  const AdminProduccionScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final board = ref.watch(produccionProvider);
    return AdminModuleScaffold(
      title: 'Cola de impresión',
      permission: 'produccion',
      what: 'la cola de impresión',
      actions: [
        IconButton(
          tooltip: 'Actualizar',
          icon: const Icon(Icons.refresh_rounded),
          onPressed: () => ref.invalidate(produccionProvider),
        ),
      ],
      body: board.when(
        loading: () => const ListSkeleton(rows: 5, height: 118),
        error: (e, _) => ErrorView(message: '$e', onRetry: () => ref.invalidate(produccionProvider)),
        data: (d) => _BoardBody(data: d),
      ),
    );
  }
}

class _BoardBody extends ConsumerStatefulWidget {
  const _BoardBody({required this.data});
  final BoardData data;

  @override
  ConsumerState<_BoardBody> createState() => _BoardBodyState();
}

class _BoardBodyState extends ConsumerState<_BoardBody> {
  SaleStatus? _stage; // null = todas las etapas
  String _type = 'todo'; // todo | online | manual

  Future<void> _refresh() async {
    ref.invalidate(produccionProvider);
    try {
      await ref.read(produccionProvider.future);
    } catch (_) {}
  }

  Future<void> _move(BoardCard card, SaleStatus target) async {
    final ok = await showAppSheet<bool>(
      context,
      builder: (_) => MoveSheet(card: card, target: target),
    );
    if (ok == true && mounted) {
      showToast(context, '${card.label}: ${target.label}');
    }
  }

  Future<void> _open(BoardCard card) async {
    await Navigator.of(context).push<void>(
      MaterialPageRoute(builder: (_) => SaleDetailScreen(source: card.source, id: card.id)),
    );
    // Al volver el estado pudo haber cambiado desde el detalle.
    ref.invalidate(produccionProvider);
  }

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    final d = widget.data;
    final me = ref.watch(meProvider).value;
    final canMove = me?.can('pedidos', 'editar') ?? false;
    final canOpen = me?.can('pedidos', 'ver') ?? false;

    final pool = d.items.where((i) => _type == 'todo' || i.source == _type).toList();
    int countOf(SaleStatus s) => pool.where((i) => i.status == s).length;
    final shown = _stage == null ? pool : pool.where((i) => i.status == _stage).toList();
    final active = d.items.where((i) => i.status != SaleStatus.delivered).length;

    return RefreshIndicator(
      color: Brand.gold,
      onRefresh: _refresh,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 4, 16, 28),
        children: [
          if (d.degraded.isNotEmpty) ...[
            InlineError('No pudimos cargar ${d.degraded.join(' y ')}: la cola puede estar incompleta. '
                'Tirá para actualizar.'),
            const SizedBox(height: 12),
          ],
          Row(
            children: [
              Expanded(
                child: Text(
                  active == 1 ? '1 trabajo en curso' : '$active trabajos en curso',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
              ),
              if (d.lateCount > 0)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: Brand.danger.withValues(alpha: 0.14),
                    borderRadius: BorderRadius.circular(99),
                  ),
                  child: Text(
                    '${d.lateCount} demorado${d.lateCount == 1 ? '' : 's'}',
                    style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: Brand.danger),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 10),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: [
                ChoiceChip(
                  label: Text('Todas (${pool.length})'),
                  selected: _stage == null,
                  onSelected: (_) => setState(() => _stage = null),
                ),
                for (final s in SaleStatus.flow) ...[
                  const SizedBox(width: 8),
                  ChoiceChip(
                    avatar: Icon(s.icon, size: 16, color: s.color),
                    label: Text('${s.label} (${countOf(s)})'),
                    selected: _stage == s,
                    onSelected: (_) => setState(() => _stage = s),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            children: [
              for (final t in const [('todo', 'Todo'), ('online', 'Online'), ('manual', 'Mostrador')])
                ChoiceChip(
                  label: Text(t.$2),
                  selected: _type == t.$1,
                  onSelected: (_) => setState(() => _type = t.$1),
                ),
            ],
          ),
          const SizedBox(height: 14),
          if (shown.isEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 36),
              child: EmptyView(
                icon: Icons.precision_manufacturing_outlined,
                title: d.items.isEmpty ? 'No hay trabajos en la cola' : 'Nada en esta vista',
                subtitle: d.items.isEmpty
                    ? 'Cuando entre un pedido o cargues una venta, aparece acá para seguirlo hasta la entrega.'
                    : 'Probá con otra etapa o tipo de venta.',
              ),
            )
          else if (_stage != null)
            for (final card in shown) ...[
              _BoardTile(card, canMove: canMove, canOpen: canOpen, onMove: _move, onOpen: _open),
              const SizedBox(height: 10),
            ]
          else
            for (final s in SaleStatus.flow)
              if (pool.any((i) => i.status == s)) ...[
                _StageHeader(s, pool.where((i) => i.status == s).length),
                for (final card in pool.where((i) => i.status == s)) ...[
                  _BoardTile(card, canMove: canMove, canOpen: canOpen, onMove: _move, onOpen: _open),
                  const SizedBox(height: 10),
                ],
              ],
          if (!canMove && d.items.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Text(
                'Tu cuenta puede ver la cola pero no avanzar los pedidos.',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 11.5, color: c.textFaint),
              ),
            ),
        ],
      ),
    );
  }
}

class _StageHeader extends StatelessWidget {
  const _StageHeader(this.stage, this.count);
  final SaleStatus stage;
  final int count;

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    return Padding(
      padding: const EdgeInsets.fromLTRB(4, 14, 0, 10),
      child: Row(
        children: [
          Container(
            width: 9,
            height: 9,
            decoration: BoxDecoration(color: stage.color, shape: BoxShape.circle),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              stage.label.toUpperCase(),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                fontFamily: 'Orbitron',
                fontSize: 10.5,
                letterSpacing: 2,
                fontWeight: FontWeight.w700,
                color: c.textFaint,
              ),
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
            decoration: BoxDecoration(color: c.surface3, borderRadius: BorderRadius.circular(99)),
            child: Text(
              '$count',
              style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: c.textDim),
            ),
          ),
        ],
      ),
    );
  }
}

class _BoardTile extends StatelessWidget {
  const _BoardTile(
    this.card, {
    required this.canMove,
    required this.canOpen,
    required this.onMove,
    required this.onOpen,
  });
  final BoardCard card;
  final bool canMove;
  final bool canOpen;
  final void Function(BoardCard, SaleStatus) onMove;
  final void Function(BoardCard) onOpen;

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    final next = canMove ? card.nextStages : const <SaleStatus>[];
    return AdminCard(
      accent: card.late ? Brand.danger : null,
      onTap: canOpen ? () => onOpen(card) : null,
      padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Text(
                  card.label,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14.5, height: 1.25),
                ),
              ),
              const SizedBox(width: 10),
              Text(
                formatPrice(card.total),
                style: const TextStyle(
                  fontFamily: 'Orbitron',
                  fontWeight: FontWeight.w700,
                  fontSize: 13,
                  color: Brand.gold,
                ),
              ),
            ],
          ),
          if (card.customerName != null)
            Padding(
              padding: const EdgeInsets.only(top: 2),
              child: Text(
                card.customerName!,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(fontSize: 12.5, color: c.textDim),
              ),
            ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 6,
            runSpacing: 6,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              // FittedBox: con fuente muy grande la píldora se achica en vez de desbordar.
              FittedBox(fit: BoxFit.scaleDown, child: StatusChip(card.status)),
              MiniTag(
                card.isManual ? 'Mostrador' : 'Tienda',
                icon: card.isManual ? Icons.point_of_sale_rounded : Icons.shopping_bag_outlined,
              ),
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (card.late) ...[
                    const Icon(Icons.warning_amber_rounded, size: 14, color: Brand.danger),
                    const SizedBox(width: 3),
                  ],
                  Text(
                    formatAgo(card.ageHours),
                    style: TextStyle(
                      fontSize: 11.5,
                      fontWeight: card.late ? FontWeight.w700 : FontWeight.w500,
                      color: card.late ? Brand.danger : c.textFaint,
                    ),
                  ),
                ],
              ),
            ],
          ),
          if (next.isNotEmpty) ...[
            const SizedBox(height: 12),
            // Una debajo de otra: dos botones lado a lado no entran en un celular
            // chico ("Marcar entregado" se cortaba).
            Column(
              children: [
                _StageButton(
                  stage: next.first,
                  primary: true,
                  onPressed: () => onMove(card, next.first),
                ),
                for (final s in next.skip(1)) ...[
                  const SizedBox(height: 8),
                  _StageButton(stage: s, primary: false, onPressed: () => onMove(card, s)),
                ],
              ],
            ),
          ],
        ],
      ),
    );
  }
}

class _StageButton extends StatelessWidget {
  const _StageButton({required this.stage, required this.primary, required this.onPressed});
  final SaleStatus stage;
  final bool primary;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final label = Text(stage.actionLabel, maxLines: 1, overflow: TextOverflow.ellipsis);
    // Colores y forma: los del tema (dorado lleno = paso siguiente, contorno =
    // alternativa). 46 dp de alto: con 42 quedaba por debajo del mínimo cómodo
    // para tocar (2026-11-14, pedido de Ale).
    return SizedBox(
      width: double.infinity,
      height: 46,
      child: primary
          ? FilledButton.icon(
              onPressed: onPressed,
              icon: Icon(stage.icon, size: 18),
              label: label,
            )
          : OutlinedButton.icon(
              onPressed: onPressed,
              icon: Icon(stage.icon, size: 18, color: stage.color),
              label: label,
            ),
    );
  }
}

/// Hoja de confirmación al avanzar un trabajo: avisa qué pasa (stock, aviso al
/// cliente) y, para marcar un pedido online como enviado, deja cargar el código
/// de seguimiento. Hace el cambio ella misma y se cierra con `true`.
class MoveSheet extends ConsumerStatefulWidget {
  const MoveSheet({super.key, required this.card, required this.target});
  final BoardCard card;
  final SaleStatus target;

  @override
  ConsumerState<MoveSheet> createState() => _MoveSheetState();
}

class _MoveSheetState extends ConsumerState<MoveSheet> {
  final _tracking = TextEditingController();
  bool _loading = false;
  String? _error;

  bool get _askTracking => widget.target == SaleStatus.shipped && !widget.card.isManual;

  /// Qué pasa al hacer el cambio (el servidor tiene la última palabra).
  String get _hint {
    final manual = widget.card.isManual;
    return switch (widget.target) {
      SaleStatus.confirmed => 'Se marca el pago como acreditado y se descuenta el filamento del '
          'stock.${manual ? '' : ' Le avisamos al cliente.'}',
      _ => manual ? 'Actualiza el estado de la venta.' : 'Le avisamos al cliente por mail y notificación.',
    };
  }

  @override
  void dispose() {
    _tracking.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final api = ref.read(produccionApiProvider);
      final code = _tracking.text.trim();
      if (_askTracking && code.isNotEmpty) await api.setTracking(widget.card.id, code);
      await api.move(widget.card, widget.target);
      invalidateBoard(ref);
      if (mounted) popIfCurrent(context, true);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } catch (_) {
      if (mounted) setState(() => _error = 'No pudimos completar el cambio. Probá de nuevo.');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    final t = widget.target;
    // Hoja estándar (2026-11-14, pedido de Ale: que los modales se vean bien):
    // el contenido se desplaza si no entra, sube con el teclado y "Confirmar"
    // queda fijo arriba de la barra del sistema.
    return SheetBody(
      // El rechazo del servidor va pegado al botón (fijo): con el teclado
      // abierto en un teléfono chico, debajo del campo no se llegaba a ver.
      footer: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (_error != null) ...[
            InlineError(_error!),
            const SizedBox(height: 10),
          ],
          GoldButton(
            label: 'Confirmar',
            icon: Icons.check_rounded,
            loading: _loading,
            onPressed: _submit,
          ),
        ],
      ),
      children: [
        Row(
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: t.color.withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(t.icon, color: t.color),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Text(t.actionLabel, style: Theme.of(context).textTheme.titleLarge),
            ),
          ],
        ),
        const SizedBox(height: 12),
        Text(
          widget.card.label,
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14, color: c.text),
        ),
        if (widget.card.customerName != null)
          Text(
            widget.card.customerName!,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(fontSize: 12.5, color: c.textDim),
          ),
        const SizedBox(height: 10),
        Text(_hint, style: TextStyle(fontSize: 13, color: c.textDim, height: 1.4)),
        if (_askTracking) ...[
          const SizedBox(height: 14),
          TextField(
            controller: _tracking,
            textCapitalization: TextCapitalization.characters,
            autocorrect: false,
            textInputAction: TextInputAction.done,
            onChanged: (_) {
              if (_error != null) setState(() => _error = null);
            },
            decoration: const InputDecoration(
              labelText: 'Código de seguimiento',
              helperText: 'Si ya lo cargaste en la venta, dejalo vacío.',
            ),
          ),
        ],
      ],
    );
  }
}
