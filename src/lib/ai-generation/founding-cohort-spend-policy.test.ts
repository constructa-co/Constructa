import { describe, expect, it, vi } from "vitest";
import {
  FOUNDING_COHORT_AI_CONTRACTOR_MONTHLY_MAX_PENCE,
  FOUNDING_COHORT_AI_GLOBAL_MONTHLY_MAX_PENCE,
  FOUNDING_COHORT_AI_SPEND_REFUSALS,
} from "./founding-cohort-spend-policy";
import { withAiBudget } from "@/lib/ai-budget";
import { fakeAiBudget } from "@/lib/__fixtures__/fake-ai-budget";
import { z } from "zod";

const REQUEST = {
  label: "test.rewrite",
  system: "RULES",
  user: '{"text":"hello"}',
  schema: z.object({ text: z.string() }),
};

describe("founding cohort AI spend policy", () => {
  it("records seeded month ceilings as pence only in source", () => {
    expect(FOUNDING_COHORT_AI_GLOBAL_MONTHLY_MAX_PENCE).toBe(2500);
    expect(FOUNDING_COHORT_AI_CONTRACTOR_MONTHLY_MAX_PENCE).toBe(500);
  });

  it("refuses reserve when the feature has no verified max_reserve_pence", async () => {
    const budget = fakeAiBudget({ penceLedger: true });
    const generate = vi.fn();
    const result = await withAiBudget(
      {
        admin: budget.admin,
        userId: "aaaaaaaa-0000-4000-8000-000000000003",
        feature: "profile.rewrite",
        promptVersion: "test-v1",
        generate: generate as never,
      },
      REQUEST,
      vi.fn(),
    );
    expect(result).toEqual({ status: "refused", reason: "disabled" });
    expect(generate).not.toHaveBeenCalled();
  });

  it("maps ledger spend-cap statuses to honest refusals without calling the provider", async () => {
    const budget = fakeAiBudget({ penceLedger: true });
    budget.limits.global.spendCapPence = 10;
    budget.features["profile.rewrite"].reservePence = 6;
    budget.attempts.push({
      id: "prior",
      user_id: "aaaaaaaa-0000-4000-8000-000000000001",
      feature: "profile.rewrite",
      started_at: Date.parse("2026-10-09T09:00:00.000Z"),
      finished_at: Date.parse("2026-10-09T09:01:00.000Z"),
      outcome: "ok",
      reserved_output_tokens: 100,
      reserved_pence: 8,
      charged_pence: 8,
      completion_tokens: 40,
    });

    const generate = vi.fn();
    const judge = vi.fn();

    const globalResult = await withAiBudget(
      {
        admin: budget.admin,
        userId: "aaaaaaaa-0000-4000-8000-000000000001",
        feature: "profile.rewrite",
        promptVersion: "test-v1",
        generate: generate as never,
      },
      REQUEST,
      judge,
    );
    expect(globalResult).toEqual({ status: "refused", reason: "global-spend-cap" });
    expect(generate).not.toHaveBeenCalled();
    expect(FOUNDING_COHORT_AI_SPEND_REFUSALS).toContain("global-spend-cap");

    const contractorBudget = fakeAiBudget({ penceLedger: true });
    contractorBudget.limits.contractor.spendCapPence = 5;
    contractorBudget.features["profile.rewrite"].reservePence = 6;
    contractorBudget.attempts.push({
      id: "prior-contractor",
      user_id: "aaaaaaaa-0000-4000-8000-000000000002",
      feature: "profile.rewrite",
      started_at: Date.parse("2026-10-09T09:00:00.000Z"),
      finished_at: Date.parse("2026-10-09T09:01:00.000Z"),
      outcome: "ok",
      reserved_output_tokens: 100,
      reserved_pence: 2,
      charged_pence: 2,
      completion_tokens: 40,
    });
    const contractorResult = await withAiBudget(
      {
        admin: contractorBudget.admin,
        userId: "aaaaaaaa-0000-4000-8000-000000000002",
        feature: "profile.rewrite",
        promptVersion: "test-v1",
        generate: generate as never,
      },
      REQUEST,
      judge,
    );
    expect(contractorResult).toEqual({ status: "refused", reason: "contractor-spend-cap" });
  });
});