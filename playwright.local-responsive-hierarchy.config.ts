import { defineConfig } from "@playwright/test";
import navigation from "./playwright.local-navigation.config";

export default defineConfig({ ...navigation, testMatch: "responsive-hierarchy.spec.ts" });
