import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("new project form editing palette", () => {
    it("uses shared workspace sage focus and primary button, not blue", () => {
        const source = readFileSync(
            path.join(process.cwd(), "src/app/dashboard/projects/new/new-project-form.tsx"),
            "utf8",
        );
        expect(source).toContain("workspaceStyles");
        expect(source).not.toMatch(/focus:ring-blue/);
        expect(source).not.toMatch(/bg-blue-600/);
    });
});
