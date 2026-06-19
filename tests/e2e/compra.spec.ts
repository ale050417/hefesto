import { expect, test } from "@playwright/test";

// Camino feliz del storefront público hasta el carrito. El checkout completo
// (pago) requiere sesión + credenciales de MercadoPago de prueba; se cubre
// aparte. Necesita la base migrada y con productos publicados (pnpm db:seed).
test.describe("Flujo de compra (público)", () => {
  test("home → catálogo → producto → agregar al carrito", async ({ page }) => {
    await page.goto("/");
    // Link del catálogo en el header (scope a banner + exacto: hay otros iguales
    // en el hero y el footer).
    await expect(
      page
        .getByRole("banner")
        .getByRole("link", { name: "Catálogo", exact: true }),
    ).toBeVisible();

    await page.goto("/catalogo");
    const firstProduct = page.locator('a[href^="/producto/"]').first();
    await expect(firstProduct).toBeVisible();
    await firstProduct.click();
    await expect(page).toHaveURL(/\/producto\//);

    await page.getByRole("button", { name: /Agregar al carrito/i }).click();

    // El contador del botón "Abrir carrito" refleja el ítem agregado.
    await expect(
      page.getByRole("button", { name: "Abrir carrito" }),
    ).toContainText("1");
  });

  test("el checkout exige sesión", async ({ page }) => {
    await page.goto("/checkout");
    await expect(page).toHaveURL(/\/ingresar/);
  });
});
