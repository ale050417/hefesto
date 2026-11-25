import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../../core/format.dart';
import '../../../core/providers.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/common.dart';
import '../admin_widgets.dart';
import 'filamentos_api.dart';
import 'filamentos_format.dart';
import 'filamentos_models.dart';
import 'shared_widgets.dart';

/// "1 carrete" · "32 carretes".
String spoolsLabel(int n) => n == 1 ? '1 carrete' : '$n carretes';

/// Aviso después de guardar un tipo: si cambió el precio, cuántos carretes lo
/// tomaron (pedido de Agustín: "cambiarlo en un solo lugar y no en los 32").
/// Pura para poder probarla.
String typeSavedMessage({required bool isNew, required bool priceChanged, required int spools}) {
  if (isNew) return 'Tipo agregado';
  if (!priceChanged) return 'Tipo guardado';
  return 'Precio actualizado en ${spoolsLabel(spools)}';
}

/// Validación de "nombre + número" (tipo con precio, carrete con peso vacío).
/// Devuelve el mensaje de error, o null si está bien. Pura.
String? validateNameAmount(String name, String amount, {required String amountWhat, double? max}) {
  if (name.trim().isEmpty) return 'Ingresá el nombre.';
  final v = parseNumber(amount);
  if (v == null) return 'Ingresá $amountWhat.';
  if (v < 0) return 'No puede ser negativo.';
  if (max != null && v > max) return 'Revisá $amountWhat.';
  return null;
}

/// Lo que devuelve el diálogo de un tipo: la respuesta del servidor y el precio
/// que quedó guardado.
typedef TypeDialogResult = ({FilamentTypeSaved saved, double costPerKg});

/// Alta o edición de un TIPO de filamento (nombre + precio por kg). Guarda ella
/// misma y devuelve la respuesta del servidor, o null si se canceló.
Future<TypeDialogResult?> showFilamentTypeDialog(BuildContext context, {FilamentType? type}) {
  return showDialog<TypeDialogResult>(
    context: context,
    builder: (_) => _FilamentTypeDialog(type: type),
  );
}

/// Alta o edición de un modelo de CARRETE (nombre + peso vacío). Guarda ella
/// misma y devuelve el id del modelo, o null si se canceló.
Future<String?> showSpoolModelDialog(BuildContext context, {SpoolModel? model}) {
  return showDialog<String>(
    context: context,
    builder: (_) => _SpoolModelDialog(model: model),
  );
}

class _FilamentTypeDialog extends ConsumerWidget {
  const _FilamentTypeDialog({this.type});
  final FilamentType? type;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = type;
    return _NameAmountDialog<TypeDialogResult>(
      title: t == null ? 'Nuevo tipo' : 'Editar tipo',
      nameLabel: 'Nombre del tipo',
      nameHint: 'Ej: PLA, PETG, PLA Silk (Dorado)',
      amountLabel: 'Precio por kg',
      amountWhat: 'el precio por kg',
      prefix: r'$ ',
      initialName: t?.name ?? '',
      initialAmount: t == null ? '' : gramsField(t.costPerKg),
      // Lo tipeado, leído como plata: "26.000" con punto se lee 26, y así se ve
      // antes de guardar.
      preview: (v) => '${formatPrice(v)} por kg',
      note: t != null && t.spools > 0
          ? 'El precio nuevo se aplica a ${spoolsLabel(t.spools)} de este tipo.'
          : 'Los carretes que elijan este tipo toman este precio.',
      onSave: (name, amount) async {
        final api = ref.read(filamentosApiProvider);
        final saved = t == null
            ? await api.createType(name: name, costPerKg: amount)
            : await api.updateType(t.id, name: name, costPerKg: amount);
        return (saved: saved, costPerKg: amount);
      },
    );
  }
}

