// Pure tender-compliance logic — zero dependencies on Next.js, Auth.js,
// or Supabase, same reasoning as every other *-core.ts file in this app:
// fully unit-testable in isolation. See docs/TENDER_WORKSPACE.md and
// src/lib/tender-core.test.ts.

export type ChecklistItem = {
  done: boolean;
};

export type ComplianceResult = {
  // null specifically means "no checklist exists yet to calculate from"
  // — genuinely different from 0%, which would mean "a checklist exists
  // and nothing on it is confirmed yet." Callers should show these two
  // states differently rather than collapsing them into the same number.
  pct: number | null;
  confirmedCount: number;
  totalCount: number;
};

/**
 * Calculates a tender's real compliance percentage from its confirmed
 * checklist items — replacing a manually-typed number with something
 * that actually reflects what's been done. Deliberately returns null,
 * not 0, when there's no checklist yet, so an empty tender doesn't
 * misleadingly show as "0% compliant" (implying failure) rather than
 * "not yet assessed."
 */
export function calculateCompliancePct(items: ChecklistItem[]): ComplianceResult {
  if (items.length === 0) {
    return { pct: null, confirmedCount: 0, totalCount: 0 };
  }
  const confirmedCount = items.filter((i) => i.done).length;
  return {
    pct: Math.round((confirmedCount / items.length) * 100),
    confirmedCount,
    totalCount: items.length,
  };
}

// =========================================================================
// TENDER WORKFLOW STAGES — see docs/TENDER_PLANNER.md
// =========================================================================

export type TenderWorkflowStage = "Drafting" | "Pricing" | "Assessment & Verification" | "Submission Ready" | "Submitted";

export const TENDER_WORKFLOW_STAGE_ORDER: TenderWorkflowStage[] = [
  "Drafting", "Pricing", "Assessment & Verification", "Submission Ready", "Submitted",
];

/**
 * Normalises a tender's raw `stage` column value to one of the 5 real
 * workflow stages, defaulting to "Drafting" for anything else. This
 * exists because `tenders.stage` is deliberately NOT database-
 * constrained (see migration_v23's comment — some pre-existing tenders
 * have free-text values like "Drafting - SARS Code" from before this
 * workflow existed), so a raw value read straight from the database can
 * be something outside the 5-value set entirely.
 *
 * BOTH the UI (TenderWorkflowControl.tsx) and the server action
 * (moveTenderStage() in tender-actions.ts) call this SAME function
 * before doing anything else with a tender's stage — that's what
 * guarantees they can never disagree about what stage a tender is
 * "really" in. Before this existed, the UI computed its own inline
 * fallback separately from what the server compared against, which is
 * exactly the kind of drift that caused a tender showing "Drafting" in
 * the UI to be rejected server-side for not matching the literal string
 * "Drafting." See docs/TENDER_PLANNER.md.
 */
export function normalizeTenderStage(rawStage: string | null | undefined): TenderWorkflowStage {
  if (rawStage && (TENDER_WORKFLOW_STAGE_ORDER as string[]).includes(rawStage)) {
    return rawStage as TenderWorkflowStage;
  }
  return "Drafting";
}

/**
 * Stages move forward one step at a time, or backward to any earlier
 * stage (e.g. Assessment finds a problem and sends work back to
 * Pricing) — but never skip ahead. "Stage should not be changed
 * casually" per the brief; this is the shape of "casually" this
 * function actually blocks — jumping straight from Drafting to
 * Submitted, for instance.
 */
export function canTransitionTenderStage(from: TenderWorkflowStage, to: TenderWorkflowStage): boolean {
  const fromIdx = TENDER_WORKFLOW_STAGE_ORDER.indexOf(from);
  const toIdx = TENDER_WORKFLOW_STAGE_ORDER.indexOf(to);
  if (fromIdx === -1 || toIdx === -1) return false;
  if (toIdx <= fromIdx) return true; // moving backward, or staying put, is always fine
  return toIdx === fromIdx + 1; // forward only one step at a time
}

export type SubmissionReadinessCheck = {
  ready: boolean;
  issues: string[];
};

