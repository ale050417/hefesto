import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../../core/providers.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/common.dart';
import '../../../core/widgets/modals.dart';
import '../stock_screen.dart' show hexColor;
import 'filamentos_api.dart';
import 'filamentos_models.dart';
import 'shared_widgets.dart';

/// Qué catálogo se está eligiendo (`kind` en la API).
enum CatalogKind {
  color('color', 'Color', 'colores'),
  brand('brand', 'Marca', 'marcas'),
  material('material', 'Material', 'materiales');

  const CatalogKind(this.api, this.label, this.plural);
  final String api;
  final String label;
  final String plural;
}

/// Colores de muestra para armar uno nuevo sin tipear el hexadecimal.
const _presetHex = [
  '#1A1A1F', '#F4F4F0', '#C9A84C', '#8B8B95', '#D14B3C', '#E8833A',
  '#E6C229', '#3FA46A', '#2E7D6B', '#3A72C4', '#4B3A78', '#D96AA7',
];

final _hexRe = RegExp(r'^#[0-9a-fA-F]{6}$');

/// Campo de solo lectura que abre el selector del catálogo al tocarlo.
class CatalogField extends StatelessWidget {
  const CatalogField({
    super.key,
    required this.kind,
    required this.value,
    required this.onTap,
    this.hex,
    this.errorText,
  });
  final CatalogKind kind;
  final String value;
  final String? hex;
  final VoidCallback onTap;
  final String? errorText;

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    return InkWell(
      borderRadius: BorderRadius.circular(14),
      onTap: onTap,
      child: InputDecorator(
        decoration: InputDecoration(
          labelText: kind.label,
          errorText: errorText,
          suffixIcon: const Icon(Icons.unfold_more_rounded),
        ),
        child: Row(
          children: [
            if (kind == CatalogKind.color && value.isNotEmpty) ...[
              ColorDot(hex: hex, size: 18),
              const SizedBox(width: 10),
            ],
            Expanded(
              child: Text(
                value.isEmpty ? 'Elegí…' : value,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(color: value.isEmpty ? c.textFaint : c.text, fontSize: 15),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Abre el selector. Devuelve el nombre elegido (o el recién agregado), o null
/// si se cerró sin elegir.
Future<String?> showCatalogPicker(
  BuildContext context, {
  required CatalogKind kind,
  required String current,
}) {
  return showAppSheet<String>(
    context,
    builder: (_) => _CatalogSheet(kind: kind, current: current),
  );
}

class _Option {
  const _Option(this.name, [this.hex]);
  final String name;
  final String? hex;
}

class _CatalogSheet extends ConsumerStatefulWidget {
  const _CatalogSheet({required this.kind, required this.current});
  final CatalogKind kind;
  final String current;

  @override
  ConsumerState<_CatalogSheet> createState() => _CatalogSheetState();
}

class _CatalogSheetState extends ConsumerState<_CatalogSheet> {
  bool _busy = false;

  /// Error del servidor al agregar o quitar. Va DENTRO de la hoja: un aviso
  /// (SnackBar) saldría detrás de ella y no se vería.
  String? _error;

  List<_Option> _options(FilamentCatalog cat) {
    final list = switch (widget.kind) {
      CatalogKind.color => [for (final c in cat.colors) _Option(c.name, c.hex)],
      CatalogKind.brand => [for (final b in cat.brands) _Option(b)],
      CatalogKind.material => [for (final m in cat.materials) _Option(m)],
    };
    // Un valor viejo (texto libre) que todavía no está en el catálogo igual
    // tiene que poder verse y elegirse (mismo criterio que la web).
    final cur = widget.current.trim();
    if (cur.isNotEmpty && !list.any((o) => o.name.toLowerCase() == cur.toLowerCase())) {
      list.add(_Option(cur));
    }
    list.sort((a, b) => a.name.toLowerCase().compareTo(b.name.toLowerCase()));
    return list;
  }

  Future<void> _add() async {
    final result = await showDialog<({String name, String? hex})>(
      context: context,
      builder: (_) => _AddDialog(kind: widget.kind),
    );
    if (result == null || !mounted) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await ref.read(filamentosApiProvider).addCatalog(
            widget.kind.api,
            result.name,
            hex: result.hex,
          );
      ref.invalidate(filamentCatalogProvider);
      if (mounted) popIfCurrent(context, result.name);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } catch (_) {
      if (mounted) setState(() => _error = 'No pudimos agregarlo. Probá de nuevo.');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _remove(_Option o) async {
    final ok = await confirmDialog(
      context,
      title: '¿Quitar «${o.name}» del catálogo?',
      message: 'Deja de aparecer en la lista. Los carretes que ya lo usan no cambian.',
      confirmLabel: 'Quitar',
      destructive: true,
    );
    if (!ok || !mounted) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await ref.read(filamentosApiProvider).removeCatalog(widget.kind.api, o.name);
      ref.invalidate(filamentCatalogProvider);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } catch (_) {
      if (mounted) setState(() => _error = 'No pudimos quitarlo. Probá de nuevo.');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    final me = ref.watch(meProvider).value;
    final canAdd = me?.can('filamentos', 'crear') ?? false;
    final canRemove = me?.can('filamentos', 'eliminar') ?? false;
    final catalog = ref.watch(filamentCatalogProvider);

    return PickerSheet(
      title: widget.kind.label,
      action: canAdd
          ? TextButton.icon(
              onPressed: _busy ? null : _add,
              icon: const Icon(Icons.add_rounded, size: 18),
              label: const Text('Agregar'),
            )
          : null,
      notice: _error == null ? null : InlineError(_error!),
      child: catalog.when(
        loading: () => const LoadingView(),
        error: (e, _) => ErrorView(
          message: '$e',
          onRetry: () => ref.invalidate(filamentCatalogProvider),
        ),
        data: (cat) {
          final options = _options(cat);
          if (options.isEmpty) {
            return EmptyView(
              icon: Icons.palette_outlined,
              title: 'Todavía no hay ${widget.kind.plural}',
              subtitle: canAdd ? 'Tocá «Agregar» para cargar el primero.' : null,
            );
          }
          return ListView.builder(
            shrinkWrap: true,
            padding: PickerSheet.listPadding(context),
            itemCount: options.length,
            itemBuilder: (_, i) {
              final o = options[i];
              final selected = o.name.toLowerCase() == widget.current.trim().toLowerCase();
              return ListTile(
                leading: widget.kind == CatalogKind.color ? ColorDot(hex: o.hex, size: 24) : null,
                title: Text(
                  o.name,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontWeight: selected ? FontWeight.w800 : FontWeight.w500,
                    color: selected ? Brand.gold : c.text,
                  ),
                ),
                trailing: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    if (selected) const Icon(Icons.check_rounded, color: Brand.gold),
                    if (canRemove)
                      IconButton(
                        tooltip: 'Quitar del catálogo',
                        icon: Icon(Icons.delete_outline_rounded, size: 20, color: c.textFaint),
                        onPressed: _busy ? null : () => _remove(o),
                      ),
                  ],
                ),
                onTap: () => Navigator.of(context).pop(o.name),
              );
            },
          );
        },
      ),
    );
  }
}

/// Alta de un color / marca / material nuevo en el catálogo.
class _AddDialog extends StatefulWidget {
  const _AddDialog({required this.kind});
  final CatalogKind kind;

  @override
  State<_AddDialog> createState() => _AddDialogState();
}

class _AddDialogState extends State<_AddDialog> {
  final _name = TextEditingController();
  final _hexText = TextEditingController(text: '#C9A84C');
  String _hex = '#C9A84C';
  String? _error;

  @override
  void dispose() {
    _name.dispose();
    _hexText.dispose();
    super.dispose();
  }

  void _submit() {
    final name = _name.text.trim();
    if (name.isEmpty) {
      setState(() => _error = 'Ingresá el nombre.');
      return;
    }
    if (name.length > 40) {
      setState(() => _error = 'Máximo 40 letras.');
      return;
    }
    String? hex;
    if (widget.kind == CatalogKind.color) {
      final raw = _hexText.text.trim();
      final withHash = raw.startsWith('#') ? raw : '#$raw';
      if (!_hexRe.hasMatch(withHash)) {
        setState(() => _error = 'Elegí un color válido (ej. #FF5733).');
        return;
      }
      hex = withHash.toUpperCase();
    }
    Navigator.of(context).pop((name: name, hex: hex));
  }

  @override
  Widget build(BuildContext context) {
    final isColor = widget.kind == CatalogKind.color;
    return AlertDialog(
      // Con campos adentro SIEMPRE `scrollable`: en un teléfono chico con el
      // teclado abierto el diálogo no entra entero (2026-11-14, pedido de Ale).
      scrollable: true,
      title: Text('Nuevo ${widget.kind.label.toLowerCase()}'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          TextField(
            controller: _name,
            autofocus: true,
            maxLength: 40,
            textCapitalization: TextCapitalization.sentences,
            textInputAction: isColor ? TextInputAction.next : TextInputAction.done,
            onChanged: (_) => setState(() => _error = null),
            onSubmitted: isColor ? null : (_) => _submit(),
            decoration: InputDecoration(
              labelText: isColor ? 'Nombre del color' : 'Nombre',
              counterText: '',
            ),
          ),
          if (isColor) ...[
            const SizedBox(height: 10),
            // Cada muestra ocupa 44 dp (el círculo se ve de 34): más chicas
            // costaba acertarles con el dedo.
            Wrap(
              children: [
                for (final h in _presetHex)
                  InkResponse(
                    key: ValueKey('preset-$h'),
                    radius: 22,
                    onTap: () => setState(() {
                      _hex = h;
                      _hexText.text = h;
                      _error = null;
                    }),
                    child: SizedBox(
                      width: 44,
                      height: 44,
                      child: Center(
                        child: Container(
                          width: 34,
                          height: 34,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: hexColor(h),
                            border: Border.all(
                              color: _hex.toUpperCase() == h.toUpperCase()
                                  ? Brand.gold
                                  : context.hc.borderStrong,
                              width: _hex.toUpperCase() == h.toUpperCase() ? 3 : 1.2,
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 10),
            TextField(
              controller: _hexText,
              maxLength: 7,
              autocorrect: false,
              textCapitalization: TextCapitalization.characters,
              textInputAction: TextInputAction.done,
              onChanged: (v) => setState(() {
                final t = v.trim();
                final withHash = t.startsWith('#') ? t : '#$t';
                if (_hexRe.hasMatch(withHash)) _hex = withHash;
                _error = null;
              }),
              onSubmitted: (_) => _submit(),
              decoration: InputDecoration(
                labelText: 'Código (#RRGGBB)',
                counterText: '',
                prefixIcon: Padding(
                  padding: const EdgeInsets.all(12),
                  child: ColorDot(hex: _hex, size: 20),
                ),
              ),
            ),
          ],
          if (_error != null) ...[
            const SizedBox(height: 10),
            Text(_error!, style: const TextStyle(color: Brand.danger, fontSize: 12.5)),
          ],
        ],
      ),
      actions: [
        TextButton(onPressed: () => Navigator.of(context).pop(), child: const Text('Cancelar')),
        TextButton(onPressed: _submit, child: const Text('Agregar')),
      ],
    );
  }
}
