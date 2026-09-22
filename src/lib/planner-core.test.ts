import { describe, it, expect } from "vitest";
import {
  validatePlannerBlockInput, sortBlocksByTime, findOverlappingBlocks, totalPlannedMinutes,
  type PlannerBlock,
} from "./planner-core";

function block(overrides: Partial<PlannerBlock> = {}): PlannerBlock {
  return {
    id: "1", title: "Deep work", startTime: "09:00", durationMinutes: 60,
    category: "Deep Work", recordUrl: null, moduleKey: null, source: "fortuniq", ...overrides,
  };
}

describe("validatePlannerBlockInput", () => {
  it("requires a title", () => {
    expect(validatePlannerBlockInput({ startTime: "09:00", durationMinutes: 30 })).toBeTruthy();
  });
  it("requires HH:MM start time", () => {
    expect(validatePlannerBlockInput({ title: "x", startTime: "9am", durationMinutes: 30 })).toBeTruthy();
    expect(validatePlannerBlockInput({ title: "x", startTime: "09:00", durationMinutes: 30 })).toBeNull();
  });
  it("rejects out-of-range durations", () => {
    expect(validatePlannerBlockInput({ title: "x", startTime: "09:00", durationMinutes: 1 })).toBeTruthy();
    expect(validatePlannerBlockInput({ title: "x", startTime: "09:00", durationMinutes: 800 })).toBeTruthy();
  });
  it("rejects an invalid category", () => {
    expect(validatePlannerBlockInput({ title: "x", startTime: "09:00", durationMinutes: 30, category: "Nope" })).toBeTruthy();
  });
});

describe("sortBlocksByTime", () => {
  it("orders blocks chronologically", () => {
    const blocks = [block({ id: "b", startTime: "14:00" }), block({ id: "a", startTime: "09:00" })];
    expect(sortBlocksByTime(blocks).map((b) => b.id)).toEqual(["a", "b"]);
  });
});

describe("findOverlappingBlocks", () => {
  it("finds no overlaps for a clean schedule", () => {
    const blocks = [block({ id: "a", startTime: "09:00", durationMinutes: 60 }), block({ id: "b", startTime: "10:00", durationMinutes: 30 })];
    expect(findOverlappingBlocks(blocks)).toEqual([]);
  });
  it("flags an overlap", () => {
    const blocks = [block({ id: "a", startTime: "09:00", durationMinutes: 90 }), block({ id: "b", startTime: "10:00", durationMinutes: 30 })];
    expect(findOverlappingBlocks(blocks)).toEqual([{ blockId: "a", overlapsWithId: "b" }]);
  });
});

describe("totalPlannedMinutes", () => {
  it("sums durations", () => {
    const blocks = [block({ durationMinutes: 60 }), block({ durationMinutes: 30 })];
    expect(totalPlannedMinutes(blocks)).toBe(90);
  });
});
