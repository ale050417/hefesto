import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/providers.dart';
import '../../../core/theme/app_theme.dart';
import '../crecimiento/form_kit.dart';
import 'clientes_models.dart';
import 'clientes_providers.dart';

final _emailRe = RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$');

/// Alta o edición de un cliente MANUAL (el que compró sin registrarse: por
/// WhatsApp, teléfono o en el local). Los clientes con cuenta no se editan acá.
/// Cierra con `true` si guardó.
class CustomerFormScreen extends ConsumerStatefulWidget {
  const CustomerFormScreen({super.key, this.customer});

  /// null = cliente nuevo.
  final Customer? customer;

  @override
  ConsumerState<CustomerFormScreen> createState() => _CustomerFormScreenState();
}

class _CustomerFormScreenState extends ConsumerState<CustomerFormScreen> {
  late final _name = TextEditingController(text: widget.customer?.name ?? '');
  late final _email = TextEditingController(text: widget.customer?.email ?? '');
  late final _phone = TextEditingController(text: widget.customer?.phone ?? '');
  late final _city = TextEditingController(text: widget.customer?.city ?? '');
  late final _note = TextEditingController(text: widget.customer?.note ?? '');

  late final String _initial = _snapshot();
  bool _busy = false;
  String? _error;
  String? _nameError;
  String? _emailError;

  bool get _edit => widget.customer != null;

  String _snapshot() => [_name, _email, _phone, _city, _note].map((c) => c.text.trim()).join('\u0001');

  bool get _dirty => _snapshot() != _initial;

  @override
  void dispose() {
    for (final c in [_name, _email, _phone, _city, _note]) {
      c.dispose();
    }
    super.dispose();
  }

  bool _validate() {
    final name = _name.text.trim();
    final email = _email.text.trim();
    setState(() {
      _nameError = name.length < 2 ? 'Ingresá el nombre del cliente.' : null;
      _emailError = email.isNotEmpty && !_emailRe.hasMatch(email) ? 'El email no es válido.' : null;
      // También arriba del botón: el campo marcado puede estar fuera de la vista.
      _error = _nameError ?? _emailError;
    });
    return _nameError == null && _emailError == null;
  }

  Future<void> _save() async {
    if (!_validate()) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    final body = customerBody(
      name: _name.text,
      email: _email.text,
      phone: _phone.text,
      city: _city.text,
      note: _note.text,
    );
    try {
      final api = ref.read(apiClientProvider);
      if (_edit) {
        await updateCustomer(api, widget.customer!.id, body);
      } else {
        await createCustomer(api, body);
      }
      if (!mounted) return;
      showToast(context, _edit ? 'Cliente actualizado' : 'Cliente creado');
      Navigator.of(context).pop(true);
    } catch (e) {
      if (mounted) setState(() => _error = errorMessage(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    void touch([String? _]) => setState(() => _error = null);

    return DiscardGuard(
      dirty: _dirty && !_busy,
      child: Scaffold(
        appBar: AppBar(title: Text(_edit ? 'Editar cliente' : 'Nuevo cliente')),
        body: ListView(
          padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
          keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
          children: [
            if (!_edit)
              Padding(
                padding: const EdgeInsets.fromLTRB(4, 0, 4, 4),
                child: Text(
                  'Cargá un cliente que compró sin registrarse (por WhatsApp, teléfono o en el local). '
                  'Queda en tu base para asociarle ventas.',
                  style: TextStyle(color: c.textDim, fontSize: 13, height: 1.4),
                ),
              ),
            FormSection(
              title: 'Datos',
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Padding(
                      padding: const EdgeInsets.only(top: 4),
                      child: InitialAvatar(_name.text, size: 52),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: TextField(
                        controller: _name,
                        textCapitalization: TextCapitalization.words,
                        textInputAction: TextInputAction.next,
                        onChanged: (_) {
                          _nameError = null;
                          touch();
                        },
                        decoration: InputDecoration(
                          labelText: 'Nombre y apellido',
                          hintText: 'Ej: Juan Pérez',
                          errorText: _nameError,
                        ),
                      ),
                    ),
                  ],
                ),
                TextField(
                  controller: _email,
                  keyboardType: TextInputType.emailAddress,
                  textInputAction: TextInputAction.next,
                  autocorrect: false,
                  onChanged: (_) {
                    _emailError = null;
                    touch();
                  },
                  decoration: InputDecoration(
                    labelText: 'Email (opcional)',
                    hintText: 'juan@email.com',
                    errorText: _emailError,
                  ),
                ),
                TextField(
                  controller: _phone,
                  keyboardType: TextInputType.phone,
                  textInputAction: TextInputAction.next,
                  onChanged: touch,
                  decoration: const InputDecoration(
                    labelText: 'Teléfono / WhatsApp',
                    hintText: '3757 624148',
                    helperText: 'Con código de área, sin el 15.',
                  ),
                ),
                TextField(
                  controller: _city,
                  textCapitalization: TextCapitalization.words,
                  textInputAction: TextInputAction.next,
                  onChanged: touch,
                  decoration: const InputDecoration(labelText: 'Ciudad', hintText: 'Posadas'),
                ),
              ],
            ),
            FormSection(
              title: 'Nota interna',
              children: [
                TextField(
                  controller: _note,
                  minLines: 3,
                  maxLines: 6,
                  maxLength: 1000,
                  textCapitalization: TextCapitalization.sentences,
                  // Al abrirse el teclado se ve el campo entero (por defecto
                  // solo sube el renglón del cursor).
                  scrollPadding: const EdgeInsets.fromLTRB(20, 20, 20, 80),
                  onChanged: touch,
                  decoration: const InputDecoration(
                    labelText: 'Nota (opcional)',
                    hintText: 'Preferencias, cómo llegó, observaciones…',
                    counterText: '',
                    alignLabelWithHint: true,
                  ),
                ),
              ],
            ),
          ],
        ),
        bottomNavigationBar: SaveBar(
          label: _edit ? 'Guardar cambios' : 'Crear cliente',
          loading: _busy,
          error: _error,
          onPressed: _dirty ? _save : null,
        ),
      ),
    );
  }
}
