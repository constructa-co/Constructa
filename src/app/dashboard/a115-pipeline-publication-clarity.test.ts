import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const DASHBOARD_CLIENT = path.join(process.cwd(), "src/app/dashboard/dashboard-client.tsx");
const PROJECT_BOARD = path.join(process.cwd(), "src/app/dashboard/project-board.tsx");

describe("A115 pipeline vs publication reconciliation (source)", () => {
    it("dashboard legend does not claim proposal column auto-syncs with platform send", () => {
        const source = readFileSync(DASHBOARD_CLIENT, "utf8");
        expect(source).not.toMatch(/Auto: when proposal is sent/i);
        expect(source).toMatch(/operational/i);
    });

    it("project board stage control describes operational tracking, not document send", () => {
        const source = readFileSync(PROJECT_BOARD, "utf8");
        expect(source).toMatch(/operational/i);
        expect(source).not.toMatch(/Saves immediately when you pick a stage/i);
        expect(source).toMatch(/proposal_sent_at/);
    });

    it("project board stage helper retains immediate-save disclosure (A115 disclosure)", () => {
        const source = readFileSync(PROJECT_BOARD, "utf8");
        expect(source).toMatch(/Changes save immediately/i);
        expect(source).toMatch(/does not send, publish, or accept/i);
    });
});
