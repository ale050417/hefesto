// Reglas del editor de socios, SIN widgets (testeables). Son las mismas que
// aplica el editor de la web (`ProfitSharesEditor`) y que el servidor vuelve a
// validar al guardar: la ganancia pura se reparte con estos porcentajes, así que
// el reparto tiene que sumar 100%.

import '../analisis/ar_number.dart';

/// Tope de socios (el mismo que el servidor).
const int kMaxShares = 20;

/// El reparto cierra si la suma redondeada da 100 (regla de la web y del servidor).
bool isBalanced(double total) => total.round() == 100;

/// "Igualar al 100%": porcentajes parejos para [n] socios; el último se queda con
/// el resto para que sume exacto (3 socios: 33,33 · 33,33 · 33,34).
List<double> equalSplit(int n) {
  if (n <= 0) return const [];
  final each = (100 / n * 100).floorToDouble() / 100;
  final last = ((100 - each * (n - 1)) * 100).roundToDouble() / 100;
  return [for (var i = 0; i < n; i++) i == n - 1 ? last : each];
}

/// Texto de la suma ("Suma 100%", "Suma 99,5%").
String sharesTotalLabel(double total) => 'Suma ${formatArNumber(total, maxDecimals: 2)}%';

/// Cuánto le toca a un socio de [profit] con [pct] por ciento (sin redondear:
/// el servidor reparte igual, `profit * pct / 100`).
double shareAmount(double profit, double pct) => (profit < 0 ? 0 : profit) * pct / 100;

/// Valores editables de una fila, para comparar contra lo original.
class ShareValues {
  const ShareValues({this.id, required this.name, required this.role, required this.pct});
  final String? id;
  final String name;
  final String role;
  final double? pct;
}

/// ¿Hay algo para guardar? (altas, bajas o cambios de nombre / rol / %).
bool sharesChanged(List<ShareValues> original, List<ShareValues> current, {required int removed}) {
  if (removed > 0) return true;
  if (original.length != current.length) return true;
  final byId = {for (final o in original) o.id: o};
  for (final c in current) {
    final o = byId[c.id];
    if (c.id == null || o == null) return true;
    if (o.name.trim() != c.name.trim() ||
        o.role.trim() != c.role.trim() ||
        (o.pct ?? 0) != (c.pct ?? double.nan)) {
      return true;
    }
  }
  return false;
}
