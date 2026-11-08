import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const worktreeRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export default defineConfig({
    root: worktreeRoot,
    test: {
        environment: "node",
        globals: false,
        include: [
            "src/app/dashboard/projects/proposal/a069-closing-editor-journey.test.tsx",
            "src/app/dashboard/projects/proposal/company-closing-entry.test.tsx",
            "src/lib/new-job-closing.test.ts",
        ],
    },
    resolve: {
        alias: {
            "@": path.join(worktreeRoot, "src"),
        },
    },
});