class _SpoolModelDialog extends ConsumerWidget {
  const _SpoolModelDialog({this.model});
  final SpoolModel? model;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final m = model;
    return _NameAmountDialog<String>(
      title: m == null ? 'Nuevo carrete' : 'Editar carrete',
      nameLabel: 'Nombre del carrete',
      nameHint: 'Ej: Grilon3 de cartón',
      amountLabel: 'Peso vacío',
      amountWhat: 'el peso del carrete vacío',
      suffix: 'g',
      max: 5000,
      initialName: m?.name ?? '',
      initialAmount: m == null ? '' : gramsField(m.emptyGrams),
      note: 'Pesá un carrete de este modelo ya terminado, sin filamento.',
      onSave: (name, amount) async {
        final api = ref.read(filamentosApiProvider);
        if (m == null) return api.createSpoolModel(name: name, emptyGrams: amount);
        await api.updateSpoolModel(m.id, name: name, emptyGrams: amount);
        return m.id;
      },
    );
  }
}

/// Diálogo "nombre + número" que guarda y muestra adentro el rechazo del
/// servidor (un aviso —SnackBar— saldría detrás y no se vería).
class _NameAmountDialog<T> extends StatefulWidget {
  const _NameAmountDialog({
    required this.title,
    required this.nameLabel,
    required this.nameHint,
    required this.amountLabel,
    required this.amountWhat,
    required this.initialName,
    required this.initialAmount,
    required this.onSave,
    this.prefix,
    this.suffix,
    this.max,
    this.note,
    this.preview,
  });

  final String title;
  final String nameLabel;
  final String nameHint;
  final String amountLabel;
  final String amountWhat;
  final String initialName;
  final String initialAmount;
  final String? prefix;
  final String? suffix;
  final double? max;
  final String? note;
  final String Function(double value)? preview;
  final Future<T> Function(String name, double amount) onSave;

  @override
  State<_NameAmountDialog<T>> createState() => _NameAmountDialogState<T>();
}

class _NameAmountDialogState<T> extends State<_NameAmountDialog<T>> {
  late final _name = TextEditingController(text: widget.initialName);
  late final _amount = TextEditingController(text: widget.initialAmount);
  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    _name.dispose();
    _amount.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_saving) return;
    final problem = validateNameAmount(_name.text, _amount.text, amountWhat: widget.amountWhat, max: widget.max);
    if (problem != null) {
      setState(() => _error = problem);
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    // El contenedor se toma ANTES del `await`: si el diálogo se cerró mientras
    // el servidor respondía, las listas igual se refrescan.
    final container = ProviderScope.containerOf(context, listen: false);
    try {
      final result = await widget.onSave(_name.text.trim(), parseNumber(_amount.text)!);
      invalidateFilamentos(container);
      if (mounted) popIfCurrent<T>(context, result);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } catch (_) {
      if (mounted) setState(() => _error = 'No pudimos guardar. Probá de nuevo.');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    final value = parseNumber(_amount.text);
    final preview = widget.preview != null && value != null && value >= 0 ? widget.preview!(value) : null;
    return AlertDialog(
      // Con campos adentro SIEMPRE `scrollable`: en un teléfono chico con el
      // teclado abierto el diálogo no entra entero.
      scrollable: true,
      title: Text(widget.title),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          TextField(
            controller: _name,
            autofocus: widget.initialName.isEmpty,
            maxLength: 60,
            textCapitalization: TextCapitalization.sentences,
            textInputAction: TextInputAction.next,
            onChanged: (_) => setState(() => _error = null),
            decoration: InputDecoration(
              labelText: widget.nameLabel,
              hintText: widget.nameHint,
              counterText: '',
            ),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _amount,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'[0-9.,]'))],
            textInputAction: TextInputAction.done,
            onChanged: (_) => setState(() => _error = null),
            onSubmitted: (_) => _submit(),
            decoration: InputDecoration(
              labelText: widget.amountLabel,
              prefixText: widget.prefix,
              suffixText: widget.suffix,
              helperText: preview,
              helperMaxLines: 2,
            ),
          ),
          if (widget.note != null) ...[
            const SizedBox(height: 10),
            Text(widget.note!, style: TextStyle(fontSize: 12.5, color: c.textDim, height: 1.35)),
          ],
          if (_error != null) ...[
            const SizedBox(height: 10),
            Text(_error!, style: const TextStyle(color: Brand.danger, fontSize: 12.5)),
          ],
        ],
      ),
      actions: [
        TextButton(
          onPressed: _saving ? null : () => Navigator.of(context).pop(),
          child: const Text('Cancelar'),
        ),
        TextButton(
          onPressed: _saving ? null : _submit,
          child: Text(_saving ? 'Guardando…' : 'Guardar'),
        ),
      ],
    );
  }
}

