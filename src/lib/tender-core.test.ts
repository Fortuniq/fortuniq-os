import { describe, it, expect } from "vitest";
import { calculateCompliancePct, canTransitionTenderStage, checkSubmissionReadiness, normalizeTenderStage } from "./tender-core";

describe("calculateCompliancePct", () => {
  it("returns null, not 0, for a tender with no checklist yet", () => {
    const result = calculateCompliancePct([]);
    expect(result.pct).toBeNull();
    expect(result.confirmedCount).toBe(0);
    expect(result.totalCount).toBe(0);
  });

  it("calculates 100% when every item is confirmed", () => {
    const result = calculateCompliancePct([{ done: true }, { done: true }, { done: true }]);
    expect(result).toEqual({ pct: 100, confirmedCount: 3, totalCount: 3 });
  });

  it("calculates 0% when a checklist exists but nothing is confirmed yet", () => {
    const result = calculateCompliancePct([{ done: false }, { done: false }]);
    expect(result).toEqual({ pct: 0, confirmedCount: 0, totalCount: 2 });
  });

  it("matches the exact worked example from the brief: 8 of 10 confirmed = 80%", () => {
    const items = [
      { done: true }, { done: true }, { done: true }, { done: true }, { done: true },
      { done: false }, { done: true }, { done: true }, { done: false }, { done: true },
    ];
    const result = calculateCompliancePct(items);
    expect(result.pct).toBe(80);
    expect(result.confirmedCount).toBe(8);
    expect(result.totalCount).toBe(10);
  });

  it("rounds to the nearest whole percent for counts that don't divide evenly", () => {
    // 2 of 3 = 66.66...% → rounds to 67
    const result = calculateCompliancePct([{ done: true }, { done: true }, { done: false }]);
    expect(result.pct).toBe(67);
  });

  it("null and 0 are distinguishable — an empty checklist is not the same as a fully unconfirmed one", () => {
    const empty = calculateCompliancePct([]);
    const unconfirmed = calculateCompliancePct([{ done: false }]);
    expect(empty.pct).toBeNull();
    expect(unconfirmed.pct).toBe(0);
    expect(empty.pct).not.toBe(unconfirmed.pct);
  });
});

describe("canTransitionTenderStage", () => {
  it("allows moving forward exactly one stage at a time", () => {
    expect(canTransitionTenderStage("Drafting", "Pricing")).toBe(true);
    expect(canTransitionTenderStage("Pricing", "Assessment & Verification")).toBe(true);
  });

  it("does not allow skipping ahead more than one stage", () => {
    expect(canTransitionTenderStage("Drafting", "Submission Ready")).toBe(false);
    expect(canTransitionTenderStage("Drafting", "Submitted")).toBe(false);
  });

  it("allows moving backward to any earlier stage — work getting sent back", () => {
    expect(canTransitionTenderStage("Submission Ready", "Pricing")).toBe(true);
    expect(canTransitionTenderStage("Assessment & Verification", "Drafting")).toBe(true);
  });

  it("staying in the same stage is always allowed (a no-op save)", () => {
    expect(canTransitionTenderStage("Pricing", "Pricing")).toBe(true);
  });
});

describe("checkSubmissionReadiness", () => {
  it("is ready when every checklist item is confirmed and compliance is 100%", () => {
    const result = checkSubmissionReadiness([{ done: true }, { done: true }], 100);
    expect(result.ready).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it("flags outstanding checklist items", () => {
    const result = checkSubmissionReadiness([{ done: true }, { done: false }], 100);
    expect(result.ready).toBe(false);
    expect(result.issues[0]).toContain("1 checklist item");
  });

  it("flags compliance under 100%", () => {
    const result = checkSubmissionReadiness([{ done: true }], 80);
    expect(result.ready).toBe(false);
    expect(result.issues.some((i) => i.includes("Compliance"))).toBe(true);
  });

  it("flags a completely empty checklist as not ready", () => {
    const result = checkSubmissionReadiness([], null);
    expect(result.ready).toBe(false);
    expect(result.issues[0]).toContain("No checklist items");
  });
});

describe("normalizeTenderStage", () => {
  it("passes through an exact valid stage unchanged", () => {
    expect(normalizeTenderStage("Pricing")).toBe("Pricing");
    expect(normalizeTenderStage("Submitted")).toBe("Submitted");
  });

  it("defaults legacy free-text stage values to Drafting — this is the exact bug that was reported", () => {
    expect(normalizeTenderStage("Drafting - SARS Code")).toBe("Drafting");
    expect(normalizeTenderStage("Closed — Won")).toBe("Drafting");
  });

  it("defaults null/undefined/empty to Drafting", () => {
    expect(normalizeTenderStage(null)).toBe("Drafting");
    expect(normalizeTenderStage(undefined)).toBe("Drafting");
    expect(normalizeTenderStage("")).toBe("Drafting");
  });
});
