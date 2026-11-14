import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_theme.dart';
import '../admin_widgets.dart';
import 'config_api.dart';
import 'config_models.dart';
import 'config_widgets.dart';

/// Medios de pago del checkout: transferencia (alias y CBU/CVU), MercadoPago
/// (activo, nota y conexión con su Access Token) y efectivo.
class PagosScreen extends ConsumerStatefulWidget {
  const PagosScreen({super.key, required this.initial, required this.canEdit});
  final PagosConfig initial;
  final bool canEdit;

  @override
  ConsumerState<PagosScreen> createState() => _PagosScreenState();
}

class _PagosScreenState extends ConfigFormState<PagosScreen> {
  late bool _transfer = widget.initial.transferEnabled;
  late final _alias = TextEditingController(text: widget.initial.transferAlias);
  late final _cbu = TextEditingController(text: widget.initial.transferCbu);
  late bool _mp = widget.initial.mpEnabled;
  late final _mpNote = TextEditingController(text: widget.initial.mpNote);
  late bool _cash = widget.initial.cashEnabled;
  late final _cashNote = TextEditingController(text: widget.initial.cashNote);
  late bool _mpConnected = widget.initial.mpConnected;
  bool _mpBusy = false;

  @override
  void initState() {
    super.initState();
    markClean();
  }

  @override
  void dispose() {
    for (final c in [_alias, _cbu, _mpNote, _cashNote]) {
      c.dispose();
    }
    super.dispose();
  }

  Map<String, dynamic> _body() => {
        'transferEnabled': _transfer,
        'transferAlias': _alias.text.trim(),
        'transferCbu': _cbu.text.trim(),
        'mpEnabled': _mp,
        'mpNote': _mpNote.text.trim(),
        'cashEnabled': _cash,
        'cashNote': _cashNote.text.trim(),
      };

  @override
  Object? snapshot() => _body();

  Future<void> _onSave() async {
    FocusScope.of(context).unfocus();
    await save(() => ref.read(configApiProvider).savePagos(_body()), 'Medios de pago guardados');
  }

  void _flip(void Function() change) => setState(() {
        error = null;
        change();
      });

  Future<void> _connect() async {
    final token = await showDialog<String>(context: context, builder: (_) => const _TokenDialog());
    if (token == null || !mounted) return;
    setState(() => _mpBusy = true);
    try {
      await ref.read(configApiProvider).connectMercadoPago(token);
      if (!mounted) return;
      ref.invalidate(adminConfigProvider);
      setState(() {
        _mpBusy = false;
        _mpConnected = true;
      });
      showOk(context, 'MercadoPago conectado');
    } catch (e) {
      if (!mounted) return;
      setState(() => _mpBusy = false);
      showOk(context, apiErrorText(e));
    }
  }

