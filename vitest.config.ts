import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  // Scenario generation plays real hands with the strategy bots, so allow generous time.
  test: { include: ["tests/**/*.test.ts"], environment: "node", testTimeout: 120000 },
});
