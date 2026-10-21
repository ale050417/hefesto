import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  Circle,
  Defs,
  Document,
  Font,
  Image,
  LinearGradient,
  Page,
  Path,
  Rect,
  Stop,
  StyleSheet,
  Svg,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";
import { shade } from "@/features/settings/seasons";
import { formatPrice } from "@/lib/format";
import {
  ORDER_STATUS_LABEL,
  ORDER_STATUS_VARIANT,
  PAYMENT_METHOD_LABEL,
} from "../constants";
import type { Receipt, ReceiptBusiness, ReceiptLine } from "../receipt";
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
 * El comprobante como PDF (botón "Descargar PDF", 2026-10-20). Mismo diseño
 * que la hoja HTML (receipt-document.tsx) dibujado con react-pdf: un archivo
 * de verdad, con texto seleccionable y las fuentes de la marca, que se manda
 * por WhatsApp o mail sin pasar por el diálogo de impresión.
 *
 * Solo servidor (renderToBuffer es de Node). Los textos y fechas salen de
 * receipt-format.ts, compartidos con la hoja HTML.
 */

// Tipografías de la marca, estáticas (react-pdf no lee fuentes variables).
// Se leen de public/fonts y se registran como data URL, que es lo que la
// librería acepta en cualquier entorno; next.config las incluye en el trazado
// de la función para que existan en Vercel.
const FONT_DIR = path.join(process.cwd(), "public", "fonts");
const FONTS = {
  Sora: [
    { file: "Sora-Regular.ttf", fontWeight: 400 },
    { file: "Sora-Medium.ttf", fontWeight: 500 },
    { file: "Sora-SemiBold.ttf", fontWeight: 600 },
    { file: "Sora-Bold.ttf", fontWeight: 700 },
  ],
  Orbitron: [
    { file: "Orbitron-Bold.ttf", fontWeight: 700 },
    { file: "Orbitron-ExtraBold.ttf", fontWeight: 800 },
  ],
} as const;

let fontsReady: Promise<void> | null = null;

/** Registra las fuentes una sola vez por proceso (se reintenta si falló). */
function ensureFonts(): Promise<void> {
  if (!fontsReady) {
    fontsReady = registerFonts().catch((error) => {
      fontsReady = null;
      throw error;
    });
  }
  return fontsReady;
}

async function registerFonts(): Promise<void> {
  for (const [family, faces] of Object.entries(FONTS)) {
    const fonts = await Promise.all(
      faces.map(async (f) => {
        const data = await readFile(path.join(FONT_DIR, f.file));
        return {
          src: `data:font/ttf;base64,${data.toString("base64")}`,
          fontWeight: f.fontWeight,
        };
      }),
    );
    Font.register({ family, fonts });
  }
  // Sin partir palabras con guiones: la separación por defecto es en inglés y
  // deja cosas como "Igua-zú".
  Font.registerHyphenationCallback((word) => [word]);
}

type Logo = { data: Buffer; format: "png" };

/**
 * Logo del taller como PNG. Las fotos se suben en WebP (ver optimizeImage) y
 * react-pdf solo entiende PNG/JPG, así que se convierte con sharp. Si no hay
 * logo, no responde a tiempo o falla, va la marca dibujada (como en la web).
 */
async function loadLogo(url: string | null): Promise<Logo | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const sharp = (await import("sharp")).default;
    const data = await sharp(Buffer.from(await res.arrayBuffer()))
      .resize(160, 160, { fit: "cover" })
      .png()
      .toBuffer();
    return { data, format: "png" };
  } catch (error) {
    console.error(
      "[comprobante] no se pudo cargar el logo para el PDF:",
      error,
    );
    return null;
  }
}

// Mismos colores que la hoja HTML (.rcp-*), fijos: papel blanco y dorado.
const C = {
  ink: "#0a0a0f",
  text: "#18181f",
  dim: "#5b5b68",
  faint: "#9a9aa6",
  line: "#e3e5ec",
  soft: "#eef0f4",
  pay: "#f8f9fc",
  gold: "#c9a84c",
  goldDeep: "#a8863a",
};

// Colores del estado (misma paleta que .rcp-status). Las variantes del Badge
// que ningún estado usa (primary, gold) caen en neutral.
type Tone = (typeof ORDER_STATUS_VARIANT)[keyof typeof ORDER_STATUS_VARIANT];
const DANGER = { color: "#9b2f22", border: "#efb0a7", bg: "#fdecea" };
const NEUTRAL = { color: "#5b5b68", border: "#cfd0d8", bg: "#f1f2f6" };
const TONE: Partial<Record<Tone, typeof NEUTRAL>> = {
  success: { color: "#1f7a4d", border: "#9fd6b8", bg: "#eaf7ef" },
  info: { color: "#2a5f99", border: "#a9c8ea", bg: "#eaf2fb" },
  warning: { color: "#8a5a0f", border: "#ecc98a", bg: "#fbf3e3" },
  danger: DANGER,
  neutral: NEUTRAL,
};

