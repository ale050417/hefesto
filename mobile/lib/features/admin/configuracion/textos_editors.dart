import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_theme.dart';
import '../admin_widgets.dart';
import 'config_api.dart';
import 'config_models.dart';
import 'config_widgets.dart';

/// Cómo se nombra cada ícono fijo de la banda de confianza.
const Map<String, String> trustIconLabels = {
  'truck': 'Envío / producción',
  'shield': 'Pago / seguridad',
  'layers': 'Materiales',
  'refresh': 'Garantía',
};

const Map<String, IconData> _trustIcons = {
  'truck': Icons.local_shipping_rounded,
  'shield': Icons.shield_rounded,
  'layers': Icons.layers_rounded,
  'refresh': Icons.autorenew_rounded,
};

// --- Banda de confianza ---

/// Los puntos bajo el banner del inicio: el ícono es fijo; se editan el
/// título y el texto de cada uno.
class TrustBarScreen extends ConsumerStatefulWidget {
  const TrustBarScreen({super.key, required this.initial, required this.canEdit});
  final List<TrustItem> initial;
  final bool canEdit;

  @override
  ConsumerState<TrustBarScreen> createState() => _TrustBarScreenState();
}

class _TrustBarScreenState extends ConfigFormState<TrustBarScreen> {
  late final List<(TrustItem, TextEditingController, TextEditingController)> _rows = [
    for (final t in widget.initial) (t, TextEditingController(text: t.t), TextEditingController(text: t.d)),
  ];
  final Map<int, String> _errors = {};

  @override
  void initState() {
    super.initState();
    markClean();
  }

  @override
  void dispose() {
    for (final r in _rows) {
      r.$2.dispose();
      r.$3.dispose();
    }
    super.dispose();
  }

  List<Map<String, dynamic>> _items() => [
        for (final r in _rows) TrustItem(ic: r.$1.ic, t: r.$2.text, d: r.$3.text).toJson(),
      ];

  @override
  Object? snapshot() => _items();

  Future<void> _onSave() async {
    FocusScope.of(context).unfocus();
    _errors.clear();
    for (var i = 0; i < _rows.length; i++) {
      if (_rows[i].$2.text.trim().isEmpty) _errors[i] = 'Ingresá un título.';
    }
    if (_errors.isNotEmpty) {
      setState(() => error = 'Revisá los campos marcados.');
      return;
    }
    setState(() {});
    await save(() => ref.read(configApiProvider).saveTextos({'trustBar': _items()}), 'Banda de confianza guardada');
  }

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    final enabled = widget.canEdit;
    return ConfigSectionScaffold(
      title: 'Banda de confianza',
      dirty: dirty,
      saving: saving,
      canEdit: widget.canEdit,
      error: error,
      onSave: _onSave,
      onChanged: touch,
      children: [
        const ConfigHint('Son los puntos que se ven bajo el banner del inicio. El ícono de cada uno es fijo.'),
        for (var i = 0; i < _rows.length; i++)
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: AdminCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Icon(_trustIcons[_rows[i].$1.ic] ?? Icons.star_rounded, size: 18, color: Brand.gold),
                      const SizedBox(width: 8),
                      Text(
                        (trustIconLabels[_rows[i].$1.ic] ?? 'Punto ${i + 1}').toUpperCase(),
                        style: TextStyle(
                          fontFamily: 'Orbitron',
                          fontSize: 10.5,
                          letterSpacing: 1.4,
                          fontWeight: FontWeight.w700,
                          color: c.textFaint,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  ConfigField(
                    controller: _rows[i].$2,
                    label: 'Título',
                    errorText: _errors[i],
                    maxLength: 60,
                    enabled: enabled,
                    textCapitalization: TextCapitalization.sentences,
                  ),
                  ConfigField(
                    controller: _rows[i].$3,
                    label: 'Texto',
                    maxLength: 140,
                    maxLines: 2,
                    enabled: enabled,
                    textCapitalization: TextCapitalization.sentences,
                  ),
                ],
              ),
            ),
          ),
      ],
    );
  }
}

// --- Preguntas frecuentes ---

class _FaqEdit {
  _FaqEdit(String q, String a)
      : q = TextEditingController(text: q),
        a = TextEditingController(text: a);
  final TextEditingController q;
  final TextEditingController a;

  void dispose() {
    q.dispose();
    a.dispose();
  }
}

/// Preguntas y respuestas del inicio (hasta 12). Las filas vacías se descartan
/// al guardar; tiene que quedar al menos una.
class FaqScreen extends ConsumerStatefulWidget {
  const FaqScreen({super.key, required this.initial, required this.canEdit});
  final List<FaqItem> initial;
  final bool canEdit;

  @override
  ConsumerState<FaqScreen> createState() => _FaqScreenState();
}

