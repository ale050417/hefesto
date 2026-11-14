// Modelos de Reportes (`/api/v1/admin/reportes*`). El servidor calcula todo
// (ticket promedio, % por origen, variación contra el año anterior); la app solo
// lo dibuja.

import '../admin_models.dart' show RevenuePoint;
import '../analisis/json_parse.dart';

class ReportKpis {
  const ReportKpis({
    this.revenue = 0,
    this.salesCount = 0,
    this.unitsSold = 0,
    this.newCustomers = 0,
    this.avgTicket = 0,
  });

  final double revenue;
  final int salesCount;
  final int unitsSold;
  final int newCustomers;
  final double avgTicket;

  factory ReportKpis.fromJson(Map<String, dynamic> j) => ReportKpis(
        revenue: jNum(j['revenue']),
        salesCount: jInt(j['salesCount']),
        unitsSold: jInt(j['unitsSold']),
        newCustomers: jInt(j['newCustomers']),
        avgTicket: jNum(j['avgTicket']),
      );
}

/// Año contra año: el año en curso se compara con el MISMO tramo del anterior.
class YearOverYear {
  const YearOverYear({this.asOfMonth = 12, this.current = 0, this.prevSamePeriod = 0, this.deltaPct});
  final int asOfMonth;
  final double current;
  final double prevSamePeriod;
  final double? deltaPct;

  factory YearOverYear.fromJson(Map<String, dynamic> j) => YearOverYear(
        asOfMonth: jInt(j['asOfMonth'], 12).clamp(1, 12),
        current: jNum(j['current']),
        prevSamePeriod: jNum(j['prevSamePeriod']),
        deltaPct: j['deltaPct'] == null ? null : jNum(j['deltaPct']),
      );
}

class NamedAmount {
  const NamedAmount(this.name, this.revenue);
  final String name;
  final double revenue;

  factory NamedAmount.fromJson(Map<String, dynamic> j) =>
      NamedAmount(jStr(j['name']) ?? 'Sin categoría', jNum(j['revenue']));
}

class TopProduct {
  const TopProduct({required this.name, required this.qty, required this.revenue});
  final String name;
  final int qty;
  final double revenue;

  factory TopProduct.fromJson(Map<String, dynamic> j) => TopProduct(
        name: jStr(j['name']) ?? 'Sin nombre',
        qty: jInt(j['qty']),
        revenue: jNum(j['revenue']),
      );
}

class SourceStat {
  const SourceStat({this.revenue = 0, this.count = 0, this.pct = 0});
  final double revenue;
  final int count;
  final int pct;

  factory SourceStat.fromJson(Map<String, dynamic> j) => SourceStat(
        revenue: jNum(j['revenue']),
        count: jInt(j['count']),
        pct: jInt(j['pct']),
      );
}

/// Consumo de filamento: `ventas` = gramos netos del ledger; `fallas` = lo que se
/// perdió en impresiones fallidas.
class ConsumptionRow {
  const ConsumptionRow({
    required this.material,
    required this.color,
    required this.grams,
    required this.cost,
    required this.source,
  });

  final String material;
  final String? color;
  final double grams;
  final double cost;
  final String source;

  bool get isFailure => source == 'fallas';

  factory ConsumptionRow.fromJson(Map<String, dynamic> j) => ConsumptionRow(
        material: jStr(j['material']) ?? 'Otro',
        color: jStr(j['color']),
        grams: jNum(j['grams']),
        cost: jNum(j['cost']),
        source: jStr(j['source']) ?? 'ventas',
      );
}

class ReportsOverview {
  const ReportsOverview({
    required this.year,
    required this.prevYear,
    required this.years,
    required this.kpis,
    required this.monthsCurrent,
    required this.monthsPrev,
    required this.yoy,
    required this.categories,
    required this.topProducts,
    required this.storefront,
    required this.manual,
    required this.consumption,
    required this.consumptionGrams,
    required this.consumptionCost,
  });

  final int year;
  final int prevYear;
  final List<int> years;
  final ReportKpis kpis;
  final List<double> monthsCurrent;
  final List<double> monthsPrev;
  final YearOverYear yoy;

  /// Acumulado histórico (no depende del año), como en la web.
  final List<NamedAmount> categories;
  final List<TopProduct> topProducts;
  final SourceStat storefront;
  final SourceStat manual;
  final List<ConsumptionRow> consumption;
  final double consumptionGrams;
  final double consumptionCost;

  bool get hasSales => kpis.salesCount > 0 || monthsCurrent.any((v) => v > 0);

  factory ReportsOverview.fromJson(Map<String, dynamic> j) {
    final year = jInt(j['year'], DateTime.now().year);
    final sources = jMap(j['bySource']);
    final totals = jMap(j['consumptionTotals']);
    final years = [for (final y in (j['years'] is List ? j['years'] as List : const [])) jInt(y)]
        .where((y) => y > 0)
        .toList();
    return ReportsOverview(
      year: year,
      prevYear: jInt(j['prevYear'], year - 1),
      years: years.isEmpty ? [year, year - 1] : years,
      kpis: ReportKpis.fromJson(jMap(j['kpis'])),
      monthsCurrent: jNums(j['monthsCurrent'], 12),
      monthsPrev: jNums(j['monthsPrev'], 12),
      yoy: YearOverYear.fromJson(jMap(j['yoy'])),
      categories: jList(j['categoryBreakdown']).map(NamedAmount.fromJson).toList(),
      topProducts: jList(j['topProducts']).map(TopProduct.fromJson).toList(),
      storefront: SourceStat.fromJson(jMap(sources['storefront'])),
      manual: SourceStat.fromJson(jMap(sources['manual'])),
      consumption: jList(j['consumption']).map(ConsumptionRow.fromJson).toList(),
      consumptionGrams: jNum(totals['grams']),
      consumptionCost: jNum(totals['cost']),
    );
  }
}

/// Ingresos por día de un rango (7 / 30 / 90 días).
class DailySeries {
  const DailySeries({
    required this.days,
    required this.points,
    required this.total,
    required this.average,
    this.best,
  });

  final int days;
  final List<RevenuePoint> points;
  final double total;
  final double average;
  final RevenuePoint? best;

  factory DailySeries.fromJson(Map<String, dynamic> j) {
    RevenuePoint point(Map<String, dynamic> p) => RevenuePoint(jDate(p['date']), jNum(p['total']));
    final best = j['best'] is Map ? jMap(j['best']) : null;
    return DailySeries(
      days: jInt(j['days'], 30),
      points: jList(j['points']).map(point).toList(),
      total: jNum(j['total']),
      average: jNum(j['average']),
      best: best == null ? null : point(best),
    );
  }
}

class CsvExport {
  const CsvExport({required this.csv, required this.rows, required this.days});
  final String csv;
  final int rows;
  final int days;

  factory CsvExport.fromJson(Map<String, dynamic> j) =>
      CsvExport(csv: '${j['csv'] ?? ''}', rows: jInt(j['rows']), days: jInt(j['days'], 365));
}
