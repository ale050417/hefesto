import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/common.dart';
import '../admin_widgets.dart';
import '../analisis/analysis_widgets.dart';
import '../analisis/ar_number.dart';
import '../analisis/number_field.dart';
import '../ganancias/ganancias_api.dart';
import 'calculadora_api.dart';
import 'calculadora_models.dart';

/// Configuración global de costos de la calculadora (kWh, máquina y margen de
/// error). Es la misma fila que usa Ganancias para la amortización.
class CalcConfigScreen extends ConsumerStatefulWidget {
  const CalcConfigScreen({super.key, required this.config});
  final CalcConfig config;

  @override
  ConsumerState<CalcConfigScreen> createState() => _CalcConfigScreenState();
}

class _CalcConfigScreenState extends ConsumerState<CalcConfigScreen> {
  late final _kwh = TextEditingController(text: arEditText(widget.config.kwhPrice));
  late final _watts = TextEditingController(text: arEditText(widget.config.machineWatts, maxDecimals: 0));
  late final _life = TextEditingController(text: arEditText(widget.config.machineLifeHours, maxDecimals: 0));
  late final _maint = TextEditingController(text: arEditText(widget.config.maintenanceCost));
  late final _err = TextEditingController(text: arEditText(widget.config.marginErrorPct));
  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    for (final c in [_kwh, _watts, _life, _maint, _err]) {
      c.dispose();
    }
    super.dispose();
  }

  CalcConfig? get _current {
    if (validateArNumber(_kwh.text, min: 0) != null ||
        validateArNumber(_watts.text, min: 0, maxDecimals: 0) != null ||
        validateArNumber(_life.text, min: 1, maxDecimals: 0) != null ||
        validateArNumber(_maint.text, min: 0) != null ||
        validateArNumber(_err.text, min: 0, max: 100) != null) {
      return null;
    }
    return CalcConfig(
      kwhPrice: parseArNumber(_kwh.text)!,
      machineWatts: parseArNumber(_watts.text)!.round(),
      machineLifeHours: parseArNumber(_life.text)!.round(),
      maintenanceCost: parseArNumber(_maint.text)!,
      marginErrorPct: parseArNumber(_err.text)!,
    );
  }

  bool get _canSave {
    final cur = _current;
    return cur != null && cur != widget.config && !_saving;
  }

  Future<void> _save() async {
    final cur = _current;
    if (cur == null || _saving) return;
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await ref.read(calculadoraApiProvider).saveConfig(cur);
      ref.invalidate(calculadoraProvider);
      // Ganancias usa la misma fila de costos: que no muestre valores viejos.
      ref.invalidate(gananciasProvider);
      if (!mounted) return;
      showSnack(context, 'Configuración guardada');
      Navigator.of(context).pop(true);
    } catch (e) {
      if (mounted) setState(() => _error = errorMessage(e));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  void _touch() => setState(() => _error = null);

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    return Scaffold(
      appBar: AppBar(title: const Text('Configuración global')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
        children: [
          Text(
            'Se usa para estimar electricidad, desgaste de la máquina y el margen de error. '
            'El material sale del costo por kg de cada filamento.',
            style: TextStyle(fontSize: 13, color: c.textDim, height: 1.45),
          ),
          const SizedBox(height: 16),
          AdminCard(
            child: Column(
              children: [
                ArNumberField(controller: _kwh, label: 'Precio del kWh', prefix: '\$', onChanged: (_) => _touch()),
                const SizedBox(height: 14),
                ArNumberField(
                  controller: _watts,
                  label: 'Consumo de la máquina',
                  suffix: 'watts',
                  maxDecimals: 0,
                  onChanged: (_) => _touch(),
                ),
                const SizedBox(height: 14),
                ArNumberField(
                  controller: _life,
                  label: 'Vida útil de la máquina',
                  suffix: 'horas',
                  maxDecimals: 0,
                  min: 1,
                  onChanged: (_) => _touch(),
                ),
                const SizedBox(height: 14),
                ArNumberField(
                  controller: _maint,
                  label: 'Costo de mantenimiento',
                  prefix: '\$',
                  helper: 'Se reparte entre las horas de vida útil.',
                  onChanged: (_) => _touch(),
                ),
                const SizedBox(height: 14),
                ArNumberField(
                  controller: _err,
                  label: 'Margen de error',
                  suffix: '%',
                  max: 100,
                  helper: 'Colchón sobre el costo por fallas y desperdicio (0 a 100).',
                  textInputAction: TextInputAction.done,
                  onChanged: (_) => _touch(),
                ),
              ],
            ),
          ),
          if (_error != null) ...[
            const SizedBox(height: 14),
            NoticeBanner(_error!, icon: Icons.error_outline_rounded, color: Brand.danger),
          ],
          const SizedBox(height: 20),
          GoldButton(label: 'Guardar', icon: Icons.check_rounded, loading: _saving, onPressed: _canSave ? _save : null),
        ],
      ),
    );
  }
}
