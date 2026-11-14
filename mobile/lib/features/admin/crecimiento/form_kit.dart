// Piezas compartidas por los módulos Clientes, Descuentos y Recompensas del
// panel móvil: avisos, confirmaciones, tarjetas de número, formularios.
// Todo con los tokens del tema (`context.hc` / `Brand`), así se ve bien en los
// tres modos (oscuro, claro y luz nocturna).

import 'package:flutter/material.dart';

import '../../../core/api/api_client.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/common.dart';
import '../../../core/widgets/modals.dart';
import '../admin_widgets.dart';

// El selector de día vive en `core/widgets/modals.dart` (lo usan varios
// módulos); se reexporta acá para los que ya lo importaban desde este archivo.
export '../../../core/widgets/modals.dart' show pickDay;

/// Texto para mostrar de un error: el del servidor (ya viene en castellano) o
/// uno genérico si fue otra cosa.
String errorMessage(Object e) =>
    e is ApiException ? e.message : 'No pudimos completar la operación. Probá de nuevo.';

void showToast(BuildContext context, String message) {
  ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(SnackBar(content: Text(message)));
}

/// Pregunta de confirmación (acciones destructivas o que no se deshacen).
Future<bool> confirmAction(
  BuildContext context, {
  required String title,
  String? message,
  String confirmLabel = 'Confirmar',
  bool destructive = false,
}) async {
  final ok = await showDialog<bool>(
    context: context,
    builder: (ctx) => AlertDialog(
      // (2026-11-14, pedido de Ale: que los modales se vean bien.) El título
      // lleva el nombre de lo que se borra (un cupón, una recompensa) y el
      // servidor no le pone tope de largo: si no entra, la pregunta se
      // desplaza y los botones quedan siempre a la vista.
      scrollable: true,
      title: Text(title),
      content: message == null ? null : Text(message),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(ctx).pop(false),
          child: const Text('Cancelar'),
        ),
        FilledButton(
          style: destructive
              ? FilledButton.styleFrom(
                  backgroundColor: Brand.danger,
                  foregroundColor: Colors.white,
                )
              : null,
          onPressed: () => Navigator.of(ctx).pop(true),
          child: Text(confirmLabel),
        ),
      ],
    ),
  );
  return ok == true;
}

/// Número grande con su rótulo (contadores del encabezado de cada módulo).
class StatBox extends StatelessWidget {
  const StatBox({
    super.key,
    required this.label,
    required this.value,
    this.color = Brand.gold,
    this.icon,
  });
  final String label;
  final String value;
  final Color color;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    return AdminCard(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
      accent: color,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              if (icon != null) ...[
                Icon(icon, size: 15, color: color),
                const SizedBox(width: 6),
              ],
              Expanded(
                child: Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(fontSize: 12, color: c.textDim, fontWeight: FontWeight.w600),
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          FittedBox(
            fit: BoxFit.scaleDown,
            alignment: Alignment.centerLeft,
            child: Text(
              value,
              style: TextStyle(
                fontFamily: 'Orbitron',
                fontWeight: FontWeight.w800,
                fontSize: 20,
                color: color,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Error del servidor mostrado dentro del formulario.
class FormErrorBanner extends StatelessWidget {
  const FormErrorBanner(this.message, {super.key});
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
            Expanded(
              child: Text(
                message,
                style: const TextStyle(fontSize: 13, color: Brand.danger, fontWeight: FontWeight.w600),
              ),
            ),
          ],
        ),
      );
}

/// Bloque de un formulario: título en mayúsculas + tarjeta con los campos.
class FormSection extends StatelessWidget {
  const FormSection({super.key, required this.title, required this.children, this.hint});
  final String title;
  final String? hint;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        AdminSectionTitle(title),
        AdminCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              for (var i = 0; i < children.length; i++) ...[
                if (i > 0) const SizedBox(height: 14),
                children[i],
              ],
              if (hint != null) ...[
                const SizedBox(height: 10),
                Text(hint!, style: TextStyle(fontSize: 11.5, color: c.textFaint, height: 1.35)),
              ],
            ],
          ),
        ),
      ],
    );
  }
}

/// Barra fija de abajo con el botón "Guardar". Deshabilitado (`onPressed` nulo)
/// mientras no haya nada para guardar.
class SaveBar extends StatelessWidget {
  const SaveBar({
    super.key,
    required this.label,
    required this.onPressed,
    this.loading = false,
    this.error,
  });
  final String label;
  final VoidCallback? onPressed;
  final bool loading;

