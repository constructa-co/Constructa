import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/theme-context", () => ({ useTheme: () => ({ theme: "light" }) }));

import PastWorkFrame from "./past-work-frame";
import { PROPOSAL_READINESS_PATH } from "@/lib/first-session";

const html = renderToStaticMarkup(
    <PastWorkFrame><div data-editor-sentinel="true">The existing editor stays here</div></PastWorkFrame>,
);
const guide = html.match(/<aside[^>]*aria-label="Adding past work"[^>]*>([\s\S]*?)<\/aside>/)![1];

describe("past-work guide", () => {
    it("explains similar-work evidence and deliberate reuse, without promising an automatic selection or results", () => {
        expect(guide).toContain("Help a client see work like theirs.");
        expect(guide).toContain("A similar project gives a client something concrete to judge");
        expect(guide).toContain("Choose relevant saved examples when preparing a proposal");
        expect(guide).toContain("Only describe work you actually did");
        expect(guide).not.toMatch(/automatically|guaranteed|win more/i);
    });

    it("retains the heading, editor slot, permission guidance, save warning and existing route", () => {
        expect(html).toContain("Show what you&#x27;ve built.");
        expect(html).toContain('data-editor-sentinel="true"');
        expect(html).toContain("The existing editor stays here");
        expect(html).toContain(`href="${PROPOSAL_READINESS_PATH}"`);
        expect(guide).toContain("Use examples and details you have permission to share.");
        expect(guide).toContain("Save all past work saves this whole list.");
        expect(guide).toContain("work in one tab at a time.");
    });
});
