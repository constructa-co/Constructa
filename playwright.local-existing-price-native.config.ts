import company from "./playwright.local-phase1.config";
import { defineConfig } from "@playwright/test";

export default defineConfig({ ...company, testMatch: "existing-price-native.spec.ts" });
