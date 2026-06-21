export function TopBanner() {
  return (
    <div
      className="text-center text-xs"
      style={{
        background:
          "linear-gradient(90deg, var(--gold-deep), var(--gold-bright))",
        color: "var(--gold-fg)",
        padding: "7px 12px",
        fontWeight: 600,
      }}
    >
      Envío a todo el país · Producción en 48 h · Pago seguro con MercadoPago
    </div>
  );
}
