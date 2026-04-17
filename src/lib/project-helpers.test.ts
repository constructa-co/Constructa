import { describe, it, expect } from "vitest";
import {
    isActiveProject,
    isPipelineProject,
    isClosedProject,
    ACTIVE_PROJECT_STATUSES,
} from "./project-helpers";

describe("isActiveProject", () => {
    it("matches canonical 'Active' status", () => {
        expect(isActiveProject({ status: "Active" })).toBe(true);
    });

    it("matches 'Won' — transitional state before mark-as-won settles", () => {
        expect(isActiveProject({ status: "Won" })).toBe(true);
    });

    it("matches legacy lowercase 'active'", () => {
        // Older rows predating the status-case normalisation.
        expect(isActiveProject({ status: "active" })).toBe(true);
    });

    it("excludes archived projects even when status is Active", () => {
        expect(isActiveProject({ status: "Active", is_archived: true })).toBe(false);
    });

    it("excludes pipeline statuses", () => {
        expect(isActiveProject({ status: "Lead" })).toBe(false);
        expect(isActiveProject({ status: "Estimating" })).toBe(false);
        expect(isActiveProject({ status: "Proposal Sent" })).toBe(false);
        expect(isActiveProject({ status: "Draft" })).toBe(false);
    });

    it("excludes close-out statuses", () => {
        expect(isActiveProject({ status: "Completed" })).toBe(false);
        expect(isActiveProject({ status: "Lost" })).toBe(false);
    });

    it("handles null/undefined status gracefully", () => {
        expect(isActiveProject({ status: null })).toBe(false);
        expect(isActiveProject({ status: undefined })).toBe(false);
        expect(isActiveProject({})).toBe(false);
    });
});

describe("isPipelineProject", () => {
    it("matches all canonical pipeline stages", () => {
        expect(isPipelineProject({ status: "Lead" })).toBe(true);
        expect(isPipelineProject({ status: "Estimating" })).toBe(true);
        expect(isPipelineProject({ status: "Proposal Sent" })).toBe(true);
        expect(isPipelineProject({ status: "Draft" })).toBe(true);
    });

    it("excludes active / closed / archived", () => {
        expect(isPipelineProject({ status: "Active" })).toBe(false);
        expect(isPipelineProject({ status: "Completed" })).toBe(false);
        expect(isPipelineProject({ status: "Lost" })).toBe(false);
        expect(isPipelineProject({ status: "Lead", is_archived: true })).toBe(false);
    });
});

describe("isClosedProject", () => {
    it("matches Completed and Lost", () => {
        expect(isClosedProject({ status: "Completed" })).toBe(true);
        expect(isClosedProject({ status: "Lost" })).toBe(true);
    });

    it("treats archived as closed regardless of status", () => {
        expect(isClosedProject({ status: "Active", is_archived: true })).toBe(true);
        expect(isClosedProject({ status: "Estimating", is_archived: true })).toBe(true);
    });

    it("excludes active + pipeline stages", () => {
        expect(isClosedProject({ status: "Active" })).toBe(false);
        expect(isClosedProject({ status: "Estimating" })).toBe(false);
        expect(isClosedProject({ status: "Lead" })).toBe(false);
    });
});

describe("partition invariants", () => {
    // A project can be either pipeline, active, or closed — never two
    // simultaneously. These invariants are what the Active Projects KPI
    // depends on for consistency across Home, Pipeline, and Management
    // Accounts.
    const allStatuses = [
        "Lead", "Estimating", "Proposal Sent", "Draft",
        "Active", "Won", "active",
        "Completed", "Lost",
    ];

    it("no live status is in more than one partition", () => {
        for (const s of allStatuses) {
            const p = { status: s };
            const flags = [
                isActiveProject(p),
                isPipelineProject(p),
                isClosedProject(p),
            ].filter(Boolean).length;
            expect(flags, `status ${s} classified into ${flags} partitions`).toBe(1);
        }
    });

    it("every archived project is closed", () => {
        for (const s of allStatuses) {
            expect(isClosedProject({ status: s, is_archived: true })).toBe(true);
        }
    });

    it("ACTIVE_PROJECT_STATUSES constant matches isActiveProject predicate", () => {
        // Ensures any caller writing a Supabase .in() filter using this
        // constant gets the same rows the predicate returns true for.
        for (const s of ACTIVE_PROJECT_STATUSES) {
            expect(isActiveProject({ status: s })).toBe(true);
        }
    });
});
