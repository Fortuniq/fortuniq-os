// Pure logic for the Compliance Status card on My Profile — zero
// dependencies on Next.js or Supabase, same testable-core pattern as
// the rest of this app. The caller does all the DB querying and hands
// in simple booleans; this file only decides what the checklist looks
// like and whether it's overall complete. See
// docs/EMPLOYEE_SELF_SERVICE.md and compliance-status-core.test.ts.

export type ComplianceItem = { label: string; complete: boolean };

export type ComplianceInput = {
  hasEmergencyContact: boolean;
  equipmentIssued: boolean;
  /** One entry per document flagged acknowledgement_required for this employee, whatever it's called (Handbook, POPIA, etc). */
  requiredAcknowledgements: { label: string; acknowledged: boolean }[];
};

/**
 * Builds the Compliance Status checklist. Standing items (emergency
 * contact, equipment) always appear; acknowledgement-required documents
 * are entirely data-driven — HR can add/remove which documents require
 * acknowledgement without any code change here, and this function will
 * just reflect whatever comes in.
 */
export function computeComplianceStatus(input: ComplianceInput): ComplianceItem[] {
  const items: ComplianceItem[] = [
    { label: "Emergency Contact Captured", complete: input.hasEmergencyContact },
    { label: "Company Equipment Issued", complete: input.equipmentIssued },
  ];
  for (const ack of input.requiredAcknowledgements) {
    items.push({ label: `${ack.label} Acknowledged`, complete: ack.acknowledged });
  }
  return items;
}

export function isComplianceComplete(items: ComplianceItem[]): boolean {
  return items.length > 0 && items.every((i) => i.complete);
}

export function outstandingComplianceCount(items: ComplianceItem[]): number {
  return items.filter((i) => !i.complete).length;
}
