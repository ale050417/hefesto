import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/common.dart';
import '../admin_widgets.dart';
import '../productos/catalogo_ui.dart';
import '../productos/category_picker.dart';
import '../stock_screen.dart' show hexColor;
import 'categorias_models.dart';
import 'categorias_providers.dart';

/// Alta y edición de una categoría o subcategoría: nombre, ícono, color y padre.
/// Vuelve con `true` si se guardó. El slug lo arma el servidor (y se conserva al
/// renombrar). La imagen de la categoría se cambia desde el panel web.
class AdminCategoryFormScreen extends ConsumerStatefulWidget {
  const AdminCategoryFormScreen({
    super.key,
    required this.all,
    this.category,
    this.initialParentId,
  });

  /// Todas las categorías (para elegir el padre y evitar ciclos).
  final List<AdminCategory> all;

  /// Categoría a editar; `null` = alta.
  final AdminCategory? category;

  /// Padre preseleccionado al crear desde "Nueva subcategoría".
  final String? initialParentId;

  @override
  ConsumerState<AdminCategoryFormScreen> createState() => _AdminCategoryFormScreenState();
}

class _AdminCategoryFormScreenState extends ConsumerState<AdminCategoryFormScreen> {
  late final _name = TextEditingController(text: widget.category?.name ?? '');
  late String _icon = widget.category?.icon ?? kCategoryIcons.keys.first;
  late String _color = widget.category?.color ?? kCategoryColors.first;
  late String? _parentId = widget.category?.parentId ?? widget.initialParentId;

  bool _busy = false;
  String? _error;
  String? _nameError;

  /// Ancla del campo "Nombre": al guardar con el nombre vacío se lo lleva a la
  /// vista (si no, desde el final del formulario el error no se veía).
  final _nameKey = GlobalKey();

  bool get _isEdit => widget.category != null;

  @override
  void dispose() {
    _name.dispose();
    super.dispose();
  }

  /// ¿Cambió algo respecto de lo guardado? (en el alta, siempre).
  bool get _changed {
    final cat = widget.category;
    if (cat == null) return true;
    return _name.text.trim() != cat.name ||
        _icon != (cat.icon ?? kCategoryIcons.keys.first) ||
        _color.toLowerCase() != (cat.color ?? kCategoryColors.first).toLowerCase() ||
        _parentId != cat.parentId;
  }

  /// En el alta: ¿ya se cargó algo que se perdería al salir?
  bool get _started =>
      _name.text.trim().isNotEmpty ||
      _icon != kCategoryIcons.keys.first ||
      _color != kCategoryColors.first ||
      _parentId != widget.initialParentId;

  AdminCategory? _byId(String? id) =>
      id == null ? null : widget.all.where((c) => c.id == id).firstOrNull;

  Future<void> _pickParent() async {
    // Padre posible: cualquiera menos ella misma y su propia descendencia.
    final self = widget.category;
    final exclude = self == null ? <String>{} : {self.id, ...descendantIdsOf(widget.all, self.id)};
    // Se suelta el nombre: si no, al cerrar la hoja el teclado vuelve a abrirse.
    FocusManager.instance.primaryFocus?.unfocus();
    final pick = await pickCategory(
      context,
      options: [for (final c in widget.all) c.toOption()],
      selectedId: _parentId,
      noneLabel: 'Ninguna (categoría principal)',
      title: 'Dentro de…',
      excludeIds: exclude,
    );
    if (pick != null && mounted) setState(() => _parentId = pick.id);
  }

