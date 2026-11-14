import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_theme.dart';
import '../admin_widgets.dart';
import 'config_api.dart';
import 'config_models.dart';
import 'config_widgets.dart';

/// Envío y retiro: si se retira en el taller y/o se envía a domicilio, la
/// ciudad de envío, desde qué monto es gratis, el precio por barrio y el
/// mensaje para quien está fuera de la ciudad.
class EnviosScreen extends ConsumerStatefulWidget {
  const EnviosScreen({super.key, required this.initial, required this.canEdit});
  final EnviosConfig initial;
  final bool canEdit;

  @override
  ConsumerState<EnviosScreen> createState() => _EnviosScreenState();
}

class _ZoneEdit {
  _ZoneEdit(String name, String price)
      : name = TextEditingController(text: name),
        price = TextEditingController(text: price);
  final TextEditingController name;
  final TextEditingController price;

  void dispose() {
    name.dispose();
    price.dispose();
  }
}

class _EnviosScreenState extends ConfigFormState<EnviosScreen> {
  late final _city = TextEditingController(text: widget.initial.city);
  late final _freeOver = TextEditingController(
    text: widget.initial.freeOver > 0 ? plainNumber(widget.initial.freeOver) : '',
  );
  late final _outMsg = TextEditingController(text: widget.initial.outMsg);
  late final List<_ZoneEdit> _zones = [
    for (final z in widget.initial.zones) _ZoneEdit(z.name, plainNumber(z.price)),
  ];
  late bool _pickup = widget.initial.pickupEnabled;
  late bool _delivery = widget.initial.deliveryEnabled;
  String? _freeOverError;

  @override
  void initState() {
    super.initState();
    markClean();
  }

  @override
  void dispose() {
    _city.dispose();
    _freeOver.dispose();
    _outMsg.dispose();
    for (final z in _zones) {
      z.dispose();
    }
    super.dispose();
  }

  List<Map<String, dynamic>> _zoneJson() => [
        // Los barrios sin nombre no se guardan (igual que la web).
        for (final z in _zones)
          if (z.name.text.trim().isNotEmpty)
            {'name': z.name.text.trim(), 'price': parseNumber(z.price.text) ?? 0},
      ];

  Map<String, dynamic> _body() => {
        'city': _city.text.trim(),
        'freeOver': parseNumber(_freeOver.text) ?? 0,
        'outMsg': _outMsg.text.trim(),
        'zones': _zoneJson(),
        'pickupEnabled': _pickup,
        'deliveryEnabled': _delivery,
      };

  @override
  Object? snapshot() => _body();

  Future<void> _onSave() async {
    FocusScope.of(context).unfocus();
    final raw = _freeOver.text.trim();
    if (raw.isNotEmpty && parseNumber(raw) == null) {
      setState(() {
        _freeOverError = 'Ingresá un monto válido.';
        error = 'Revisá los campos marcados.';
      });
      return;
    }
    setState(() => _freeOverError = null);
    await save(() => ref.read(configApiProvider).saveEnvios(_body()), 'Envíos guardados');
  }

  void _addZone() => setState(() {
        error = null;
        _zones.add(_ZoneEdit('', ''));
      });

  void _removeZone(int i) => setState(() {
        error = null;
        _zones.removeAt(i).dispose();
      });

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    final enabled = widget.canEdit;
    final cityLabel = _city.text.trim().isEmpty ? 'tu ciudad' : _city.text.trim();
    return ConfigSectionScaffold(
      title: 'Envío y retiro',
      dirty: dirty,
      saving: saving,
      canEdit: widget.canEdit,
      error: error,
      onSave: _onSave,
      onChanged: touch,
      children: [
        AdminCard(
          child: Column(
            children: [
              ConfigSwitchRow(
                title: 'Retiro en local',
                subtitle: 'Permitir retirar en el taller, sin costo.',
                value: _pickup,
                onChanged: enabled
                    ? (v) => setState(() {
                          error = null;
                          _pickup = v;
                        })
                    : null,
              ),
              Divider(color: c.border, height: 18),
              ConfigSwitchRow(
                title: 'Envío a domicilio',
                subtitle: 'Habilitar envíos (el precio se arma por barrio, acá abajo).',
                value: _delivery,
                onChanged: enabled
                    ? (v) => setState(() {
                          error = null;
                          _delivery = v;
                        })
                    : null,
              ),
            ],
          ),
        ),
        const AdminSectionTitle('Envío a domicilio'),
        const ConfigHint(
          'Dentro de tu ciudad el cliente elige su barrio y paga el precio que cargues. '
          'Fuera de la ciudad se coordina por chat y el costo queda a cargo del comprador.',
        ),
        ConfigField(
          controller: _city,
          label: 'Ciudad de envío',
          hint: 'Iguazú',
          maxLength: 80,
          enabled: enabled,
          textCapitalization: TextCapitalization.words,
        ),
        ConfigField(
          controller: _freeOver,
          label: 'Envío gratis desde (ARS)',
          hint: '30000',
          helper: 'Dejalo vacío si no ofrecés envío gratis.',
          errorText: _freeOverError,
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
          inputFormatters: moneyFormatters,
          prefixText: r'$ ',
          enabled: enabled,
        ),
        AdminSectionTitle(
          'Barrios y precios',
          action: enabled ? '+ Agregar' : null,
          onAction: enabled ? _addZone : null,
        ),
        if (_zones.isEmpty)
          AdminCard(
            padding: const EdgeInsets.all(16),
            child: Text(
              'Todavía no hay barrios. ${enabled ? 'Tocá "+ Agregar" para cargar el primero.' : ''}',
              style: TextStyle(color: c.textDim, fontSize: 13.5),
            ),
          )
        else
          for (var i = 0; i < _zones.length; i++)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: AdminCard(
                padding: const EdgeInsets.fromLTRB(12, 10, 6, 10),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      flex: 5,
                      child: TextFormField(
                        controller: _zones[i].name,
                        enabled: enabled,
                        maxLength: 80,
                        textCapitalization: TextCapitalization.words,
                        decoration: InputDecoration(
                          hintText: 'Barrio ${i + 1}',
                          counterText: '',
                          isDense: true,
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      flex: 3,
                      child: TextFormField(
                        controller: _zones[i].price,
                        enabled: enabled,
                        keyboardType: const TextInputType.numberWithOptions(decimal: true),
                        inputFormatters: moneyFormatters,
                        decoration: const InputDecoration(prefixText: r'$ ', hintText: '0', isDense: true),
                      ),
                    ),
                    if (enabled)
                      IconButton(
                        tooltip: 'Quitar barrio',
                        icon: Icon(Icons.delete_outline_rounded, color: c.textDim),
                        onPressed: () => _removeZone(i),
                      )
                    else
                      const SizedBox(width: 10),
                  ],
                ),
              ),
            ),
        const AdminSectionTitle('Fuera de la ciudad'),
        ConfigField(
          controller: _outMsg,
          label: 'Mensaje "fuera de $cityLabel"',
          hint: 'Coordinamos el envío por WhatsApp; el costo del flete queda a cargo del comprador.',
          helper: 'Es lo que ve el cliente en el checkout al elegir un envío fuera de tu ciudad.',
          maxLines: 4,
          maxLength: 500,
          enabled: enabled,
          textCapitalization: TextCapitalization.sentences,
        ),
      ],
    );
  }
}
