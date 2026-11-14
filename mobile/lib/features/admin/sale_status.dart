import 'package:flutter/material.dart';

import '../../core/theme/app_theme.dart';

/// Estados de un pedido / venta (mismo enum que la DB y que la web).
///
/// `next` replica la máquina de estados del servidor (`ORDER_TRANSITIONS`) SOLO
/// para decidir qué botones ofrecer; el servidor vuelve a validar cada cambio,
/// así que si algún día difieren, gana el servidor y la app muestra su mensaje.
enum SaleStatus {
  pendingPayment('pending_payment', 'Pendiente de pago', Icons.hourglass_top_rounded),
  confirmed('confirmed', 'Pago confirmado', Icons.verified_rounded),
  inProduction('in_production', 'En producción', Icons.precision_manufacturing_rounded),
  ready('ready', 'Listo para entregar', Icons.inventory_2_rounded),
  shipped('shipped', 'Enviado', Icons.local_shipping_rounded),
  delivered('delivered', 'Entregado', Icons.check_circle_rounded),
  cancelled('cancelled', 'Cancelado', Icons.cancel_rounded),
  refunded('refunded', 'Reembolsado', Icons.undo_rounded);

  const SaleStatus(this.api, this.label, this.icon);

  /// Valor que viaja por la API.
  final String api;
  final String label;
  final IconData icon;

  static SaleStatus fromApi(String? value) => SaleStatus.values.firstWhere(
        (s) => s.api == value,
        orElse: () => SaleStatus.pendingPayment,
      );

  Color get color => switch (this) {
        SaleStatus.pendingPayment => Brand.warning,
        SaleStatus.confirmed => Brand.info,
        SaleStatus.inProduction => Brand.gold,
        SaleStatus.ready => const Color(0xFF3FB8AF),
        SaleStatus.shipped => const Color(0xFF8B7CF6),
        SaleStatus.delivered => Brand.success,
        SaleStatus.cancelled => Brand.danger,
        SaleStatus.refunded => const Color(0xFF8D8C99),
      };

  /// Cancelar y reembolsar tocan plata: la API los reserva a administradores.
  bool get isDestructive => this == SaleStatus.cancelled || this == SaleStatus.refunded;

  /// Terminales: no hay nada más que hacer con el pedido.
  bool get isFinal => this == SaleStatus.cancelled || this == SaleStatus.refunded;

  List<SaleStatus> get next => switch (this) {
        SaleStatus.pendingPayment => [SaleStatus.confirmed, SaleStatus.cancelled],
        SaleStatus.confirmed => [
            SaleStatus.inProduction,
            SaleStatus.cancelled,
            SaleStatus.refunded,
          ],
        SaleStatus.inProduction => [
            SaleStatus.ready,
            SaleStatus.cancelled,
            SaleStatus.refunded,
          ],
        SaleStatus.ready => [
            SaleStatus.shipped,
            SaleStatus.delivered,
            SaleStatus.cancelled,
            SaleStatus.refunded,
          ],
        SaleStatus.shipped => [SaleStatus.delivered, SaleStatus.refunded],
        SaleStatus.delivered => [SaleStatus.cancelled, SaleStatus.refunded],
        SaleStatus.cancelled || SaleStatus.refunded => const [],
      };

  /// Texto del botón que lleva a este estado.
  String get actionLabel => switch (this) {
        SaleStatus.confirmed => 'Confirmar pago',
        SaleStatus.inProduction => 'Pasar a producción',
        SaleStatus.ready => 'Marcar listo',
        SaleStatus.shipped => 'Marcar enviado',
        SaleStatus.delivered => 'Marcar entregado',
        SaleStatus.cancelled => 'Cancelar',
        SaleStatus.refunded => 'Reembolsar',
        SaleStatus.pendingPayment => 'Pendiente de pago',
      };

  /// Pasos del camino feliz, para el indicador de progreso del detalle.
  static const flow = [
    SaleStatus.pendingPayment,
    SaleStatus.confirmed,
    SaleStatus.inProduction,
    SaleStatus.ready,
    SaleStatus.shipped,
    SaleStatus.delivered,
  ];
}

const paymentMethodLabels = {
  'transfer': 'Transferencia',
  'mercadopago': 'MercadoPago',
  'cash': 'Efectivo',
};

String paymentLabel(String? method) =>
    paymentMethodLabels[method] ?? (method == null || method.isEmpty ? '—' : method);

const cancelReasons = [
  'El cliente se arrepintió',
  'Producto defectuoso / falla de impresión',
  'Demora en la entrega',
  'Error en el pedido / datos incorrectos',
  'No se pudo coordinar el envío o retiro',
];
