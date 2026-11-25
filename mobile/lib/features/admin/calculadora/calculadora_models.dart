// Modelos de la Calculadora 3D (`/api/v1/admin/calculadora*`). El cálculo del
// costo y del precio lo hace el servidor con `computeQuote` (el mismo de la web);
// la app NO reimplementa la matemática. El margen de ganancia solo le llega al
// admin: para el operador los campos `margin*`, `costoTotal` y `ganancia` vienen
// vacíos (null).

import '../analisis/json_parse.dart';

/// Configuración global de costos (la comparte Ganancias).
class CalcConfig {
  const CalcConfig({
    required this.kwhPrice,
    required this.machineWatts,
    required this.machineLifeHours,
    required this.maintenanceCost,
    required this.marginErrorPct,
  });

  final double kwhPrice;
  final int machineWatts;
  final int machineLifeHours;
  final double maintenanceCost;
  final double marginErrorPct;

  factory CalcConfig.fromJson(Map<String, dynamic> j) => CalcConfig(
        kwhPrice: jNum(j['kwhPrice']),
        machineWatts: jInt(j['machineWatts']),
        machineLifeHours: jInt(j['machineLifeHours'], 1),
        maintenanceCost: jNum(j['maintenanceCost']),
        marginErrorPct: jNum(j['marginErrorPct']),
      );

  Map<String, dynamic> toJson() => {
        'kwhPrice': kwhPrice,
        'machineWatts': machineWatts,
        'machineLifeHours': machineLifeHours,
        'maintenanceCost': maintenanceCost,
        'marginErrorPct': marginErrorPct,
      };

  @override
  bool operator ==(Object other) =>
      other is CalcConfig &&
      other.kwhPrice == kwhPrice &&
      other.machineWatts == machineWatts &&
      other.machineLifeHours == machineLifeHours &&
      other.maintenanceCost == maintenanceCost &&
      other.marginErrorPct == marginErrorPct;

  @override
  int get hashCode => Object.hash(kwhPrice, machineWatts, machineLifeHours, maintenanceCost, marginErrorPct);
}

/// Un filamento elegible: el costo/kg sale de ESE carrete.
class CalcFilament {
  const CalcFilament({
    required this.id,
    required this.material,
    required this.color,
    required this.brand,
    required this.costPerKg,
    this.hex,
    this.typeId,
    this.typeName,
  });

  final String id;
  final String material;
  final String color;
  final String brand;
  final double costPerKg;
  final String? hex;

  /// Tipo de filamento (PLA, PETG…) del que sale el precio; null si el carrete
  /// no tiene tipo (precio propio).
  final String? typeId;
  final String? typeName;

  /// "PLA · Rojo · Grilon3".
  String get label => [material, color, if (brand.isNotEmpty) brand].join(' · ');

  factory CalcFilament.fromJson(Map<String, dynamic> j) => CalcFilament(
        id: '${j['id'] ?? ''}',
        material: jStr(j['material']) ?? 'Filamento',
        color: jStr(j['color']) ?? '',
        brand: jStr(j['brand']) ?? '',
        costPerKg: jNum(j['costPerKg']),
        hex: jStr(j['hex']),
        typeId: jStr(j['typeId']),
        typeName: jStr(j['typeName']),
      );
}

/// Tipo de producto. `marginPct` es null para el operador (nunca lo recibe).
class CalcPreset {
  const CalcPreset({
    required this.id,
    required this.name,
    this.marginPct,
    this.active = true,
    this.sortOrder = 0,
  });

  final String id;
  final String name;
  final double? marginPct;
  final bool active;
  final int sortOrder;

  factory CalcPreset.fromJson(Map<String, dynamic> j) => CalcPreset(
        id: '${j['id'] ?? ''}',
        name: jStr(j['name']) ?? 'Sin nombre',
        marginPct: j['marginPct'] == null ? null : jNum(j['marginPct']),
        active: j['active'] == null ? true : jBool(j['active'], true),
        sortOrder: jInt(j['sortOrder']),
      );
}

class CalcHistoryItem {
  const CalcHistoryItem({
    required this.id,
    required this.name,
    required this.customer,
    required this.material,
    required this.color,
    required this.grams,
    required this.hours,
    required this.precioFinal,
    required this.notes,
    required this.createdAt,
    this.presetName,
    this.costPerKg,
    this.marginPct,
    this.costoTotal,
    this.ganancia,
  });

  final String id;
  final String name;
  final String? customer;
  final String? material;
  final String? color;
  final double grams;
  final double hours;
  final double precioFinal;
  final String? notes;
  final DateTime createdAt;

