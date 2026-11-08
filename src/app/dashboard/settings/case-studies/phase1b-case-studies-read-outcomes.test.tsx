import type { ReactNode } from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    createClient: vi.fn(),
    redirect: vi.fn((path: string) => {
        throw new Error(`NEXT_REDIRECT:${path}`);
    }),
    profileSingle: vi.fn(async (): Promise<{ data: unknown; error: { message?: string } | null }> => ({
        data: { case_studies: [] as unknown[], company_name: "Saved Co" },
        error: null,
    })),
    caseLibraryEnabled: vi.fn(() => false),
    library: vi.fn(async () => ({ state: "ok" as const, value: { studies: [], disciplines: [] } })),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("next/navigation", () => ({
    redirect: mocks.redirect,
    unstable_rethrow: (error: unknown) => {
        if (error instanceof Error && error.message.startsWith("NEXT_")) throw error;
    },
}));
vi.mock("@/lib/case-library/gate", () => ({ caseLibraryEnabled: mocks.caseLibraryEnabled }));
vi.mock("@/lib/case-library/store", () => ({ sessionReader: () => ({ library: mocks.library }) }));
vi.mock("@/components/past-work-frame", () => ({
    default: ({ children }: { children?: ReactNode }) => createElement("div", { "data-past-work-frame": "stub" }, children),
}));
vi.mock("./library-panel", () => ({
    default: () => createElement("div", { "data-library-panel": "stub" }),
}));
vi.mock("./case-studies-client", () => ({
    default: (props: { initialCaseStudies: unknown[] }) =>
        createElement("div", {
            "data-case-studies-client": "stub",
            "data-initial-count": String(props.initialCaseStudies.length),
        }),
}));

import CaseStudiesPage from "./page";

function wireSupabase(options?: { user?: { id: string; email: string } | null }) {
    const user = options && "user" in options ? options.user : { id: "user-1", email: "sam@example.test" };
    mocks.createClient.mockResolvedValue({
        auth: { getUser: async () => ({ data: { user } }) },
        from: (table: string) => {
            if (table !== "profiles") throw new Error(`unexpected table ${table}`);
            const chain = {
                select: () => chain,
                eq: () => chain,
                single: mocks.profileSingle,
            };
            return chain;
        },
    });
}

async function renderCaseStudiesPage() {
    wireSupabase();
    return renderToStaticMarkup(await CaseStudiesPage());
}

describe("CaseStudiesPage profile read outcomes (Phase 1B)", () => {
    beforeEach(() => {
        mocks.createClient.mockReset();
        mocks.redirect.mockClear();
        mocks.profileSingle.mockReset();
        mocks.caseLibraryEnabled.mockReset();
        mocks.library.mockReset();
        mocks.profileSingle.mockResolvedValue({
            data: { case_studies: [], company_name: "Saved Co" },
            error: null,
        });
        mocks.caseLibraryEnabled.mockReturnValue(false);
        mocks.library.mockResolvedValue({ state: "ok", value: { studies: [], disciplines: [] } });
    });

    it("redirects when there is no signed-in user", async () => {
        wireSupabase({ user: null });
        await expect(CaseStudiesPage()).rejects.toThrow("NEXT_REDIRECT:/login");
    });

    it("shows an accessible unavailable state when the profile query returns an error (null data)", async () => {
        mocks.profileSingle.mockResolvedValueOnce({ data: null, error: { message: "connection failure" } });
        const markup = await renderCaseStudiesPage();
        expect(markup).toMatch(/role="alert"/);
        expect(markup).toMatch(/past work could not be loaded/i);
        expect(markup).not.toMatch(/data-case-studies-client="stub"/);
        expect(markup).toMatch(/data-past-work-frame="stub"/);
    });

    it("does not render the legacy editor when the query returns an error alongside partial case studies", async () => {
        mocks.profileSingle.mockResolvedValueOnce({
            data: { case_studies: [{ projectName: "Should Not Show" }], company_name: "Co" },
            error: { message: "permission denied" },
        });
        const markup = await renderCaseStudiesPage();
        expect(markup).toMatch(/past work could not be loaded/i);
        expect(markup).not.toMatch(/Should Not Show/);
        expect(markup).not.toMatch(/data-case-studies-client="stub"/);
    });

    it("shows unavailable when the query returns an error with an empty message and partial data", async () => {
        mocks.profileSingle.mockResolvedValueOnce({
            data: { case_studies: [{ projectName: "Empty Msg Partial" }], company_name: "Co" },
            error: { message: "" },
        });
        const markup = await renderCaseStudiesPage();
        expect(markup).toMatch(/role="alert"/);
        expect(markup).not.toMatch(/data-case-studies-client="stub"/);
    });

    it("shows unavailable when the profile row is absent (null data, no error)", async () => {
        mocks.profileSingle.mockResolvedValueOnce({ data: null, error: null });
        const markup = await renderCaseStudiesPage();
        expect(markup).toMatch(/role="alert"/);
        expect(markup).not.toMatch(/data-case-studies-client="stub"/);
    });

    it("shows unavailable when the profiles query throws", async () => {
        mocks.profileSingle.mockRejectedValueOnce(new Error("query transport failed"));
        const markup = await renderCaseStudiesPage();
        expect(markup).toMatch(/role="alert"/);
        expect(markup).toMatch(/query transport failed/);
        expect(markup).not.toMatch(/data-case-studies-client="stub"/);
    });

    it("renders the legacy editor with a confirmed empty list on a successful read", async () => {
        const markup = await renderCaseStudiesPage();
        expect(markup).not.toMatch(/past work could not be loaded/i);
        expect(markup).toMatch(/data-case-studies-client="stub"/);
        expect(markup).toMatch(/data-initial-count="0"/);
    });

    it("still reads the library only when the switch is on and the profile read succeeded", async () => {
        mocks.caseLibraryEnabled.mockReturnValue(true);
        mocks.profileSingle.mockResolvedValueOnce({
            data: { case_studies: [{ projectName: "Legacy One" }], company_name: "Co" },
            error: null,
        });
        const markup = await renderCaseStudiesPage();
        expect(mocks.library).toHaveBeenCalledTimes(1);
        expect(markup).toMatch(/data-library-panel="stub"/);
        expect(markup).toMatch(/data-case-studies-client="stub"/);
        expect(markup).toMatch(/data-initial-count="1"/);
    });

    it("does not mount the library panel when the profile read failed even if the switch is on", async () => {
        mocks.caseLibraryEnabled.mockReturnValue(true);
        mocks.profileSingle.mockResolvedValueOnce({ data: null, error: { message: "read failed" } });
        const markup = await renderCaseStudiesPage();
        expect(mocks.library).not.toHaveBeenCalled();
        expect(markup).not.toMatch(/data-library-panel="stub"/);
        expect(markup).not.toMatch(/data-case-studies-client="stub"/);
    });
});
