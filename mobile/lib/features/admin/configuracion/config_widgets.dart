import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/common.dart';
import '../admin_widgets.dart';
import 'config_api.dart';

/// Mensaje para mostrar de cualquier error: el del servidor si lo hay.
String apiErrorText(Object e) =>
    e is ApiException ? e.message : 'No pudimos completar la operación. Probá de nuevo.';

void showOk(BuildContext context, String message) {
  ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(SnackBar(content: Text(message)));
}

/// Botón principal de una acción que no se deshace: mismo formato que el resto
/// de la app (el tema pone la forma y la letra; acá solo va el rojo).
final ButtonStyle _dangerButton =
    FilledButton.styleFrom(backgroundColor: Brand.danger, foregroundColor: Colors.white);

/// "Hay cambios sin guardar" → true si el usuario elige salir igual.
Future<bool> confirmDiscard(BuildContext context) async {
  final out = await showDialog<bool>(
    context: context,
    builder: (ctx) => AlertDialog(
      // Con letra grande en un teléfono chico, la pregunta se desplaza y los
      // botones quedan siempre a la vista (2026-11-14).
      scrollable: true,
      title: const Text('Cambios sin guardar'),
      content: const Text('Si salís ahora, vas a perder lo que cambiaste en esta sección.'),
      actions: [
        TextButton(onPressed: () => Navigator.of(ctx).pop(false), child: const Text('Seguir editando')),
        FilledButton(
          style: _dangerButton,
          onPressed: () => Navigator.of(ctx).pop(true),
          child: const Text('Salir sin guardar'),
        ),
      ],
    ),
  );
  return out ?? false;
}

/// Confirmación de una acción (destructiva en rojo).
Future<bool> confirmAction(
  BuildContext context, {
  required String title,
  required String message,
  required String confirmLabel,
  bool destructive = false,
}) async {
  final out = await showDialog<bool>(
    context: context,
    builder: (ctx) => AlertDialog(
      // Con letra grande en un teléfono chico, la pregunta se desplaza y los
      // botones quedan siempre a la vista (2026-11-14).
      scrollable: true,
      title: Text(title),
      content: Text(message),
      actions: [
        TextButton(onPressed: () => Navigator.of(ctx).pop(false), child: const Text('Cancelar')),
        FilledButton(
          style: destructive ? _dangerButton : null,
          onPressed: () => Navigator.of(ctx).pop(true),
          child: Text(confirmLabel),
        ),
      ],
    ),
  );
  return out ?? false;
}

/// Base de las pantallas de una sección de Configuración: sabe si hay cambios
/// sin guardar (compara el [snapshot] actual contra el último guardado), si
/// está guardando y qué error devolvió el servidor.
abstract class ConfigFormState<T extends ConsumerStatefulWidget> extends ConsumerState<T> {
  String _baseline = '';
  bool saving = false;
  String? error;

  /// Todo lo que el usuario puede cambiar en la pantalla, como JSON simple.
  Object? snapshot();

  /// Toma lo que hay ahora como "lo guardado" (al abrir y tras guardar).
  void markClean() => _baseline = jsonEncode(snapshot());

  bool get dirty => jsonEncode(snapshot()) != _baseline;

  /// Algo cambió: redibuja (habilita "Guardar") y limpia el error anterior.
  void touch() => setState(() => error = null);

  /// Ejecuta el guardado. Devuelve true si salió bien: queda "limpio", se
  /// refresca la configuración de la lista y se avisa con un SnackBar.
  Future<bool> save(Future<void> Function() call, String okMessage) async {
    setState(() {
      saving = true;
      error = null;
    });
    try {
      await call();
      if (!mounted) return true;
      markClean();
      ref.invalidate(adminConfigProvider);
      setState(() => saving = false);
      showOk(context, okMessage);
      return true;
    } catch (e) {
      if (!mounted) return false;
      setState(() {
        saving = false;
        error = apiErrorText(e);
      });
      return false;
    }
  }
}

/// Esqueleto de una sección: título, contenido, aviso si el rol no puede
/// editar, barra inferior con "Guardar" (deshabilitado sin cambios) y
/// confirmación al salir con cambios sin guardar.
class ConfigSectionScaffold extends StatelessWidget {
  const ConfigSectionScaffold({
    super.key,
    required this.title,
    required this.children,
    required this.dirty,
    required this.saving,
    required this.canEdit,
    required this.onSave,
    required this.onChanged,
    this.error,
    this.saveLabel = 'Guardar cambios',
    this.readOnlyNote = 'Tu rol puede ver esta sección, pero no cambiarla.',
  });

  final String title;
  final List<Widget> children;
  final bool dirty;
  final bool saving;
  final bool canEdit;
  final VoidCallback onSave;

