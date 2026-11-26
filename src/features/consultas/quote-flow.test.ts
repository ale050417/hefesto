import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/core/audit", () => ({ recordAudit: vi.fn() }));
vi.mock("@/core/storage", () => ({
  deleteObject: vi.fn(),
  storeImage: vi.fn(),
  uploadObject: vi.fn(),
}));
vi.mock("@/features/notifications/service", () => ({
  notifyAdmins: vi.fn(async () => undefined),
}));
vi.mock("@/features/quotes/service", () => ({
  getQuoteDefaults: vi.fn(async () => ({})),
}));
vi.mock("@/features/orders/manual-sale-flow", () => ({
  registerManualSale: vi.fn(),
}));
vi.mock("@/features/orders/services/manualSaleService", () => ({
  deleteManualSale: vi.fn(async () => undefined),
  getManualSale: vi.fn(),
  updateManualSaleStatus: vi.fn(async () => undefined),
}));
vi.mock("./message", () => ({ buildInquiryMessage: vi.fn(() => "mensaje") }));
vi.mock("./repository", () => ({
  findInquiryById: vi.fn(),
  saveInquiryAnswer: vi.fn(),
  claimInquiryConfirmation: vi.fn(),
  setInquirySale: vi.fn(),
  setInquiryStatus: vi.fn(),
  setSalePaymentMethod: vi.fn(),
  listInquiryChatImages: vi.fn(async () => []),
  deleteInquiryRow: vi.fn(),
}));

import { notifyAdmins } from "@/features/notifications/service";
import { registerManualSale } from "@/features/orders/manual-sale-flow";
import {
  deleteManualSale,
  getManualSale,
  updateManualSaleStatus,
} from "@/features/orders/services/manualSaleService";
import { chatPreview } from "./chat";
import { answerInquiry, changeInquiryStatus, deleteInquiry } from "./flow";
import * as repo from "./repository";
import type { InquiryAnswerInput } from "./schemas";

const operador = { id: "op", name: "Agustín" };
const vendedora = { id: "ve", name: "Antonella" };

const pending = {
  id: "c1",
  customerName: "Sabunim Itati",
  title: "Trofeo con placa",
  quantity: 4,
  status: "pending",
  unitPrice: null,
  unitCost: null,
  estFilamentId: null,
  estMaterial: null,
  estGrams: null,
  estMinutes: null,
  message: null,
  saleId: null,
  createdBy: "ve",
  images: [],
  files: [],
};

const quoted = {
  ...pending,
  status: "answered",
  unitPrice: "12000.00",
  estFilamentId: "f1",
  estMaterial: "PLA",
  estGrams: "80.00",
  estMinutes: 240,
  message: "mensaje",
  saleId: "v1",
};

const answer: InquiryAnswerInput = {
  unitPrice: 12000,
  unitCost: null,
  filamentId: "f1",
  material: "PLA",
  grams: 80,
  printMinutes: 240,
  bulkPrice: null,
  bulkFrom: null,
  dimensions: "20 cm de alto",
  colors: "Dorado",
  deliveryTime: "5 días",
  note: null,
  message: null,
};

const mocked = <T extends (...args: never[]) => unknown>(fn: T) =>
  vi.mocked(fn);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("crear cotización", () => {
  it("crea el pedido en pendiente de pago con el precio de la cotización", async () => {
    mocked(repo.findInquiryById).mockResolvedValue(pending as never);
    mocked(registerManualSale).mockResolvedValue({ id: "v1" } as never);
    mocked(repo.saveInquiryAnswer).mockResolvedValue({
      ...quoted,
      saleId: null,
    } as never);
    mocked(repo.setInquirySale).mockResolvedValue(quoted as never);

    const row = await answerInquiry("c1", answer, operador);

    expect(row.saleId).toBe("v1");
    const call = mocked(registerManualSale).mock.calls[0]![0];
    expect(call.input).toMatchObject({
      customerName: "Sabunim Itati",
      detail: "Trofeo con placa",
      quantity: 4,
      total: 48000,
      status: "pending_payment",
      filamentId: "f1",
      grams: 80,
      printMinutes: 240,
    });
    expect(repo.setInquirySale).toHaveBeenCalledWith("c1", "v1");
    // Nada que reemplazar: era la primera cotización.
    expect(deleteManualSale).not.toHaveBeenCalled();
    // A la vendedora le llega el aviso; al operador que la creó, no.
    expect(mocked(notifyAdmins).mock.calls[0]![0]).toMatchObject({
      kind: "inquiry_answered",
      actorId: "op",
    });
  });

  it("volver a cotizar reemplaza el pedido pendiente anterior", async () => {
    mocked(repo.findInquiryById).mockResolvedValue(quoted as never);
    mocked(registerManualSale).mockResolvedValue({ id: "v2" } as never);
    mocked(repo.saveInquiryAnswer).mockResolvedValue(quoted as never);
    mocked(repo.setInquirySale).mockResolvedValue({
      ...quoted,
      saleId: "v2",
    } as never);
    mocked(getManualSale).mockResolvedValue({
      id: "v1",
      status: "pending_payment",
    } as never);

    const row = await answerInquiry("c1", answer, operador);

    expect(row.saleId).toBe("v2");
    expect(deleteManualSale).toHaveBeenCalledWith("v1");
  });

  it("nunca borra un pedido que ya está confirmado", async () => {
    mocked(repo.findInquiryById).mockResolvedValue(quoted as never);
    mocked(registerManualSale).mockResolvedValue({ id: "v2" } as never);
    mocked(repo.saveInquiryAnswer).mockResolvedValue(quoted as never);
    mocked(repo.setInquirySale).mockResolvedValue(quoted as never);
    mocked(getManualSale).mockResolvedValue({
      id: "v1",
      status: "confirmed",
    } as never);

    await answerInquiry("c1", answer, operador);

    expect(deleteManualSale).not.toHaveBeenCalled();
  });

  it("si no se puede costear, no guarda la cotización ni crea el pedido", async () => {
    mocked(repo.findInquiryById).mockResolvedValue(pending as never);

    await expect(
      answerInquiry(
        "c1",
        { ...answer, filamentId: null, material: null, grams: 0 },
        operador,
      ),
    ).rejects.toThrow(/costo/);
    expect(registerManualSale).not.toHaveBeenCalled();
    expect(repo.saveInquiryAnswer).not.toHaveBeenCalled();
  });

  it("si la consulta cambió mientras tanto, se deshace el pedido recién creado", async () => {
    mocked(repo.findInquiryById).mockResolvedValue(pending as never);
    mocked(registerManualSale).mockResolvedValue({ id: "v9" } as never);
    mocked(repo.saveInquiryAnswer).mockResolvedValue(null);

    await expect(answerInquiry("c1", answer, operador)).rejects.toThrow(
      /cambió/,
    );
    expect(deleteManualSale).toHaveBeenCalledWith("v9");
    expect(repo.setInquirySale).not.toHaveBeenCalled();
  });
});

