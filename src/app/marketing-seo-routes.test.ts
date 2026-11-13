import { describe, expect, it, vi } from "vitest";
import sitemap from "./sitemap";
import robots from "./robots";

describe("marketing SEO route handlers", () => {
  it("exports sitemap and robots handlers wired to marketing helpers", () => {
    vi.stubEnv("CONSTRUCTA_REVIEW_ONLY", "0");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://www.constructa.co");
    const entries = sitemap();
    expect(entries.length).toBeGreaterThan(0);
    const rules = robots();
    expect(rules.sitemap).toBe("https://www.constructa.co/sitemap.xml");
    expect(rules.rules).toMatchObject({ allow: "/" });
    vi.unstubAllEnvs();
  });
});
