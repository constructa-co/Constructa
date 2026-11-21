import { describe, expect, it } from "vitest";
import { isInterviewStorageMissing } from "./storage-ready";

describe("CON-025 interview storage readiness", () => {
    it.each(["PGRST205", "42P01"])("treats %s as missing interview storage", (code) => {
        expect(isInterviewStorageMissing({ code })).toBe(true);
    });

    it("does not treat auth or validation errors as missing storage", () => {
        expect(isInterviewStorageMissing({ code: "42501" })).toBe(false);
        expect(isInterviewStorageMissing(null)).toBe(false);
    });
});