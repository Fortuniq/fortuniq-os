import { describe, it, expect } from "vitest";
import {
  mergeDashboardLayout, sanitizeDashboardLayoutForSave, defaultDashboardLayout,
  DASHBOARD_WIDGET_REGISTRY, ALL_DASHBOARD_WIDGET_KEYS,
} from "./dashboard-widgets";

describe("defaultDashboardLayout / mergeDashboardLayout with no saved layout", () => {
  it("returns registry defaults in registry order for a first-time user", () => {
    const layout = defaultDashboardLayout(ALL_DASHBOARD_WIDGET_KEYS);
    expect(layout.map((l) => l.key)).toEqual(DASHBOARD_WIDGET_REGISTRY.map((w) => w.key));
    expect(layout.every((l) => l.visible)).toBe(true);
    layout.forEach((l, i) => expect(l.order).toBe(i));
  });

  it("only includes keys that are actually available", () => {
    const layout = defaultDashboardLayout(["myTasks", "fuelPrices"]);
    expect(layout.map((l) => l.key)).toEqual(["myTasks", "fuelPrices"]);
  });
});

describe("mergeDashboardLayout with a saved layout", () => {
  it("respects saved order, visibility and size", () => {
    const saved = [
      { key: "fuelPrices", visible: true, size: "wide", order: 0 },
      { key: "myTasks", visible: false, size: "compact", order: 1 },
    ];
    const layout = mergeDashboardLayout(["myTasks", "fuelPrices"], saved);
    expect(layout.map((l) => l.key)).toEqual(["fuelPrices", "myTasks"]);
    expect(layout[0]).toMatchObject({ key: "fuelPrices", visible: true, size: "wide", order: 0 });
    expect(layout[1]).toMatchObject({ key: "myTasks", visible: false, size: "compact", order: 1 });
  });

  it("appends a newly-available widget the saved layout has never seen, at the end", () => {
    const saved = [{ key: "myTasks", visible: true, size: "standard", order: 0 }];
    const layout = mergeDashboardLayout(["myTasks", "myWorkflow"], saved);
    expect(layout.map((l) => l.key)).toEqual(["myTasks", "myWorkflow"]);
    expect(layout[1].visible).toBe(true); // registry default for myWorkflow
  });

  it("drops a saved widget that is no longer available (e.g. lost module access)", () => {
    const saved = [
      { key: "myTasks", visible: true, size: "standard", order: 0 },
      { key: "hcmReminders", visible: true, size: "standard", order: 1 },
    ];
    const layout = mergeDashboardLayout(["myTasks"], saved);
    expect(layout.map((l) => l.key)).toEqual(["myTasks"]);
  });

  it("drops an unrecognized/stale key entirely rather than erroring", () => {
    const saved = [{ key: "someRemovedWidget", visible: true, size: "standard", order: 0 }];
    const layout = mergeDashboardLayout(["myTasks"], saved);
    expect(layout.map((l) => l.key)).toEqual(["myTasks"]);
  });

  it("falls back to the registry default size/visibility for a corrupted entry", () => {
    const saved = [{ key: "myTasks", visible: "yes", size: "gigantic", order: 0 }];
    const layout = mergeDashboardLayout(["myTasks"], saved);
    expect(layout[0].size).toBe("standard"); // registry default for myTasks
    expect(layout[0].visible).toBe(true); // registry default for myTasks
  });

  it("re-normalizes order to a clean, gapless 0..n-1 sequence", () => {
    const saved = [
      { key: "myWorkflow", visible: true, size: "standard", order: 500 },
      { key: "myTasks", visible: true, size: "standard", order: 10 },
    ];
    const layout = mergeDashboardLayout(["myTasks", "myWorkflow"], saved);
    expect(layout.map((l) => l.order)).toEqual([0, 1]);
    expect(layout.map((l) => l.key)).toEqual(["myTasks", "myWorkflow"]); // 10 < 500
  });

  it("never duplicates a key that appears twice in a corrupted saved layout", () => {
    const saved = [
      { key: "myTasks", visible: true, size: "standard", order: 0 },
      { key: "myTasks", visible: false, size: "wide", order: 1 },
    ];
    const layout = mergeDashboardLayout(["myTasks"], saved);
    expect(layout).toHaveLength(1);
    expect(layout[0]).toMatchObject({ visible: true, size: "standard" }); // first occurrence wins
  });

  it("treats null/undefined saved layout the same as no layout at all", () => {
    expect(mergeDashboardLayout(["myTasks"], null)).toEqual(defaultDashboardLayout(["myTasks"]));
    expect(mergeDashboardLayout(["myTasks"], undefined)).toEqual(defaultDashboardLayout(["myTasks"]));
  });
});

describe("sanitizeDashboardLayoutForSave", () => {
  it("is the same sanitation as merging a saved layout — never trusts client input beyond what's valid", () => {
    const proposed = [
      { key: "myTasks", visible: false, size: "wide", order: 0 },
      { key: "<script>", visible: true, size: "standard", order: 1 },
      { key: "hcmReminders", visible: true, size: "not-a-size", order: 2 },
    ];
    const layout = sanitizeDashboardLayoutForSave(["myTasks", "hcmReminders"], proposed);
    expect(layout.map((l) => l.key)).toEqual(["myTasks", "hcmReminders"]);
    expect(layout[0]).toMatchObject({ visible: false, size: "wide" });
    expect(layout[1].size).toBe("standard"); // corrupted size falls back to registry default
  });

  it("handles a completely non-array payload without throwing", () => {
    expect(sanitizeDashboardLayoutForSave(["myTasks"], "not an array")).toEqual(defaultDashboardLayout(["myTasks"]));
    expect(sanitizeDashboardLayoutForSave(["myTasks"], null)).toEqual(defaultDashboardLayout(["myTasks"]));
    expect(sanitizeDashboardLayoutForSave(["myTasks"], undefined)).toEqual(defaultDashboardLayout(["myTasks"]));
  });
});
