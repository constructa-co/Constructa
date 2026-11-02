import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import PublicChrome from "@/components/public-chrome";
import FeaturesPage from "./page";

const route = vi.hoisted(() => ({ pathname: "/features" }));
vi.mock("next/navigation", () => ({
  usePathname: () => route.pathname,
  useRouter: () => ({}),
}));

const FULL_INNER_WRAPPER =
  'class="bg-black text-white selection:bg-blue-500/30"';

function composedMarkup(profile: "cohort" | "full") {
  vi.stubEnv("NEXT_PUBLIC_CONSTRUCTA_LAUNCH_PROFILE", profile);
  route.pathname = "/features";
  return renderToStaticMarkup(
    <PublicChrome>
      <FeaturesPage />
    </PublicChrome>,
  );
}

describe("features route under the default cohort profile", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_CONSTRUCTA_LAUNCH_PROFILE", "cohort");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("exposes exactly one main landmark when composed with PublicChrome", () => {
    route.pathname = "/features";
    const markup = renderToStaticMarkup(
      <PublicChrome>
        <FeaturesPage />
      </PublicChrome>,
    );
    expect((markup.match(/<main\b/g) ?? []).length).toBe(1);
    const mainOpen = markup.indexOf("<main");
    const mainClose = markup.lastIndexOf("</main>");
    const mainContent = markup.slice(mainOpen, mainClose);
    expect(mainContent).toMatch(/<h1[\s>]/);
    expect(mainContent).toContain("From first hello.");
    expect(mainContent).toContain("not available as a live chatbot");
    expect(mainContent).not.toContain("Real-time Cost Updates");
  });
});

describe("features route under the full profile", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_CONSTRUCTA_LAUNCH_PROFILE", "full");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("exposes exactly one main landmark when composed with PublicChrome", () => {
    const markup = composedMarkup("full");
    expect((markup.match(/<main\b/g) ?? []).length).toBe(1);
    const mainOpen = markup.indexOf("<main");
    const mainClose = markup.lastIndexOf("</main>");
    const mainContent = markup.slice(mainOpen, mainClose);
    expect(mainContent).toMatch(/<h1[\s>]/);
    expect(mainContent).toContain("Designed for builders.");
    expect(mainContent).toContain("Real-time Cost Updates");
    expect(mainContent).toContain(FULL_INNER_WRAPPER);
    expect(mainContent).not.toContain("not available as a live chatbot");
  });
});
