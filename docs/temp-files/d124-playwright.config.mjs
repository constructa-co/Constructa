import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "@playwright/test";

const here = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
    testDir: here,
    testMatch: "d124-brand-visual-capture.spec.ts",
    retries: 0,
    workers: 1,
    timeout: 120_000,
    use: {
        baseURL: process.env.D124_BASE_URL ?? "http://127.0.0.1:3010",
        browserName: "chromium",
        headless: true,
    },
});