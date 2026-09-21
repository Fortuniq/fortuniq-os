import { describe, it, expect } from "vitest";
import { calculateCompliancePct, canTransitionTenderStage, checkSubmissionReadiness, normalizeTenderStage, isStageOverdue, validateStageAssignment, formatRelativeActivityTime, isTenderStale, calculateDaysRemaining, formatDaysRemaining, isClosingSoon, isDueToday, shouldAutoMarkMissed, computeEffectiveTenderStatus, computeEffectiveTenderStage, rankTenderPriority, deriveOutstandingIssue } from "./tender-core";

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

describe("isStageOverdue", () => {
  const TODAY = new Date("2026-08-20T09:00:00");

  it("flags an Active assignment past its due date", () => {
    expect(isStageOverdue({ status: "Active", dueDate: "2026-08-10" }, TODAY)).toBe(true);
  });

  it("does not flag an Active assignment not yet due", () => {
    expect(isStageOverdue({ status: "Active", dueDate: "2026-09-01" }, TODAY)).toBe(false);
  });

  it("never flags a Completed assignment, no matter how late it finished", () => {
    expect(isStageOverdue({ status: "Completed", dueDate: "2026-08-01" }, TODAY)).toBe(false);
  });

  it("never flags a Reassigned assignment", () => {
    expect(isStageOverdue({ status: "Reassigned", dueDate: "2026-08-01" }, TODAY)).toBe(false);
  });

  it("does not flag an assignment with no due date at all", () => {
    expect(isStageOverdue({ status: "Active", dueDate: null }, TODAY)).toBe(false);
  });
});

describe("validateStageAssignment", () => {
  it("requires a real, non-blank owner email", () => {
    expect(validateStageAssignment("person@iqfuels.co.za").valid).toBe(true);
    expect(validateStageAssignment(null).valid).toBe(false);
    expect(validateStageAssignment(undefined).valid).toBe(false);
    expect(validateStageAssignment("").valid).toBe(false);
    expect(validateStageAssignment("   ").valid).toBe(false);
  });
});

describe("formatRelativeActivityTime", () => {
  const NOW = new Date("2026-08-20T12:00:00Z");

  it("formats minutes, hours, yesterday, and days correctly, matching the brief's examples", () => {
    expect(formatRelativeActivityTime(new Date("2026-08-20T11:50:00Z").toISOString(), NOW)).toBe("10 min ago");
    expect(formatRelativeActivityTime(new Date("2026-08-20T10:00:00Z").toISOString(), NOW)).toBe("2 hours ago");
    expect(formatRelativeActivityTime(new Date("2026-08-19T12:00:00Z").toISOString(), NOW)).toBe("Yesterday");
    expect(formatRelativeActivityTime(new Date("2026-08-17T12:00:00Z").toISOString(), NOW)).toBe("3 days ago");
  });

  it("falls back to a plain date once older than a week", () => {
    const result = formatRelativeActivityTime(new Date("2026-07-01T12:00:00Z").toISOString(), NOW);
    expect(result).not.toContain("ago");
  });

  it("handles no activity at all", () => {
    expect(formatRelativeActivityTime(null, NOW)).toBe("No activity yet");
  });
});

describe("isTenderStale", () => {
  const NOW = new Date("2026-08-20T12:00:00Z");

  it("flags an Open tender with no recent activity", () => {
    expect(isTenderStale(new Date("2026-08-10T12:00:00Z").toISOString(), "Open", NOW)).toBe(true);
  });

  it("does not flag an Open tender with recent activity", () => {
    expect(isTenderStale(new Date("2026-08-19T12:00:00Z").toISOString(), "Open", NOW)).toBe(false);
  });

  it("never flags an Awarded tender, no matter how old its last activity", () => {
    expect(isTenderStale(new Date("2026-01-01T12:00:00Z").toISOString(), "Awarded", NOW)).toBe(false);
  });

  it("never flags a Lost tender", () => {
    expect(isTenderStale(new Date("2026-01-01T12:00:00Z").toISOString(), "Lost", NOW)).toBe(false);
  });

  it("treats an Open tender with no activity timestamp at all as stale", () => {
    expect(isTenderStale(null, "Open", NOW)).toBe(true);
  });
});

