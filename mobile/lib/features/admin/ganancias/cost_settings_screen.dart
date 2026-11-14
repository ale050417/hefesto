import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/common.dart';
import '../admin_widgets.dart';
import '../analisis/analysis_widgets.dart';
import '../analisis/ar_number.dart';
import '../analisis/number_field.dart';
import 'ganancias_api.dart';
import 'ganancias_models.dart';

/// Configuración de costos de la máquina (luz, desgaste). Alimenta la
/// amortización por pedido de Ganancias; es la misma configuración que usa la
/// calculadora.
class CostSettingsScreen extends ConsumerStatefulWidget {
  const CostSettingsScreen({super.key, required this.settings});
  final CostSettings settings;

  @override
  ConsumerState<CostSettingsScreen> createState() => _CostSettingsScreenState();
}

class _CostSettingsScreenState extends ConsumerState<CostSettingsScreen> {
  late final _kwh = TextEditingController(text: arEditText(widget.settings.kwhPrice));
  late final _watts = TextEditingController(text: arEditText(widget.settings.machineWatts, maxDecimals: 0));
  late final _life = TextEditingController(text: arEditText(widget.settings.machineLifeHours, maxDecimals: 0));
  late final _maint = TextEditingController(text: arEditText(widget.settings.maintenanceCost));
  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    _kwh.dispose();
    _watts.dispose();
    _life.dispose();
    _maint.dispose();
    super.dispose();
  }

  /// Los valores tipeados, o null si algún campo es inválido.
  CostSettings? get _current {
    if (validateArNumber(_kwh.text, min: 0) != null ||
        validateArNumber(_watts.text, min: 0, maxDecimals: 0) != null ||
        validateArNumber(_life.text, min: 1, maxDecimals: 0) != null ||
        validateArNumber(_maint.text, min: 0) != null) {
      return null;
    }
    return CostSettings(
      kwhPrice: parseArNumber(_kwh.text)!,
      machineWatts: parseArNumber(_watts.text)!.round(),
      machineLifeHours: parseArNumber(_life.text)!.round(),
      maintenanceCost: parseArNumber(_maint.text)!,
    );
  }

  bool get _canSave {
    final cur = _current;
    return cur != null && cur != widget.settings && !_saving;
  }

  Future<void> _save() async {
    final cur = _current;
    if (cur == null || _saving) return;
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await ref.read(gananciasApiProvider).saveCosts(cur);
      ref.invalidate(gananciasProvider);
      if (!mounted) return;
      showSnack(context, 'Configuración de costos guardada');
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
      appBar: AppBar(title: const Text('Costos de producción')),
      // SafeArea (2026-11-14, pedido de Ale: que las pantallas no estén rotas):
      // la app dibuja de borde a borde y "Guardar" quedaba debajo de la barra
      // de gestos / de los tres botones. Desplazar cierra el teclado numérico
      // (en iPhone no trae tecla "listo").
      body: SafeArea(
        top: false,
        child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
        keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
        children: [
          Text(
            'Se usa para estimar la amortización de cada pieza (luz + desgaste de la máquina). '
            'El material sale del costo por kg de cada filamento.',
            style: TextStyle(fontSize: 13, color: c.textDim, height: 1.45),
          ),
          const SizedBox(height: 16),
          AdminCard(
            child: Column(
              children: [
                ArNumberField(
                  controller: _kwh,
                  label: 'Precio del kWh',
                  prefix: '\$',
                  onChanged: (_) => _touch(),
                ),
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
          GoldButton(
            label: 'Guardar',
            icon: Icons.check_rounded,
            loading: _saving,
            onPressed: _canSave ? _save : null,
          ),
        ],
        ),
      ),
    );
  }
}
