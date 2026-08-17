import { describe, it, expect } from "vitest";
import { effectiveStatus, isDueToday, groupMyTasks, sortMyTasks, canSeeTask, type MyTask } from "./tasks-core";

const TODAY = new Date("2026-08-17T09:00:00");

function task(overrides: Partial<MyTask>): MyTask {
  return {
    id: "1", title: "Test task", moduleKey: null, recordId: null, recordUrl: null,
    employeeEmail: "person@iqfuels.co.za", dueDate: null, dueLabel: null,
    priority: "Medium", status: "To Do", workflowStage: null, createdAt: null, completedAt: null,
    ...overrides,
  };
}

describe("effectiveStatus", () => {
  it("reclassifies an unfinished task as Overdue once its due date has passed", () => {
    const t = task({ status: "To Do", dueDate: "2026-08-10" });
    expect(effectiveStatus(t, TODAY)).toBe("Overdue");
  });

  it("never reclassifies a Completed task as Overdue, no matter how late it finished", () => {
    const t = task({ status: "Completed", dueDate: "2026-08-01" });
    expect(effectiveStatus(t, TODAY)).toBe("Completed");
  });

  it("keeps a task's stored status when its due date is in the future", () => {
    const t = task({ status: "In Progress", dueDate: "2026-08-25" });
    expect(effectiveStatus(t, TODAY)).toBe("In Progress");
  });

  it("keeps a task's stored status when it has no due date at all", () => {
    const t = task({ status: "Waiting", dueDate: null });
    expect(effectiveStatus(t, TODAY)).toBe("Waiting");
  });
});

describe("isDueToday", () => {
  it("matches the exact calendar day", () => {
    expect(isDueToday(task({ dueDate: "2026-08-17" }), TODAY)).toBe(true);
    expect(isDueToday(task({ dueDate: "2026-08-18" }), TODAY)).toBe(false);
  });
});

describe("groupMyTasks", () => {
  it("buckets tasks into dueToday / upcoming / overdue / highPriority, excluding Completed", () => {
    const tasks = [
      task({ id: 1, dueDate: "2026-08-17", priority: "Low" }), // due today
      task({ id: 2, dueDate: "2026-08-25", priority: "Medium" }), // upcoming
      task({ id: 3, dueDate: "2026-08-01", priority: "Low" }), // overdue
      task({ id: 4, dueDate: "2026-08-25", priority: "High" }), // upcoming AND high priority
      task({ id: 5, dueDate: "2026-08-01", status: "Completed" }), // excluded entirely
    ];
    const groups = groupMyTasks(tasks, TODAY);
    expect(groups.dueToday.map((t) => t.id)).toEqual([1]);
    expect(groups.overdue.map((t) => t.id)).toEqual([3]);
    expect(groups.upcoming.map((t) => t.id).sort()).toEqual([2, 4]);
    expect(groups.highPriority.map((t) => t.id)).toEqual([4]);
  });
});

describe("sortMyTasks", () => {
  it("puts overdue tasks first, then sorts by soonest due date", () => {
    const tasks = [
      task({ id: 1, dueDate: "2026-08-25" }),
      task({ id: 2, dueDate: "2026-08-01" }), // overdue
      task({ id: 3, dueDate: "2026-08-18" }),
    ];
    const sorted = sortMyTasks(tasks, TODAY);
    expect(sorted.map((t) => t.id)).toEqual([2, 3, 1]);
  });
});

describe("canSeeTask", () => {
  it("hides a task assigned to someone else", () => {
    const t = task({ employeeEmail: "other@iqfuels.co.za" });
    expect(canSeeTask(t, "me@iqfuels.co.za", () => true)).toBe(false);
  });

  it("shows a task with no module key to its assigned employee regardless of module access", () => {
    const t = task({ employeeEmail: "me@iqfuels.co.za", moduleKey: null });
    expect(canSeeTask(t, "me@iqfuels.co.za", () => false)).toBe(true);
  });

  it("hides a task whose module the viewer can't access, even if it's assigned to them", () => {
    const t = task({ employeeEmail: "me@iqfuels.co.za", moduleKey: "finance" });
    expect(canSeeTask(t, "me@iqfuels.co.za", (m) => m !== "finance")).toBe(false);
  });

  it("email matching is case-insensitive", () => {
    const t = task({ employeeEmail: "Me@IQFuels.co.za" });
    expect(canSeeTask(t, "me@iqfuels.co.za", () => true)).toBe(true);
  });
});
