import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
    cacheDir: path.join(root, ".vitest-cache"),
    test: {
        include: ["src/app/dashboard/settings/case-studies/actions.test.ts", "src/app/dashboard/settings/case-studies/case-study-enhance-off.test.ts"],
        environment: "node",
        globals: false,
    },
    resolve: {
        alias: {
            "@": path.join(root, "src"),
        },
    },
});
