import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("full features marketing apply CTA", () => {
  it("routes the bottom highlight bar to /apply instead of sign-in", () => {
    const source = readFileSync(new URL("./full-features.tsx", import.meta.url), "utf8");
    expect(source).toMatch(/href="\/apply"[^>]*>\s*Apply to the founding cohort/);
    expect(source).not.toMatch(/href="\/login"[^>]*>\s*Get Started for free/);
  });
});