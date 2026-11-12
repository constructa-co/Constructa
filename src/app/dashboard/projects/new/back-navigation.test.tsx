import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { isDashboardPathAllowed } from "@/lib/launch-profile";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/lib/theme-context", () => ({ useTheme: () => ({ theme: "dark" }) }));
vi.mock("./actions", () => ({ createBlankProjectAction: vi.fn() }));

import NewProjectForm from "./new-project-form";

afterEach(() => vi.unstubAllEnvs());

describe("new-job return link", () => {
    it("returns a first project to the existing company setup hub before the heading", () => {
        const html = renderToStaticMarkup(<NewProjectForm isFirstProject />);
        expect(html).toContain('href="/dashboard/settings/profile/readiness"');
        expect(html).toContain("Back to company setup");
        expect(html.indexOf("Back to company setup")).toBeLessThan(html.indexOf("<h1"));
        expect(isDashboardPathAllowed("/dashboard/settings/profile/readiness", "cohort")).toBe(true);
    });

    it.each([["cohort", "/dashboard"], ["full", "/dashboard/home"]])("uses the existing %s landing route for a returning contractor", (profile, href) => {
        vi.stubEnv("NEXT_PUBLIC_CONSTRUCTA_LAUNCH_PROFILE", profile);
        const html = renderToStaticMarkup(<NewProjectForm isFirstProject={false} />);
        expect(html).toContain(`href="${href}"`);
        expect(html).toContain("Back to your workspace");
        expect(html).not.toContain("Back to company setup");
        expect(html).toContain('id="new-project-name"');
        expect(html).toContain('id="new-project-client"');
        expect(html).toContain("Create project and start the brief");
    });
});
