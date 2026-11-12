import { describe, expect, it } from "vitest";
import { gitRefName } from "../../../scripts/recovery-manifest-check.mjs";

describe("gitRefName", () => {
    const valid = "refs/heads/backup";

    it.each([
        valid,
        "refs/tags/v1.0.0",
        " refs/heads/spaced-prefix",
        "refs/heads/trailing-space ",
    ])("accepts a real string ref: %s", value => {
        expect(gitRefName(value)).toBe(value);
    });

    it.each([
        null,
        undefined,
        42,
        true,
        { ref: valid },
        [valid],
        [valid, "refs/heads/other"],
        [],
        "",
        "   ",
        "\t\n",
    ])("rejects non-string, empty, whitespace-only, and coercible values: %j", value => {
        expect(gitRefName(value as never)).toBeNull();
    });
});