const s = StyleSheet.create({
  page: {
    paddingTop: 36,
    paddingBottom: 40,
    paddingHorizontal: 40,
    fontFamily: "Sora",
    fontSize: 9.5,
    lineHeight: 1.4,
    color: C.text,
  },
  head: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
    paddingBottom: 14,
    borderBottomWidth: 1.5,
    borderBottomColor: C.gold,
  },
  brand: { flexDirection: "row", gap: 10, alignItems: "flex-start", flex: 1 },
  logo: { width: 42, height: 42, borderRadius: 9 },
  brandName: {
    fontFamily: "Orbitron",
    fontWeight: 800,
    fontSize: 14,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: C.ink,
  },
  brandSub: { fontSize: 8.5, color: C.dim, marginTop: 1 },
  contact: {
    marginTop: 6,
    flexDirection: "row",
    flexWrap: "wrap",
    columnGap: 10,
    rowGap: 1,
    maxWidth: 330,
    fontSize: 8,
    color: C.dim,
  },
  doc: { alignItems: "flex-end" },
  docTitle: {
    fontFamily: "Orbitron",
    fontWeight: 700,
    fontSize: 7.5,
    letterSpacing: 2,
    textTransform: "uppercase",
    color: C.dim,
  },
  docCode: {
    fontFamily: "Orbitron",
    fontWeight: 800,
    fontSize: 16,
    // Orbitron es alta: con el interlineado general la fecha de abajo se le
    // montaba encima.
    lineHeight: 1.25,
    color: C.ink,
    marginTop: 3,
  },
  docMeta: { fontSize: 8.5, color: C.dim, marginTop: 5 },
  status: {
    marginTop: 6,
    paddingVertical: 2,
    paddingHorizontal: 7,
    borderRadius: 99,
    borderWidth: 0.8,
    fontSize: 7.5,
    fontWeight: 600,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  alert: {
    marginTop: 12,
    padding: 8,
    borderRadius: 7,
    borderWidth: 0.8,
    borderColor: DANGER.border,
    backgroundColor: DANGER.bg,
    color: DANGER.color,
    fontSize: 9,
  },
  grid: {
    flexDirection: "row",
    gap: 18,
    paddingVertical: 16,
    borderBottomWidth: 0.8,
    borderBottomColor: C.line,
  },
  block: { flex: 1 },
  h3: {
    fontFamily: "Orbitron",
    fontWeight: 700,
    fontSize: 7,
    letterSpacing: 1.8,
    textTransform: "uppercase",
    color: C.goldDeep,
    marginBottom: 5,
  },
  strong: { fontWeight: 600, fontSize: 10.5, color: C.ink },
  muted: { color: C.dim },
  dateRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 2,
  },
  table: { marginTop: 16 },
  tr: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 7,
    paddingHorizontal: 6,
    borderBottomWidth: 0.6,
    borderBottomColor: C.soft,
  },
  th: {
    paddingTop: 0,
    paddingBottom: 7,
    borderBottomWidth: 0.8,
    borderBottomColor: C.line,
  },
  thText: {
    fontFamily: "Orbitron",
    fontWeight: 700,
    fontSize: 6.8,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: C.dim,
  },
  colName: { flex: 1, paddingRight: 8 },
  colQty: { width: 44, textAlign: "right" },
  colPrice: { width: 72, textAlign: "right" },
  colTotal: { width: 80, textAlign: "right" },
  lineName: { fontWeight: 500, color: C.ink },
  lineDetail: { fontSize: 8.5, color: C.dim },
  totals: { marginTop: 10, marginLeft: "auto", width: 220 },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  totalMain: {
    marginTop: 2,
    paddingTop: 7,
    borderTopWidth: 1.5,
    borderTopColor: C.gold,
  },
  totalMainText: {
    fontFamily: "Orbitron",
    fontWeight: 800,
    fontSize: 12.5,
    color: C.ink,
  },
  pay: {
    marginTop: 14,
    padding: 9,
    borderRadius: 7,
    borderWidth: 0.8,
    borderColor: C.line,
    backgroundColor: C.pay,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    fontSize: 9,
  },
  foot: {
    marginTop: 22,
    paddingTop: 12,
    borderTopWidth: 0.8,
    borderTopColor: C.line,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    fontSize: 7.8,
    color: C.faint,
  },
  thanks: {
    fontFamily: "Orbitron",
    fontWeight: 700,
    fontSize: 8.2,
    letterSpacing: 1,
    color: C.goldDeep,
    marginBottom: 2,
  },
  right: { textAlign: "right" },
});

