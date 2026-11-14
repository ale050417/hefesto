// Modelos de Ganancias y socios (`/api/v1/admin/ganancias*`). El servidor aplica
// las reglas de `economics.ts` (amortización, ganancia pura, reparto); la app no
// recalcula nada de plata, solo muestra y manda lo que se edita.

import '../analisis/json_parse.dart';

/// Configuración de costos de la máquina (misma fila que la calculadora).
class CostSettings {
  const CostSettings({
    required this.kwhPrice,
    required this.machineWatts,
    required this.machineLifeHours,
    required this.maintenanceCost,
  });

  final double kwhPrice;
  final int machineWatts;
  final int machineLifeHours;
  final double maintenanceCost;

  factory CostSettings.fromJson(Map<String, dynamic> j) => CostSettings(
        kwhPrice: jNum(j['kwhPrice']),
        machineWatts: jInt(j['machineWatts']),
        machineLifeHours: jInt(j['machineLifeHours'], 1),
        maintenanceCost: jNum(j['maintenanceCost']),
      );

  Map<String, dynamic> toJson() => {
        'kwhPrice': kwhPrice,
        'machineWatts': machineWatts,
        'machineLifeHours': machineLifeHours,
        'maintenanceCost': maintenanceCost,
      };

  @override
  bool operator ==(Object other) =>
      other is CostSettings &&
      other.kwhPrice == kwhPrice &&
      other.machineWatts == machineWatts &&
      other.machineLifeHours == machineLifeHours &&
      other.maintenanceCost == maintenanceCost;

  @override
  int get hashCode => Object.hash(kwhPrice, machineWatts, machineLifeHours, maintenanceCost);
}

/// Un socio con su porcentaje del reparto.
class ProfitShare {
  const ProfitShare({required this.id, required this.name, this.role, required this.pct});
  final String id;
  final String name;
  final String? role;
  final double pct;

  factory ProfitShare.fromJson(Map<String, dynamic> j) => ProfitShare(
        id: '${j['id'] ?? ''}',
        name: jStr(j['name']) ?? 'Socio',
        role: jStr(j['role']),
        pct: jNum(j['pct']),
      );
}

class Payout {
  const Payout(this.name, this.amount);
  final String name;
  final double amount;

  factory Payout.fromJson(Map<String, dynamic> j) => Payout(jStr(j['name']) ?? 'Socio', jNum(j['amount']));
}

/// Una venta cobrada con su economía y cómo se repartió la ganancia.
class EarningsRow {
  const EarningsRow({
    required this.id,
    required this.title,
    required this.customer,
    required this.date,
    required this.ingreso,
    required this.amort,
    required this.profit,
    required this.grams,
    required this.manual,
    required this.split,
  });

  final String id;
  final String title;
  final String? customer;
  final DateTime date;
  final double ingreso;
  final double amort;
  final double profit;
  final double grams;
  final bool manual;
  final List<Payout> split;

  factory EarningsRow.fromJson(Map<String, dynamic> j) => EarningsRow(
        id: '${j['id'] ?? ''}',
        title: jStr(j['orderNumber']) ?? 'Venta',
        customer: jStr(j['customerName']),
        date: jDate(j['createdAt']),
        ingreso: jNum(j['ingreso']),
        amort: jNum(j['amort']),
        profit: jNum(j['gananciaPura']),
        grams: jNum(j['grams']),
        manual: jBool(j['manual']),
        split: jList(j['split']).map(Payout.fromJson).toList(),
      );
}

class EarningsTotals {
  const EarningsTotals({
    this.ingreso = 0,
    this.amort = 0,
    this.profit = 0,
    this.grams = 0,
    this.orders = 0,
    this.profitPct = 0,
  });

  final double ingreso;
  final double amort;
  final double profit;
  final double grams;
  final int orders;
  final int profitPct;

  factory EarningsTotals.fromJson(Map<String, dynamic> j) => EarningsTotals(
        ingreso: jNum(j['ingreso']),
        amort: jNum(j['amort']),
        profit: jNum(j['profit']),
        grams: jNum(j['grams']),
        orders: jInt(j['orders']),
        profitPct: jInt(j['profitPct']),
      );
}

class EarningsMonth {
  const EarningsMonth(this.value, this.label);
  final String value;
  final String label;

  factory EarningsMonth.fromJson(Map<String, dynamic> j) =>
      EarningsMonth('${j['value'] ?? ''}', jStr(j['label']) ?? '${j['value'] ?? ''}');

  /// "Octubre 2026" -> "Oct 2026" para el chip.
  String get shortLabel {
    final parts = label.split(' ');
    if (parts.length < 2) return label;
    final m = parts.first;
    return '${m.length > 4 ? m.substring(0, 3) : m} ${parts.last}';
  }
}

class EarningsOverview {
  const EarningsOverview({
    required this.settings,
    required this.shares,
    required this.sharesTotal,
    required this.totals,
    required this.months,
    required this.selectedMonth,
    required this.payouts,
    required this.rows,
    required this.rowsTotal,
    required this.truncated,
  });

  final CostSettings settings;
  final List<ProfitShare> shares;
  final double sharesTotal;
  final EarningsTotals totals;
  final List<EarningsMonth> months;

  /// `YYYY-MM` o `all`.
  final String selectedMonth;
  final List<Payout> payouts;
  final List<EarningsRow> rows;
  final int rowsTotal;
  final bool truncated;

  bool get isAll => selectedMonth == 'all';

  String? get selectedLabel {
    for (final m in months) {
      if (m.value == selectedMonth) return m.label;
    }
    return null;
  }

  /// El período elegido, para usar dentro de una frase: "acumulada" (todos los
  /// meses) o "de octubre de 2026". El servidor manda el rótulo con mayúscula
  /// ("Octubre de 2026"): pegado tal cual quedaba "ganancia pura Octubre de 2026".
  String get periodPhrase {
    if (isAll) return 'acumulada';
    final label = selectedLabel;
    if (label == null || label.isEmpty) return '';
    return 'de ${label[0].toLowerCase()}${label.substring(1)}';
  }

  factory EarningsOverview.fromJson(Map<String, dynamic> j) {
    final shares = jList(j['shares']).map(ProfitShare.fromJson).toList();
    return EarningsOverview(
      settings: CostSettings.fromJson(jMap(j['settings'])),
      shares: shares,
      sharesTotal: j['sharesTotal'] == null ? shares.fold(0.0, (a, s) => a + s.pct) : jNum(j['sharesTotal']),
      totals: EarningsTotals.fromJson(jMap(j['totals'])),
      months: jList(j['months']).map(EarningsMonth.fromJson).toList(),
      selectedMonth: jStr(j['selectedMonth']) ?? 'all',
      payouts: jList(j['payouts']).map(Payout.fromJson).toList(),
      rows: jList(j['rows']).map(EarningsRow.fromJson).toList(),
      rowsTotal: jInt(j['rowsTotal'], jList(j['rows']).length),
      truncated: jBool(j['truncated']),
    );
  }
}