  /// Algún campo cambió (se conecta al `Form`).
  final VoidCallback onChanged;
  final String? error;
  final String saveLabel;
  final String readOnlyNote;

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    // Alto del teclado: la barra de "Guardar" se apoya arriba del teclado
    // (2026-11-14, pedido de Ale): antes quedaba tapada por el teclado y no
    // había forma de guardar sin cerrarlo primero.
    final keyboard = MediaQuery.viewInsetsOf(context).bottom;
    return PopScope(
      canPop: !dirty || saving,
      onPopInvokedWithResult: (didPop, _) async {
        if (didPop) return;
        final leave = await confirmDiscard(context);
        if (leave && context.mounted) Navigator.of(context).pop();
      },
      child: Scaffold(
        appBar: AppBar(title: Text(title)),
        // Columna dentro de un scroll (no un ListView perezoso): los formularios
        // son cortos y así un campo con error siempre existe y se puede mostrar.
        // SafeArea: en solo lectura no hay barra de "Guardar" y lo último de la
        // pantalla quedaba debajo de la barra de gestos / de los tres botones.
        body: SafeArea(
          top: false,
          child: Form(
            onChanged: onChanged,
            child: SingleChildScrollView(
              keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 28),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  if (!canEdit)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: AdminCard(
                        accent: Brand.info,
                        padding: const EdgeInsets.all(12),
                        child: Row(
                          children: [
                            const Icon(Icons.visibility_rounded, size: 18, color: Brand.info),
                            const SizedBox(width: 10),
                            Expanded(child: Text(readOnlyNote, style: const TextStyle(fontSize: 13))),
                          ],
                        ),
                      ),
                    ),
                  ...children,
                ],
              ),
            ),
          ),
        ),
        bottomNavigationBar: canEdit
            ? Padding(
                // Sube con el teclado: "Guardar" queda siempre a la vista.
                padding: EdgeInsets.only(bottom: keyboard),
                child: Material(
                  color: c.bg,
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      border: Border(top: BorderSide(color: c.border)),
                    ),
                    child: SafeArea(
                      top: false,
                      child: Padding(
                        padding: const EdgeInsets.fromLTRB(16, 10, 16, 12),
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            if (error != null)
                              Padding(
                                padding: const EdgeInsets.only(bottom: 8),
                                child: Row(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    const Icon(Icons.error_outline_rounded, size: 18, color: Brand.danger),
                                    const SizedBox(width: 8),
                                    Expanded(
                                      child: Text(
                                        error!,
                                        style: const TextStyle(color: Brand.danger, fontSize: 13, height: 1.3),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            GoldButton(label: saveLabel, loading: saving, onPressed: dirty ? onSave : null),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
              )
            : null,
      ),
    );
  }
}

/// Campo de texto con la etiqueta arriba (como los formularios de la web).
class ConfigField extends StatelessWidget {
  const ConfigField({
    super.key,
    required this.controller,
    required this.label,
    this.hint,
    this.helper,
    this.errorText,
    this.keyboardType,
    this.maxLines = 1,
    this.maxLength,
    this.enabled = true,
    this.obscure = false,
    this.prefixText,
    this.suffixText,
    this.inputFormatters,
    this.textCapitalization = TextCapitalization.none,
    this.textInputAction,
  });

  final TextEditingController controller;
  final String label;
  final String? hint;
  final String? helper;
  final String? errorText;
  final TextInputType? keyboardType;
  final int maxLines;
  final int? maxLength;
  final bool enabled;
  final bool obscure;
  final String? prefixText;
  final String? suffixText;
  final List<TextInputFormatter>? inputFormatters;
  final TextCapitalization textCapitalization;
  final TextInputAction? textInputAction;

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    return _ScrollToError(
      hasError: errorText != null,
      child: Padding(
        padding: const EdgeInsets.only(bottom: 14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.only(left: 2, bottom: 6),
              child: Text(
                label,
                style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: c.textDim),
              ),
            ),
            TextFormField(
              controller: controller,
              enabled: enabled,
              obscureText: obscure,
              keyboardType: keyboardType,
              maxLines: obscure ? 1 : maxLines,
              minLines: maxLines > 1 ? (maxLines < 3 ? maxLines : 3) : 1,
              maxLength: maxLength,
              inputFormatters: inputFormatters,
              textCapitalization: textCapitalization,
              textInputAction:
                  textInputAction ?? (maxLines > 1 ? TextInputAction.newline : TextInputAction.next),
              autocorrect: !obscure,
              enableSuggestions: !obscure,
              style: TextStyle(color: enabled ? c.text : c.textDim, fontSize: 14.5),
              decoration: InputDecoration(
                hintText: hint,
                errorText: errorText,
                errorMaxLines: 3,
                prefixText: prefixText,
                suffixText: suffixText,
                counterText: '',
                isDense: true,
              ),
            ),
            if (helper != null)
              Padding(
                padding: const EdgeInsets.only(left: 2, top: 5),
                child: Text(helper!, style: TextStyle(fontSize: 11.5, color: c.textFaint, height: 1.3)),
              ),
          ],
        ),
      ),
    );
  }
}

