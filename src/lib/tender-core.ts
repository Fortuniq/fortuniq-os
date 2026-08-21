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