class _FaqScreenState extends ConfigFormState<FaqScreen> {
  late final List<_FaqEdit> _rows = [for (final f in widget.initial) _FaqEdit(f.q, f.a)];
  final Map<int, String> _errors = {};

  @override
  void initState() {
    super.initState();
    markClean();
  }

  @override
  void dispose() {
    for (final r in _rows) {
      r.dispose();
    }
    super.dispose();
  }

  /// Solo las filas completas (las vacías no cuentan, como en la web).
  List<Map<String, dynamic>> _clean() => [
        for (final r in _rows)
          if (r.q.text.trim().isNotEmpty && r.a.text.trim().isNotEmpty)
            FaqItem(q: r.q.text, a: r.a.text).toJson(),
      ];

  // Una fila a medio llenar también cuenta como cambio (para poder guardar y
  // que avise qué falta); las completamente vacías, no.
  @override
  Object? snapshot() => [
        for (final r in _rows)
          if (r.q.text.trim().isNotEmpty || r.a.text.trim().isNotEmpty) [r.q.text.trim(), r.a.text.trim()],
      ];

  void _add() => setState(() {
        error = null;
        _rows.add(_FaqEdit('', ''));
      });

  void _remove(int i) => setState(() {
        error = null;
        _rows.removeAt(i).dispose();
      });

  Future<void> _onSave() async {
    FocusScope.of(context).unfocus();
    _errors.clear();
    for (var i = 0; i < _rows.length; i++) {
      final q = _rows[i].q.text.trim().isNotEmpty;
      final a = _rows[i].a.text.trim().isNotEmpty;
      if (q != a) _errors[i] = q ? 'Falta la respuesta.' : 'Falta la pregunta.';
    }
    if (_errors.isNotEmpty) {
      setState(() => error = 'Completá la pregunta y la respuesta, o quitá la fila.');
      return;
    }
    final items = _clean();
    if (items.isEmpty) {
      setState(() => error = 'Cargá al menos una pregunta con su respuesta.');
      return;
    }
    setState(() {});
    await save(() => ref.read(configApiProvider).saveTextos({'faq': items}), 'Preguntas frecuentes guardadas');
  }

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    final enabled = widget.canEdit;
    return ConfigSectionScaffold(
      title: 'Preguntas frecuentes',
      dirty: dirty,
      saving: saving,
      canEdit: widget.canEdit,
      error: error,
      onSave: _onSave,
      onChanged: touch,
      children: [
        const ConfigHint('Editá, agregá o quitá las que quieras (hasta 12). Se muestran en el inicio de la tienda.'),
        for (var i = 0; i < _rows.length; i++)
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: AdminCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          'PREGUNTA ${i + 1}',
                          style: TextStyle(
                            fontFamily: 'Orbitron',
                            fontSize: 10.5,
                            letterSpacing: 1.4,
                            fontWeight: FontWeight.w700,
                            color: c.textFaint,
                          ),
                        ),
                      ),
                      if (enabled)
                        IconButton(
                          tooltip: 'Quitar pregunta',
                          visualDensity: VisualDensity.compact,
                          icon: Icon(Icons.delete_outline_rounded, color: c.textDim),
                          onPressed: () => _remove(i),
                        ),
                    ],
                  ),
                  ConfigField(
                    controller: _rows[i].q,
                    label: 'Pregunta',
                    errorText: _errors[i] != null && _errors[i]!.contains('pregunta') ? _errors[i] : null,
                    maxLength: 140,
                    enabled: enabled,
                    textCapitalization: TextCapitalization.sentences,
                  ),
                  ConfigField(
                    controller: _rows[i].a,
                    label: 'Respuesta',
                    errorText: _errors[i] != null && _errors[i]!.contains('respuesta') ? _errors[i] : null,
                    maxLength: 600,
                    maxLines: 4,
                    enabled: enabled,
                    textCapitalization: TextCapitalization.sentences,
                  ),
                ],
              ),
            ),
          ),
        if (enabled && _rows.length < 12)
          OutlinedButton.icon(
            onPressed: _add,
            icon: const Icon(Icons.add_rounded),
            label: const Text('Agregar pregunta'),
            style: OutlinedButton.styleFrom(
              minimumSize: const Size.fromHeight(46),
              foregroundColor: Brand.gold,
              side: const BorderSide(color: Brand.gold),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
            ),
          ),
      ],
    );
  }
}

// --- Cotización por WhatsApp ---

/// Los textos por defecto de la cotización: encabezado, porcentaje y texto de la
/// seña y aclaraciones (hasta 10).
class QuoteScreen extends ConsumerStatefulWidget {
  const QuoteScreen({super.key, required this.initial, required this.canEdit});
  final QuoteConfig initial;
  final bool canEdit;

