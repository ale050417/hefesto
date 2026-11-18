import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../../core/config.dart';
import '../../../core/providers.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/common.dart';
import '../admin_models.dart';
import '../admin_providers.dart';
import 'manual_sale_edit_screen.dart';
import 'ventas_extra_api.dart';
import 'ventas_extra_widgets.dart';

enum _SaleAction { edit, receipt, delete }

/// Menú "⋮" del detalle de una venta:
///  - Editar (solo ventas de mostrador, con permiso `pedidos/editar`);
///  - Comprobante (abre el de la web, que pide iniciar sesión);
///  - Eliminar (solo administradores, con confirmación).
class SaleExtraMenu extends ConsumerWidget {
  const SaleExtraMenu({super.key, required this.d});
  final SaleDetail d;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final me = ref.watch(meProvider).value;
    final canEdit = d.isManual && (me?.can('pedidos', 'editar') ?? false);
    final canDelete = me?.isAdmin ?? false;

    return PopupMenuButton<_SaleAction>(
      tooltip: 'Más acciones',
      icon: const Icon(Icons.more_vert_rounded),
      onSelected: (a) => _run(context, ref, a),
      itemBuilder: (_) => [
        if (canEdit)
          const PopupMenuItem(
            value: _SaleAction.edit,
            child: _MenuRow(Icons.edit_outlined, 'Editar venta'),
          ),
        const PopupMenuItem(
          value: _SaleAction.receipt,
          child: _MenuRow(Icons.receipt_long_outlined, 'Ver comprobante'),
        ),
        if (canDelete) ...[
          const PopupMenuDivider(),
          PopupMenuItem(
            value: _SaleAction.delete,
            child: _MenuRow(
              Icons.delete_outline_rounded,
              d.isManual ? 'Eliminar venta' : 'Eliminar pedido',
              color: Brand.danger,
            ),
          ),
        ],
      ],
    );
  }

  Future<void> _run(BuildContext context, WidgetRef ref, _SaleAction a) async {
    switch (a) {
      case _SaleAction.edit:
        await Navigator.of(context).push(
          MaterialPageRoute<bool>(builder: (_) => ManualSaleEditScreen(saleId: d.id)),
        );
      case _SaleAction.receipt:
        // El comprobante de la web vive detrás de la sesión web: si no está
        // iniciada, pide el ingreso y vuelve al comprobante.
        final kind = d.isManual ? 'venta' : 'pedido';
        await openUrl('${AppConfig.siteUrl}/comprobante/$kind/${d.id}');
      case _SaleAction.delete:
        final messenger = ScaffoldMessenger.of(context);
        final navigator = Navigator.of(context);
        final deleted = await showDialog<bool>(
          context: context,
          barrierDismissible: false,
          builder: (_) => DeleteSaleDialog(d: d),
        );
        if (deleted != true) return;
        // Se refrescan las listas y el inicio; el detalle de ESTA venta no (ya
        // no existe: volvería a pedirla y mostraría un error mientras se cierra).
        ref.invalidate(adminDashboardProvider);
        ref.invalidate(adminSalesProvider);
        navigator.pop();
        messenger
          ..hideCurrentSnackBar()
          ..showSnackBar(SnackBar(
            content: Text(d.isManual ? 'Venta eliminada' : 'Pedido ${d.title} eliminado'),
          ));
    }
  }
}

class _MenuRow extends StatelessWidget {
  const _MenuRow(this.icon, this.label, {this.color});
  final IconData icon;
  final String label;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final c = color ?? context.hc.text;
    return Row(
      children: [
        Icon(icon, size: 20, color: color ?? context.hc.textDim),
        const SizedBox(width: 12),
        Text(label, style: TextStyle(color: c, fontWeight: FontWeight.w600)),
      ],
    );
  }
}

/// Confirmación de borrado. Hace el borrado ella misma (con el error en línea)
/// y se cierra con `true` si salió bien.
class DeleteSaleDialog extends ConsumerStatefulWidget {
  const DeleteSaleDialog({super.key, required this.d});
  final SaleDetail d;

  @override
  ConsumerState<DeleteSaleDialog> createState() => _DeleteSaleDialogState();
}

class _DeleteSaleDialogState extends ConsumerState<DeleteSaleDialog> {
  bool _busy = false;
  String? _error;

  Future<void> _delete() async {
    if (_busy) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final api = ref.read(ventasExtraApiProvider);
      if (widget.d.isManual) {
        await api.deleteManualSale(widget.d.id);
      } else {
        await api.deleteOrder(widget.d.id);
      }
      if (mounted) Navigator.of(context).pop(true);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } catch (_) {
      if (mounted) setState(() => _error = 'No pudimos eliminarla. Probá de nuevo.');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    final d = widget.d;
    final who = d.customerName == null ? '' : ' de ${d.customerName}';
    return AlertDialog(
      title: Text(d.isManual ? '¿Eliminar la venta$who?' : '¿Eliminar el pedido ${d.title}?'),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              d.isManual
                  ? 'Se elimina para siempre y deja de sumar a facturación, ganancias y reportes. '
                      'Si había descontado filamento, se repone al stock.'
                  : 'Se elimina para siempre, en cualquier estado que esté. Deja de sumar a facturación, '
                      'ganancias y reportes, se repone el filamento descontado y se revierten los puntos y el cupón usados.',
              style: TextStyle(color: c.textDim, height: 1.4),
            ),
            const SizedBox(height: 10),
            Text(
              'No se puede deshacer.',
              style: TextStyle(color: c.text, fontWeight: FontWeight.w700),
            ),
            if (_error != null) ...[
              const SizedBox(height: 12),
              InlineError(_error!),
            ],
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: _busy ? null : () => Navigator.of(context).pop(false),
          child: const Text('Cancelar'),
        ),
        FilledButton(
          style: FilledButton.styleFrom(backgroundColor: Brand.danger, foregroundColor: Colors.white),
          onPressed: _busy ? null : _delete,
          child: _busy
              ? const SizedBox(
                  width: 18,
                  height: 18,
                  child: AppSpinner(color: Colors.white),
                )
              : const Text('Eliminar'),
        ),
      ],
    );
  }
}
