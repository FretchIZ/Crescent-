import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Each suite resets its own SQLite file via `prisma db push`. Running them
    // in parallel spawns competing schema engines (slow/flaky on Windows), so
    // keep file execution sequential and allow generous setup time.
    fileParallelism: false,
    hookTimeout: 120000,
    testTimeout: 60000,
    setupFiles: ["./tests/setup.ts"],
  },
});
