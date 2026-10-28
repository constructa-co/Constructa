import { defineConfig } from "@playwright/test";
import company from "./playwright.local-phase1.config";

export default defineConfig({ ...company, testMatch: "a111-readability.spec.ts" });
