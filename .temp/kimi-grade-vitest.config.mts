// Operational grade-only config (not a product file, not for merge).
// Bounded to the two A038 enhance-OFF tests; absolute worktree root/alias;
// cache kept inside the worktree so the shared parent node_modules is untouched.
import { defineConfig } from "vitest/config";
import path from "node:path";

const root = "/Users/robertsmith/dev/constructa-fresh-20261025/.cq-wt/a038-photos";

export default defineConfig({
    root,
    cacheDir: path.join(root, ".vitest-cache"),
    test: {
        include: [
            "src/app/dashboard/settings/case-studies/actions.test.ts",
            "src/app/dashboard/settings/case-studies/case-study-enhance-off.test.ts",
        ],
        environment: "node",
        globals: false,
    },
    resolve: {
        alias: {
            "@": path.join(root, "src"),
        },
    },
});