describe("calculateDaysRemaining", () => {
  const TODAY = new Date("2026-08-25T15:00:00");

  it("returns 0 for today, matching the brief's 'Today' case", () => {
    expect(calculateDaysRemaining("2026-08-25", TODAY)).toBe(0);
  });

  it("returns 1 for tomorrow", () => {
    expect(calculateDaysRemaining("2026-08-26", TODAY)).toBe(1);
  });

  it("returns a negative number once overdue", () => {
    expect(calculateDaysRemaining("2026-08-23", TODAY)).toBe(-2);
  });

  it("ignores time-of-day — only the calendar date matters", () => {
    const lateInDay = new Date("2026-08-25T23:59:00");
    expect(calculateDaysRemaining("2026-08-25", lateInDay)).toBe(0);
  });
});

describe("formatDaysRemaining", () => {
  it("matches the brief's exact examples", () => {
    expect(formatDaysRemaining(10)).toBe("10 Days Remaining");
    expect(formatDaysRemaining(3)).toBe("3 Days Remaining");
    expect(formatDaysRemaining(1)).toBe("Tomorrow");
    expect(formatDaysRemaining(0)).toBe("Today");
    expect(formatDaysRemaining(-2)).toBe("Overdue by 2 Days");
    expect(formatDaysRemaining(-14)).toBe("Overdue by 14 Days");
  });

  it("singularises 'Day' for exactly 1 day overdue", () => {
    expect(formatDaysRemaining(-1)).toBe("Overdue by 1 Day");
  });
});

describe("isClosingSoon / isDueToday", () => {
  it("flags within the warning window but not today or overdue", () => {
    expect(isClosingSoon(7)).toBe(true);
    expect(isClosingSoon(1)).toBe(true);
    expect(isClosingSoon(0)).toBe(false); // Today has its own indicator, not Closing Soon
    expect(isClosingSoon(-1)).toBe(false);
    expect(isClosingSoon(8)).toBe(false);
  });

  it("respects a custom warning period", () => {
    expect(isClosingSoon(10, 14)).toBe(true);
    expect(isClosingSoon(15, 14)).toBe(false);
  });

  it("isDueToday only true at exactly 0 days remaining", () => {
    expect(isDueToday(0)).toBe(true);
    expect(isDueToday(1)).toBe(false);
    expect(isDueToday(-1)).toBe(false);
  });
});

describe("shouldAutoMarkMissed", () => {
  const TODAY = new Date("2026-08-25T12:00:00");

  it("flags an Open tender past its closing date with no submission", () => {
    expect(shouldAutoMarkMissed({ closingDate: "2026-08-20", status: "Open", stage: "Pricing" }, TODAY)).toBe(true);
  });

  it("does not flag a tender not yet past its closing date", () => {
    expect(shouldAutoMarkMissed({ closingDate: "2026-08-25", status: "Open", stage: "Pricing" }, TODAY)).toBe(false);
    expect(shouldAutoMarkMissed({ closingDate: "2026-09-01", status: "Open", stage: "Pricing" }, TODAY)).toBe(false);
  });

  it("never flags an Awarded tender", () => {
    expect(shouldAutoMarkMissed({ closingDate: "2026-08-01", status: "Awarded", stage: "Submitted" }, TODAY)).toBe(false);
  });

  it("never flags a Lost tender", () => {
    expect(shouldAutoMarkMissed({ closingDate: "2026-08-01", status: "Lost", stage: "Submitted" }, TODAY)).toBe(false);
  });

  it("never flags a tender already Missed — idempotent", () => {
    expect(shouldAutoMarkMissed({ closingDate: "2026-08-01", status: "Missed", stage: "Closed — Missed" }, TODAY)).toBe(false);
  });

  it("never flags a tender that has actually been submitted, even past its closing date", () => {
    expect(shouldAutoMarkMissed({ closingDate: "2026-08-01", status: "Open", stage: "Submitted" }, TODAY)).toBe(false);
  });
});

