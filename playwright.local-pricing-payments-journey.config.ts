import company from "./playwright.local-journey.config";
import { defineConfig } from "@playwright/test";

export default defineConfig({ ...company, testMatch: "pricing-payments-journey.spec.ts" });