/**
 * The gate before Assessment & Verification -> Submission Ready — see
 * docs/TENDER_PLANNER.md, "Stage controls." Checks what FortunIQ OS can
 * actually verify from its own data: every checklist item confirmed,
 * and compliance at 100%. It does NOT independently invent an
 * "approvals obtained" check — the brief is explicit that "FortunIQ
 * Intelligence may identify risks... but must not independently approve
 * the stage transition," and the same principle applies to this plain
 * logic function: it surfaces what's incomplete and requires a human
 * with the right permission to make the actual call (see
 * moveTenderStage() in tender-actions.ts, which requires explicit
 * Approve-level permission for this specific transition).
 */
export function checkSubmissionReadiness(checklist: ChecklistItem[], compliancePct: number | null): SubmissionReadinessCheck {
  const issues: string[] = [];
  if (checklist.length === 0) {
    issues.push("No checklist items exist yet for this tender.");
  } else {
    const outstanding = checklist.filter((i) => !i.done).length;
    if (outstanding > 0) issues.push(`${outstanding} checklist item${outstanding === 1 ? "" : "s"} not yet confirmed.`);
  }
  if (compliancePct === null || compliancePct < 100) {
    issues.push("Compliance is not yet at 100%.");
  }
  return { ready: issues.length === 0, issues };
}

// =========================================================================
// STAGE OWNERSHIP & ASSIGNMENT — see docs/TENDER_ASSIGNMENT.md
// =========================================================================

export type StageAssignmentStatus = "Active" | "Completed" | "Reassigned";
export type AssignmentPriority = "High" | "Medium" | "Low";

export type StageAssignment = {
  stage: TenderWorkflowStage;
  ownerEmail: string;
  dueDate: string | null;
  status: StageAssignmentStatus;
};

/**
 * A stage is Overdue purely as a DISPLAY computation — never a stored
 * status — the same "compute at read time from a due date, don't rely
 * on a background job" pattern already used for document expiry
 * (isExpiringSoon/isExpired) and dashboard reminders (isWithinDays)
 * elsewhere in this app. Only an Active assignment with a past due date
 * counts; a Completed or Reassigned assignment is never "overdue" no
 * matter how late it finished.
 */
export function isStageOverdue(assignment: Pick<StageAssignment, "status" | "dueDate">, today: Date = new Date()): boolean {
  if (assignment.status !== "Active" || !assignment.dueDate) return false;
  const due = new Date(assignment.dueDate + "T23:59:59");
  return due.getTime() < today.getTime();
}

/**
 * "The stage cannot become active until an owner has been assigned" —
 * this is the one function that actually enforces that gate, called
 * before any stage transition is allowed to complete. Deliberately
 * strict: a blank or whitespace-only email doesn't count as an
 * assignment.
 */
export function validateStageAssignment(ownerEmail: string | null | undefined): { valid: boolean; error?: string } {
  if (!ownerEmail || !ownerEmail.trim()) {
    return { valid: false, error: "You must assign this stage to an employee before it can become active." };
  }
  return { valid: true };
}

// =========================================================================
// TENDER REGISTER: LAST ACTIVITY & STALE DETECTION — see docs/TENDER_REGISTER.md
// =========================================================================

/**
 * Default "no activity for this many days" threshold before a tender
 * is flagged stale. The brief calls this "configurable" — this constant
 * is the one place that configuration would live once a real settings
 * UI exists; for now it's a single, documented default rather than a
 * fabricated settings screen. See docs/TENDER_REGISTER.md, "Known
 * limitations."
 */
export const STALE_TENDER_THRESHOLD_DAYS = 5;

/**
 * Renders a timestamp as a short relative-time string — "10 min ago",
 * "2 hours ago", "Yesterday", "3 days ago" — matching the brief's own
 * examples exactly. Falls back to a plain date once it's more than a
 * week old, since "47 days ago" is less useful than an actual date at
 * that distance.
 */
export function formatRelativeActivityTime(timestamp: string | null, today: Date = new Date()): string {
  if (!timestamp) return "No activity yet";
  const then = new Date(timestamp);
  const diffMs = today.getTime() - then.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes} min ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  return then.toLocaleDateString("en-ZA", { day: "2-digit", month: "short", year: "numeric" });
}

