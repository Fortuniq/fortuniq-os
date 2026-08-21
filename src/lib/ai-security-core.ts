// Pure classification/authorisation logic for what the AI Assistant is
// allowed to see. Deliberately has ZERO dependencies on Next.js, Auth.js,
// Supabase, or the network — same reasoning as permissions-core.ts: this
// makes it possible to unit test every classification rule in complete
// isolation. See docs/AI_SECURITY.md and src/lib/ai-security.test.ts.
//
// FAIL-CLOSED BY DESIGN: every function here defaults to denying access.
// A document is only included for the AI if there is a specific,
// affirmative reason it should be — never because we simply don't know.

import { hasModuleAccess, type UserPermissions } from "./permissions-core";

export type Classification = "Public" | "General" | "Internal" | "Confidential" | "Highly Confidential";

export const ALL_CLASSIFICATIONS: Classification[] = ["Public", "Internal", "Confidential", "Highly Confidential"];

export type ClassifiableDocument = {
  classification: Classification;
  authorizedRoles: string[];
  authorizedEmails: string[];
  aiExcluded: boolean;
  /**
   * Set when this document belongs to a specific employee's personnel
   * file (documents.employee_id). See canAccessDocumentByClassification
   * below — this is checked BEFORE classification, and overrides it:
   * an employee-linked document is never universally visible no matter
   * how permissive its classification is. See docs/DOCUMENT_HUB_SECURITY.md.
   */
  employeeId: string | null;
};

/**
 * Can this specific person's role/identity see this document at all —
 * checked in two layers, in order:
 *
 * 1. EMPLOYEE-DOCUMENT OWNERSHIP (checked first, overrides everything
 *    below it): if this document belongs to a specific employee's
 *    personnel file, it is ONLY visible to that employee themselves,
 *    HR/Admin, or Super Admin — regardless of classification. A
 *    Marketing person must never see an Employment Contract just
 *    because someone classified it "Internal." This is what makes
 *    employee documents "security trimmed" rather than merely hidden —
 *    a document failing this check is excluded from every consumer of
 *    this function: listings, search, counts, recent documents, the AI
 *    Assistant, reports, downloads, previews. See
 *    docs/DOCUMENT_HUB_SECURITY.md.
 *
 * 2. CLASSIFICATION + explicit authorisation (the pre-existing rule,
 *    unchanged): General/Public/Internal are visible to anyone with
 *    Documents access; Confidential/Highly Confidential need Super
 *    Admin or explicit authorizedRoles/authorizedEmails.
 */
export function canAccessDocumentByClassification(
  permissions: UserPermissions,
  doc: Pick<ClassifiableDocument, "classification" | "authorizedRoles" | "authorizedEmails" | "employeeId">,
  viewerEmployeeId: string | null = null
): boolean {
  if (permissions.status !== "active" && permissions.status !== "no-database") {
    return false;
  }

  if (doc.employeeId) {
    const isOwnDocument = !!viewerEmployeeId && viewerEmployeeId === doc.employeeId;
    const isHRForThisDoc = permissions.isAdmin || permissions.role === "HR/Admin";
    if (!isOwnDocument && !isHRForThisDoc) return false;
  }

  if (doc.classification === "General" || doc.classification === "Public" || doc.classification === "Internal") {
    return true;
  }

  if (permissions.isAdmin) {
    return true;
  }

  const roleAuthorized = !!permissions.role && doc.authorizedRoles.includes(permissions.role);
  const emailAuthorized = !!permissions.email && doc.authorizedEmails.includes(permissions.email.toLowerCase());

  return roleAuthorized || emailAuthorized;
}

/**
 * Can this specific person's role/identity see this document AT ALL,
 * according to FortunIQ OS's own classification rules — independent of
 * whether they can also reach it in SharePoint (that's a separate,
 * additional real-time check — see canUserAccessItem() in graph.ts,
 * combined with this in src/app/api/ai/chat/route.ts).
 *
 * This function answers the question "is this person, by role/identity,
 * even the kind of person who should see this document" — SharePoint's
 * own permissions answer the separate question "does this specific
 * person actually have that file shared with them." Both must be true.
 */
export function canAccessDocumentForAI(
  permissions: UserPermissions,
  doc: ClassifiableDocument,
  viewerEmployeeId: string | null = null
): boolean {
  // Hard override — never shown to the AI, regardless of anything else.
  if (doc.aiExcluded) {
    return false;
  }

  // Baseline: must have ordinary Documents module access at all.
  if (!hasModuleAccess(permissions, "documents")) {
    return false;
  }

  return canAccessDocumentByClassification(permissions, doc, viewerEmployeeId);
}

/**
 * Filters a list of documents down to only the ones this person is
 * allowed to have the AI Assistant reference. This is the single
 * function the AI chat route should call — never build document context
 * from an unfiltered list.
 */
export function filterDocumentsForAI<T extends ClassifiableDocument>(
  permissions: UserPermissions,
  documents: T[],
  viewerEmployeeId: string | null = null
): T[] {
  return documents.filter((doc) => canAccessDocumentForAI(permissions, doc, viewerEmployeeId));
}
