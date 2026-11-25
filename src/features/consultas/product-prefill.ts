import { buildSaleLine } from "@/features/orders/sale-catalog";
import type { ProductForSale } from "@/features/products/services/catalogService";

/**
 * Responder una consulta desde un producto ya cargado (sugerencia de Agustín,
 * 2026-11-19: "si ya tengo cargado el producto, poder seleccionarlo y que se
 * rellene todo, como al cargar una venta").
 *
 * De la ficha del producto salen el precio de la tienda, las medidas, la
 * demora, los colores y lo que hace falta para costear el pedido al confirmar
 * (material + gramos + minutos por unidad, lo mismo que deja la calculadora).
 * Puro: lo usan la página web y la API de la app, y se testea.
 */

/** Un tamaño / combinación del producto (o la única opción si no tiene). */
export type InquiryProductOption = {
  /** null = el producto no tiene tamaños para elegir. */
  label: string | null;
  /** Precio de la tienda por unidad. */
  unitPrice: number;
  /** Gramos de UNA unidad. */
  grams: number;
  /** Minutos de impresión de UNA unidad. */
  printMinutes: number;
};

export type InquiryProduct = {
  id: string;
  name: string;
  categoryName: string | null;
  material: string | null;
  dimensions: string | null;
  deliveryTime: string | null;
  /** "Blanco, Negro": listo para el campo Colores. */
  colors: string;
  options: InquiryProductOption[];
};

const text = (s: string | null | undefined) => (s ?? "").trim() || null;

export function inquiryProduct(p: ProductForSale): InquiryProduct {
  // En multicolor los colores son las claves de los gramos por color.
  const colors =
    p.colors.length > 0
      ? p.colors
      : p.colorMode === "multi"
        ? Object.keys(p.colorPrices)
        : [];
  const labels: Array<string | null> =
    p.variants.length > 0 ? p.variants.map((v) => v.label) : [null];
  return {
    id: p.id,
    name: p.name,
    categoryName: p.categoryName,
    material: text(p.material),
    dimensions: text(p.dimensions),
    deliveryTime: text(p.productionTime),
    colors: colors
      .map((c) => c.trim())
      .filter(Boolean)
      .join(", "),
    options: labels.map((label) => {
      // Sin color elegido: el precio del tamaño (o el base) y sus gramos. El
      // carrete no se fija acá: el costo sale del material, como en una
      // respuesta calculada sin elegir filamento.
      const line = buildSaleLine(p, [], label, null);
      return {
        label,
        unitPrice: line.unitPrice,
        grams: line.weight,
        printMinutes: line.printMinutes,
      };
    }),
  };
}

/**
 * ¿Alcanza la ficha para costear el pedido? Es la misma regla de
 * `inquiryAnswerSchema`: material y gramos o minutos. Si no alcanza, el
 * operador igual tiene que pasar por la calculadora.
 */
export function optionHasCost(
  product: Pick<InquiryProduct, "material">,
  option: InquiryProductOption,
): boolean {
  return (
    product.material != null && (option.grams > 0 || option.printMinutes > 0)
  );
}
