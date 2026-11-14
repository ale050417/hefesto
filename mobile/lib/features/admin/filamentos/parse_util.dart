/// Parseo defensivo del JSON de la API (Postgres manda los `numeric` como
/// String, y cualquier campo puede venir null). Nunca lanza: lo que no se
/// entiende cae a un valor neutro.
double numOf(Object? v, [double fallback = 0]) {
  if (v is num) return v.toDouble();
  if (v is String) return double.tryParse(v.replaceAll(',', '.')) ?? fallback;
  return fallback;
}

int intOf(Object? v, [int fallback = 0]) {
  if (v is num) return v.toInt();
  if (v is String) return int.tryParse(v) ?? double.tryParse(v)?.toInt() ?? fallback;
  return fallback;
}

String strOf(Object? v, [String fallback = '']) {
  if (v == null) return fallback;
  final s = '$v'.trim();
  return s.isEmpty ? fallback : s;
}

String? strOrNull(Object? v) {
  final s = strOf(v);
  return s.isEmpty ? null : s;
}

bool boolOf(Object? v, [bool fallback = false]) => v is bool ? v : fallback;

/// ISO 8601 → hora local; null si no se puede leer.
DateTime? dateOf(Object? v) => v is String ? DateTime.tryParse(v)?.toLocal() : null;

/// Lista de mapas (descarta lo que no sea un objeto).
List<Map<String, dynamic>> mapsOf(Object? v) => v is List
    ? [
        for (final e in v)
          if (e is Map) Map<String, dynamic>.from(e),
      ]
    : const [];

List<String> stringsOf(Object? v) =>
    v is List ? [for (final e in v) if (strOf(e).isNotEmpty) strOf(e)] : const [];
