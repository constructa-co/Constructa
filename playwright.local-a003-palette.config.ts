import { defineConfig } from "@playwright/test";
import company from "./playwright.local-phase1.config";

export default defineConfig({ ...company, testMatch: "a003-palette.spec.ts" });