  /// Aviso de validación o error del servidor. Va fijo arriba del botón: al
  /// final del formulario quedaba fuera de la vista y "Guardar" parecía no
  /// hacer nada.
  final String? error;

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    return Container(
      decoration: BoxDecoration(
        color: c.bg,
        border: Border(top: BorderSide(color: c.border)),
      ),
      // (2026-11-14, pedido de Ale: que todo funcione en el celular.) La barra
      // sube con el teclado: como `bottomNavigationBar` quedaba tapada por él
      // y no se podía guardar sin cerrarlo antes (en iPhone el teclado
      // numérico ni siquiera tiene tecla para cerrarse).
      padding: EdgeInsets.fromLTRB(16, 10, 16, 10 + MediaQuery.viewInsetsOf(context).bottom),
      child: SafeArea(
        top: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (error != null) ...[
              FormErrorBanner(error!),
              const SizedBox(height: 10),
            ],
            GoldButton(label: label, onPressed: onPressed, loading: loading),
          ],
        ),
      ),
    );
  }
}

/// Si hay cambios sin guardar, al volver pregunta antes de descartarlos.
class DiscardGuard extends StatelessWidget {
  const DiscardGuard({super.key, required this.dirty, required this.child});
  final bool dirty;
  final Widget child;

  @override
  Widget build(BuildContext context) => PopScope(
        canPop: !dirty,
        onPopInvokedWithResult: (didPop, _) async {
          if (didPop) return;
          final discard = await confirmAction(
            context,
            title: '¿Descartar los cambios?',
            message: 'Si salís ahora, se pierde lo que cargaste.',
            confirmLabel: 'Descartar',
            destructive: true,
          );
          if (discard && context.mounted) Navigator.of(context).pop();
        },
        child: child,
      );
}

/// Elección entre pocas opciones (tipo de descuento, a qué aplica…).
class ChoiceRow<T> extends StatelessWidget {
  const ChoiceRow({
    super.key,
    required this.options,
    required this.value,
    required this.onChanged,
  });

  /// (valor, rótulo, ícono opcional)
  final List<(T, String, IconData?)> options;
  final T value;
  final ValueChanged<T> onChanged;

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: [
        for (final o in options)
          ChoiceChip(
            avatar: o.$3 == null
                ? null
                : Icon(o.$3, size: 16, color: value == o.$1 ? Brand.gold : c.textDim),
            label: Text(o.$2),
            selected: value == o.$1,
            onSelected: (_) => onChanged(o.$1),
          ),
      ],
    );
  }
}

/// Fila con título, ayuda y un interruptor.
class SwitchRow extends StatelessWidget {
  const SwitchRow({
    super.key,
    required this.title,
    required this.value,
    required this.onChanged,
    this.subtitle,
  });
  final String title;
  final String? subtitle;
  final bool value;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    return InkWell(
      borderRadius: BorderRadius.circular(12),
      onTap: () => onChanged(!value),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
                if (subtitle != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 2),
                    child: Text(subtitle!, style: TextStyle(fontSize: 12, color: c.textDim, height: 1.3)),
                  ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Switch(value: value, onChanged: onChanged),
        ],
      ),
    );
  }
}

/// Campo "tipo selector": muestra lo elegido y abre una lista al tocarlo.
class PickerField extends StatelessWidget {
  const PickerField({
    super.key,
    required this.label,
    required this.value,
    required this.onTap,
    this.placeholder = 'Elegir…',
    this.errorText,
    this.onClear,
  });
  final String label;
  final String? value;
  final String placeholder;
  final String? errorText;
  final VoidCallback onTap;
  final VoidCallback? onClear;

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    final has = value != null && value!.isNotEmpty;
    return InkWell(
      borderRadius: BorderRadius.circular(14),
      onTap: onTap,
      child: InputDecorator(
        decoration: InputDecoration(
          labelText: label,
          errorText: errorText,
          suffixIcon: has && onClear != null
              ? IconButton(
                  tooltip: 'Quitar',
                  icon: const Icon(Icons.close_rounded, size: 20),
                  onPressed: onClear,
                )
              : Icon(Icons.keyboard_arrow_down_rounded, color: c.textDim),
        ),
        child: Text(
          has ? value! : placeholder,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(color: has ? c.text : c.textFaint, fontSize: 14.5),
        ),
      ),
    );
  }
}

/// Un elemento de una lista de opciones (producto, categoría…).
class IdName {
  const IdName(this.id, this.name);
  final String id;
  final String name;

  factory IdName.fromJson(Map<String, dynamic> j) =>
      IdName('${j['id'] ?? ''}', ('${j['name'] ?? ''}').trim());
}

/// Lista con buscador en una hoja desde abajo. Devuelve lo elegido (o null).
Future<IdName?> showOptionPicker(
  BuildContext context, {
  required String title,
  required List<IdName> options,
  String? selectedId,
  String searchHint = 'Buscar…',
  String emptyText = 'No hay nada para elegir.',
}) =>
    showAppSheet<IdName>(
      context,
      builder: (_) => _OptionSheet(
        title: title,
        options: options,
        selectedId: selectedId,
        searchHint: searchHint,
        emptyText: emptyText,
      ),
    );

