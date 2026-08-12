// Konfiguracja vitest dla SZTAB. Testujemy WYŁĄCZNIE czyste moduły
// (lib/crm/* poza queries/actions, lib/auth.ts) — reszta importuje
// "server-only" i wysypałaby się poza środowiskiem Next.
import { fileURLToPath } from "node:url";
import path from "node:path";
import { defineConfig } from "vitest/config";

// import.meta.url działa niezależnie od cwd, w tym w ścieżkach ze spacją.
const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": rootDir,
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
