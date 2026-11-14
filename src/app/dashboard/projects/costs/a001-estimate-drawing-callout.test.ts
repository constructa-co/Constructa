import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (rel: string) => readFileSync(path.join(process.cwd(), rel), "utf8");

describe("A001 advanced estimating drawing callout", () => {
    it("Got a drawing? prompt uses emerald dashed chrome, not purple brand", () => {
        const source = read("src/app/dashboard/projects/costs/advanced-estimate.tsx");
        expect(source).toContain("Got a drawing?");
        expect(source).toContain("border-dashed border-emerald-500/30");
        expect(source).not.toContain("border-purple-500/30");
    });
});