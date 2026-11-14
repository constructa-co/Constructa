import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
    PLATFORM_TERMS_ENFORCEMENT_ENV,
    isPlatformTermsEnforcementEnabled,
    isPlatformTermsGatedPath,
    platformTermsGateRedirect,
    resolvePlatformTermsStatus,
} from "./platform-terms-gate";
import { PLATFORM_TERMS_COMPLETION_PATH } from "./platform-terms-completion";

afterEach(() => {
    vi.restoreAllMocks();
});

describe("A023 F4: enforcement is default OFF", () => {
    it("is off when unset, empty, or anything other than exactly 'on'", () => {
        expect(isPlatformTermsEnforcementEnabled(undefined)).toBe(false);
        for (const value of ["", " ", "off", "true", "1", "yes", "enabled", "onn"]) {
            expect(isPlatformTermsEnforcementEnabled(value)).toBe(false);
        }
    });

    it("is on only for 'on' (case and whitespace tolerant)", () => {
        expect(isPlatformTermsEnforcementEnabled("on")).toBe(true);
        expect(isPlatformTermsEnforcementEnabled(" ON ")).toBe(true);
    });

    it("reads the server-only variable by default, and it is not a NEXT_PUBLIC_ name", () => {
        expect(PLATFORM_TERMS_ENFORCEMENT_ENV).toBe("CONSTRUCTA_PLATFORM_TERMS_ENFORCEMENT");
        expect(PLATFORM_TERMS_ENFORCEMENT_ENV.startsWith("NEXT_PUBLIC_")).toBe(false);
        vi.stubEnv(PLATFORM_TERMS_ENFORCEMENT_ENV, "on");
        expect(isPlatformTermsEnforcementEnabled()).toBe(true);
        vi.stubEnv(PLATFORM_TERMS_ENFORCEMENT_ENV, "");
        expect(isPlatformTermsEnforcementEnabled()).toBe(false);
        vi.unstubAllEnvs();
    });
});

describe("A023 F1: which paths are 'the app'", () => {
    it.each(["/dashboard", "/dashboard/home", "/dashboard/projects/proposal", "/onboarding", "/onboarding/step"])(
        "gates %s",
        (pathname) => expect(isPlatformTermsGatedPath(pathname)).toBe(true),
    );

    it.each([
        "/",
        "/login",
        "/auth/platform-terms",
        "/auth/callback",
        "/auth/signout",
        "/terms-of-service",
        "/proposal/some-token",
        "/admin",
        "/dashboard-x",
        "/onboardingx",
        "/api/anything",
    ])("does not gate %s", (pathname) => expect(isPlatformTermsGatedPath(pathname)).toBe(false));
});

describe("A023 F1: status classification", () => {
    it("accepted when a current-revision row comes back", async () => {
        await expect(resolvePlatformTermsStatus(async () => ({ data: [{ id: "r1" }], error: null }))).resolves.toBe("accepted");
    });

    it("missing only on a clean empty result", async () => {
        await expect(resolvePlatformTermsStatus(async () => ({ data: [], error: null }))).resolves.toBe("missing");
    });

    it("unknown (fail open) when the table is not installed, quietly", async () => {
        const log = vi.spyOn(console, "error").mockImplementation(() => {});
        for (const code of ["PGRST205", "42P01"]) {
            await expect(resolvePlatformTermsStatus(async () => ({ data: null, error: { code } }))).resolves.toBe("unknown");
        }
        expect(log).not.toHaveBeenCalled();
    });

    it("unknown (fail open) on a lookup error, logging the code only", async () => {
        const log = vi.spyOn(console, "error").mockImplementation(() => {});
        await expect(
            resolvePlatformTermsStatus(async () => ({ data: null, error: { code: "XX000", message: "secret provider detail" } })),
        ).resolves.toBe("unknown");
        expect(log).toHaveBeenCalledTimes(1);
        expect(JSON.stringify(log.mock.calls)).not.toContain("secret provider detail");
    });

    it("unknown (fail open) when the lookup throws, with no detail logged", async () => {
        const log = vi.spyOn(console, "error").mockImplementation(() => {});
        await expect(
            resolvePlatformTermsStatus(() => {
                throw new Error("connection reset token=secret");
            }),
        ).resolves.toBe("unknown");
        expect(JSON.stringify(log.mock.calls)).not.toContain("secret");
    });

    it("unknown when data is not an array and there is no error", async () => {
        await expect(resolvePlatformTermsStatus(async () => ({ data: null, error: null }))).resolves.toBe("unknown");
    });
});

describe("A023 F1: redirect decision (no loops, only confirmed absence)", () => {
    it("routes a missing acceptance on an app path to the acceptance page", () => {
        expect(platformTermsGateRedirect("/dashboard/projects/costs", "missing")).toBe(PLATFORM_TERMS_COMPLETION_PATH);
        expect(platformTermsGateRedirect("/onboarding", "missing")).toBe(PLATFORM_TERMS_COMPLETION_PATH);
    });

    it("never redirects accepted or unknown", () => {
        for (const status of ["accepted", "unknown"] as const) {
            expect(platformTermsGateRedirect("/dashboard", status)).toBeNull();
        }
    });

    it("never redirects from the acceptance page itself or other non-app paths, whatever the status", () => {
        for (const status of ["accepted", "missing", "unknown"] as const) {
            expect(platformTermsGateRedirect(PLATFORM_TERMS_COMPLETION_PATH, status)).toBeNull();
            expect(platformTermsGateRedirect("/login", status)).toBeNull();
            expect(platformTermsGateRedirect("/admin", status)).toBeNull();
        }
    });

    it("the redirect target is itself not a gated path", () => {
        expect(isPlatformTermsGatedPath(PLATFORM_TERMS_COMPLETION_PATH)).toBe(false);
    });
});

describe("A023 F2: per-version migration draft (static text check, no SQL executed)", () => {
    const sql = readFileSync(
        path.resolve(import.meta.dirname, "../../supabase/migrations/20261114032000_platform_terms_per_version_acceptance.sql"),
        "utf8",
    );
    const statements = sql.replace(/--.*$/gm, "");

    it("adds the per-revision unique key before dropping the old one-per-document key", () => {
        const add = statements.indexOf("ADD CONSTRAINT platform_terms_acceptances_one_record_per_revision");
        const drop = statements.indexOf("DROP CONSTRAINT platform_terms_acceptances_one_current_record");
        expect(add).toBeGreaterThan(-1);
        expect(drop).toBeGreaterThan(add);
        expect(statements).toMatch(/UNIQUE \(user_id, terms_document, accepted_revision\)/);
    });

    it("runs in one transaction", () => {
        expect(statements).toMatch(/BEGIN;[\s\S]*COMMIT;/);
    });

    it("changes no grants or policies and adds no UPDATE/DELETE/service_role access", () => {
        expect(statements).not.toMatch(/GRANT|REVOKE|POLICY|service_role|DROP TABLE|DELETE|UPDATE/i);
    });
});
