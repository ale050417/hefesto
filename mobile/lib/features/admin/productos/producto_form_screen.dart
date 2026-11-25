import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/common.dart';
import '../../../core/widgets/modals.dart';
import '../admin_widgets.dart';
import 'catalogo_ui.dart';
import 'category_picker.dart';
import 'producto_drafts.dart';
import 'producto_drafts_provider.dart';
import 'producto_form_logic.dart';
import 'productos_models.dart';
import 'productos_providers.dart';

/// Alta (sin [product]) y edición (con [product]) de un producto. Al guardar
/// vuelve con el id del producto. En la edición solo se mandan los campos que
/// cambiaron y el botón "Guardar" está apagado si no hay cambios.
///
/// Las fotos se manejan en la ficha del producto (`ProductGallery`): hace falta
/// que el producto exista para subirlas. Los colores y los tamaños NO se editan
/// acá (se cargan desde el panel web). El alta nace como borrador: publicar
/// exige fotos.
///
/// Lo que se va cargando se guarda solo en el teléfono (pedido del operador:
/// "a veces cierro sin querer y debo de empezar todo de nuevo"). En el alta
/// queda en "Borradores sin guardar" del listado y con [draft] se retoma; en la
/// edición, al volver a abrir el producto se ofrece recuperar los cambios.
class AdminProductFormScreen extends ConsumerStatefulWidget {
  const AdminProductFormScreen({super.key, this.product, this.draft})
      : assert(product == null || draft == null, 'un borrador solo se retoma en el alta');
  final AdminProductDetail? product;

  /// Alta: borrador que se retoma (lo que se siga cargando lo actualiza).
  final ProductDraft? draft;

  @override
  ConsumerState<AdminProductFormScreen> createState() => _AdminProductFormScreenState();
}

class _AdminProductFormScreenState extends ConsumerState<AdminProductFormScreen> {
  /// Con qué arranca el formulario: el borrador que se retoma, el producto
  /// que se edita, o vacío.
  late final ProductDraftFields _seed = widget.draft?.fields ??
      (widget.product == null ? const ProductDraftFields() : _fieldsOf(widget.product!));

  late final _name = TextEditingController(text: _seed.name);
  late final _desc = TextEditingController(text: _seed.description);
  late final _price = TextEditingController(text: _seed.priceText);
  late final _sale = TextEditingController(text: _seed.saleText);
  late final _weight = TextEditingController(text: _seed.weightText);
  late final _minutes = TextEditingController(text: _seed.minutesText);
  late final _dims = TextEditingController(text: _seed.dimensions);
  late final _production = TextEditingController(text: _seed.productionTime);

  late String? _categoryId = _seed.categoryId;
  late String? _categoryLabel = _seed.categoryLabel;
  late String? _material = _seed.material;
  late bool _featured = _seed.featured;

  static ProductDraftFields _fieldsOf(AdminProductDetail p) => ProductDraftFields(
        name: p.name,
        description: p.description ?? '',
        categoryId: p.categoryId,
        categoryLabel: p.categoryPath ?? p.categoryName,
        material: p.material,
        priceText: numberToField(p.price),
        saleText: numberToField(p.salePrice),
        weightText: p.weightGrams?.toString() ?? '',
        minutesText: p.printTimeMinutes?.toString() ?? '',
        dimensions: p.dimensions ?? '',
        productionTime: p.productionTime ?? '',
        featured: p.isFeatured,
      );

  late final ProductFormValues? _initial =
      widget.product == null ? null : ProductFormValues.fromDetail(widget.product!);

  bool _busy = false;
  String? _error;
  Map<String, String> _errors = const {};

  /// Hay un selector (categoría / material) abriéndose: un segundo toque
  /// mientras cargan las opciones abría dos hojas, una encima de la otra.
  bool _picking = false;

  /// Un ancla por campo, en el orden de la pantalla: al guardar con errores se
  /// lleva a la vista el primero (ver [_revealFirstError]).
  final _fieldKeys = <String, GlobalKey>{
    for (final id in const [
      'name',
      'category',
      'description',
      'price',
      'salePrice',
      'weight',
      'minutes',
      'dimensions',
      'productionTime',
    ])
      id: GlobalKey(),
  };

