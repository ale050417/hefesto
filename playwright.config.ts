import { defineConfig, devices } from "@playwright/test";

// E2E (Cap. 15). Requiere la app corriendo y la base configurada.
// Local:  pnpm exec playwright install  (una vez)  →  pnpm test:e2e
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  fullyParallel: true,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // Si no se apunta a una URL externa, levanta el dev server.
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "pnpm dev",
        url: "http://localhost:3000",
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
