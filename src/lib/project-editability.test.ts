import { describe, expect, it } from "vitest";
import { getPrecontractEditLockReason } from "./project-editability";

describe("pre-contract project editability", () => {
  it.each(["Active", "Won", "active", "Completed", "Lost"])(
    "locks delivery or close-out status %s",
    (status) => {
      expect(getPrecontractEditLockReason({ status })).toContain("locked");
    },
  );

  it("locks accepted proposals even before the project status advances", () => {
    expect(
      getPrecontractEditLockReason({
        status: "Proposal Sent",
        proposal_status: "accepted",
      }),
    ).toContain("accepted");
  });

  it("locks archived projects independently of status", () => {
    expect(getPrecontractEditLockReason({ status: "Lead", is_archived: true })).toContain(
      "archived",
    );
  });

  it.each(["Lead", "Estimating", "Proposal Sent", "Draft"])(
    "allows editable pre-contract status %s",
    (status) => {
      expect(getPrecontractEditLockReason({ status })).toBeNull();
    },
  );
});
