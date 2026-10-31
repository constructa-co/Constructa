import type { ReactElement, ReactNode } from "react";
import { createElement } from "react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { coreFocusVisibleRing, corePrimaryButton } from "@/lib/core-editing-palette";

/** Material pre-A091 assurance and styling (base b275390… source). */
const LEGACY_UNSUPPORTED_ASSURANCE = "no data has been lost";
const LEGACY_TRY_AGAIN_BLUE = "bg-blue-600";

vi.mock("@/lib/observability", () => ({ reportError: vi.fn() }));
vi.mock("next/link", () => ({
    default: ({ children, href }: { children?: ReactNode; href: string }) => createElement("a", { href }, children),
}));
vi.mock("react", async original => ({
    ...await original<typeof import("react")>(),
    useEffect: (fn: () => void) => {
        fn();
    },
}));

import DashboardError from "./error";
import { reportError } from "@/lib/observability";

type Element = ReactElement<Record<string, unknown>>;

function nodes(value: unknown): Element[] {
    if (Array.isArray(value)) return value.flatMap(nodes);
    if (!value || typeof value !== "object" || !("props" in value)) return [];
    const element = value as Element;
    return [element, ...nodes(element.props.children)];
}

function text(value: unknown): string {
    if (typeof value === "string" || typeof value === "number") return String(value);
    if (Array.isArray(value)) return value.map(text).join("");
    if (value && typeof value === "object" && "props" in value) return text((value as Element).props.children);
    return "";
}

function renderError(error: Error & { digest?: string }, reset: () => void) {
    return nodes(DashboardError({ error, reset }));
}

const readSource = () => readFileSync(path.join(process.cwd(), "src/app/dashboard/error.tsx"), "utf8");

afterEach(() => {
    vi.unstubAllEnvs();
    vi.mocked(reportError).mockClear();
});

describe("A091 dashboard route-group error boundary (pre-change baseline)", () => {
    it("no longer carries the unsupported persistence guarantee or blue Try again control", () => {
        const source = readSource();
        expect(source.toLowerCase()).not.toContain(LEGACY_UNSUPPORTED_ASSURANCE);
        expect(source).not.toContain(LEGACY_TRY_AGAIN_BLUE);
    });
});

describe("A091 dashboard route-group error boundary (recovery UI)", () => {
    it("shows honest uncertainty copy without raw error or auth/service leakage", () => {
        vi.stubEnv("NEXT_PUBLIC_CONSTRUCTA_LAUNCH_PROFILE", "cohort");
        const sensitive = "Bearer secret-token Supabase auth failed at service_role";
        const error = Object.assign(new Error(sensitive), { digest: "abc123digest" });
        const markup = text(renderError(error, vi.fn()));
        expect(markup.toLowerCase()).not.toContain(LEGACY_UNSUPPORTED_ASSURANCE);
        expect(markup).toContain("may be missing");
        expect(markup).toContain("Check what is already saved");
        expect(markup).not.toContain(sensitive);
        expect(markup).not.toContain("Bearer");
        expect(markup).not.toContain("Supabase");
        expect(markup).not.toContain("service_role");
    });

    it("shows digest-only support reference when present", () => {
        const els = renderError(Object.assign(new Error("internal"), { digest: "digest-only-ref" }), vi.fn());
        const refLine = els.find(e => text(e.props.children).includes("ref:"));
        expect(refLine).toBeDefined();
        expect(text(refLine!.props.children)).toBe("ref: digest-only-ref");
        expect(text(els)).not.toContain("internal");
    });

    it("calls reset exactly once when Try again is clicked; primary uses sage tokens", () => {
        vi.stubEnv("NEXT_PUBLIC_CONSTRUCTA_LAUNCH_PROFILE", "full");
        const reset = vi.fn();
        const els = renderError(Object.assign(new Error("x"), { digest: "d1" }), reset);
        const retry = els.find(
            e => e.type === "button" && /Try again/.test(text(e.props.children)),
        )!;
        expect(String(retry.props.className)).toContain(corePrimaryButton);
        expect(String(retry.props.className)).toContain(coreFocusVisibleRing);
        expect(String(retry.props.className)).not.toMatch(/blue/);
        (retry.props.onClick as () => void)();
        expect(reset).toHaveBeenCalledTimes(1);
    });

    it("links Dashboard to the launch landing path without auto navigation", () => {
        vi.stubEnv("NEXT_PUBLIC_CONSTRUCTA_LAUNCH_PROFILE", "full");
        const els = renderError(new Error("x"), vi.fn());
        const dashboard = els.find(e => typeof e.props.href === "string" && /Dashboard/.test(text(e.props.children)))!;
        expect(dashboard.props.href).toBe("/dashboard/home");
        expect(dashboard.props.onClick).toBeUndefined();

        vi.stubEnv("NEXT_PUBLIC_CONSTRUCTA_LAUNCH_PROFILE", "cohort");
        const cohortEls = renderError(new Error("x"), vi.fn());
        const cohortLink = cohortEls.find(
            e => typeof e.props.href === "string" && /Dashboard/.test(text(e.props.children)),
        )!;
        expect(cohortLink.props.href).toBe("/dashboard");
    });

    it("still forwards the error to observability on mount", () => {
        const error = Object.assign(new Error("obs"), { digest: "dig" });
        renderError(error, vi.fn());
        expect(reportError).toHaveBeenCalledWith(error, {
            source: "dashboard-error-boundary",
            digest: "dig",
        });
    });
});