  bool get _isEdit => widget.product != null;

  /// Lo que hay en pantalla, tal cual está escrito.
  ProductDraftFields _fields() => ProductDraftFields(
        name: _name.text,
        description: _desc.text,
        categoryId: _categoryId,
        categoryLabel: _categoryLabel,
        material: _material,
        priceText: _price.text,
        saleText: _sale.text,
        weightText: _weight.text,
        minutesText: _minutes.text,
        dimensions: _dims.text,
        productionTime: _production.text,
        featured: _featured,
      );

  ProductFormValues _values() => _fields().toValues();

  // ---- Borrador local ------------------------------------------------------

  /// Se toma al abrir: también se usa cuando la pantalla ya se cerró.
  late final ProductDraftsController _drafts;
  late final AppLifecycleListener _lifecycle;

  /// Alta: el borrador al que se va guardando (null = todavía no hay ninguno).
  late String? _draftId = widget.draft?.id;
  Timer? _draftTimer;

  /// Hay cambios que todavía no se pasaron al borrador.
  bool _draftDirty = false;

  /// El producto se guardó (o la persona descartó los cambios): ya no se
  /// escribe ningún borrador.
  bool _draftClosed = false;

  /// Fecha de modificación del producto que se edita, como se guarda en el
  /// borrador (para avisar si alguien lo cambió en el medio).
  String? get _productStamp => widget.product?.updatedAt?.toUtc().toIso8601String();