  Future<void> _disconnect() async {
    final ok = await confirmAction(
      context,
      title: 'Desconectar MercadoPago',
      message: 'Los clientes dejan de poder pagar con MercadoPago hasta que lo vuelvas a conectar.',
      confirmLabel: 'Desconectar',
      destructive: true,
    );
    if (!ok || !mounted) return;
    setState(() => _mpBusy = true);
    try {
      await ref.read(configApiProvider).disconnectMercadoPago();
      if (!mounted) return;
      ref.invalidate(adminConfigProvider);
      setState(() {
        _mpBusy = false;
        _mpConnected = false;
      });
      showOk(context, 'MercadoPago desconectado');
    } catch (e) {
      if (!mounted) return;
      setState(() => _mpBusy = false);
      showOk(context, apiErrorText(e));
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    final enabled = widget.canEdit;
    return ConfigSectionScaffold(
      title: 'Medios de pago',
      dirty: dirty,
      saving: saving,
      canEdit: widget.canEdit,
      error: error,
      onSave: _onSave,
      onChanged: touch,
      children: [
        const ConfigHint('Elegí con qué pueden pagar tus clientes en el checkout de la tienda.'),
        AdminCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              ConfigSwitchRow(
                title: 'Transferencia bancaria',
                subtitle: 'El cliente transfiere y vos confirmás el pago.',
                value: _transfer,
                onChanged: enabled ? (v) => _flip(() => _transfer = v) : null,
              ),
              if (_transfer) ...[
                const SizedBox(height: 10),
                ConfigField(
                  controller: _alias,
                  label: 'Alias',
                  hint: 'hefesto.3d',
                  maxLength: 120,
                  enabled: enabled,
                ),
                ConfigField(
                  controller: _cbu,
                  label: 'CBU / CVU',
                  hint: '0000003100…',
                  keyboardType: TextInputType.number,
                  maxLength: 40,
                  enabled: enabled,
                ),
              ],
            ],
          ),
        ),
        const SizedBox(height: 12),
        AdminCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              ConfigSwitchRow(
                title: 'MercadoPago',
                subtitle: 'Tarjetas, dinero en cuenta y cuotas.',
                value: _mp,
                onChanged: enabled ? (v) => _flip(() => _mp = v) : null,
              ),
              const SizedBox(height: 8),
              Wrap(
                spacing: 6,
                runSpacing: 2,
                crossAxisAlignment: WrapCrossAlignment.center,
                children: [
                  _mpConnected
                      ? const StateChip('Conectado', color: Brand.success, icon: Icons.check_circle_rounded)
                      : const StateChip('Sin conectar', color: Brand.warning, icon: Icons.link_off_rounded),
                  if (enabled && _mpBusy)
                    const Padding(
                      padding: EdgeInsets.symmetric(horizontal: 12),
                      child: SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(strokeWidth: 2.2, color: Brand.gold),
                      ),
                    ),
                  if (enabled && !_mpBusy) ...[
                    TextButton(onPressed: _connect, child: Text(_mpConnected ? 'Cambiar token' : 'Conectar')),
                    if (_mpConnected)
                      TextButton(
                        onPressed: _disconnect,
                        child: const Text('Desconectar', style: TextStyle(color: Brand.danger)),
                      ),
                  ],
                ],
              ),
              if (!_mpConnected)
                Padding(
                  padding: const EdgeInsets.only(top: 2, bottom: 6),
                  child: Text(
                    'Para cobrar con MercadoPago pegá tu Access Token (lo sacás de tu cuenta de MercadoPago, en '
                    'Tus integraciones). Por seguridad nunca se vuelve a mostrar.',
                    style: TextStyle(fontSize: 12, color: c.textDim, height: 1.4),
                  ),
                ),
              if (_mp) ...[
                const SizedBox(height: 8),
                ConfigField(
                  controller: _mpNote,
                  label: 'Nota para el cliente',
                  hint: 'Opcional',
                  maxLength: 200,
                  enabled: enabled,
                ),
              ],
            ],
          ),
        ),
        const SizedBox(height: 12),
        AdminCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              ConfigSwitchRow(
                title: 'Efectivo',
                subtitle: 'Se paga al retirar o al recibir.',
                value: _cash,
                onChanged: enabled ? (v) => _flip(() => _cash = v) : null,
              ),
              if (_cash) ...[
                const SizedBox(height: 10),
                ConfigField(
                  controller: _cashNote,
                  label: 'Nota para el cliente',
                  hint: 'Ej: solo retiro en el taller',
                  maxLength: 200,
                  enabled: enabled,
                ),
              ],
            ],
          ),
        ),
      ],
    );
  }
}

/// Pide el Access Token de MercadoPago. Va oculto, sin autocorrección, y el
/// texto no se guarda en ningún lado: solo vuelve a quien abrió el diálogo.
class _TokenDialog extends StatefulWidget {
  const _TokenDialog();

  @override
  State<_TokenDialog> createState() => _TokenDialogState();
}

class _TokenDialogState extends State<_TokenDialog> {
  final _ctl = TextEditingController();
  bool _show = false;
  String? _err;

  @override
  void dispose() {
    _ctl.dispose();
    super.dispose();
  }

  void _ok() {
    final t = _ctl.text.trim();
    if (t.length < 10) {
      setState(() => _err = 'Pegá tu Access Token completo.');
      return;
    }
    Navigator.of(context).pop(t);
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
        // Con un campo adentro va `scrollable` (2026-11-14, pedido de Ale): en
        // un teléfono chico con el teclado abierto el diálogo no entra entero
        // y se desbordaba; así se desplaza y los botones quedan a la vista.
        scrollable: true,
        title: const Text('Access Token de MercadoPago'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // El campo va PRIMERO y la explicación después: en un teléfono
            // chico con el teclado abierto y letra grande, lo que queda a la
            // vista sin desplazar es justo donde se pega el token.
            TextField(
              controller: _ctl,
              obscureText: !_show,
              autocorrect: false,
              enableSuggestions: false,
              autofocus: true,
              onChanged: (_) {
                if (_err != null) setState(() => _err = null);
              },
              decoration: InputDecoration(
                hintText: 'APP_USR-…',
                errorText: _err,
                suffixIcon: IconButton(
                  tooltip: _show ? 'Ocultar' : 'Mostrar',
                  icon: Icon(_show ? Icons.visibility_off_rounded : Icons.visibility_rounded),
                  onPressed: () => setState(() => _show = !_show),
                ),
              ),
            ),
            const SizedBox(height: 12),
            const Text('Pegalo acá. Queda guardado en el servidor y no se vuelve a mostrar.'),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.of(context).pop(), child: const Text('Cancelar')),
          FilledButton(onPressed: _ok, child: const Text('Conectar')),
        ],
      );
}