// Intl mete un espacio duro entre "$" y el número; la fuente no lo tiene y
// react-pdf lo dibujaría como un cuadrado. Espacio común.
const money = (n: number) => formatPrice(n).replace(/ /g, " ");

// La fuente no tiene los corchetes/comillas de otros alfabetos que a veces
// vienen en nombres de productos ("Tom《Hoppers》") y react-pdf los omite sin
// avisar. Se cambian por su equivalente latino; el resto del texto va igual.
const PUNCT: Array<[RegExp, string]> = [
  [/[《〈]/g, "«"],
  [/[》〉]/g, "»"],
  [/[「『]/g, "“"],
  [/[」』]/g, "”"],
  [/【/g, "["],
  [/】/g, "]"],
  [/、/g, ", "],
];
const pdfText = (text: string | null | undefined): string => {
  let out = text ?? "";
  for (const [re, to] of PUNCT) out = out.replace(re, to);
  return out;
};

/** Marca dibujada (misma que BrandMark de la web) para cuando no hay logo. */
function Mark() {
  return (
    <Svg width={42} height={42} viewBox="0 0 48 48">
      <Defs>
        <LinearGradient id="hef-g" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#D4AF37" />
          <Stop offset="1" stopColor="#A8863A" />
        </LinearGradient>
      </Defs>
      <Rect
        x={3}
        y={3}
        width={42}
        height={42}
        rx={11}
        fill="#0A0A0F"
        stroke="url('#hef-g')"
        strokeWidth={1.5}
      />
      <Path
        d="M16 14v20M32 14v20M16 24h16"
        stroke="url('#hef-g')"
        strokeWidth={3.4}
        strokeLinecap="round"
      />
      <Circle cx={24} cy={24} r={2.6} fill="url('#hef-g')" />
    </Svg>
  );
}

function Line({ l }: { l: ReceiptLine }) {
  return (
    <View style={s.tr} wrap={false}>
      <View style={s.colName}>
        <Text style={s.lineName}>{pdfText(l.name)}</Text>
        {l.detail ? (
          <Text style={s.lineDetail}>{pdfText(l.detail)}</Text>
        ) : null}
      </View>
      <Text style={s.colQty}>{l.quantity}</Text>
      <Text style={s.colPrice}>{money(l.unitPrice)}</Text>
      <Text style={s.colTotal}>{money(l.lineTotal)}</Text>
    </View>
  );
}