/// Cuando un campo pasa a tener error, lo trae a la vista (si el formulario es
/// largo, el error puede quedar fuera de pantalla y no se vería por qué no guarda).
class _ScrollToError extends StatefulWidget {
  const _ScrollToError({required this.hasError, required this.child});
  final bool hasError;
  final Widget child;

  @override
  State<_ScrollToError> createState() => _ScrollToErrorState();
}

class _ScrollToErrorState extends State<_ScrollToError> {
  @override
  void didUpdateWidget(_ScrollToError old) {
    super.didUpdateWidget(old);
    if (widget.hasError && !old.hasError) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        Scrollable.ensureVisible(context, duration: const Duration(milliseconds: 250), alignment: 0.1);
      });
    }
  }

  @override
  Widget build(BuildContext context) => widget.child;
}

/// Fila con un interruptor (título + explicación).
class ConfigSwitchRow extends StatelessWidget {
  const ConfigSwitchRow({
    super.key,
    required this.title,
    required this.value,
    required this.onChanged,
    this.subtitle,
    this.enabled = true,
  });

  final String title;
  final String? subtitle;
  final bool value;
  final ValueChanged<bool>? onChanged;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
                if (subtitle != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 2),
                    child: Text(subtitle!, style: TextStyle(fontSize: 12, color: c.textDim, height: 1.3)),
                  ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Semantics(
            label: title,
            // Sin colores a mano: manda el tema (`switchTheme`).
            child: Switch(value: value, onChanged: enabled ? onChanged : null),
          ),
        ],
      ),
    );
  }
}

/// Subtítulo dentro de una tarjeta.
class ConfigCardTitle extends StatelessWidget {
  const ConfigCardTitle(this.text, {super.key, this.trailing});
  final String text;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 12),
    child: Row(
      children: [
        Expanded(
          child: Text(text, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15)),
        ),
        ?trailing,
      ],
    ),
  );
}

/// Texto de ayuda suave.
class ConfigHint extends StatelessWidget {
  const ConfigHint(this.text, {super.key});
  final String text;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 12),
    child: Text(text, style: TextStyle(fontSize: 12.5, color: context.hc.textDim, height: 1.4)),
  );
}

/// Etiqueta de estado con color (Conectado, Invitación pendiente…).
class StateChip extends StatelessWidget {
  const StateChip(this.text, {super.key, required this.color, this.icon});
  final String text;
  final Color color;
  final IconData? icon;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
    decoration: BoxDecoration(color: color.withValues(alpha: 0.15), borderRadius: BorderRadius.circular(99)),
    child: Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        if (icon != null) ...[Icon(icon, size: 12, color: color), const SizedBox(width: 4)],
        Flexible(
          child: Text(
            text,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: color),
          ),
        ),
      ],
    ),
  );
}

/// "#C9A84C" → Color (gris neutro si viene roto).
Color parseHex(String? hex, {Color fallback = const Color(0xFF8D8C99)}) {
  final h = (hex ?? '').replaceFirst('#', '').trim();
  if (h.length != 6) return fallback;
  final v = int.tryParse(h, radix: 16);
  return v == null ? fallback : Color(0xFF000000 | v);
}

/// Número sin ceros de más ("1500", "12.5"). Para rellenar campos numéricos.
String plainNumber(num v) => v == v.roundToDouble() ? '${v.toInt()}' : '$v';

/// Lee un número que el usuario escribió ("1.500", "1500,5", "").
/// Con coma, la coma es el decimal y el punto el de miles; un punto solo
/// agrupando de a tres dígitos ("1.500") también es de miles.
double? parseNumber(String text) {
  final t = text.trim().replaceAll(' ', '');
  if (t.isEmpty) return null;
  if (t.contains(',')) return double.tryParse(t.replaceAll('.', '').replaceAll(',', '.'));
  if (RegExp(r'^\d{1,3}(\.\d{3})+$').hasMatch(t)) return double.tryParse(t.replaceAll('.', ''));
  return double.tryParse(t);
}

/// Solo dígitos, punto y coma (para importes).
final List<TextInputFormatter> moneyFormatters = [FilteringTextInputFormatter.allow(RegExp(r'[0-9.,]'))];
