import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    env: { SKIP_ENV_VALIDATION: "1" },
    // Por defecto Vitest abre un worker por núcleo. En equipos de muchos
    // núcleos (32 hilos) con poca RAM libre, cada worker carga react-pdf,
    // drizzle, etc. y el proceso muere con "out of memory". 4 alcanza de sobra
    // (la suite entera corre en ~5 s).
    maxWorkers: 4,
  },
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
});
