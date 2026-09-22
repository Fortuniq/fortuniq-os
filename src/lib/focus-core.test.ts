import { describe, it, expect } from "vitest";
import {
  validateFocusInput, isValidFocusStatus, isValidProgressPct,
  scoreFocusCandidate, recommendFocus, daysRemaining, needsDailyResetPrompt,
  type FocusCandidate, type EmployeeFocus,
} from "./focus-core";

const TODAY = "2026-09-22";

function candidate(overrides: Partial<FocusCandidate> = {}): FocusCandidate {
  return {
    key: "task:1", title: "Prepare submission", moduleKey: "tenders", relatedLabel: "Tender A",
    relatedUrl: "/tenders/1", workflowStage: "Drafting", priority: "Medium", dueDate: null,
    isOverdue: false, isMeeting: false, ...overrides,
  };
}

function focus(overrides: Partial<EmployeeFocus> = {}): EmployeeFocus {
  return {
    id: "f1", employeeEmail: "a@x.com", title: "Do the thing", moduleKey: "tasks", relatedLabel: null,
    relatedUrl: null, workflowStage: null, priority: "High", dueDate: null, estimatedTime: null,
    progressPct: null, status: "In Progress", source: "Employee", assignedBy: null, notes: null,
    focusDate: TODAY, isActive: true, lastActivityAt: TODAY, createdAt: TODAY, completedAt: null,
    ...overrides,
  };
}

describe("validateFocusInput", () => {
  it("requires a title", () => {
    expect(validateFocusInput({})).toBeTruthy();
    expect(validateFocusInput({ title: "  " })).toBeTruthy();
  });
  it("rejects overlong titles", () => {
    expect(validateFocusInput({ title: "x".repeat(201) })).toBeTruthy();
  });
  it("rejects an invalid module", () => {
    expect(validateFocusInput({ title: "ok", moduleKey: "nope" })).toBeTruthy();
  });
  it("accepts a valid minimal input", () => {
    expect(validateFocusInput({ title: "Prepare submission", moduleKey: "tenders" })).toBeNull();
  });
});

describe("isValidFocusStatus / isValidProgressPct", () => {
  it("validates status", () => {
    expect(isValidFocusStatus("Blocked")).toBe(true);
    expect(isValidFocusStatus("Nope")).toBe(false);
  });
  it("validates progress percentage", () => {
    expect(isValidProgressPct(50)).toBe(true);
    expect(isValidProgressPct(-1)).toBe(false);
    expect(isValidProgressPct(101)).toBe(false);
    expect(isValidProgressPct("50")).toBe(false);
  });
});

describe("scoreFocusCandidate", () => {
  it("scores overdue work highest", () => {
    const overdue = scoreFocusCandidate(candidate({ isOverdue: true }), TODAY);
    const notOverdue = scoreFocusCandidate(candidate({ isOverdue: false, dueDate: "2026-10-01" }), TODAY);
    expect(overdue).toBeGreaterThan(notOverdue);
  });
  it("scores a closer due date higher than a far one", () => {
    const soon = scoreFocusCandidate(candidate({ dueDate: "2026-09-23" }), TODAY);
    const far = scoreFocusCandidate(candidate({ dueDate: "2026-11-01" }), TODAY);
    expect(soon).toBeGreaterThan(far);
  });
  it("scores High priority above Low", () => {
    const high = scoreFocusCandidate(candidate({ priority: "High" }), TODAY);
    const low = scoreFocusCandidate(candidate({ priority: "Low" }), TODAY);
    expect(high).toBeGreaterThan(low);
  });
  it("gives a same-day meeting a nudge", () => {
    const withMeeting = scoreFocusCandidate(candidate({ isMeeting: true, dueDate: TODAY }), TODAY);
    const without = scoreFocusCandidate(candidate({ isMeeting: false, dueDate: TODAY }), TODAY);
    expect(withMeeting).toBeGreaterThan(without);
  });
});

describe("recommendFocus", () => {
  it("returns null for no candidates", () => {
    expect(recommendFocus([], TODAY)).toBeNull();
  });
  it("picks the highest-scoring candidate", () => {
    const low = candidate({ key: "a", priority: "Low" });
    const overdue = candidate({ key: "b", isOverdue: true });
    expect(recommendFocus([low, overdue], TODAY)?.key).toBe("b");
  });
});

describe("daysRemaining", () => {
  it("returns null with no due date", () => {
    expect(daysRemaining(null, TODAY)).toBeNull();
  });
  it("computes whole days", () => {
    expect(daysRemaining("2026-09-25", TODAY)).toBe(3);
    expect(daysRemaining("2026-09-20", TODAY)).toBe(-2);
  });
});

describe("needsDailyResetPrompt", () => {
  it("is false when there is no focus", () => {
    expect(needsDailyResetPrompt(null, TODAY)).toBe(false);
  });
  it("is false for a focus already dated today", () => {
    expect(needsDailyResetPrompt(focus({ focusDate: TODAY }), TODAY)).toBe(false);
  });
  it("is false for a completed focus, even from an earlier day", () => {
    expect(needsDailyResetPrompt(focus({ focusDate: "2026-09-20", status: "Complete" }), TODAY)).toBe(false);
  });
  it("is true for an incomplete focus carried over from a prior day", () => {
    expect(needsDailyResetPrompt(focus({ focusDate: "2026-09-20", status: "Blocked" }), TODAY)).toBe(true);
  });
});
