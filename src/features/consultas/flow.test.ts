import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/core/audit", () => ({ recordAudit: vi.fn() }));
vi.mock("@/core/storage", () => ({
  deleteObject: vi.fn(),
  storeImage: vi.fn(),
  uploadObject: vi.fn(async () => "https://x/archivo.ogg"),
}));
vi.mock("@/features/notifications/service", () => ({
  notifyAdmins: vi.fn(async () => undefined),
}));
vi.mock("@/features/quotes/service", () => ({ getQuoteDefaults: vi.fn() }));
vi.mock("@/features/orders/manual-sale-flow", () => ({
  registerManualSale: vi.fn(),
}));
vi.mock("./repository", () => ({
  findInquiryById: vi.fn(),
  claimInquiryConfirmation: vi.fn(),
  setInquirySale: vi.fn(),
  setInquiryStatus: vi.fn(),
  appendInquiryFile: vi.fn(),
}));

import { registerManualSale } from "@/features/orders/manual-sale-flow";
import { addInquiryFile, changeInquiryStatus } from "./flow";
import * as repo from "./repository";

const actor = { id: "u1", name: "Antonella" };
const answered = {
  id: "c1",
  customerName: "Juan",
  title: "Llavero APL",
  quantity: 4,
  status: "answered",
  unitPrice: "2500.00",
  unitCost: "700.00",
  message: "texto",
  saleId: null,
  createdBy: "u1",
  images: [],
  files: [],
};

const mocked = <T extends (...args: never[]) => unknown>(fn: T) =>
  vi.mocked(fn);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("confirmar una consulta", () => {
  it("crea el pedido en estado confirmado con el precio y el costo de la respuesta", async () => {
    mocked(repo.findInquiryById).mockResolvedValue(answered as never);
    mocked(repo.claimInquiryConfirmation).mockResolvedValue({
      ...answered,
      status: "confirmed",
    } as never);
    mocked(registerManualSale).mockResolvedValue({ id: "v1" } as never);
    mocked(repo.setInquirySale).mockResolvedValue({
      ...answered,
      status: "confirmed",
      saleId: "v1",
    } as never);

    const row = await changeInquiryStatus("c1", "confirmed", actor, "cash");

    expect(row.saleId).toBe("v1");
    const call = mocked(registerManualSale).mock.calls[0]![0];
    expect(call.input).toMatchObject({
      customerName: "Juan",
      detail: "Llavero APL",
      quantity: 4,
      total: 10000,
      paymentMethod: "cash",
      status: "confirmed",
    });
    expect(call.input.saleDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(call.manualCost).toBe(2800);
    expect(call.actorId).toBe("u1");
  });

  it("con datos de la calculadora: el costo lo resuelve el servidor desde el filamento", async () => {
    const calc = {
      ...answered,
      unitCost: null,
      estFilamentId: "f1",
      estMaterial: "PLA",
      estGrams: "30.00",
      estMinutes: 90,
    };
    mocked(repo.findInquiryById).mockResolvedValue(calc as never);
    mocked(repo.claimInquiryConfirmation).mockResolvedValue(calc as never);
    mocked(registerManualSale).mockResolvedValue({ id: "v2" } as never);
    mocked(repo.setInquirySale).mockResolvedValue({
      ...calc,
      saleId: "v2",
    } as never);

    await changeInquiryStatus("c1", "confirmed", actor);

    const call = mocked(registerManualSale).mock.calls[0]![0];
    expect(call.input).toMatchObject({
      filamentId: "f1",
      material: "PLA",
      grams: 30,
      printMinutes: 90,
      quantity: 4,
      total: 10000,
    });
    // Sin costo a mano: lo calcula la venta desde gramos, horas y filamento.
    expect(call.manualCost).toBeUndefined();
  });

  it("si la venta falla, la consulta vuelve a respondida y no queda confirmada", async () => {
    mocked(repo.findInquiryById).mockResolvedValue(answered as never);
    mocked(repo.claimInquiryConfirmation).mockResolvedValue(answered as never);
    mocked(registerManualSale).mockRejectedValue(new Error("db"));

    await expect(changeInquiryStatus("c1", "confirmed", actor)).rejects.toThrow(
      "db",
    );
    expect(repo.setInquiryStatus).toHaveBeenCalledWith("c1", "answered");
    expect(repo.setInquirySale).not.toHaveBeenCalled();
  });

  it("dos toques seguidos: el segundo no crea otro pedido", async () => {
    mocked(repo.findInquiryById).mockResolvedValue(answered as never);
    mocked(repo.claimInquiryConfirmation).mockResolvedValue(null);

    await expect(changeInquiryStatus("c1", "confirmed", actor)).rejects.toThrow(
      /cambió/,
    );
    expect(registerManualSale).not.toHaveBeenCalled();
  });

  it("sin costo cargado no confirma ni crea nada", async () => {
    mocked(repo.findInquiryById).mockResolvedValue({
      ...answered,
      unitCost: null,
    } as never);

    await expect(changeInquiryStatus("c1", "confirmed", actor)).rejects.toThrow(
      /costo/,
    );
    expect(repo.claimInquiryConfirmation).not.toHaveBeenCalled();
    expect(registerManualSale).not.toHaveBeenCalled();
  });

  it("una consulta sin respuesta no se puede confirmar", async () => {
    mocked(repo.findInquiryById).mockResolvedValue({
      ...answered,
      status: "pending",
    } as never);
    await expect(changeInquiryStatus("c1", "confirmed", actor)).rejects.toThrow(
      /respuesta/,
    );
  });

  it("no se reabre una consulta que ya generó un pedido", async () => {
    mocked(repo.findInquiryById).mockResolvedValue({
      ...answered,
      status: "confirmed",
      saleId: "v1",
    } as never);
    await expect(changeInquiryStatus("c1", "reopen", actor)).rejects.toThrow(
      /pedido/,
    );
    expect(repo.setInquiryStatus).not.toHaveBeenCalled();
  });
});

describe("adjuntos de una consulta", () => {
  const audio = {
    bytes: Buffer.from("OggS"),
    name: "audio.ogg",
    type: "audio/ogg",
  };

  it("guarda un audio en la consulta", async () => {
    mocked(repo.findInquiryById).mockResolvedValue(answered as never);
    mocked(repo.appendInquiryFile).mockResolvedValue(true);
    const saved = await addInquiryFile("c1", audio, actor, false);
    expect(saved).toEqual({
      url: "https://x/archivo.ogg",
      name: "audio.ogg",
      type: "audio/ogg",
    });
  });

  it("rechaza tipos que no son audio, video ni PDF", async () => {
    mocked(repo.findInquiryById).mockResolvedValue(answered as never);
    await expect(
      addInquiryFile(
        "c1",
        { ...audio, name: "x.html", type: "text/html" },
        actor,
        false,
      ),
    ).rejects.toThrow(/audios/);
  });

  it("rechaza archivos de más de 4 MB", async () => {
    mocked(repo.findInquiryById).mockResolvedValue(answered as never);
    await expect(
      addInquiryFile(
        "c1",
        { ...audio, bytes: Buffer.alloc(4 * 1024 * 1024 + 1) },
        actor,
        false,
      ),
    ).rejects.toThrow(/4 MB/);
  });

  it("solo adjunta quien la cargó o quien puede responder", async () => {
    mocked(repo.findInquiryById).mockResolvedValue(answered as never);
    await expect(
      addInquiryFile("c1", audio, { id: "otro", name: null }, false),
    ).rejects.toThrow();
  });
});
