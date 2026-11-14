import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FoundingCohortApplyForm } from "./founding-cohort-apply-form";
import { FOUNDING_COHORT_APPLY_STORAGE_NOTICE_ID } from "./founding-cohort-apply-storage-notice";

describe("FoundingCohortApplyForm without storage", () => {
  it("disables submit and describes the upstream storage notice", () => {
    const html = renderToStaticMarkup(<FoundingCohortApplyForm />);
    expect(html).toContain('aria-describedby="founding-cohort-apply-storage-notice"');
    expect(html).toContain("Submission unavailable");
    expect(html).toMatch(/disabled(?:=""|="disabled")/);
    expect(html).not.toContain('action="');
    expect(html).not.toContain("Thank you for your interest");
  });

  it("exports a stable id for the notice region", () => {
    expect(FOUNDING_COHORT_APPLY_STORAGE_NOTICE_ID).toBe(
      "founding-cohort-apply-storage-notice",
    );
  });
});