describe("computeEffectiveTenderStatus / computeEffectiveTenderStage", () => {
  const TODAY = new Date("2026-08-25T12:00:00");

  it("overrides the stored status/stage to Missed/Closed — Missed once past due and unsubmitted", () => {
    const tender = { closingDate: "2026-08-01", status: "Open", stage: "Pricing" };
    expect(computeEffectiveTenderStatus(tender, TODAY)).toBe("Missed");
    expect(computeEffectiveTenderStage(tender, TODAY)).toBe("Closed — Missed");
  });

  it("leaves status/stage untouched when the tender isn't overdue", () => {
    const tender = { closingDate: "2026-09-01", status: "Open", stage: "Pricing" };
    expect(computeEffectiveTenderStatus(tender, TODAY)).toBe("Open");
    expect(computeEffectiveTenderStage(tender, TODAY)).toBe("Pricing");
  });
});

describe("rankTenderPriority", () => {
  it("ranks a tender due today, overdue, incomplete, and high priority as HIGH", () => {
    const result = rankTenderPriority({ daysRemaining: 0, stageAssignmentOverdue: true, compliancePct: 40, assignmentPriority: "High" });
    expect(result.level).toBe("HIGH");
  });

  it("ranks a tender due in a week, on track, low priority as LOW", () => {
    const result = rankTenderPriority({ daysRemaining: 9, stageAssignmentOverdue: false, compliancePct: 100, assignmentPriority: "Low" });
    expect(result.level).toBe("LOW");
  });

  it("does NOT simply sort by closing date — a tender due later can outrank one due sooner if it's otherwise riskier", () => {
    const soonButHealthy = rankTenderPriority({ daysRemaining: 2, stageAssignmentOverdue: false, compliancePct: 100, assignmentPriority: "Low" });
    const laterButAtRisk = rankTenderPriority({ daysRemaining: 5, stageAssignmentOverdue: true, compliancePct: 30, assignmentPriority: "High" });
    expect(laterButAtRisk.score).toBeGreaterThan(soonButHealthy.score);
  });

  it("treats a null compliance (not yet assessed) as not incomplete — no penalty applied", () => {
    const withNull = rankTenderPriority({ daysRemaining: 5, stageAssignmentOverdue: false, compliancePct: null, assignmentPriority: null });
    const withComplete = rankTenderPriority({ daysRemaining: 5, stageAssignmentOverdue: false, compliancePct: 100, assignmentPriority: null });
    expect(withNull.score).toBe(withComplete.score);
  });

  it("penalises severely incomplete compliance more than mildly incomplete", () => {
    const severe = rankTenderPriority({ daysRemaining: 5, stageAssignmentOverdue: false, compliancePct: 20, assignmentPriority: null });
    const mild = rankTenderPriority({ daysRemaining: 5, stageAssignmentOverdue: false, compliancePct: 90, assignmentPriority: null });
    expect(severe.score).toBeGreaterThan(mild.score);
  });
});

describe("deriveOutstandingIssue", () => {
  it("prioritises an overdue stage assignment over everything else", () => {
    expect(deriveOutstandingIssue({ stage: "Pricing", hasOverdueAssignment: true, firstIncompleteChecklistItem: "Signed Declaration" })).toBe("Waiting for Pricing");
  });

  it("falls back to the first incomplete checklist item, matching the brief's 'Missing X' phrasing", () => {
    expect(deriveOutstandingIssue({ stage: "Assessment & Verification", hasOverdueAssignment: false, firstIncompleteChecklistItem: "Signed Declaration" })).toBe("Missing Signed Declaration");
  });

  it("reports the stage as complete when nothing is outstanding", () => {
    expect(deriveOutstandingIssue({ stage: "Assessment & Verification", hasOverdueAssignment: false, firstIncompleteChecklistItem: null })).toBe("Assessment & Verification Complete");
  });
});
