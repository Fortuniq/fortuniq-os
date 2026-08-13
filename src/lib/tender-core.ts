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
