import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/providers.dart';
import '../../../core/widgets/common.dart';
import '../admin_module.dart';
import '../analisis/analysis_widgets.dart';
import 'calc_config_screen.dart';
import 'calc_form.dart';
import 'calc_history.dart';
import 'calculadora_api.dart';
import 'presets_screen.dart';

/// Calculadora 3D: costo y precio de una pieza con cotización en vivo (el cálculo
/// lo hace el servidor con las mismas fórmulas que la web), historial de
/// presupuestos, configuración global y tipos con margen (admin).
class AdminCalculadoraScreen extends ConsumerStatefulWidget {
  const AdminCalculadoraScreen({super.key});

  @override
  ConsumerState<AdminCalculadoraScreen> createState() => _AdminCalculadoraScreenState();
}

class _AdminCalculadoraScreenState extends ConsumerState<AdminCalculadoraScreen> {
  int _tab = 0; // 0 = calcular · 1 = historial

  @override
  Widget build(BuildContext context) {
    final me = ref.watch(meProvider).value;
    final data = ref.watch(calculadoraProvider);
    final overview = data.value;
    final canEditConfig = me?.can('calculadora', 'editar') ?? false;
    final isAdmin = overview?.isAdmin ?? false;

    return AdminModuleScaffold(
      title: 'Calculadora 3D',
      permission: 'calculadora',
      what: 'la calculadora',
      actions: [
        if (isAdmin)
          IconButton(
            tooltip: 'Tipos y márgenes',
            icon: const Icon(Icons.tune_rounded),
            onPressed: () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => const PresetsScreen())),
          ),
        if (canEditConfig && overview != null)
          IconButton(
            tooltip: 'Configuración global',
            icon: const Icon(Icons.settings_outlined),
            onPressed: () => Navigator.of(context).push(
              MaterialPageRoute<bool>(builder: (_) => CalcConfigScreen(config: overview.config)),
            ),
          ),
      ],
      body: data.when(
        loading: () => const AnalysisSkeleton(cards: 3),
        error: (e, _) => ErrorView(
          message: errorMessage(e, fallback: '$e'),
          onRetry: () => ref.invalidate(calculadoraProvider),
        ),
        data: (o) => Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
              child: Align(
                alignment: Alignment.centerLeft,
                child: PeriodChips<int>(
                  options: [(0, 'Calcular'), (1, 'Historial (${o.history.length})')],
                  selected: _tab,
                  onSelected: (t) => setState(() => _tab = t),
                ),
              ),
            ),
            Expanded(
              // IndexedStack: el formulario conserva lo tipeado al mirar el historial.
              child: IndexedStack(
                index: _tab,
                children: [
                  CalcForm(
                    overview: o,
                    canSave: me?.can('calculadora', 'crear') ?? false,
                    onSaved: () {},
                  ),
                  CalcHistoryTab(overview: o, canDelete: me?.can('calculadora', 'eliminar') ?? false),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