function ReceiptPdf({
  receipt: r,
  business: b,
  logo,
}: {
  receipt: Receipt;
  business: ReceiptBusiness;
  logo: Logo | null;
}) {
  const tone = TONE[ORDER_STATUS_VARIANT[r.status]] ?? NEUTRAL;
  // Acento de la marca (Config → Apariencia): el mismo que usa la hoja HTML
  // vía --gold / --gold-deep, así el PDF y la vista previa se ven iguales.
  const gold = b.accent ?? C.gold;
  const goldDeep = b.accent ? shade(b.accent, -16) : C.goldDeep;
  const contact = contactLine(b);
  const cancel = cancelLabel(r);
  const paid = paidLabel(r);

  return (
    <Document
      title={`Comprobante ${r.code}`}
      author={b.name}
      subject="Comprobante de venta"
      language="es"
    >
      <Page size="A4" style={s.page}>
        <View style={[s.head, { borderBottomColor: gold }]}>
          <View style={s.brand}>
            {/* Image de react-pdf, no la etiqueta HTML: no lleva alt. */}
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            {logo ? <Image src={logo} style={s.logo} /> : <Mark />}
            <View>
              <Text style={s.brandName}>{b.name}</Text>
              {b.slogan ? <Text style={s.brandSub}>{b.slogan}</Text> : null}
              {contact.length > 0 ? (
                <View style={s.contact}>
                  {contact.map((c) => (
                    <Text key={c}>{c}</Text>
                  ))}
                </View>
              ) : null}
            </View>
          </View>
          <View style={s.doc}>
            <Text style={s.docTitle}>Comprobante de venta</Text>
            <Text style={s.docCode}>{r.code}</Text>
            <Text style={s.docMeta}>{dateLong.format(r.dates.issued)}</Text>
            <Text
              style={[
                s.status,
                {
                  color: tone.color,
                  borderColor: tone.border,
                  backgroundColor: tone.bg,
                },
              ]}
            >
              {ORDER_STATUS_LABEL[r.status]}
            </Text>
          </View>
        </View>

        {cancel ? <Text style={s.alert}>{cancel}</Text> : null}

        <View style={s.grid}>
          <View style={s.block}>
            <Text style={[s.h3, { color: goldDeep }]}>Cliente</Text>
            <Text style={s.strong}>{pdfText(r.customer.name)}</Text>
            {r.customer.phone ? <Text>{r.customer.phone}</Text> : null}
            {r.customer.email ? <Text>{r.customer.email}</Text> : null}
            {r.customer.city && !r.delivery.address ? (
              <Text style={s.muted}>{r.customer.city}</Text>
            ) : null}
          </View>

          {r.kind === "online" ? (
            <View style={s.block}>
              <Text style={[s.h3, { color: goldDeep }]}>Entrega</Text>
              <Text style={s.strong}>{deliveryTitle(r)}</Text>
              {r.delivery.type === "pickup" && b.address ? (
                <Text style={s.muted}>{b.address}</Text>
              ) : null}
              {r.delivery.zone ? <Text>{r.delivery.zone}</Text> : null}
              {r.delivery.address ? <Text>{r.delivery.address}</Text> : null}
              {r.delivery.notes ? (
                <Text style={s.muted}>
                  Indicaciones: {pdfText(r.delivery.notes)}
                </Text>
              ) : null}
              {r.delivery.trackingCode ? (
                <Text>
                  Seguimiento:{" "}
                  <Text style={{ fontWeight: 600 }}>
                    {r.delivery.trackingCode}
                  </Text>
                </Text>
              ) : null}
            </View>
          ) : null}

          <View style={s.block}>
            <Text style={[s.h3, { color: goldDeep }]}>Fechas</Text>
            {milestones(r).map((m) => (
              <View key={m.label} style={s.dateRow}>
                <Text style={s.muted}>{m.label}</Text>
                <Text>{m.value}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={s.table}>
          <View style={[s.tr, s.th]} fixed>
            <Text style={[s.colName, s.thText]}>Detalle</Text>
            <Text style={[s.colQty, s.thText]}>Cant.</Text>
            <Text style={[s.colPrice, s.thText]}>Precio</Text>
            <Text style={[s.colTotal, s.thText]}>Importe</Text>
          </View>
          {r.lines.map((l, i) => (
            <Line key={`${l.name}-${i}`} l={l} />
          ))}
        </View>

        <View style={s.totals} wrap={false}>
          <View style={s.totalRow}>
            <Text style={s.muted}>Subtotal</Text>
            <Text>{money(r.totals.subtotal)}</Text>
          </View>
          {r.totals.discount > 0 ? (
            <View style={s.totalRow}>
              <Text style={s.muted}>Descuento</Text>
              <Text>-{money(r.totals.discount)}</Text>
            </View>
          ) : null}
          {r.totals.shipping > 0 ? (
            <View style={s.totalRow}>
              <Text style={s.muted}>
                Envío{r.delivery.zone ? ` · ${r.delivery.zone}` : ""}
              </Text>
              <Text>{money(r.totals.shipping)}</Text>
            </View>
          ) : null}
          <View style={[s.totalRow, s.totalMain, { borderTopColor: gold }]}>
            <Text style={s.totalMainText}>Total</Text>
            <Text style={s.totalMainText}>{money(r.totals.total)}</Text>
          </View>
        </View>

        <View style={s.pay} wrap={false}>
          <Text>
            <Text style={s.muted}>Forma de pago: </Text>
            {PAYMENT_METHOD_LABEL[r.paymentMethod]}
          </Text>
          {paid ? <Text>{paid}</Text> : null}
        </View>

        <View style={s.foot} wrap={false}>
          <View>
            <Text style={[s.thanks, { color: goldDeep }]}>
              ¡Gracias por tu compra!
            </Text>
            <Text>
              {b.name} · {b.site}
            </Text>
          </View>
          <View style={s.right}>
            <Text>{RECEIPT_FOOT_NOTE}</Text>
            <Text>Generado el {dateTime.format(new Date())}</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}

/** Genera el PDF del comprobante (fuentes + logo + layout). */
export async function renderReceiptPdf(
  receipt: Receipt,
  business: ReceiptBusiness,
): Promise<Buffer> {
  const [, logo] = await Promise.all([
    ensureFonts(),
    loadLogo(business.logoUrl),
  ]);
  return renderToBuffer(ReceiptPdf({ receipt, business, logo }));
}
