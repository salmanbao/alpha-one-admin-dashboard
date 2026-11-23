import path from "node:path";
import { defineConfig } from "vitest/config";

/**
 * Unit tests for platform-admin (S3 read-only gate regression, S7 parity).
 * Kept separate from the Next.js build: `bun run test` runs vitest with a
 * jsdom environment; `next build` never sees these files.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
