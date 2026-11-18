import type { Inquiry } from "./repository";
import type { InquiryStatus } from "./schemas";

/** Consulta lista para mostrar (panel web y app): números y fechas ISO. */
export type InquiryView = {
  id: string;
  customerName: string;
  customerPhone: string | null;
  title: string;
  description: string;
  quantity: number;
  images: string[];
  files: Array<{ url: string; name: string; type: string }>;
  status: InquiryStatus;
  unitPrice: number | null;
  unitCost: number | null;
  /** Datos de la calculadora (por unidad), para volver a abrirla cargada. */
  estFilamentId: string | null;
  estMaterial: string | null;
  estGrams: number | null;
  estMinutes: number | null;
  bulkPrice: number | null;
  bulkFrom: number | null;
  dimensions: string | null;
  colors: string | null;
  deliveryTime: string | null;
  answerNote: string | null;
  message: string | null;
  author: string;
  answeredBy: string | null;
  /** La cargó el usuario que está mirando. */
  mine: boolean;
  createdAt: string;
  answeredAt: string | null;
  confirmedAt: string | null;
  /** Pedido que se creó al confirmar. */
  saleId: string | null;
};

const num = (v: string | null) => (v == null ? null : Number(v));

export function toInquiryView(
  row: Inquiry,
  viewerId: string | null,
): InquiryView {
  return {
    id: row.id,
    customerName: row.customerName,
    customerPhone: row.customerPhone,
    title: row.title,
    description: row.description,
    quantity: row.quantity,
    images: row.images,
    files: row.files,
    status: row.status as InquiryStatus,
    unitPrice: num(row.unitPrice),
    unitCost: num(row.unitCost),
    estFilamentId: row.estFilamentId,
    estMaterial: row.estMaterial,
    estGrams: num(row.estGrams),
    estMinutes: row.estMinutes,
    bulkPrice: num(row.bulkPrice),
    bulkFrom: row.bulkFrom,
    dimensions: row.dimensions,
    colors: row.colors,
    deliveryTime: row.deliveryTime,
    answerNote: row.answerNote,
    message: row.message,
    author: row.createdByName ?? "Alguien del equipo",
    answeredBy: row.answeredByName,
    mine: viewerId != null && row.createdBy === viewerId,
    createdAt: row.createdAt.toISOString(),
    answeredAt: row.answeredAt?.toISOString() ?? null,
    confirmedAt: row.confirmedAt?.toISOString() ?? null,
    saleId: row.saleId,
  };
}
