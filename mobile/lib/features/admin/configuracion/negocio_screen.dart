import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/modals.dart';
import '../admin_widgets.dart';
import 'config_api.dart';
import 'config_models.dart';
import 'config_widgets.dart';

/// Datos del negocio: nombre, eslogan, contacto, redes, dirección, descripción
/// y horario de atención. Mismos campos que Configuración → Negocio de la web.
class NegocioScreen extends ConsumerStatefulWidget {
  const NegocioScreen({super.key, required this.initial, required this.canEdit});
  final NegocioConfig initial;
  final bool canEdit;

  @override
  ConsumerState<NegocioScreen> createState() => _NegocioScreenState();
}

final RegExp _emailRe = RegExp(r'.+@.+\..+');

class _NegocioScreenState extends ConfigFormState<NegocioScreen> {
  late final _name = TextEditingController(text: widget.initial.storeName);
  late final _slogan = TextEditingController(text: widget.initial.slogan);
  late final _email = TextEditingController(text: widget.initial.contactEmail);
  late final _whatsapp = TextEditingController(text: widget.initial.whatsapp);
  late final _cuit = TextEditingController(text: widget.initial.cuit);
  late final _desc = TextEditingController(text: widget.initial.description);
  late final _instagram = TextEditingController(text: widget.initial.instagram);
  late final _tiktok = TextEditingController(text: widget.initial.tiktok);
  late final _address = TextEditingController(text: widget.initial.addressText);
  late final List<HourRow> _hours = List.of(widget.initial.hours);
  final Map<String, String> _errors = {};

  @override
  void initState() {
    super.initState();
    markClean();
  }

  @override
  void dispose() {
    for (final c in [_name, _slogan, _email, _whatsapp, _cuit, _desc, _instagram, _tiktok, _address]) {
      c.dispose();
    }
    super.dispose();
  }

  Map<String, dynamic> _fields() => {
        'storeName': _name.text.trim(),
        'slogan': _slogan.text.trim(),
        'contactEmail': _email.text.trim(),
        'whatsapp': _whatsapp.text.trim(),
        'cuit': _cuit.text.trim(),
        'description': _desc.text.trim(),
        'instagram': _instagram.text.trim(),
        'tiktok': _tiktok.text.trim(),
        'addressText': _address.text.trim(),
        'hours': [for (final h in _hours) h.toJson()],
      };

  @override
  Object? snapshot() => _fields();

  bool _validate() {
    _errors.clear();
    if (_name.text.trim().isEmpty) _errors['name'] = 'Ingresá el nombre del negocio.';
    final mail = _email.text.trim();
    if (mail.isNotEmpty && !_emailRe.hasMatch(mail)) _errors['email'] = 'El email no es válido.';
    setState(() {});
    return _errors.isEmpty;
  }

  Future<void> _onSave() async {
    FocusScope.of(context).unfocus();
    if (!_validate()) {
      setState(() => error = 'Revisá los campos marcados.');
      return;
    }
    await save(() => ref.read(configApiProvider).saveNegocio(_fields()), 'Datos del negocio guardados');
  }

  void _setShift(int i, {HourShift? morning, HourShift? afternoon}) {
    setState(() {
      error = null;
      _hours[i] = _hours[i].copyWith(morning: morning, afternoon: afternoon);
    });
  }

  @override
  Widget build(BuildContext context) {
    final enabled = widget.canEdit;
    return ConfigSectionScaffold(
      title: 'Datos del negocio',
      dirty: dirty,
      saving: saving,
      canEdit: widget.canEdit,
      error: error,
      onSave: _onSave,
      onChanged: touch,
      children: [
        const ConfigHint('Esto es lo que ve la gente en la tienda: el nombre, cómo contactarte y cuándo atendés.'),
        ConfigField(
          controller: _name,
          label: 'Nombre comercial',
          hint: 'Hefesto 3D',
          errorText: _errors['name'],
          maxLength: 120,
          enabled: enabled,
          textCapitalization: TextCapitalization.words,
        ),
        ConfigField(
          controller: _slogan,
          label: 'Eslogan',
          hint: 'Forjado en capas',
          maxLength: 120,
          enabled: enabled,
          textCapitalization: TextCapitalization.sentences,
        ),
        ConfigField(
          controller: _desc,
          label: 'Descripción',
          hint: 'Contá de qué se trata tu negocio, qué imprimís, tu diferencial…',
          maxLines: 5,
          maxLength: 500,
          enabled: enabled,
          textCapitalization: TextCapitalization.sentences,
        ),
        const AdminSectionTitle('Contacto'),
        ConfigField(
          controller: _whatsapp,
          label: 'WhatsApp',
          hint: '+54 9 3757 …',
          keyboardType: TextInputType.phone,
          maxLength: 40,
          enabled: enabled,
        ),
        ConfigField(
          controller: _email,
          label: 'Email de contacto',
          hint: 'hola@hefesto3d.com',
          errorText: _errors['email'],
          keyboardType: TextInputType.emailAddress,
          maxLength: 160,
          enabled: enabled,
        ),
        ConfigField(
          controller: _address,
          label: 'Dirección del taller',
          hint: 'Av. Victoria Aguirre 320, Puerto Iguazú',
          maxLength: 200,
          enabled: enabled,
          textCapitalization: TextCapitalization.sentences,
        ),
        ConfigField(
          controller: _cuit,
          label: 'CUIT',
          hint: '30-71845512-3',
          keyboardType: TextInputType.number,
          maxLength: 20,
          enabled: enabled,
        ),
        const AdminSectionTitle('Redes'),
        ConfigField(
          controller: _instagram,
          label: 'Instagram',
          hint: '@hefesto3d',
          maxLength: 160,
          enabled: enabled,
        ),
        ConfigField(
          controller: _tiktok,
          label: 'TikTok',
          hint: '@hefesto3d',
          maxLength: 160,
          enabled: enabled,
        ),
        const AdminSectionTitle('Horario de atención'),
        for (var i = 0; i < _hours.length; i++)
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: _HourCard(
              key: ValueKey('hour-$i'),
              row: _hours[i],
              enabled: enabled,
              onLabel: (v) => setState(() {
                error = null;
                _hours[i] = _hours[i].copyWith(label: v);
              }),
              onMorning: (s) => _setShift(i, morning: s),
              onAfternoon: (s) => _setShift(i, afternoon: s),
            ),
          ),
      ],
    );
  }
}

