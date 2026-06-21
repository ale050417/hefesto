import { expect, test } from "@playwright/test";

// Aplicar un cupón inexistente en el carrito muestra el error (flujo público,
// sin login). Necesita la base con al menos un producto publicado.
test("cupón inválido muestra error en el carrito", async ({ page }) => {
  await page.goto("/catalogo");
  await page.locator('a[href^="/producto/"]').first().click();
  await expect(page).toHaveURL(/\/producto\//);

  await page.getByRole("button", { name: /Agregar al carrito/i }).click();

  await page.getByPlaceholder("Código de cupón").fill("NO-EXISTE-123");
  await page.getByRole("button", { name: "Aplicar" }).click();

  await expect(page.getByText(/no existe|inválido|venc/i)).toBeVisible();
});
