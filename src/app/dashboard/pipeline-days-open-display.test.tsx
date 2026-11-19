import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/lib/theme-context", () => ({ useTheme: () => ({ theme: "dark" }) }));
vi.mock("next/link", () => ({
    default: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {} }) }));
vi.mock("@/lib/launch-profile", () => ({ isCapabilityEnabled: () => false }));

import ProjectList from "./project-list";
import ProjectBoard from "./project-board";

const NOW = Date.parse("2026-11-16T12:00:00.000Z");

const demoProject = {
    id: "demo",
    name: "Demo job",
    status: "Lead",
    created_at: new Date(NOW - 218 * 86_400_000).toISOString(),
    proposal_sent_at: null,
};

describe("CON-075 pipeline days open presentation", () => {
    it("list hides Days Open column for rows with only created_at (218d demo)", () => {
        vi.spyOn(Date, "now").mockReturnValue(NOW);
        const html = renderToStaticMarkup(
            <ProjectList projects={[demoProject]} financials={{}} />,
        );
        expect(html).not.toContain("Days Open");
        expect(html).not.toContain("218d");
        expect(html).not.toContain("text-amber-500");
        vi.restoreAllMocks();
    });

    it("board hides open-age strip for rows with only created_at (218d demo)", () => {
        vi.spyOn(Date, "now").mockReturnValue(NOW);
        const html = renderToStaticMarkup(
            <ProjectBoard projects={[demoProject]} financials={{}} />,
        );
        expect(html).not.toContain("data-board-age");
        expect(html).not.toContain("218d");
        expect(html).not.toContain("Open 31w");
        expect(html).not.toContain("text-amber-500");
        vi.restoreAllMocks();
    });
});