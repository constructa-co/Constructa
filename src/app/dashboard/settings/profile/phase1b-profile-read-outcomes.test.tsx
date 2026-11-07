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
        data: { id: "user-1", company_name: "Saved Co", full_name: "Sam" },
        error: null,
    })),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("next/navigation", () => ({
    redirect: mocks.redirect,
    unstable_rethrow: (error: unknown) => {
        if (error instanceof Error && error.message.startsWith("NEXT_")) throw error;
    },
}));
vi.mock("sonner", () => ({ Toaster: () => null }));
vi.mock("@/components/company-profile-presentation", () => ({
    default: ({ children }: { children?: ReactNode }) => createElement("div", { "data-company-profile-presentation": "stub" }, children),
}));
vi.mock("./profile-form", () => ({
    default: (props: { profile?: { company_name?: string | null } }) =>
        createElement("form", { "data-profile-form": "stub", "data-company": props.profile?.company_name ?? "" }),
}));

import ProfilePage from "./page";

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

async function renderProfilePage() {
    wireSupabase();
    return renderToStaticMarkup(await ProfilePage());
}

describe("ProfilePage profile read outcomes (Phase 1B)", () => {
    beforeEach(() => {
        mocks.createClient.mockReset();
        mocks.redirect.mockClear();
        mocks.profileSingle.mockReset();
        mocks.profileSingle.mockResolvedValue({
            data: { id: "user-1", company_name: "Saved Co", full_name: "Sam" },
            error: null,
        });
    });

    it("redirects when there is no signed-in user", async () => {
        wireSupabase({ user: null });
        await expect(ProfilePage()).rejects.toThrow("NEXT_REDIRECT:/login");
    });

    it("shows an accessible unavailable state when the profile query returns an error (null data)", async () => {
        mocks.profileSingle.mockResolvedValueOnce({ data: null, error: { message: "connection failure" } });
        const markup = await renderProfilePage();
        expect(markup).toMatch(/role="alert"/);
        expect(markup).toMatch(/company profile could not be loaded/i);
        expect(markup).not.toMatch(/data-profile-form="stub"/);
        expect(markup).toMatch(/data-company-profile-presentation="stub"/);
    });

    it("does not render the editable form when the query returns an error alongside partial data", async () => {
        mocks.profileSingle.mockResolvedValueOnce({
            data: { id: "user-1", company_name: "Should Not Show" },
            error: { message: "permission denied" },
        });
        const markup = await renderProfilePage();
        expect(markup).toMatch(/company profile could not be loaded/i);
        expect(markup).not.toMatch(/Should Not Show/);
        expect(markup).not.toMatch(/data-profile-form="stub"/);
    });

    it("shows unavailable when the query returns an error with an empty message and partial data", async () => {
        mocks.profileSingle.mockResolvedValueOnce({
            data: { id: "user-1", company_name: "Empty Msg Partial" },
            error: { message: "" },
        });
        const markup = await renderProfilePage();
        expect(markup).toMatch(/role="alert"/);
        expect(markup).not.toMatch(/data-profile-form="stub"/);
        expect(markup).not.toMatch(/Empty Msg Partial/);
    });

    it("shows unavailable when the profile row is absent (null data, no error)", async () => {
        mocks.profileSingle.mockResolvedValueOnce({ data: null, error: null });
        const markup = await renderProfilePage();
        expect(markup).toMatch(/role="alert"/);
        expect(markup).not.toMatch(/data-profile-form="stub"/);
    });

    it("shows unavailable when the profiles query throws", async () => {
        mocks.profileSingle.mockRejectedValueOnce(new Error("query transport failed"));
        const markup = await renderProfilePage();
        expect(markup).toMatch(/role="alert"/);
        expect(markup).toMatch(/company profile could not be loaded/i);
        expect(markup).toMatch(/query transport failed/);
        expect(markup).not.toMatch(/data-profile-form="stub"/);
    });

    it("shows unavailable when the profiles query throws an error with an empty message", async () => {
        mocks.profileSingle.mockRejectedValueOnce(new Error(""));
        const markup = await renderProfilePage();
        expect(markup).toMatch(/role="alert"/);
        expect(markup).not.toMatch(/data-profile-form="stub"/);
    });

    it("renders the editable form with known profile data on a successful read", async () => {
        const markup = await renderProfilePage();
        expect(markup).not.toMatch(/company profile could not be loaded/i);
        expect(markup).toMatch(/data-profile-form="stub"/);
        expect(markup).toMatch(/data-company="Saved Co"/);
    });
});
