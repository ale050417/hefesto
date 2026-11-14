import 'package:flutter/material.dart';

import '../../../core/theme/app_theme.dart';
import '../stock_screen.dart' show hexColor;

/// SnackBar breve (reemplaza al anterior para que no se apilen).
void showToast(BuildContext context, String message) {
  ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(SnackBar(content: Text(message)));
}

/// Diálogo de confirmación para acciones que no se pueden deshacer.
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
      // Con un nombre de producto larguísimo y letra grande el texto no entra
      // en un teléfono chico: se desplaza y los botones quedan a la vista.
      scrollable: true,
      title: Text(title),
      content: Text(message),
      actions: [
        TextButton(onPressed: () => Navigator.of(ctx).pop(false), child: Text(cancelLabel)),
        TextButton(
          onPressed: () => Navigator.of(ctx).pop(true),
          // El dorado y el peso ya los pone el tema; solo lo destructivo va en rojo.
          style: destructive ? TextButton.styleFrom(foregroundColor: Brand.danger) : null,
          child: Text(confirmLabel),
        ),
      ],
    ),
  );
  return ok == true;
}

/// Cierra la hoja o pantalla de [context] SOLO si sigue siendo la de arriba.
/// Si el usuario ya la cerró mientras el servidor respondía, un `pop` a ciegas
/// cerraría la pantalla de abajo.
void popIfCurrent<T extends Object?>(BuildContext context, [T? result]) {
  final route = ModalRoute.of(context);
  if (route != null && route.isCurrent) Navigator.of(context).pop<T>(result);
}

/// Hoja inferior con una lista para elegir (carretes, colores, marcas…):
/// título fijo, lista que se desplaza y alto según el contenido. Se abre con
/// `showAppSheet` (2026-11-14, pedido de Ale: que los modales se vean bien):
///   • nunca ocupa toda la pantalla: arriba queda una franja para tocar y cerrar;
///   • la última fila queda por arriba de la barra de gestos del sistema
///     (usar [PickerSheet.listPadding] en la lista);
///   • si se abre el teclado (el diálogo de "Agregar"), se achica sin desbordar.
class PickerSheet extends StatelessWidget {
  const PickerSheet({
    super.key,
    required this.title,
    required this.child,
    this.action,
    this.notice,
  });

  final String title;

  /// Botón a la derecha del título (p. ej. "Agregar").
  final Widget? action;

  /// Aviso fijo entre el título y la lista (p. ej. un error del servidor).
  final Widget? notice;

  /// La lista (con `shrinkWrap: true`) o un aviso de vacío / cargando / error.
  final Widget child;

  /// Margen de la lista: deja la última fila arriba de la barra del sistema.
  static EdgeInsets listPadding(BuildContext context) =>
      EdgeInsets.only(bottom: 12 + MediaQuery.paddingOf(context).bottom);

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, box) => ConstrainedBox(
        constraints: BoxConstraints(maxHeight: box.maxHeight * 0.86),
        child: Padding(
          padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 0, 12, 8),
                child: Row(
                  children: [
                    Expanded(
                      child: Padding(
                        padding: const EdgeInsets.symmetric(vertical: 8),
                        child: Text(title, style: Theme.of(context).textTheme.titleLarge),
                      ),
                    ),
                    ?action,
                  ],
                ),
              ),
              if (notice != null)
                Padding(padding: const EdgeInsets.fromLTRB(20, 0, 20, 8), child: notice),
              Flexible(child: child),
            ],
          ),
        ),
      ),
    );
  }
}

/// Punto de color de un filamento (hex del catálogo; gris si no hay).
class ColorDot extends StatelessWidget {
  const ColorDot({super.key, required this.hex, this.size = 16});
  final String? hex;
  final double size;

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: hexColor(hex),
        border: Border.all(color: c.border, width: 1.2),
      ),
    );
  }
}

/// Rótulo de sección chico en mayúsculas (como "ACCIONES" en el detalle de venta).
class SectionLabel extends StatelessWidget {
  const SectionLabel(this.text, {super.key});
  final String text;

  @override
  Widget build(BuildContext context) => Text(
        text.toUpperCase(),
        style: TextStyle(
          fontFamily: 'Orbitron',
          fontSize: 10.5,
          letterSpacing: 2,
          fontWeight: FontWeight.w700,
          color: context.hc.textFaint,
        ),
      );
}

/// Error del servidor mostrado en línea dentro de un formulario o una hoja.
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
            const Icon(Icons.error_outline_rounded, size: 18, color: Brand.danger),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                message,
                style: const TextStyle(color: Brand.danger, fontSize: 13, fontWeight: FontWeight.w600),
              ),
            ),
          ],
        ),
      );
}

/// Chip de elección única con el estilo del panel.
class PickChip extends StatelessWidget {
  const PickChip({
    super.key,
    required this.label,
    required this.selected,
    required this.onTap,
    this.leading,
  });
  final String label;
  final bool selected;
  final VoidCallback onTap;
  final Widget? leading;

  @override
  Widget build(BuildContext context) {
    return ChoiceChip(
      avatar: leading,
      label: Text(label),
      selected: selected,
      onSelected: (_) => onTap(),
    );
  }
}
