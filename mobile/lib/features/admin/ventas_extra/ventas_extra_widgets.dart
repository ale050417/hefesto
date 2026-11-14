import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../core/theme/app_theme.dart';
import '../admin_widgets.dart';

/// "#CC2200" → color. Null si no hay hex o no se entiende.
Color? parseHexColor(String? hex) {
  if (hex == null) return null;
  final h = hex.replaceFirst('#', '').trim();
  if (h.length != 6) return null;
  final v = int.tryParse(h, radix: 16);
  return v == null ? null : Color(0xFF000000 | v);
}

/// Tarjeta del formulario con título en mayúsculas (mismo lenguaje que el
/// detalle de la venta).
class FormSection extends StatelessWidget {
  const FormSection({
    super.key,
    required this.title,
    required this.child,
    this.trailing,
  });
  final String title;
  final Widget child;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    return AdminCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  title.toUpperCase(),
                  style: TextStyle(
                    fontFamily: 'Orbitron',
                    fontSize: 10.5,
                    letterSpacing: 2,
                    fontWeight: FontWeight.w700,
                    color: c.textFaint,
                  ),
                ),
              ),
              ?trailing,
            ],
          ),
          const SizedBox(height: 12),
          child,
        ],
      ),
    );
  }
}

/// Aviso de error en línea (errores del servidor, validaciones).
class InlineError extends StatelessWidget {
  const InlineError(this.message, {super.key});
  final String message;

  @override
  Widget build(BuildContext context) => Container(
        width: double.infinity,
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: Brand.danger.withValues(alpha: 0.12),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Icon(Icons.error_outline_rounded, color: Brand.danger, size: 20),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                message,
                style: const TextStyle(color: Brand.danger, fontSize: 13, height: 1.35),
              ),
            ),
          ],
        ),
      );
}

/// Etiqueta chica con el mismo aspecto que [MiniTag], para textos LIBRES (la
/// categoría de un producto o de una venta, hasta 80 caracteres): si no entra
/// en el ancho disponible se corta con "…" en vez de desbordar la tarjeta.
class TextTag extends StatelessWidget {
  const TextTag(this.text, {super.key, this.icon});
  final String text;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: c.surface2,
        borderRadius: BorderRadius.circular(99),
        border: Border.all(color: c.border),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[Icon(icon, size: 11, color: c.textDim), const SizedBox(width: 4)],
          Flexible(
            child: Text(
              text,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(fontSize: 11, color: c.textDim, fontWeight: FontWeight.w600),
            ),
          ),
        ],
      ),
    );
  }
}

/// Campo de monto en pesos ("$ 2.500"). Acepta coma o punto.
class MoneyField extends StatelessWidget {
  const MoneyField({
    super.key,
    required this.controller,
    required this.label,
    this.onChanged,
    this.errorText,
    this.helperText,
    this.enabled = true,
  });
  final TextEditingController controller;
  final String label;
  final ValueChanged<String>? onChanged;
  final String? errorText;
  final String? helperText;
  final bool enabled;

  @override
  Widget build(BuildContext context) => TextField(
        controller: controller,
        enabled: enabled,
        onChanged: onChanged,
        keyboardType: const TextInputType.numberWithOptions(decimal: true),
        inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'[0-9.,]'))],
        decoration: InputDecoration(
          labelText: label,
          prefixText: r'$ ',
          errorText: errorText,
          helperText: helperText,
          helperMaxLines: 4,
        ),
      );
}

/// Cantidad con − y + (mínimo 1).
class QtyStepper extends StatelessWidget {
  const QtyStepper({
    super.key,
    required this.value,
    required this.onChanged,
    this.min = 1,
    this.max = 9999,
  });
  final int value;
  final ValueChanged<int> onChanged;
  final int min;
  final int max;

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    Widget button(IconData icon, String tip, bool enabled, VoidCallback onTap) =>
        IconButton(
          tooltip: tip,
          visualDensity: VisualDensity.compact,
          constraints: const BoxConstraints.tightFor(width: 40, height: 40),
          padding: EdgeInsets.zero,
          icon: Icon(icon, size: 20),
          color: Brand.gold,
          disabledColor: c.textFaint,
          onPressed: enabled ? onTap : null,
        );
    return Container(
      decoration: BoxDecoration(
        color: c.surface2,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: c.border),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          button(Icons.remove_rounded, 'Menos', value > min, () => onChanged(value - 1)),
          ConstrainedBox(
            constraints: const BoxConstraints(minWidth: 28),
            child: Text(
              '$value',
              textAlign: TextAlign.center,
              style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15),
            ),
          ),
          button(Icons.add_rounded, 'Más', value < max, () => onChanged(value + 1)),
        ],
      ),
    );
  }
}

/// Círculo con el color del filamento.
class ColorDot extends StatelessWidget {
  const ColorDot(this.hex, {super.key, this.size = 18});
  final String? hex;
  final double size;

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    final color = parseHexColor(hex);
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: color ?? c.surface3,
        border: Border.all(color: color == null ? c.border : c.textFaint.withValues(alpha: 0.4)),
      ),
      child: color == null
          ? Icon(Icons.palette_outlined, size: size * 0.6, color: c.textFaint)
          : null,
    );
  }
}
