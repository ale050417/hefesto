// Opciones del selector "Filamento" de la calculadora, agrupadas por TIPO
// (sugerencia de Agustín, 2026-11-24: la lista mostraba los 50 carretes con el
// mismo precio repetido). Con tipos se elige "PLA — $26.000/kg" y listo.
//
// Misma lógica que `filament-choices.ts` de la web. El precio se sigue
// resolviendo en el servidor por el id de un carrete: cada tipo se representa
// con uno de SUS carretes (todos valen lo mismo, el precio es del tipo). Los
// carretes sin tipo siguen apareciendo de a uno, con su precio propio. Puro y
// testeado.

import 'calculadora_models.dart';

/// Un tipo de filamento como opción del selector.
class TypeChoice {
  TypeChoice({
    required this.value,
    required this.typeId,
    required this.name,
    required this.costPerKg,
    this.spools = 1,
  });

  /// Id del carrete que representa al tipo (lo que viaja al servidor).
  final String value;
  final String typeId;
  final String name;
  final double costPerKg;

  /// Cuántos carretes hay de este tipo.
  int spools;
}

class FilamentChoices {
  const FilamentChoices({required this.types, required this.loose});

  /// Un renglón por tipo, en orden alfabético.
  final List<TypeChoice> types;

  /// Carretes sin tipo (precio propio), en el orden en que vinieron.
  final List<CalcFilament> loose;

  /// Sin ningún tipo cargado, el selector queda como antes (carrete por carrete).
  bool get grouped => types.isNotEmpty;
}

const _accents = {'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u', 'ü': 'u', 'ñ': 'n~'};

/// Clave para ordenar "en castellano": sin mayúsculas ni tildes.
String _sortKey(String s) => s.toLowerCase().split('').map((ch) => _accents[ch] ?? ch).join();

FilamentChoices filamentChoices(List<CalcFilament> filaments) {
  final byType = <String, TypeChoice>{};
  final loose = <CalcFilament>[];
  for (final f in filaments) {
    final typeId = f.typeId;
    if (typeId == null || typeId.isEmpty) {
      loose.add(f);
      continue;
    }
    final known = byType[typeId];
    if (known != null) {
      known.spools += 1;
    } else {
      byType[typeId] = TypeChoice(
        value: f.id,
        typeId: typeId,
        name: f.typeName ?? f.material,
        costPerKg: f.costPerKg,
      );
    }
  }
  final types = byType.values.toList()..sort((a, b) => _sortKey(a.name).compareTo(_sortKey(b.name)));
  return FilamentChoices(types: types, loose: loose);
}

/// Valor del selector para un carrete dado: si tiene tipo, el carrete que
/// representa a ese tipo (así, al volver a abrir algo cotizado con "PLA Verde",
/// queda elegido "PLA"). Devuelve null si el carrete ya no existe.
String? choiceValueFor(List<CalcFilament> filaments, String? filamentId) {
  if (filamentId == null || filamentId.isEmpty) return null;
  CalcFilament? found;
  for (final f in filaments) {
    if (f.id == filamentId) {
      found = f;
      break;
    }
  }
  if (found == null) return null;
  final typeId = found.typeId;
  if (typeId == null || typeId.isEmpty) return found.id;
  for (final f in filaments) {
    if (f.typeId == typeId) return f.id;
  }
  return found.id;
}

/// Primera opción del selector (el primer tipo; si no hay, el primer carrete).
String? firstChoiceValue(List<CalcFilament> filaments) {
  final c = filamentChoices(filaments);
  if (c.types.isNotEmpty) return c.types.first.value;
  return c.loose.isEmpty ? null : c.loose.first.id;
}

/// El tipo al que pertenece el carrete [filamentId] (null si no tiene tipo o
/// ya no existe).
TypeChoice? typeChoiceOf(List<CalcFilament> filaments, String? filamentId) {
  final value = choiceValueFor(filaments, filamentId);
  if (value == null) return null;
  for (final t in filamentChoices(filaments).types) {
    if (t.value == value) return t;
  }
  return null;
}
