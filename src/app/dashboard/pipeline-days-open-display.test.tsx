import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/lib/theme-context", () => ({ useTheme: () => ({ theme: "dark" }) }));
vi.mock("next/link", () => ({ default: ({ children }: { children: unknown }) => <span>{children}</span> }));

import ProjectList from "./project-list";

const NOW = Date.parse("2026-11-16T12:00:00.000Z");

describe("CON-075 pipeline list days open", () => {
    it("shows a dash when created_at is missing", () => {
        vi.spyOn(Date, "now").mockReturnValue(NOW);
        const html = renderToStaticMarkup(
            <ProjectList
                projects={[{ id: "a", name: "Example", status: "Lead", created_at: null, proposal_sent_at: null }]}
                financials={{}}
            />,
        );
        expect(html).toContain("—");
        expect(html).not.toContain("NaNd");
        expect(html).not.toContain(">0d<");
        vi.restoreAllMocks();
    });

    it("shows day count from created_at when readable", () => {
        vi.spyOn(Date, "now").mockReturnValue(NOW);
        const created = new Date(NOW - 5 * 86_400_000).toISOString();
        const html = renderToStaticMarkup(
            <ProjectList
                projects={[{ id: "a", name: "Example", status: "Lead", created_at: created, proposal_sent_at: null }]}
                financials={{}}
            />,
        );
        expect(html).toContain("5d");
        vi.restoreAllMocks();
    });
});