describe("el cliente señó", () => {
  it("el pedido pendiente pasa a confirmado con la forma de pago elegida", async () => {
    mocked(repo.findInquiryById).mockResolvedValue(quoted as never);
    mocked(repo.claimInquiryConfirmation).mockResolvedValue({
      ...quoted,
      status: "confirmed",
    } as never);

    const row = await changeInquiryStatus("c1", "confirmed", vendedora, "cash");

    expect(row.status).toBe("confirmed");
    expect(repo.setSalePaymentMethod).toHaveBeenCalledWith("v1", "cash");
    expect(updateManualSaleStatus).toHaveBeenCalledWith("v1", "confirmed");
    // No se crea un pedido nuevo: ya existía.
    expect(registerManualSale).not.toHaveBeenCalled();
  });

  it("si el pedido no se puede confirmar, la consulta vuelve a cotizada", async () => {
    mocked(repo.findInquiryById).mockResolvedValue(quoted as never);
    mocked(repo.claimInquiryConfirmation).mockResolvedValue(quoted as never);
    mocked(updateManualSaleStatus).mockRejectedValueOnce(new Error("db"));

    await expect(
      changeInquiryStatus("c1", "confirmed", vendedora),
    ).rejects.toThrow("db");
    expect(repo.setInquiryStatus).toHaveBeenCalledWith("c1", "answered");
  });
});

describe("no se hizo / reabrir", () => {
  it("marcar que no se hizo cancela el pedido pendiente", async () => {
    mocked(repo.findInquiryById).mockResolvedValue(quoted as never);
    mocked(repo.setInquiryStatus).mockResolvedValue({
      ...quoted,
      status: "cancelled",
    } as never);

    await changeInquiryStatus("c1", "cancelled", vendedora);

    expect(mocked(updateManualSaleStatus).mock.calls[0]!.slice(0, 2)).toEqual([
      "v1",
      "cancelled",
    ]);
  });

  it("reabrir una que no se hizo arma de nuevo el pedido pendiente", async () => {
    mocked(repo.findInquiryById).mockResolvedValue({
      ...quoted,
      status: "cancelled",
    } as never);
    mocked(getManualSale).mockResolvedValue({
      id: "v1",
      status: "cancelled",
    } as never);
    mocked(registerManualSale).mockResolvedValue({ id: "v3" } as never);
    mocked(repo.setInquiryStatus).mockResolvedValue(quoted as never);

    await changeInquiryStatus("c1", "reopen", vendedora);

    expect(deleteManualSale).toHaveBeenCalledWith("v1");
    expect(mocked(registerManualSale).mock.calls[0]![0].input.status).toBe(
      "pending_payment",
    );
    expect(repo.setInquirySale).toHaveBeenCalledWith("c1", "v3");
    expect(repo.setInquiryStatus).toHaveBeenCalledWith("c1", "answered");
  });
});

describe("eliminar una consulta", () => {
  it("cotizada sin cobrar: se lleva su pedido pendiente", async () => {
    mocked(repo.findInquiryById).mockResolvedValue(quoted as never);
    mocked(getManualSale).mockResolvedValue({
      id: "v1",
      status: "pending_payment",
    } as never);

    await deleteInquiry("c1", vendedora, true);

    expect(deleteManualSale).toHaveBeenCalledWith("v1");
    expect(repo.deleteInquiryRow).toHaveBeenCalledWith("c1");
  });

  it("confirmada: el pedido es una venta real y no se toca", async () => {
    mocked(repo.findInquiryById).mockResolvedValue({
      ...quoted,
      status: "confirmed",
    } as never);

    await deleteInquiry("c1", vendedora, true);

    expect(getManualSale).not.toHaveBeenCalled();
    expect(deleteManualSale).not.toHaveBeenCalled();
  });
});

describe("chatPreview · texto del aviso de un mensaje", () => {
  it("muestra el texto, o que es una foto", () => {
    expect(chatPreview("Lo quiere de 12 cm", false)).toBe("Lo quiere de 12 cm");
    expect(chatPreview("", true)).toBe("📷 Foto");
    expect(chatPreview("así", true)).toBe("📷 así");
  });
  it("junta los saltos de línea y corta lo largo", () => {
    expect(chatPreview("uno\n\ndos", false)).toBe("uno dos");
    const long = chatPreview("a".repeat(200), false);
    expect(long.length).toBe(90);
    expect(long.endsWith("…")).toBe(true);
  });
});