  /// Tipo de producto con el que se cotizó (null en cálculos viejos).
  final String? presetName;

  // Solo admin.
  final double? costPerKg;
  final double? marginPct;
  final double? costoTotal;
  final double? ganancia;

  bool get hasCosts => costoTotal != null;

  String get materialLabel => [?material, ?color].join(' · ');

  factory CalcHistoryItem.fromJson(Map<String, dynamic> j) {
    double? opt(String k) => j[k] == null ? null : jNum(j[k]);
    return CalcHistoryItem(
      id: '${j['id'] ?? ''}',
      name: jStr(j['name']) ?? 'Sin nombre',
      customer: jStr(j['customer']),
      material: jStr(j['material']),
      color: jStr(j['color']),
      grams: jNum(j['grams']),
      hours: jNum(j['hours']),
      precioFinal: jNum(j['precioFinal']),
      notes: jStr(j['notes']),
      createdAt: jDate(j['createdAt']),
      presetName: jStr(j['presetName']),
      costPerKg: opt('costPerKg'),
      marginPct: opt('marginPct'),
      costoTotal: opt('costoTotal'),
      ganancia: opt('ganancia'),
    );
  }
}

class CalcStats {
  const CalcStats({this.count = 0, this.grams = 0, this.hours = 0, this.ganancia, this.precioFinal});
  final int count;
  final double grams;
  final double hours;

  /// Solo admin.
  final double? ganancia;
  final double? precioFinal;

  factory CalcStats.fromJson(Map<String, dynamic> j) => CalcStats(
        count: jInt(j['count']),
        grams: jNum(j['grams']),
        hours: jNum(j['hours']),
        ganancia: j['ganancia'] == null ? null : jNum(j['ganancia']),
        precioFinal: j['precioFinal'] == null ? null : jNum(j['precioFinal']),
      );
}

class CalcOverview {
  const CalcOverview({
    required this.isAdmin,
    required this.config,
    required this.filaments,
    required this.presetOptions,
    required this.presets,
    required this.history,
    required this.stats,
  });

  final bool isAdmin;
  final CalcConfig config;
  final List<CalcFilament> filaments;

  /// Tipos activos (id + nombre): lo que elige el operador.
  final List<CalcPreset> presetOptions;

  /// Todos los tipos con su margen: solo admin (vacío para el operador).
  final List<CalcPreset> presets;
  final List<CalcHistoryItem> history;
  final CalcStats stats;

  factory CalcOverview.fromJson(Map<String, dynamic> j) {
    final presets = jList(j['presets']).map(CalcPreset.fromJson).toList();
    final options = jList(j['presetOptions']).map(CalcPreset.fromJson).toList();
    return CalcOverview(
      isAdmin: jBool(j['isAdmin']),
      config: CalcConfig.fromJson(jMap(j['config'])),
      filaments: jList(j['filaments']).map(CalcFilament.fromJson).toList(),
      presetOptions: options,
      presets: presets,
      history: jList(j['history']).map(CalcHistoryItem.fromJson).toList(),
      stats: CalcStats.fromJson(jMap(j['stats'])),
    );
  }
}

/// Resultado de una cotización. El operador solo recibe [precioFinal]; el admin
/// recibe además el desglose completo.
class CalcQuote {
  const CalcQuote({
    required this.precioFinal,
    this.detail = false,
    this.material = 0,
    this.electricidad = 0,
    this.desgaste = 0,
    this.subtotal = 0,
    this.margenError = 0,
    this.costoTotal = 0,
    this.ganancia = 0,
    this.marginPct = 0,
    this.costPerKg = 0,
    this.hours = 0,
  });

  final double precioFinal;
  final bool detail;
  final double material;
  final double electricidad;
  final double desgaste;
  final double subtotal;
  final double margenError;
  final double costoTotal;
  final double ganancia;
  final double marginPct;
  final double costPerKg;
  final double hours;

  factory CalcQuote.fromJson(Map<String, dynamic> j) => CalcQuote(
        precioFinal: jNum(j['precioFinal']),
        detail: jBool(j['detail']),
        material: jNum(j['material']),
        electricidad: jNum(j['electricidad']),
        desgaste: jNum(j['desgaste']),
        subtotal: jNum(j['subtotal']),
        margenError: jNum(j['margenError']),
        costoTotal: jNum(j['costoTotal']),
        ganancia: jNum(j['ganancia']),
        marginPct: jNum(j['marginPct']),
        costPerKg: jNum(j['costPerKg']),
        hours: jNum(j['hours']),
      );
}
