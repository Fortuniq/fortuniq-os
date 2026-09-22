import { describe, it, expect } from "vitest";
import { computeStageProgressPct, pickCurrentWorkflowItemsByModule, buildWorkflowHistory } from "./workflow-core";
import type { MyTask } from "./tasks-core";

function task(overrides: Partial<MyTask>): MyTask {
  return {
    id: "1", title: "Test task", taskType: "Company", moduleKey: "tenders", recordId: null, recordUrl: "/tenders/1",
    employeeEmail: "person@iqfuels.co.za", dueDate: null, dueLabel: null,
    priority: "Medium", status: "In Progress", workflowStage: "Drafting", sortOrder: null, reminderAt: null,
    createdAt: "2026-09-01T00:00:00Z", completedAt: null,
    ...overrides,
  };
}

describe("computeStageProgressPct", () => {
  it("computes a fraction for a known Tenders stage", () => {
    expect(computeStageProgressPct("tenders", "Drafting")).toBe(20);
    expect(computeStageProgressPct("tenders", "Submitted")).toBe(100);
  });
  it("returns null for a module with no known stage sequence", () => {
    expect(computeStageProgressPct("finance", "Review")).toBeNull();
  });
  it("returns null when there's no stage at all", () => {
    expect(computeStageProgressPct("tenders", null)).toBeNull();
  });
  it("returns null for an unrecognised stage name within a known module", () => {
    expect(computeStageProgressPct("tenders", "Made Up Stage")).toBeNull();
  });
});

describe("pickCurrentWorkflowItemsByModule", () => {
  it("picks one item per module", () => {
    const tasks = [
      task({ id: 1, moduleKey: "tenders" }),
      task({ id: 2, moduleKey: "documents", workflowStage: "Review", recordUrl: "/documents/2" }),
    ];
    const items = pickCurrentWorkflowItemsByModule(tasks);
    expect(items.map((i) => i.moduleKey).sort()).toEqual(["documents", "tenders"]);
  });

  it("excludes Personal tasks even if they somehow carry a workflow stage", () => {
    const tasks = [task({ id: 1, taskType: "Personal" })];
    expect(pickCurrentWorkflowItemsByModule(tasks)).toHaveLength(0);
  });

  it("excludes tasks with no workflow stage", () => {
    const tasks = [task({ id: 1, workflowStage: null })];
    expect(pickCurrentWorkflowItemsByModule(tasks)).toHaveLength(0);
  });

  it("excludes completed tasks", () => {
    const tasks = [task({ id: 1, status: "Completed" })];
    expect(pickCurrentWorkflowItemsByModule(tasks)).toHaveLength(0);
  });

  it("picks the task with the soonest due date within a module", () => {
    const tasks = [
      task({ id: 1, dueDate: "2026-10-01" }),
      task({ id: 2, dueDate: "2026-09-25" }),
    ];
    const items = pickCurrentWorkflowItemsByModule(tasks);
    expect(items).toHaveLength(1);
    expect(items[0].taskId).toBe(2);
  });

  it("attaches a progress percentage for Tenders stages", () => {
    const items = pickCurrentWorkflowItemsByModule([task({ moduleKey: "tenders", workflowStage: "Pricing" })]);
    expect(items[0].progressPct).toBe(40);
  });
});

describe("buildWorkflowHistory", () => {
  it("sorts by completedAt descending and respects the limit", () => {
    const tasks = [
      task({ id: 1, status: "Completed", completedAt: "2026-09-01T00:00:00Z" }),
      task({ id: 2, status: "Completed", completedAt: "2026-09-10T00:00:00Z" }),
      task({ id: 3, status: "Completed", completedAt: "2026-09-05T00:00:00Z" }),
    ];
    const history = buildWorkflowHistory(tasks, 2);
    expect(history.map((h) => h.taskId)).toEqual([2, 3]);
  });

  it("excludes Personal tasks and tasks without a workflow stage", () => {
    const tasks = [
      task({ id: 1, status: "Completed", completedAt: "2026-09-01T00:00:00Z", taskType: "Personal" }),
      task({ id: 2, status: "Completed", completedAt: "2026-09-01T00:00:00Z", workflowStage: null }),
    ];
    expect(buildWorkflowHistory(tasks)).toHaveLength(0);
  });
});
