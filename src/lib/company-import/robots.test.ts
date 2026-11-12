import { describe, expect, it } from "vitest";
import { isPathAllowed } from "./robots";

describe("isPathAllowed", () => {
    it("allows everything when there is no file or no matching rule", () => {
        expect(isPathAllowed("", "/contact")).toBe(true);
        expect(isPathAllowed("User-agent: Googlebot\nDisallow: /", "/contact")).toBe(true);
        expect(isPathAllowed("User-agent: *\nDisallow:", "/contact")).toBe(true);
    });

    it("follows Disallow for all robots", () => {
        const robots = "User-agent: *\nDisallow: /private/\nDisallow: /contact\n";
        expect(isPathAllowed(robots, "/private/x")).toBe(false);
        expect(isPathAllowed(robots, "/contact-us")).toBe(false);
        expect(isPathAllowed(robots, "/about")).toBe(true);
        expect(isPathAllowed("User-agent: *\nDisallow: /", "/")).toBe(false);
    });

    it("prefers rules written for this reader over the general ones", () => {
        const robots = "User-agent: *\nAllow: /\n\nUser-agent: ConstructaProfileImport\nDisallow: /\n";
        expect(isPathAllowed(robots, "/about")).toBe(false);
        expect(isPathAllowed("User-agent: *\nDisallow: /\n\nUser-agent: constructaprofileimport\nDisallow:\n", "/about")).toBe(true);
    });

    it("lets the longest rule decide, with Allow winning a tie", () => {
        const robots = "User-agent: *\nDisallow: /services\nAllow: /services/extensions\n";
        expect(isPathAllowed(robots, "/services/extensions")).toBe(true);
        expect(isPathAllowed(robots, "/services/lofts")).toBe(false);
        expect(isPathAllowed("User-agent: *\nDisallow: /a\nAllow: /a\n", "/a")).toBe(true);
    });

    it("understands * and $ without treating the file as a pattern language", () => {
        const robots = "User-agent: *\nDisallow: /*.pdf$\nDisallow: /tmp*/x\n";
        expect(isPathAllowed(robots, "/files/brochure.pdf")).toBe(false);
        expect(isPathAllowed(robots, "/files/brochure.pdf?x=1")).toBe(true);
        expect(isPathAllowed(robots, "/tmp123/x/y")).toBe(false);
        expect(isPathAllowed("User-agent: *\nDisallow: /(a+)+$\n", `/${"a".repeat(5000)}!`)).toBe(true);
    });

    it("ignores comments, junk lines and grouped user agents", () => {
        const robots = "# hello\nUser-agent: a\nUser-agent: *\nDisallow: /x # trailing\nnonsense\n: also nonsense\n";
        expect(isPathAllowed(robots, "/x")).toBe(false);
        expect(isPathAllowed(robots, "/y")).toBe(true);
    });
});
