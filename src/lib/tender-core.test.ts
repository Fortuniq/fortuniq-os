import { describe, it, expect } from "vitest";
import { calculateCompliancePct } from "./tender-core";

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