/// "Tipos y precios" (pedidos de Agustín, 2026-11-24): el precio por kg se
/// carga UNA vez por tipo (PLA, PETG, PLA Silk…) y lo toman todos sus carretes;
/// abajo, los modelos de carrete con su peso vacío para "Calcular filamento".
class FilamentTypesScreen extends ConsumerStatefulWidget {
  const FilamentTypesScreen({super.key});

  @override
  ConsumerState<FilamentTypesScreen> createState() => _FilamentTypesScreenState();
}

class _FilamentTypesScreenState extends ConsumerState<FilamentTypesScreen> {
  String? _busyId;

  Future<void> _refresh() async {
    ref.invalidate(filamentTypesProvider);
    try {
      await ref.read(filamentTypesProvider.future);
    } catch (_) {}
  }

  Future<void> _editType([FilamentType? type]) async {
    final res = await showFilamentTypeDialog(context, type: type);
    if (res == null || !mounted) return;
    showToast(
      context,
      typeSavedMessage(
        isNew: type == null,
        priceChanged: type != null && res.costPerKg != type.costPerKg,
        spools: res.saved.spools,
      ),
    );
  }

  Future<void> _editSpool([SpoolModel? model]) async {
    final id = await showSpoolModelDialog(context, model: model);
    if (id != null && mounted) showToast(context, model == null ? 'Carrete agregado' : 'Carrete guardado');
  }

  Future<void> _delete({
    required String id,
    required String title,
    required String message,
    required Future<void> Function(FilamentosApi api) run,
    required String done,
  }) async {
    final ok = await confirmDialog(
      context,
      title: title,
      message: message,
      confirmLabel: 'Eliminar',
      destructive: true,
    );
    if (!ok || !mounted) return;
    setState(() => _busyId = id);
    final container = ProviderScope.containerOf(context, listen: false);
    try {
      await run(ref.read(filamentosApiProvider));
      invalidateFilamentos(container);
      if (mounted) showToast(context, done);
    } on ApiException catch (e) {
      if (mounted) showToast(context, e.message);
    } catch (_) {
      if (mounted) showToast(context, 'No pudimos eliminarlo. Probá de nuevo.');
    } finally {
      if (mounted) setState(() => _busyId = null);
    }
  }

  Future<void> _deleteType(FilamentType t) => _delete(
        id: t.id,
        title: '¿Eliminar el tipo «${t.name}»?',
        message: t.spools > 0
            ? 'Hay ${spoolsLabel(t.spools)} de este tipo: conservan el precio que tienen y quedan sin tipo.'
            : 'Ningún carrete usa este tipo.',
        run: (api) => api.deleteType(t.id),
        done: 'Tipo eliminado',
      );

  Future<void> _deleteSpool(SpoolModel m) => _delete(
        id: m.id,
        title: '¿Eliminar el carrete «${m.name}»?',
        message: 'Deja de aparecer en «Calcular filamento». El stock de los filamentos no cambia.',
        run: (api) => api.deleteSpoolModel(m.id),
        done: 'Carrete eliminado',
      );

