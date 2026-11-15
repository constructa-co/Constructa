import { defineConfig } from "@playwright/test";
import path from "node:path";

const output = process.env.CONSTRUCTA_LOCAL_PHASE1_OUTPUT;
if (!output || !path.isAbsolute(output) || output.startsWith(process.cwd() + path.sep)) {
  throw Error("Set CONSTRUCTA_LOCAL_PHASE1_OUTPUT to the prepared private output outside the application.");
}

const touch = { hasTouch: true, isMobile: true, deviceScaleFactor: 2 };

export default defineConfig({
  testDir: "./e2e/local-phase1",
  testMatch: "marketing-product-captures.spec.ts",
  outputDir: path.join(output, "marketing-captures-browser"),
  workers: 1,
  retries: 0,
  use: { channel: "chrome", headless: true },
  projects: [
    { name: "desktop", use: { viewport: { width: 1440, height: 900 } } },
    { name: "phone", use: { viewport: { width: 390, height: 844 }, ...touch } },
  ],
});