/// Un renglón del horario: nombre del tramo y dos turnos (mañana y tarde).
class _HourCard extends StatelessWidget {
  const _HourCard({
    super.key,
    required this.row,
    required this.enabled,
    required this.onLabel,
    required this.onMorning,
    required this.onAfternoon,
  });

  final HourRow row;
  final bool enabled;
  final ValueChanged<String> onLabel;
  final ValueChanged<HourShift> onMorning;
  final ValueChanged<HourShift> onAfternoon;

  @override
  Widget build(BuildContext context) {
    return AdminCard(
      padding: const EdgeInsets.fromLTRB(14, 12, 14, 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: TextFormField(
                  initialValue: row.label,
                  enabled: enabled,
                  maxLength: 40,
                  onChanged: onLabel,
                  style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14.5),
                  decoration: const InputDecoration(counterText: '', isDense: true, hintText: 'Días (ej. Lun a Vie)'),
                ),
              ),
              if (row.closed) ...[
                const SizedBox(width: 8),
                const StateChip('Cerrado', color: Color(0xFF8D8C99)),
              ],
            ],
          ),
          const SizedBox(height: 6),
          _ShiftRow(label: 'Mañana', shift: row.morning, enabled: enabled, onChanged: onMorning),
          _ShiftRow(label: 'Tarde', shift: row.afternoon, enabled: enabled, onChanged: onAfternoon),
        ],
      ),
    );
  }
}

TimeOfDay? _parseTime(String s) {
  final m = RegExp(r'^(\d{1,2}):(\d{2})$').firstMatch(s.trim());
  if (m == null) return null;
  final h = int.parse(m.group(1)!);
  final min = int.parse(m.group(2)!);
  if (h > 23 || min > 59) return null;
  return TimeOfDay(hour: h, minute: min);
}

String _fmtTime(TimeOfDay t) =>
    '${t.hour.toString().padLeft(2, '0')}:${t.minute.toString().padLeft(2, '0')}';

class _ShiftRow extends StatelessWidget {
  const _ShiftRow({required this.label, required this.shift, required this.enabled, required this.onChanged});
  final String label;
  final HourShift shift;
  final bool enabled;
  final ValueChanged<HourShift> onChanged;

  Future<void> _pick(BuildContext context, bool isFrom) async {
    final initial = _parseTime(isFrom ? shift.from : shift.to) ?? const TimeOfDay(hour: 9, minute: 0);
    // El reloj de la app (2026-11-14, pedido de Ale: que los modales se vean
    // bien): en castellano, de 24 h y con los colores del tema.
    final picked = await pickTime(
      context,
      initial: initial,
      title: '$label: ${isFrom ? 'abre a las' : 'cierra a las'}',
    );
    if (picked == null) return;
    onChanged(isFrom ? shift.copyWith(from: _fmtTime(picked)) : shift.copyWith(to: _fmtTime(picked)));
  }

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    Widget timeButton(String value, bool isFrom) => OutlinedButton(
          onPressed: enabled ? () => _pick(context, isFrom) : null,
          style: OutlinedButton.styleFrom(
            minimumSize: const Size(72, 36),
            padding: const EdgeInsets.symmetric(horizontal: 12),
            foregroundColor: c.text,
            side: BorderSide(color: c.border),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          ),
          child: Text(value.isEmpty ? '--:--' : value, style: const TextStyle(fontWeight: FontWeight.w700)),
        );

    return Wrap(
      crossAxisAlignment: WrapCrossAlignment.center,
      spacing: 8,
      runSpacing: 4,
      children: [
        Semantics(
          label: label,
          // Sin colores a mano: manda el tema (`switchTheme`).
          child: Switch(
            value: shift.on,
            onChanged: enabled ? (v) => onChanged(shift.copyWith(on: v)) : null,
          ),
        ),
        // Ancho mínimo (no fijo): con letra grande "Mañana" se partía en dos.
        ConstrainedBox(
          constraints: const BoxConstraints(minWidth: 56),
          child: Text(label, style: TextStyle(fontSize: 13, color: c.textDim)),
        ),
        if (shift.on) ...[
          timeButton(shift.from, true),
          Text('a', style: TextStyle(color: c.textFaint)),
          timeButton(shift.to, false),
        ] else
          Text('Cerrado', style: TextStyle(fontSize: 12.5, color: c.textFaint)),
      ],
    );
  }
}