  Future<void> _save() async {
    // Un segundo toque antes de que la pantalla se redibuje creaba dos veces.
    if (_busy) return;
    FocusManager.instance.primaryFocus?.unfocus();
    final name = _name.text.trim();
    if (name.isEmpty) {
      setState(() => _nameError = 'Poné un nombre.');
      // El nombre puede haber quedado arriba, fuera de la vista.
      WidgetsBinding.instance.addPostFrameCallback((_) {
        final target = _nameKey.currentContext;
        if (mounted && target != null) {
          Scrollable.ensureVisible(
            target,
            alignment: 0.1,
            duration: const Duration(milliseconds: 250),
            curve: Curves.easeOut,
          );
        }
      });
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
      _nameError = null;
    });
    try {
      final repo = ref.read(categoriasRepoProvider);
      final cat = widget.category;
      if (cat == null) {
        await repo.create({
          'name': name,
          'icon': _icon,
          'color': _color,
          'parentId': ?_parentId,
        });
      } else {
        // Solo lo que cambió (el slug no se toca).
        await repo.update(cat.id, {
          if (name != cat.name) 'name': name,
          if (_icon != (cat.icon ?? kCategoryIcons.keys.first)) 'icon': _icon,
          if (_color.toLowerCase() != (cat.color ?? kCategoryColors.first).toLowerCase())
            'color': _color,
          if (_parentId != cat.parentId) 'parentId': _parentId,
        });
      }
      invalidateCategories(ref);
      if (!mounted) return;
      showSnack(context, _isEdit ? 'Categoría actualizada' : 'Categoría creada');
      Navigator.of(context).pop(true);
    } on ApiException catch (e) {
      if (mounted) {
        setState(() {
          _busy = false;
          _error = e.message;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _busy = false;
          _error = 'Ocurrió un error inesperado. Probá de nuevo.';
        });
      }
    }
  }

  Future<void> _confirmLeave() async {
    final leave = await confirmDialog(
      context,
      title: '¿Descartar los cambios?',
      message: 'Lo que cargaste no se guardó.',
      confirmLabel: 'Descartar',
      cancelLabel: 'Seguir editando',
      destructive: true,
    );
    if (leave && mounted) Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    final tint = hexColor(_color, fallback: Brand.gold);
    final parent = _byId(_parentId);
    final changed = _changed;
    final canSave = !_busy && changed;
    // ¿Se perdería algo al salir? En la edición, cualquier cambio; en el alta,
    // lo que ya se haya cargado (antes "atrás" lo descartaba sin avisar).
    final unsaved = (_isEdit ? changed : _started) && !_busy;
    final imageUrl = widget.category?.imageUrl;

    return PopScope(
      canPop: !unsaved,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _confirmLeave();
      },
      child: Scaffold(
        appBar: AppBar(
          title: Text(_isEdit
              ? 'Editar categoría'
              : (widget.initialParentId != null ? 'Nueva subcategoría' : 'Nueva categoría')),
        ),
        body: Column(
          children: [
            Expanded(
              // Columna y no lista perezosa: el nombre existe siempre, así se
              // lo puede llevar a la vista cuando falta.
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
                keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // Vista previa: así se ve el círculo de la categoría en la tienda.
                    AdminCard(
                      child: Column(
                        children: [
                          Text('VISTA PREVIA',
                              style: TextStyle(
                                fontFamily: 'Orbitron',
                                fontSize: 10,
                                letterSpacing: 2,
                                fontWeight: FontWeight.w700,
                                color: c.textFaint,
                              )),
                          const SizedBox(height: 12),
                          Container(
                            width: 84,
                            height: 84,
                            clipBehavior: Clip.antiAlias,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: tint.withValues(alpha: 0.15),
                              border: Border.all(color: tint.withValues(alpha: 0.45), width: 2),
                            ),
                            child: imageUrl != null
                                ? NetImage(imageUrl)
                                : Icon(categoryIconData(_icon), size: 36, color: tint),
                          ),
                          const SizedBox(height: 10),
                          Text(
                            _name.text.trim().isEmpty ? 'Categoría' : _name.text.trim(),
                            textAlign: TextAlign.center,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14),
                          ),
                          if (imageUrl != null) ...[
                            const SizedBox(height: 6),
                            Text(
                              'Tiene una imagen cargada (se cambia desde el panel web).',
                              textAlign: TextAlign.center,
                              style: TextStyle(fontSize: 11.5, color: c.textFaint),
                            ),
                          ],
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),
                    TextField(
                      key: _nameKey,
                      controller: _name,
                      enabled: !_busy,
                      maxLength: 80,
                      textCapitalization: TextCapitalization.sentences,
                      onChanged: (_) => setState(() => _nameError = null),
                      decoration: InputDecoration(
                        labelText: 'Nombre',
                        errorText: _nameError,
                        counterText: '',
                      ),
                    ),
                    const SizedBox(height: 12),
                    InkWell(
                      borderRadius: BorderRadius.circular(14),
                      onTap: _busy ? null : _pickParent,
                      child: InputDecorator(
                        decoration: InputDecoration(
                          labelText: 'Dentro de',
                          suffixIcon: Icon(Icons.arrow_drop_down_rounded, color: c.textDim),
                        ),
                        child: Text(
                          parent == null ? 'Ninguna (categoría principal)' : parent.path,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(color: parent == null ? c.textDim : c.text),
                        ),
                      ),
                    ),
                    const AdminSectionTitle('Ícono'),
                    Wrap(
                      spacing: 10,
                      runSpacing: 10,
                      children: [
                        for (final e in kCategoryIcons.entries)
                          _Swatch(
                            selected: _icon == e.key,
                            tooltip: kCategoryIconLabels[e.key] ?? e.key,
                            onTap: _busy ? null : () => setState(() => _icon = e.key),
                            child: Icon(e.value, size: 22, color: _icon == e.key ? Brand.gold : c.textDim),
                          ),
                      ],
                    ),
                    const AdminSectionTitle('Color'),
                    Wrap(
                      spacing: 12,
                      runSpacing: 12,
                      children: [
                        for (final hex in kCategoryColors)
                          _Swatch(
                            selected: _color.toLowerCase() == hex.toLowerCase(),
                            tooltip: kCategoryColorLabels[hex] ?? hex,
                            round: true,
                            onTap: _busy ? null : () => setState(() => _color = hex),
                            child: Container(
                              width: 26,
                              height: 26,
                              decoration: BoxDecoration(color: hexColor(hex), shape: BoxShape.circle),
                            ),
                          ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
            SafeArea(
              top: false,
              child: Container(
                padding: const EdgeInsets.fromLTRB(16, 10, 16, 12),
                decoration: BoxDecoration(
                  color: c.surface1,
                  border: Border(top: BorderSide(color: c.border)),
                ),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    if (_error != null) ...[InlineError(_error!), const SizedBox(height: 10)],
                    GoldButton(
                      label: _isEdit ? 'Guardar cambios' : 'Crear categoría',
                      icon: Icons.check_rounded,
                      loading: _busy,
                      onPressed: canSave ? _save : null,
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Casilla elegible (ícono o color) con borde dorado cuando está elegida.
class _Swatch extends StatelessWidget {
  const _Swatch({
    required this.selected,
    required this.onTap,
    required this.child,
    required this.tooltip,
    this.round = false,
  });
  final bool selected;
  final VoidCallback? onTap;
  final Widget child;
  final String tooltip;
  final bool round;

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    final radius = BorderRadius.circular(round ? 99 : 14);
    return Tooltip(
      message: tooltip,
      child: InkWell(
        borderRadius: radius,
        onTap: onTap,
        child: Container(
          width: 48,
          height: 48,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            borderRadius: radius,
            color: selected ? Brand.gold.withValues(alpha: 0.15) : c.surface2,
            border: Border.all(color: selected ? Brand.gold : c.border, width: selected ? 2 : 1),
          ),
          child: child,
        ),
      ),
    );
  }
}
