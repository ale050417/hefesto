import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  changeOrderStatus,
  updateManualSaleStatus,
  recordAudit,
  revalidatePath,
} = vi.hoisted(() => ({
  changeOrderStatus: vi.fn<(p: unknown) => Promise<unknown>>(async () => ({})),
  updateManualSaleStatus: vi.fn<(...a: unknown[]) => Promise<void>>(
    async () => {},
  ),
  recordAudit: vi.fn<(e: unknown) => Promise<void>>(async () => {}),
  revalidatePath: vi.fn<(p: string) => void>(),
}));

vi.mock("@/features/orders/status-flow", () => ({ changeOrderStatus }));
vi.mock("@/features/orders/services/manualSaleService", () => ({
  updateManualSaleStatus,
}));
vi.mock("@/core/audit", () => ({ recordAudit }));
vi.mock("next/cache", () => ({ revalidatePath }));

const { moveBoardCard } = await import("./board-move");

beforeEach(() => vi.clearAllMocks());

describe("moveBoardCard", () => {
  it("online: usa el flujo compartido de pedidos y revalida pedidos y cola", async () => {
    await moveBoardCard({
      source: "online",
      id: "o1",
      status: "in_production",
      actorId: "u1",
    });
    expect(changeOrderStatus).toHaveBeenCalledWith({
      orderId: "o1",
      toStatus: "in_production",
      actorId: "u1",
    });
    expect(updateManualSaleStatus).not.toHaveBeenCalled();
    const paths = revalidatePath.mock.calls.map((c) => c[0]);
    expect(paths).toEqual(
      expect.arrayContaining([
        "/admin/pedidos/o1",
        "/admin/pedidos",
        "/admin/produccion",
      ]),
    );
  });

  it("manual: cambia el estado, audita y revalida ganancias y reportes", async () => {
    await moveBoardCard({
      source: "manual",
      id: "m1",
      status: "ready",
      actorId: "u1",
    });
    expect(updateManualSaleStatus).toHaveBeenCalledWith("m1", "ready", null);
    expect(recordAudit).toHaveBeenCalledWith({
      actorId: "u1",
      action: "manual_sale.status_changed",
      entityType: "manual_sale",
      entityId: "m1",
      metadata: { status: "ready" },
    });
    expect(changeOrderStatus).not.toHaveBeenCalled();
    const paths = revalidatePath.mock.calls.map((c) => c[0]);
    expect(paths).toEqual(
      expect.arrayContaining([
        "/admin/pedidos",
        "/admin/ganancias",
        "/admin/reportes",
        "/admin/produccion",
      ]),
    );
  });

  it("no permite cancelar ni reembolsar desde la cola", async () => {
    for (const status of ["cancelled", "refunded"] as const) {
      await expect(
        moveBoardCard({ source: "online", id: "o1", status, actorId: "u1" }),
      ).rejects.toThrow(/etapas del taller/);
    }
    expect(changeOrderStatus).not.toHaveBeenCalled();
    expect(updateManualSaleStatus).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("si el servicio rechaza la transición, no revalida ni audita", async () => {
    updateManualSaleStatus.mockRejectedValueOnce(
      new Error("transición inválida"),
    );
    await expect(
      moveBoardCard({
        source: "manual",
        id: "m1",
        status: "delivered",
        actorId: null,
      }),
    ).rejects.toThrow("transición inválida");
    expect(recordAudit).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
