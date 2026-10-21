import Image from "next/image";
import { BrandMark } from "@/components/layout/brand-mark";
import { formatPrice } from "@/lib/format";
import {
  ORDER_STATUS_LABEL,
  ORDER_STATUS_VARIANT,
  PAYMENT_METHOD_LABEL,
} from "../constants";
import type { Receipt, ReceiptBusiness } from "../receipt";
import {
  cancelLabel,
  contactLine,
  dateLong,
  dateTime,
  deliveryTitle,
  milestones,
  paidLabel,
  RECEIPT_FOOT_NOTE,
} from "../receipt-format";

/**
 * El comprobante en sí (hoja blanca). Componente de servidor, presentacional:
 * recibe el modelo común (`Receipt`) y los datos del taller, y dibuja. Los
 * textos y fechas salen de receipt-format.ts (compartidos con el PDF); los
 * estilos `.rcp-*` viven en globals.css, con sus reglas de impresión.
 */
export function ReceiptDocument({
  receipt: r,
  business: b,
}: {
  receipt: Receipt;
  business: ReceiptBusiness;
}) {
  const contact = contactLine(b);
  const cancel = cancelLabel(r);
  const paid = paidLabel(r);

  return (
    <article className="rcp-sheet">
      <header className="rcp-head">
        <div className="rcp-brand">
          {b.logoUrl ? (
            // Grande y entero (2026-10-21, pedido de Ale): el logo del taller
            // es un dibujo dorado con detalle y lleva el nombre adentro; a
            // 56px recortado quedaba una mancha, y suelto sobre el papel
            // blanco se veía lavado. Va entero, con su proporción, sobre una
            // placa oscura como la de la tienda (.rcp-logo-tile).
            <span className="rcp-logo-tile">
              <Image
                src={b.logoUrl}
                alt={b.name}
                width={80}
                height={80}
                className="rcp-logo"
                priority
              />
            </span>
          ) : (
            <BrandMark size={64} />
          )}
          <div>
            <div className="rcp-brand-name">{b.name}</div>
            {b.slogan ? <div className="rcp-brand-sub">{b.slogan}</div> : null}
            {contact.length > 0 ? (
              <div className="rcp-contact">
                {contact.map((c) => (
                  <span key={c}>{c}</span>
                ))}
              </div>
            ) : null}
          </div>
        </div>
        <div className="rcp-doc">
          <div className="rcp-doc-title">Comprobante de venta</div>
          <div className="rcp-doc-code">{r.code}</div>
          <div className="rcp-doc-meta">{dateLong.format(r.dates.issued)}</div>
          <span
            className="rcp-status"
            data-tone={ORDER_STATUS_VARIANT[r.status]}
          >
            {ORDER_STATUS_LABEL[r.status]}
          </span>
        </div>
      </header>

      {cancel ? <div className="rcp-alert">{cancel}</div> : null}

      <section className="rcp-grid">
        <div className="rcp-block">
          <h3>Cliente</h3>
          <p className="rcp-strong">{r.customer.name}</p>
          {r.customer.phone ? <p>{r.customer.phone}</p> : null}
          {r.customer.email ? <p>{r.customer.email}</p> : null}
          {r.customer.city && !r.delivery.address ? (
            <p className="rcp-muted">{r.customer.city}</p>
          ) : null}
        </div>

        {r.kind === "online" ? (
          <div className="rcp-block">
            <h3>Entrega</h3>
            <p className="rcp-strong">{deliveryTitle(r)}</p>
            {r.delivery.type === "pickup" && b.address ? (
              <p className="rcp-muted">{b.address}</p>
            ) : null}
            {r.delivery.zone ? <p>{r.delivery.zone}</p> : null}
            {r.delivery.address ? <p>{r.delivery.address}</p> : null}
            {r.delivery.notes ? (
              <p className="rcp-muted">Indicaciones: {r.delivery.notes}</p>
            ) : null}
            {r.delivery.trackingCode ? (
              <p>
                Seguimiento: <b>{r.delivery.trackingCode}</b>
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="rcp-block">
          <h3>Fechas</h3>
          <div className="rcp-dates">
            {milestones(r).map((m) => (
              <div key={m.label}>
                <span className="rcp-muted">{m.label}</span>
                <span>{m.value}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <table className="rcp-table">
        <thead>
          <tr>
            <th>Detalle</th>
            <th className="num">Cant.</th>
            <th className="num">Precio</th>
            <th className="num">Importe</th>
          </tr>
        </thead>
        <tbody>
          {r.lines.map((l, i) => (
            <tr key={`${l.name}-${i}`}>
              <td>
                <div className="rcp-line-name">{l.name}</div>
                {l.detail ? (
                  <div className="rcp-line-detail">{l.detail}</div>
                ) : null}
              </td>
              <td className="num">{l.quantity}</td>
              <td className="num">{formatPrice(l.unitPrice)}</td>
              <td className="num">{formatPrice(l.lineTotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="rcp-totals">
        <div>
          <span className="rcp-muted">Subtotal</span>
          <span>{formatPrice(r.totals.subtotal)}</span>
        </div>
        {r.totals.discount > 0 ? (
          <div>
            <span className="rcp-muted">Descuento</span>
            <span>-{formatPrice(r.totals.discount)}</span>
          </div>
        ) : null}
        {r.totals.shipping > 0 ? (
          <div>
            <span className="rcp-muted">
              Envío{r.delivery.zone ? ` · ${r.delivery.zone}` : ""}
            </span>
            <span>{formatPrice(r.totals.shipping)}</span>
          </div>
        ) : null}
        <div className="rcp-total">
          <span>Total</span>
          <span>{formatPrice(r.totals.total)}</span>
        </div>
      </div>

      <div className="rcp-pay">
        <span>
          <span className="rcp-muted">Forma de pago:</span>{" "}
          {PAYMENT_METHOD_LABEL[r.paymentMethod]}
        </span>
        {paid ? <span>{paid}</span> : null}
      </div>

      <footer className="rcp-foot">
        <div>
          <div className="rcp-thanks">¡Gracias por tu compra!</div>
          <div>
            {b.name} · {b.site}
          </div>
        </div>
        <div className="rcp-foot-right">
          <div>{RECEIPT_FOOT_NOTE}</div>
          <div>Generado el {dateTime.format(new Date())}</div>
        </div>
      </footer>
    </article>
  );
}
