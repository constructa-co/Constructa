import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
    test: {
        // Sprint 58 Phase 1 item #8. Start with unit tests on pure financial
        // functions in src/lib/**/*.test.ts. Gradually expand to server
        // actions (they're async but still pure) and then to React
        // components if/when that's needed.
        include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
        environment: "node",
        globals: false,
    },
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
        },
    },
});
