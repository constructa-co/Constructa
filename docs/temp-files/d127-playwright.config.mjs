import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "@playwright/test";

const here = path.dirname(fileURLToPath(import.meta.url));

// D127 layout captures: offline bundles only, no server or baseURL. Installed Edge, as the local-phase1 configs.
export default defineConfig({
    testDir: here,
    testMatch: "d127-layout-capture.spec.ts",
    retries: 0,
    workers: 1,
    timeout: 120_000,
    use: { channel: "msedge", headless: true },
});