  @override
  void initState() {
    super.initState();
    _drafts = ref.read(productDraftsProvider.notifier);
    // Al salir de la app (o si el sistema la cierra) no se espera al reloj.
    _lifecycle = AppLifecycleListener(
      onStateChange: (state) {
        if (state != AppLifecycleState.resumed) _flushDraft();
      },
    );
    if (_isEdit) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _offerRecovery());
    }
  }

  /// Cambió algo: se guarda el borrador cuando la persona deja de tipear.
  void _touch() {
    if (_draftClosed) return;
    _draftDirty = true;
    _draftTimer?.cancel();
    _draftTimer = Timer(const Duration(milliseconds: 600), _flushDraft);
  }

  /// Guarda ya lo pendiente (si hay).
  void _flushDraft() {
    _draftTimer?.cancel();
    _draftTimer = null;
    if (!_draftDirty || _draftClosed) return;
    _draftDirty = false;
    _draftWrite()();
  }

  /// Arma el guardado del borrador con lo que hay en pantalla AHORA; se
  /// ejecuta después (al cerrarse la pantalla los campos ya no existen).
  VoidCallback _draftWrite() {
    final fields = _fields();
    final drafts = _drafts;
    final now = DateTime.now();
    final product = widget.product;
    if (product != null) {
      // Edición: solo mientras haya cambios respecto de lo guardado.
      if (fields.toValues() == _initial) return () => drafts.removeEdit(product.id);
      final draft = ProductDraft(
        id: 'edit-${product.id}',
        updatedAt: now,
        fields: fields,
        productId: product.id,
        productUpdatedAt: _productStamp,
      );
      return () => drafts.saveEdit(draft);
    }
    if (fields.isBlank) {
      // Un alta vacía no deja borrador (y si se vació uno, se va).
      final id = _draftId;
      _draftId = null;
      return () {
        if (id != null) drafts.remove(id);
      };
    }
    final id = _draftId ??= now.microsecondsSinceEpoch.toRadixString(36);
    final draft = ProductDraft(id: id, updatedAt: now, fields: fields);
    return () => drafts.save(draft);
  }

  /// El producto quedó guardado: su borrador ya no hace falta.
  void _closeDraft() {
    _draftClosed = true;
    _draftTimer?.cancel();
    final product = widget.product;
    if (product != null) {
      _drafts.removeEdit(product.id);
    } else if (_draftId != null) {
      _drafts.remove(_draftId!);
    }
  }

  /// Edición: si quedaron cambios sin guardar de la vez anterior (se cerró la
  /// app, se apagó el teléfono), se ofrece recuperarlos.
  Future<void> _offerRecovery() async {
    if (!mounted) return;
    final product = widget.product!;
    final draft = ref.read(productDraftsProvider).editOf(product.id);
    if (draft == null) return;
    if (draft.fields.toValues() == _initial) {
      _drafts.removeEdit(product.id);
      return;
    }
    final stale = draft.productUpdatedAt != _productStamp;
    final recover = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        scrollable: true,
        title: const Text('Cambios sin guardar'),
        content: Text(
          stale
              ? 'Tenés cambios sin guardar de la última vez. ¿Recuperarlos?\n\n'
                  'El producto se modificó después de eso: revisá los datos antes de guardar.'
              : 'Tenés cambios sin guardar de la última vez. ¿Recuperarlos?',
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Descartar')),
          TextButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Recuperar')),
        ],
      ),
    );
    // Cerrado sin elegir (tocar afuera, "atrás"): no se pierde ni se aplica.
    if (recover == null || !mounted) return;
    if (!recover) {
      _drafts.removeEdit(product.id);
      return;
    }
    final f = draft.fields;
    setState(() {
      _name.text = f.name;
      _desc.text = f.description;
      _price.text = f.priceText;
      _sale.text = f.saleText;
      _weight.text = f.weightText;
      _minutes.text = f.minutesText;
      _dims.text = f.dimensions;
      _production.text = f.productionTime;
      _categoryId = f.categoryId;
      _categoryLabel = f.categoryLabel;
      _material = f.material;
      _featured = f.featured;
      _errors = const {};
    });
  }

  @override
  void dispose() {
    _draftTimer?.cancel();
    _lifecycle.dispose();
    if (_draftDirty && !_draftClosed) {
      // La pantalla se cerró con algo pendiente. Se guarda apenas termina de
      // desarmarse (avisar a quien mira los borradores en este instante no
      // se puede: el árbol de pantallas está bloqueado).
      Future.microtask(_draftWrite());
    }
    for (final c in [_name, _desc, _price, _sale, _weight, _minutes, _dims, _production]) {
      c.dispose();
    }
    super.dispose();
  }

  /// Categorías y materiales para los selectores (ya precargados por la
  /// pantalla). Si la carga anterior falló —se abrió el formulario sin
  /// conexión— se vuelve a pedir: antes el error quedaba guardado y el selector
  /// no abría nunca más hasta salir de la pantalla (perdiendo lo cargado).
  /// Devuelve `null` (y avisa) si no se pudieron traer.
  Future<ProductOptions?> _loadOptions() async {
    if (ref.read(adminProductOptionsProvider).hasError) {
      ref.invalidate(adminProductOptionsProvider);
    }
    try {
      return await ref.read(adminProductOptionsProvider.future);
    } on ApiException catch (e) {
      if (mounted) showSnack(context, e.message, error: true);
    } catch (_) {
      if (mounted) showSnack(context, 'No pudimos cargar las opciones. Probá de nuevo.', error: true);
    }
    return null;
  }

  Future<void> _pickCategory() async {
    if (_picking) return;
    _picking = true;
    // Se suelta el campo que tenía el foco: si no, al cerrar la hoja el
    // teclado vuelve a abrirse solo.
    FocusManager.instance.primaryFocus?.unfocus();
    try {
      final options = await _loadOptions();
      if (options == null || !mounted) return;
      final pick = await pickCategory(
        context,
        options: options.categories,
        selectedId: _categoryId,
      );
      final id = pick?.id;
      if (id == null || !mounted) return;
      setState(() {
        _categoryId = id;
        _categoryLabel = options.categories.where((o) => o.id == id).firstOrNull?.path;
        _errors = {..._errors}..remove('category');
      });
      _touch();
    } finally {
      _picking = false;
    }
  }

  Future<void> _pickMaterial() async {
    if (_picking) return;
    _picking = true;
    FocusManager.instance.primaryFocus?.unfocus();
    try {
      final options = await _loadOptions();
      if (options == null || !mounted) return;
      // En el orden que manda el servidor (alfabético en castellano). Si el
      // producto tiene un material que ya no tiene filamento cargado, igual se
      // muestra para no perderlo.
      final current = _material;
      final materials = [
        ...options.materials,
        if (current != null && !options.materials.contains(current)) current,
      ];
      // Hoja estándar de la app (2026-11-14, pedido de Ale: "que se vean bien
      // los modales"). Antes era una hoja de media pantalla: con muchos
      // materiales la lista quedaba apretada y la última fila, debajo de la
      // barra de gestos.
      final picked = await showAppSheet<({String? value})>(
        context,
        builder: (ctx) {
          Widget row(String label, String? value, IconData icon, Color iconColor) {
            final selected = value == _material;
            return ListTile(
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              // La elegida: fondo suave + letra gruesa + tilde.
              tileColor: selected ? Brand.gold.withValues(alpha: 0.14) : null,
              leading: Icon(icon, size: 20, color: iconColor),
              title: Text(
                label,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: selected ? const TextStyle(fontWeight: FontWeight.w700) : null,
              ),
              trailing: selected ? const Icon(Icons.check_rounded, color: Brand.gold) : null,
              onTap: () => Navigator.pop(ctx, (value: value)),
            );
          }

          return SheetBody(
            // Las filas ya traen su margen interno.
            padding: const EdgeInsets.symmetric(horizontal: 8),
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(12, 0, 12, 10),
                child: Text('Material', style: Theme.of(ctx).textTheme.titleLarge),
              ),
              // Material propio: el fondo de la fila elegida se desplaza y se
              // recorta con la lista (si no, se pintaba sobre la manija).
              Material(
                type: MaterialType.transparency,
                child: Column(
                  children: [
                    row('Sin definir', null, Icons.block_rounded, ctx.hc.textDim),
                    for (final m in materials) row(m, m, Icons.layers_rounded, Brand.gold),
                  ],
                ),
              ),
            ],
          );
        },
      );
      if (picked != null && mounted) {
        setState(() => _material = picked.value);
        _touch();
      }
    } finally {
      _picking = false;
    }
  }

  /// Lleva a la vista el primer campo con error. Sin esto, tocar "Crear
  /// producto" desde el final del formulario con el nombre vacío no mostraba
  /// nada (el error quedaba arriba, fuera de la pantalla) y el botón parecía
  /// no hacer nada.
  void _revealFirstError(Map<String, String> errors) {
    for (final entry in _fieldKeys.entries) {
      if (!errors.containsKey(entry.key)) continue;
      final target = entry.value.currentContext;
      if (target != null) {
        Scrollable.ensureVisible(
          target,
          alignment: 0.1,
          duration: const Duration(milliseconds: 250),
          curve: Curves.easeOut,
        );
      }
      return;
    }
  }

  Future<void> _save() async {
    // Un segundo toque antes de que la pantalla se redibuje mandaba el alta
    // dos veces (dos productos iguales).
    if (_busy) return;
    // Se cierra el teclado: así se ve el resultado (el campo con error, o el
    // aviso del servidor arriba del botón).
    FocusManager.instance.primaryFocus?.unfocus();
    final values = _values();
    final errors = values.validate();
    if (errors.isNotEmpty) {
      setState(() {
        _errors = errors;
        _error = null;
      });
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _revealFirstError(errors);
      });
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
      _errors = const {};
    });
    try {
      final repo = ref.read(productosRepoProvider);
      final String id;
      if (_isEdit) {
        id = widget.product!.id;
        await repo.patch(id, values.diffAgainst(_initial!));
      } else {
        id = await repo.create(values.toCreateBody());
      }
      // Ya está en el servidor: el borrador se va (aunque la pantalla se haya
      // cerrado mientras guardaba; si no, quedaría para crearlo dos veces).
      _closeDraft();
      invalidateProducts(ref);
      if (!mounted) return;
      showSnack(
        context,
        _isEdit
            ? 'Cambios guardados'
            : 'Producto creado como borrador. Sumale las fotos para publicarlo.',
      );
      Navigator.of(context).pop(id);
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
    if (!leave || !mounted) return;
    // Lo descartó a propósito: tampoco queda para "recuperar" la próxima vez.
    _draftClosed = true;
    _draftTimer?.cancel();
    _drafts.removeEdit(widget.product!.id);
    Navigator.of(context).pop();
  }

  /// Alta: se salió sin crear el producto. Nada se pierde: lo cargado queda en
  /// "Borradores sin guardar" del listado, y se avisa.
  void _leftCreate() {
    if (_draftClosed) return;
    _flushDraft();
    if (_draftId != null && !_busy) showSnack(context, 'Guardado en Borradores');
  }

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    // Se precarga: así los selectores abren al instante.
    final options = ref.watch(adminProductOptionsProvider);
    final values = _values();
    final changed = _isEdit ? values != _initial : true;
    // Con la edición sin cambios (o guardando) no se puede apretar "Guardar".
    final canSave = !_busy && (!_isEdit || changed);
    // ¿Se perdería algo al salir? Solo en la edición con cambios: se pregunta.
    // El alta se deja salir siempre: lo cargado ya está en un borrador.
    final unsaved = _isEdit && changed && !_busy;

    return PopScope(
      canPop: !unsaved,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) {
          _confirmLeave();
        } else if (!_isEdit) {
          _leftCreate();
        }
      },
      child: Scaffold(
        appBar: AppBar(title: Text(_isEdit ? 'Editar producto' : 'Nuevo producto')),
        body: Column(
          children: [
            Expanded(
              // Columna y no lista perezosa: todos los campos existen siempre,
              // así al guardar se puede llevar a la vista el que tiene el error.
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
                keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    if (!_isEdit)
                      AdminCard(
                        accent: Brand.info,
                        padding: const EdgeInsets.all(14),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Icon(Icons.info_outline_rounded, size: 20, color: Brand.info),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Text(
                                'El producto se crea como borrador. Al guardarlo se abre su ficha: '
                                'ahí le sumás las fotos y lo publicás.',
                                style: TextStyle(fontSize: 12.5, height: 1.4, color: c.textDim),
                              ),
                            ),
                          ],
                        ),
                      ),
                    const AdminSectionTitle('Básicos'),
                    _field(_name, 'Nombre', id: 'name', maxLength: 120, capitalize: true),
                    const SizedBox(height: 12),
                    _picker(
                      label: 'Categoría',
                      value: _categoryLabel,
                      placeholder: 'Elegí una categoría',
                      id: 'category',
                      onTap: _pickCategory,
                      loading: options.isLoading,
                    ),
                    const SizedBox(height: 12),
                    _field(
                      _desc,
                      'Descripción (opcional)',
                      id: 'description',
                      maxLines: 4,
                      maxLength: 2000,
                      capitalize: true,
                    ),
                    const AdminSectionTitle('Precio'),
                    _field(_price, 'Precio', id: 'price', money: true, prefix: '\$ '),
                    const SizedBox(height: 12),
                    _field(
                      _sale,
                      'Precio de oferta (opcional)',
                      id: 'salePrice',
                      money: true,
                      prefix: '\$ ',
                      helper: 'Dejalo vacío si no hay oferta. Tiene que ser menor al precio.',
                    ),
                    const AdminSectionTitle('Ficha técnica'),
                    Padding(
                      padding: const EdgeInsets.only(bottom: 10, left: 4),
                      child: Text(
                        _isEdit
                            ? 'Con el material, los gramos y los minutos de impresión se calcula el costo '
                                'de producción.'
                            : 'Con el material, los gramos y los minutos de impresión se calcula el costo de producción '
                                '(es obligatorio para crear el producto).',
                        style: TextStyle(fontSize: 12, color: c.textDim, height: 1.35),
                      ),
                    ),
                    _picker(
                      label: 'Material',
                      value: _material,
                      placeholder: 'Sin definir',
                      onTap: _pickMaterial,
                      loading: options.isLoading,
                    ),
                    const SizedBox(height: 12),
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          child: _field(_weight, 'Gramos', id: 'weight', digits: true),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: _field(
                            _minutes,
                            // Rótulo corto: "Tiempo (min)" se cortaba con letra grande.
                            'Minutos',
                            id: 'minutes',
                            digits: true,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    _field(_dims, 'Medidas (opcional)', id: 'dimensions', maxLength: 120),
                    const SizedBox(height: 12),
                    _field(
                      _production,
                      'Tiempo de entrega (opcional)',
                      id: 'productionTime',
                      maxLength: 120,
                    ),
                    const AdminSectionTitle('Tienda'),
                    AdminCard(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      child: SwitchListTile(
                        contentPadding: const EdgeInsets.symmetric(horizontal: 12),
                        title: const Text('Destacado', style: TextStyle(fontWeight: FontWeight.w600)),
                        subtitle: Text(
                          'Aparece en la sección de destacados del inicio.',
                          style: TextStyle(fontSize: 12, color: c.textDim),
                        ),
                        // Sin colores a mano: el tema ya pinta el interruptor
                        // (con el pulgar dorado la pista quedaba color oliva).
                        value: _featured,
                        onChanged: _busy
                            ? null
                            : (v) {
                                setState(() => _featured = v);
                                _touch();
                              },
                      ),
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
                      label: _isEdit ? 'Guardar cambios' : 'Crear producto',
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

  Widget _field(
    TextEditingController controller,
    String label, {
    required String id,
    String? helper,
    String? prefix,
    int maxLines = 1,
    int? maxLength,
    bool money = false,
    bool digits = false,
    bool capitalize = false,
  }) {
    return TextField(
      key: _fieldKeys[id],
      controller: controller,
      enabled: !_busy,
      maxLines: maxLines,
      maxLength: maxLength,
      onChanged: (_) {
        setState(() {
          // Al corregir un campo se le saca el error.
          if (_errors.isNotEmpty) _errors = const {};
        });
        _touch();
      },
      textCapitalization: capitalize ? TextCapitalization.sentences : TextCapitalization.none,
      keyboardType: money
          ? const TextInputType.numberWithOptions(decimal: true)
          : digits
              ? TextInputType.number
              : (maxLines > 1 ? TextInputType.multiline : TextInputType.text),
      inputFormatters: [
        if (money) FilteringTextInputFormatter.allow(RegExp(r'[0-9.,]')),
        if (digits) FilteringTextInputFormatter.digitsOnly,
        // Gramos y minutos son enteros de 32 bits en la base: 9 cifras entran
        // siempre (con más, el servidor fallaba con un error genérico).
        if (digits) LengthLimitingTextInputFormatter(9),
      ],
      decoration: InputDecoration(
        labelText: label,
        alignLabelWithHint: maxLines > 1,
        helperText: helper,
        helperMaxLines: 2,
        prefixText: prefix,
        errorText: _errors[id],
        errorMaxLines: 2,
        // Sin contador de letras: ocupa lugar y no aporta.
        counterText: '',
      ),
    );
  }

  Widget _picker({
    required String label,
    required String? value,
    required String placeholder,
    required VoidCallback onTap,
    String? id,
    bool loading = false,
  }) {
    final c = context.hc;
    return InkWell(
      key: id == null ? null : _fieldKeys[id],
      borderRadius: BorderRadius.circular(14),
      onTap: _busy ? null : onTap,
      child: InputDecorator(
        decoration: InputDecoration(
          labelText: label,
          errorText: id == null ? null : _errors[id],
          errorMaxLines: 2,
          suffixIcon: loading
              ? const Padding(
                  padding: EdgeInsets.all(14),
                  child: SizedBox.square(
                    dimension: 18,
                    child: AppSpinner(),
                  ),
                )
              : Icon(Icons.arrow_drop_down_rounded, color: c.textDim),
        ),
        child: Text(
          value ?? placeholder,
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(color: value == null ? c.textFaint : c.text),
        ),
      ),
    );
  }
}