/**
 * A tender is "stale" only if it's still Open (an Awarded or Lost
 * tender is done — the brief explicitly says never mark
 * closed/awarded/lost/archived tenders as stale) AND its last activity
 * is older than the threshold. A tender with NO activity timestamp at
 * all (shouldn't normally happen once activity logging is wired up,
 * but defensively) is treated as stale if it's Open — silence on an
 * open tender is exactly the situation this indicator exists to catch.
 */
export function isTenderStale(
  lastActivityAt: string | null,
  status: string,
  today: Date = new Date(),
  thresholdDays: number = STALE_TENDER_THRESHOLD_DAYS
): boolean {
  if (status !== "Open") return false;
  if (!lastActivityAt) return true;
  const diffDays = (today.getTime() - new Date(lastActivityAt).getTime()) / 86400000;
  return diffDays >= thresholdDays;
}

// =========================================================================
// AUTOMATIC TENDER DEADLINE MANAGEMENT — see docs/TENDER_DEADLINES.md
// =========================================================================

export const DEFAULT_CLOSING_SOON_WARNING_DAYS = 7;

/**
 * Days remaining until closing — negative once overdue. Pure date math,
 * no time-of-day component (both dates compared at midnight), so
 * "Today" means the whole calendar day, not the next 24 hours from now.
 */
export function calculateDaysRemaining(closingDate: string, today: Date = new Date()): number {
  const closing = new Date(closingDate + "T00:00:00");
  const todayMidnight = new Date(today.toDateString());
  return Math.round((closing.getTime() - todayMidnight.getTime()) / 86400000);
}

/**
 * Renders days-remaining exactly matching the brief's own examples:
 * "10 Days Remaining", "Tomorrow", "Today", "Overdue by 2 Days".
 */
export function formatDaysRemaining(daysRemaining: number): string {
  if (daysRemaining < 0) return `Overdue by ${Math.abs(daysRemaining)} Day${Math.abs(daysRemaining) === 1 ? "" : "s"}`;
  if (daysRemaining === 0) return "Today";
  if (daysRemaining === 1) return "Tomorrow";
  return `${daysRemaining} Days Remaining`;
}

export function isClosingSoon(daysRemaining: number, warningDays: number = DEFAULT_CLOSING_SOON_WARNING_DAYS): boolean {
  return daysRemaining > 0 && daysRemaining <= warningDays;
}

export function isDueToday(daysRemaining: number): boolean {
  return daysRemaining === 0;
}

/**
 * The actual decision logic for automatic Missed classification — the
 * brief's own list, verbatim: closing date passed, not submitted, not
 * Awarded, not Lost, not already manually closed another way. A tender
 * already Missed is never re-flagged (idempotent — calling this
 * repeatedly on an already-Missed tender is always false, there's
 * nothing further to do).
 */
export function shouldAutoMarkMissed(tender: {
  closingDate: string;
  status: string;
  stage: string | null;
}, today: Date = new Date()): boolean {
  if (tender.status === "Awarded" || tender.status === "Lost" || tender.status === "Missed") return false;
  if (tender.stage === "Submitted") return false;
  const daysRemaining = calculateDaysRemaining(tender.closingDate, today);
  return daysRemaining < 0;
}

/**
 * The status to actually DISPLAY, computed live — used everywhere a
 * tender's status is shown, so the UI always reflects reality even in
 * the brief window between a deadline passing and the next time
 * applyMissedStatusIfNeeded() (tender-deadlines.ts) actually writes
 * "Missed" to the database. See docs/TENDER_DEADLINES.md, "How the
 * automatic transition actually happens."
 */
export function computeEffectiveTenderStatus(tender: { closingDate: string; status: string; stage: string | null }, today: Date = new Date()): string {
  return shouldAutoMarkMissed(tender, today) ? "Missed" : tender.status;
}

export function computeEffectiveTenderStage(tender: { closingDate: string; status: string; stage: string | null }, today: Date = new Date()): string | null {
  return shouldAutoMarkMissed(tender, today) ? "Closed — Missed" : tender.stage;
}
