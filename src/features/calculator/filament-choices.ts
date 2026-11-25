/**
 * Opciones del selector "Filamento" de la calculadora, agrupadas por TIPO
 * (sugerencia de Agustín, 2026-11-24: la lista mostraba los 50 carretes con el
 * mismo precio repetido). Con tipos, se elige "PLA — $26.000/kg" y listo.
 *
 * El precio se sigue resolviendo en el servidor por el id de un carrete: cada
 * tipo se representa con uno de SUS carretes (todos valen lo mismo, el precio
 * es del tipo). Los carretes sin tipo siguen apareciendo de a uno, con su
 * precio propio. Puro y testeado.
 */

export type ChoiceFilament = {
  id: string;
  material: string;
  color: string;
  brand: string;
  costPerKg: number;
  typeId: string | null;
  typeName: string | null;
};

export type TypeChoice = {
  /** Id del carrete que representa al tipo (lo que viaja al servidor). */
  value: string;
  typeId: string;
  name: string;
  costPerKg: number;
  /** Cuántos carretes hay de este tipo. */
  spools: number;
};

export type FilamentChoices<F extends ChoiceFilament> = {
  types: TypeChoice[];
  /** Carretes sin tipo (precio propio), en el orden en que vinieron. */
  loose: F[];
};

export function filamentChoices<F extends ChoiceFilament>(
  filaments: F[],
): FilamentChoices<F> {
  const byType = new Map<string, TypeChoice>();
  const loose: F[] = [];
  for (const f of filaments) {
    if (!f.typeId) {
      loose.push(f);
      continue;
    }
    const known = byType.get(f.typeId);
    if (known) known.spools += 1;
    else {
      byType.set(f.typeId, {
        value: f.id,
        typeId: f.typeId,
        name: f.typeName ?? f.material,
        costPerKg: f.costPerKg,
        spools: 1,
      });
    }
  }
  const types = [...byType.values()].sort((a, b) =>
    a.name.localeCompare(b.name, "es"),
  );
  return { types, loose };
}

/**
 * Valor del selector para un carrete dado: si tiene tipo, el carrete que
 * representa a ese tipo (así, al editar algo cotizado con "PLA Verde", queda
 * elegido "PLA"). Devuelve "" si el carrete ya no existe.
 */
export function choiceValueFor<F extends ChoiceFilament>(
  filaments: F[],
  filamentId: string | null | undefined,
): string {
  if (!filamentId) return "";
  const f = filaments.find((x) => x.id === filamentId);
  if (!f) return "";
  if (!f.typeId) return f.id;
  return filaments.find((x) => x.typeId === f.typeId)?.id ?? f.id;
}

/** Primera opción del selector (el primer tipo; si no hay, el primer carrete). */
export function firstChoiceValue<F extends ChoiceFilament>(
  filaments: F[],
): string {
  const { types, loose } = filamentChoices(filaments);
  return types[0]?.value ?? loose[0]?.id ?? "";
}