  Widget _row({
    required String title,
    required String subtitle,
    String? trailing,
    VoidCallback? onTap,
    VoidCallback? onDelete,
  }) {
    final c = context.hc;
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: AdminCard(
        onTap: onTap,
        padding: EdgeInsets.fromLTRB(14, 10, onDelete == null ? 14 : 4, 10),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14.5),
                  ),
                  Text(subtitle, style: TextStyle(fontSize: 12.5, color: c.textDim)),
                ],
              ),
            ),
            if (trailing != null) ...[
              const SizedBox(width: 8),
              Text(trailing, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14.5)),
            ],
            if (onDelete != null)
              IconButton(
                tooltip: 'Eliminar',
                onPressed: onDelete,
                icon: const Icon(Icons.delete_outline_rounded, color: Brand.danger),
              ),
          ],
        ),
      ),
    );
  }

  Widget _empty(String text) => Padding(
        padding: const EdgeInsets.only(bottom: 8),
        child: AdminCard(
          child: Text(text, style: TextStyle(color: context.hc.textDim, fontSize: 13, height: 1.4)),
        ),
      );

  Widget _addButton(String label, VoidCallback onPressed) => OutlinedButton.icon(
        icon: const Icon(Icons.add_rounded, size: 18),
        label: Text(label, maxLines: 1, overflow: TextOverflow.ellipsis),
        style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(48)),
        onPressed: _busyId == null ? onPressed : null,
      );

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    final me = ref.watch(meProvider).value;
    final denied = me != null && !me.can('filamentos', 'ver');
    final canEdit = me?.can('filamentos', 'editar') ?? false;
    final data = ref.watch(filamentTypesProvider);
    final idle = _busyId == null;

    return Scaffold(
      appBar: AppBar(title: const Text('Tipos y precios')),
      body: SafeArea(
        top: false,
        child: denied
            ? const AccessDenied(what: 'los tipos de filamento')
            : data.when(
                loading: () => const ListSkeleton(rows: 5, height: 68),
                error: (e, _) => ErrorView(message: '$e', onRetry: () => ref.invalidate(filamentTypesProvider)),
                data: (d) => RefreshIndicator(
                  color: Brand.gold,
                  onRefresh: _refresh,
                  child: ListView(
                    padding: const EdgeInsets.fromLTRB(16, 4, 16, 32),
                    children: [
                      Text(
                        'El precio por kg se carga una sola vez por tipo. Cada carrete elige su tipo y '
                        'toma ese precio: si lo cambiás acá, cambia en todos sus carretes.',
                        style: TextStyle(fontSize: 13, color: c.textDim, height: 1.45),
                      ),
                      const AdminSectionTitle('Tipos de filamento'),
                      if (d.types.isEmpty)
                        _empty('Todavía no hay tipos. Agregá el primero (ej: PLA) y elegilo en cada carrete.'),
                      for (final t in d.types)
                        _row(
                          title: t.name,
                          subtitle: t.spools == 0 ? 'Sin carretes' : spoolsLabel(t.spools),
                          trailing: '${formatPrice(t.costPerKg)}/kg',
                          onTap: canEdit && idle ? () => _editType(t) : null,
                          onDelete: canEdit ? (idle ? () => _deleteType(t) : null) : null,
                        ),
                      if (canEdit) _addButton('Agregar tipo', _editType),
                      const AdminSectionTitle('Carretes vacíos'),
                      Padding(
                        padding: const EdgeInsets.only(bottom: 10),
                        child: Text(
                          'Cuánto pesa cada modelo de carrete sin filamento. Se usa en «Calcular filamento»: '
                          'pesás el carrete en uso y se resta este peso.',
                          style: TextStyle(fontSize: 13, color: c.textDim, height: 1.45),
                        ),
                      ),
                      if (d.spoolModels.isEmpty) _empty('Todavía no hay carretes cargados.'),
                      for (final m in d.spoolModels)
                        _row(
                          title: m.name,
                          subtitle: 'Vacío: ${formatGrams(m.emptyGrams)}',
                          onTap: canEdit && idle ? () => _editSpool(m) : null,
                          onDelete: canEdit ? (idle ? () => _deleteSpool(m) : null) : null,
                        ),
                      if (canEdit) _addButton('Agregar carrete', _editSpool),
                    ],
                  ),
                ),
              ),
      ),
    );
  }
}