class _OptionSheet extends StatefulWidget {
  const _OptionSheet({
    required this.title,
    required this.options,
    required this.selectedId,
    required this.searchHint,
    required this.emptyText,
  });
  final String title;
  final List<IdName> options;
  final String? selectedId;
  final String searchHint;
  final String emptyText;

  @override
  State<_OptionSheet> createState() => _OptionSheetState();
}

class _OptionSheetState extends State<_OptionSheet> {
  final _search = TextEditingController();

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    final q = _search.text.trim().toLowerCase();
    final shown = q.isEmpty
        ? widget.options
        : widget.options.where((o) => o.name.toLowerCase().contains(q)).toList();
    final keyboardOpen = MediaQuery.viewInsetsOf(context).bottom > 0;
    return Padding(
      // (2026-11-14, pedido de Ale: que los modales se vean bien.) Con el
      // teclado abierto todo sube con él; cerrado, la lista termina arriba de
      // la barra de gestos (antes las últimas opciones quedaban debajo).
      padding: EdgeInsets.only(bottom: sheetBottomInset(context)),
      child: FractionallySizedBox(
        // Con el teclado abierto queda poco alto: la hoja lo usa entero.
        heightFactor: keyboardOpen ? 1 : 0.85,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 0, 8, 6),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      widget.title,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.titleLarge,
                    ),
                  ),
                  // Con el teclado abierto la hoja ocupa toda la pantalla y no
                  // queda dónde tocar afuera: la cruz es la forma de cerrarla.
                  IconButton(
                    tooltip: 'Cerrar',
                    icon: const Icon(Icons.close_rounded),
                    onPressed: () => Navigator.of(context).pop(),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: TextField(
                controller: _search,
                onChanged: (_) => setState(() {}),
                decoration: InputDecoration(
                  hintText: widget.searchHint,
                  prefixIcon: const Icon(Icons.search_rounded),
                  suffixIcon: _search.text.isEmpty
                      ? null
                      : IconButton(
                          icon: const Icon(Icons.close_rounded),
                          onPressed: () => setState(_search.clear),
                        ),
                ),
              ),
            ),
            const SizedBox(height: 6),
            Expanded(
              child: shown.isEmpty
                  ? Center(
                      child: Padding(
                        padding: const EdgeInsets.all(24),
                        child: Text(
                          widget.options.isEmpty ? widget.emptyText : 'Sin resultados.',
                          style: TextStyle(color: c.textDim),
                        ),
                      ),
                    )
                  : ListView.builder(
                      padding: const EdgeInsets.only(bottom: 16),
                      itemCount: shown.length,
                      itemBuilder: (_, i) {
                        final o = shown[i];
                        final selected = o.id == widget.selectedId;
                        return ListTile(
                          title: Text(o.name, maxLines: 2, overflow: TextOverflow.ellipsis),
                          trailing: selected
                              ? const Icon(Icons.check_rounded, color: Brand.gold)
                              : null,
                          onTap: () => Navigator.of(context).pop(o),
                        );
                      },
                    ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Círculo dorado con la inicial (clientes).
class InitialAvatar extends StatelessWidget {
  const InitialAvatar(this.name, {super.key, this.size = 44});
  final String name;
  final double size;

  @override
  Widget build(BuildContext context) {
    final t = name.trim();
    return Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: const BoxDecoration(gradient: Brand.goldGradient, shape: BoxShape.circle),
      child: Text(
        t.isEmpty ? '?' : t.characters.first.toUpperCase(),
        style: TextStyle(
          fontFamily: 'Orbitron',
          fontWeight: FontWeight.w800,
          fontSize: size * 0.4,
          color: Brand.goldFg,
        ),
      ),
    );
  }
}

/// Número tipeado a la argentina: "2.000" (miles) → 2000; "1.500,50" → 1500.5;
/// "15,5" o "15.5" → 15.5. Vacío o ilegible → null.
double? parseAmount(String raw) {
  var t = raw.trim().replaceAll(' ', '').replaceAll('\$', '');
  if (t.isEmpty) return null;
  if (RegExp(r'^\d{1,3}(\.\d{3})+(,\d+)?$').hasMatch(t)) t = t.replaceAll('.', '');
  t = t.replaceAll(',', '.');
  return double.tryParse(t);
}

/// Número sin ceros de más para volver a mostrarlo en un campo: 2000.0 → "2000".
String plainNumber(num v) => v == v.roundToDouble() ? '${v.round()}' : '$v'.replaceAll('.', ',');
