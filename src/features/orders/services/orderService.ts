import crypto from "node:crypto";
import { AppError, type ErrorCode } from "@/core/errors";
import { validateCoupon, eligibleSubtotal } from "@/features/discounts/service";
import type { Coupon } from "@/features/discounts/types";
import type { ProductDetailView } from "@/features/products/types";
import type { CreateOrderInput } from "../repository";
import type { CheckoutInput } from "../schemas";
import type { Order } from "../types";

// El pedido se crea desde una entrada YA validada (Zod) más el id del cliente,
// que viene de la sesión en el servidor (nunca del cliente).
export type CreateOrderParams = CheckoutInput & {
  customerId: string;
  /** Fecha de nacimiento del cliente ("YYYY-MM-DD") para cupones de cumpleaños. */
  customerBirthDate?: string | null;
};

// Error de negocio de pedidos. Extiende AppError (Cap. 12) para integrarse con
// el mapeo uniforme de las actions; conserva su constructor (code, message).
export class OrderError extends AppError {
  constructor(code: ErrorCode, message: string) {
    super(code, message);
  }
}

// Dependencias inyectables: en producción pegan a la base; en los tests se
// reemplazan por dobles puros (Cap. 6/15). Se importan de forma perezosa para
// que los tests unitarios no arrastren la conexión a la base.
export type OrderServiceDeps = {
  getProduct: (slug: string) => Promise<ProductDetailView | null>;
  getCoupon: (code: string) => Promise<Coupon | null>;
  persist: (input: CreateOrderInput) => Promise<Order>;
  generateOrderNumber: () => string;
};

const defaultDeps: OrderServiceDeps = {
  getProduct: (slug) =>
    import("@/features/products/services/catalogService").then((m) =>
      m.getProductBySlug(slug),
    ),
  getCoupon: (code) =>
    import("@/features/discounts/repository").then((m) =>
      m.findByCode(code.trim().toUpperCase()),
    ),
  persist: (input) => import("../repository").then((m) => m.createOrder(input)),
  generateOrderNumber: () =>
    `HEF-${Date.now().toString(36).toUpperCase()}-${crypto
      .randomBytes(3)
      .toString("hex")
      .toUpperCase()}`,
};

// Redondeo a 2 decimales evitando errores de coma flotante.
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const money = (n: number) => n.toFixed(2);

/**
 * Crea un pedido a partir del carrito. Reglas clave (Cap. 11/13/15):
 * - El precio se RECALCULA en el servidor desde la base (nunca se confía en el
 *   precio que mandó el navegador).
 * - Snapshots: se copian nombre/tamaño/precio a cada línea.
 * - Nace en `pending_payment`; el cobro se conecta en el Paso 37 (MercadoPago).
 * - Todo se persiste de forma transaccional (lo garantiza el repository).
 */
export async function createOrder(
  params: CreateOrderParams,
  deps: OrderServiceDeps = defaultDeps,
): Promise<Order> {
  if (params.items.length === 0) {
    throw new OrderError("EMPTY_CART", "El carrito está vacío.");
  }

  const lines: CreateOrderInput["items"] = [];
  // Para el scope de cupones (producto/categoría): qué se descuenta.
  const scopeItems: {
    productId: string;
    categoryId: string | null;
    lineTotal: number;
  }[] = [];
  let subtotal = 0;

  for (const line of params.items) {
    if (!Number.isInteger(line.quantity) || line.quantity <= 0) {
      throw new OrderError("INVALID_QUANTITY", "La cantidad no es válida.");
    }

    const product = await deps.getProduct(line.slug);
    if (!product) {
      throw new OrderError(
        "PRODUCT_UNAVAILABLE",
        `El producto "${line.slug}" ya no está disponible.`,
      );
    }

    const hasVariants = product.variants.length > 0;
    let unitPrice = product.effectivePrice;
    let variantLabel: string | null = null;

    if (hasVariants) {
      if (!line.variantId) {
        throw new OrderError(
          "VARIANT_REQUIRED",
          `Elegí un tamaño para "${product.name}".`,
        );
      }
      const variant = product.variants.find((v) => v.id === line.variantId);
      if (!variant) {
        throw new OrderError(
          "VARIANT_NOT_FOUND",
          `El tamaño elegido para "${product.name}" ya no existe.`,
        );
      }
      // El precio de la variante (si lo tiene) reemplaza al precio base.
      unitPrice = variant.price ?? product.effectivePrice;
      variantLabel = variant.label;
    } else if (line.variantId) {
      throw new OrderError(
        "VARIANT_NOT_FOUND",
        `El producto "${product.name}" no maneja tamaños.`,
      );
    }

    // El color elegido NO cambia el precio: el producto tiene un precio único
    // (el de la calculadora). Solo validamos que el color pertenezca al producto
    // (en "color único") y lo guardamos en la etiqueta de la línea.
    const lineColor = line.color ?? null;
    if (lineColor && product.colorMode === "single") {
      if (!product.colors.includes(lineColor)) {
        throw new OrderError(
          "INVALID_COLOR",
          `El color elegido para "${product.name}" ya no está disponible.`,
        );
      }
    }
    const lineLabel =
      [variantLabel, lineColor].filter(Boolean).join(" · ") || null;

    const lineTotal = round2(unitPrice * line.quantity);
    subtotal = round2(subtotal + lineTotal);

    lines.push({
      productId: product.id,
      productName: product.name,
      variantLabel: lineLabel,
      unitPrice: money(unitPrice),
      quantity: line.quantity,
      lineTotal: money(lineTotal),
    });
    scopeItems.push({
      productId: product.id,
      categoryId: product.categoryId,
      lineTotal,
    });
  }

  // Cupón: se revalida en el servidor contra el subtotal recalculado.
  let discountAmount = 0;
  let couponId: string | null = null;
  if (params.couponCode) {
    const coupon = await deps.getCoupon(params.couponCode);
    if (!coupon) throw new OrderError("INVALID_COUPON", "El cupón no existe.");
    const result = validateCoupon(coupon, {
      subtotal,
      eligibleSubtotal: eligibleSubtotal(coupon, scopeItems, subtotal),
      customerBirthDate: params.customerBirthDate ?? null,
    });
    if (!result.valid) throw new OrderError("INVALID_COUPON", result.reason);
    discountAmount = result.discount;
    couponId = coupon.id;
  }

  const total = round2(subtotal - discountAmount);

  return deps.persist({
    order: {
      orderNumber: deps.generateOrderNumber(),
      customerId: params.customerId,
      status: "pending_payment",
      subtotal: money(subtotal),
      discountAmount: money(discountAmount),
      total: money(total),
      paymentMethod: params.paymentMethod,
      shippingAddress: params.shippingAddress,
      couponId,
    },
    items: lines,
    ...(couponId ? { redeemCoupon: { couponId } } : {}),
  });
}