  @override
  ConsumerState<QuoteScreen> createState() => _QuoteScreenState();
}

class _QuoteScreenState extends ConfigFormState<QuoteScreen> {
  late final _title = TextEditingController(text: widget.initial.title);
  late final _pct = TextEditingController(text: '${widget.initial.depositPct}');
  late final _depositText = TextEditingController(text: widget.initial.depositText);
  late final List<TextEditingController> _notes = [
    for (final n in widget.initial.notes) TextEditingController(text: n),
  ];
  String? _titleError;
  String? _pctError;

  @override
  void initState() {
    super.initState();
    markClean();
  }

  @override
  void dispose() {
    _title.dispose();
    _pct.dispose();
    _depositText.dispose();
    for (final n in _notes) {
      n.dispose();
    }
    super.dispose();
  }

  Map<String, dynamic> _body() => {
        'title': _title.text.trim(),
        'depositPct': int.tryParse(_pct.text.trim()) ?? -1,
        'depositText': _depositText.text.trim(),
        'notes': [
          for (final n in _notes)
            if (n.text.trim().isNotEmpty) n.text.trim(),
        ],
      };

  @override
  Object? snapshot() => _body();

  Future<void> _onSave() async {
    FocusScope.of(context).unfocus();
    final title = _title.text.trim();
    final pct = int.tryParse(_pct.text.trim());
    setState(() {
      _titleError = title.length < 3 ? 'El encabezado necesita al menos 3 letras.' : null;
      _pctError = pct == null || pct < 0 || pct > 100 ? 'Ingresá un porcentaje entre 0 y 100.' : null;
    });
    if (_titleError != null || _pctError != null) {
      setState(() => error = 'Revisá los campos marcados.');
      return;
    }
    await save(() => ref.read(configApiProvider).saveCotizacion(_body()), 'Textos de la cotización guardados');
  }

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    final enabled = widget.canEdit;
    return ConfigSectionScaffold(
      title: 'Cotización por WhatsApp',
      dirty: dirty,
      saving: saving,
      canEdit: widget.canEdit,
      error: error,
      onSave: _onSave,
      onChanged: touch,
      readOnlyNote: 'Estos textos los cambia quien puede editar productos o pedidos.',
      children: [
        const ConfigHint('Es el formato del mensaje que arma el botón "Cotización". Después lo podés ajustar en cada cotización.'),
        ConfigField(
          controller: _title,
          label: 'Encabezado',
          hint: 'COTIZACIÓN — HEFESTO 3D',
          errorText: _titleError,
          maxLength: 80,
          enabled: enabled,
          textCapitalization: TextCapitalization.characters,
        ),
        ConfigField(
          controller: _pct,
          label: 'Seña (%)',
          hint: '50',
          errorText: _pctError,
          keyboardType: TextInputType.number,
          inputFormatters: [FilteringTextInputFormatter.digitsOnly],
          maxLength: 3,
          suffixText: '%',
          enabled: enabled,
        ),
        ConfigField(
          controller: _depositText,
          label: 'Texto de la seña',
          hint: 'La seña es necesaria para confirmar el encargo y comenzar con el trabajo.',
          maxLines: 3,
          maxLength: 300,
          enabled: enabled,
          textCapitalization: TextCapitalization.sentences,
        ),
        const AdminSectionTitle('Aclaraciones'),
        const ConfigHint('Cada una sale con 📌 al final del mensaje (hasta 10).'),
        for (var i = 0; i < _notes.length; i++)
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: AdminCard(
              padding: const EdgeInsets.fromLTRB(12, 10, 6, 0),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: ConfigField(
                      controller: _notes[i],
                      label: 'Aclaración ${i + 1}',
                      maxLines: 4,
                      maxLength: 600,
                      enabled: enabled,
                      textCapitalization: TextCapitalization.sentences,
                    ),
                  ),
                  if (enabled)
                    IconButton(
                      tooltip: 'Quitar aclaración',
                      icon: Icon(Icons.delete_outline_rounded, color: c.textDim),
                      onPressed: () => setState(() {
                        error = null;
                        _notes.removeAt(i).dispose();
                      }),
                    ),
                ],
              ),
            ),
          ),
        if (enabled && _notes.length < 10)
          OutlinedButton.icon(
            onPressed: () => setState(() {
              error = null;
              _notes.add(TextEditingController());
            }),
            icon: const Icon(Icons.add_rounded),
            label: const Text('Agregar aclaración'),
            style: OutlinedButton.styleFrom(
              minimumSize: const Size.fromHeight(46),
              foregroundColor: Brand.gold,
              side: const BorderSide(color: Brand.gold),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
            ),
          ),
      ],
    );
  }
}
