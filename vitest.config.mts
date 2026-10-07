import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
    test: {
        // Sprint 58 Phase 1 item #8. Start with unit tests on pure financial
        // functions in src/lib/**/*.test.ts. Gradually expand to server
        // actions (they're async but still pure) and then to React
        // components if/when that's needed.
        // e2e/**/*.test.ts are unit tests of the browser harness itself (its
        // environment gate). The browser journeys are *.spec.ts and run under
        // Playwright, not here.
        include: ["src/**/*.test.ts", "src/**/*.test.tsx", "e2e/**/*.test.ts"],
        environment: "node",
        globals: false,
    },
    resolve: {
        alias: {
            "@": path.resolve(import.meta.dirname, "./src"),
        },
    },
});
