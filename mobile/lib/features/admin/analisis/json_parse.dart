// Parseo defensivo de JSON para los modelos de análisis: los `numeric` de
// Postgres pueden llegar como String, y cualquier campo puede venir null.

double jNum(dynamic v, [double fallback = 0]) {
  if (v is num) return v.isFinite ? v.toDouble() : fallback;
  final parsed = double.tryParse('${v ?? ''}'.trim());
  return parsed != null && parsed.isFinite ? parsed : fallback;
}

int jInt(dynamic v, [int fallback = 0]) {
  if (v is num) return v.isFinite ? v.toInt() : fallback;
  return int.tryParse('${v ?? ''}'.trim()) ?? fallback;
}

/// Texto recortado; vacío o null -> null.
String? jStr(dynamic v) {
  final s = v?.toString().trim();
  return (s == null || s.isEmpty) ? null : s;
}

bool jBool(dynamic v, [bool fallback = false]) => v is bool ? v : fallback;

DateTime jDate(dynamic v) => DateTime.tryParse('${v ?? ''}')?.toLocal() ?? DateTime.now();

List<Map<String, dynamic>> jList(dynamic v) => v is List
    ? [
        for (final e in v)
          if (e is Map) Map<String, dynamic>.from(e),
      ]
    : const [];

Map<String, dynamic> jMap(dynamic v) => v is Map ? Map<String, dynamic>.from(v) : const {};

/// Lista de exactamente [n] números (rellena con 0 / recorta).
List<double> jNums(dynamic v, int n) {
  final src = v is List ? v : const [];
  return List<double>.generate(n, (i) => i < src.length ? jNum(src[i]) : 0);
}
