// Piezas de interfaz compartidas por Productos y Categorías del panel.

import 'package:flutter/material.dart';

import '../../../core/api/api_client.dart';
import '../../../core/format.dart';
import '../../../core/theme/app_theme.dart';

/// Texto para mostrarle a la persona cuando falla una carga: el mensaje del
/// servidor (ya viene en castellano) o, si el problema es otro —una respuesta
/// con forma inesperada—, un aviso genérico en vez del error técnico en inglés.
String errorText(Object error) =>
    error is ApiException ? error.message : 'No pudimos cargar los datos. Probá de nuevo.';

/// Pregunta antes de una acción que no se puede deshacer (o que cambia lo que
/// ve la tienda). Devuelve `true` si la persona confirma.
Future<bool> confirmDialog(
  BuildContext context, {
  required String title,
  required String message,
  required String confirmLabel,
  String cancelLabel = 'Cancelar',
  bool destructive = false,
}) async {
  final ok = await showDialog<bool>(
    context: context,
    builder: (ctx) => AlertDialog(
      // Desplazable: con un nombre largo y letra grande el aviso no entraba en
      // un teléfono chico y el texto quedaba cortado, sin poder leerse entero.
      scrollable: true,
      title: Text(title),
      content: Text(message),
      actions: [
        TextButton(onPressed: () => Navigator.pop(ctx, false), child: Text(cancelLabel)),
        TextButton(
          onPressed: () => Navigator.pop(ctx, true),
          style: destructive ? TextButton.styleFrom(foregroundColor: Brand.danger) : null,
          child: Text(confirmLabel),
        ),
      ],
    ),
  );
  return ok == true;
}

/// Aviso corto al pie. `error` lo pinta como problema.
void showSnack(BuildContext context, String text, {bool error = false}) {
  final messenger = ScaffoldMessenger.of(context);
  messenger
    ..hideCurrentSnackBar()
    ..showSnackBar(
      SnackBar(
        content: Row(
          children: [
            Icon(
              error ? Icons.error_outline_rounded : Icons.check_circle_outline_rounded,
              size: 18,
              color: error ? Brand.danger : Brand.success,
            ),
            const SizedBox(width: 10),
            Expanded(child: Text(text)),
          ],
        ),
      ),
    );
}

/// Píldora con ícono y texto (estado, destacado, oferta…).
class InfoPill extends StatelessWidget {
  const InfoPill({super.key, required this.label, required this.color, this.icon});
  final String label;
  final Color color;
  final IconData? icon;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.15),
          borderRadius: BorderRadius.circular(99),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (icon != null) ...[Icon(icon, size: 12, color: color), const SizedBox(width: 4)],
            Flexible(
              child: Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: color),
              ),
            ),
          ],
        ),
      );
}

/// Etiqueta chica de las fichas ("Rojo · $31.000"). A diferencia de la etiqueta
/// común del panel, si el texto no entra baja de línea: un color de nombre
/// largo con su precio (y letra grande) desbordaba la tarjeta.
class WrapTag extends StatelessWidget {
  const WrapTag(this.text, {super.key});
  final String text;

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: c.surface2,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: c.border),
      ),
      child: Text(
        text,
        style: TextStyle(fontSize: 11, color: c.textDim, fontWeight: FontWeight.w600),
      ),
    );
  }
}

/// Precio con oferta: el vigente en dorado y el original tachado.
class PriceLabel extends StatelessWidget {
  const PriceLabel({
    super.key,
    required this.price,
    this.salePrice,
    this.from = false,
    this.size = 14.5,
  });
  final double price;
  final double? salePrice;

  /// Muestra "desde" (el producto tiene tamaños con otros precios).
  final bool from;
  final double size;

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    final onSale = salePrice != null && salePrice! < price;
    return Wrap(
      crossAxisAlignment: WrapCrossAlignment.end,
      spacing: 6,
      children: [
        if (from) Text('desde', style: TextStyle(fontSize: size - 3, color: c.textFaint)),
        Text(
          formatPrice(onSale ? salePrice! : price),
          style: TextStyle(
            fontFamily: 'Orbitron',
            fontWeight: FontWeight.w800,
            fontSize: size,
            color: Brand.gold,
          ),
        ),
        if (onSale)
          Text(
            formatPrice(price),
            style: TextStyle(
              fontSize: size - 2.5,
              color: c.textFaint,
              decoration: TextDecoration.lineThrough,
            ),
          ),
      ],
    );
  }
}

/// Fila "etiqueta ........ valor" de las fichas.
class InfoRow extends StatelessWidget {
  const InfoRow(this.label, this.value, {super.key});
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 5),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            flex: 4,
            child: Text(label, style: TextStyle(fontSize: 13, color: c.textDim)),
          ),
          const SizedBox(width: 12),
          Expanded(
            flex: 6,
            child: Text(
              value,
              textAlign: TextAlign.right,
              style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w600),
            ),
          ),
        ],
      ),
    );
  }
}

/// Mensaje de error en línea para los formularios.
class InlineError extends StatelessWidget {
  const InlineError(this.message, {super.key});
  final String message;

  @override
  Widget build(BuildContext context) => Container(
        width: double.infinity,
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: Brand.danger.withValues(alpha: 0.12),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: Brand.danger.withValues(alpha: 0.4)),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Icon(Icons.error_outline_rounded, size: 18, color: Brand.danger),
            const SizedBox(width: 8),
            Expanded(child: Text(message, style: const TextStyle(fontSize: 13, height: 1.35))),
          ],
        ),
      );
}
