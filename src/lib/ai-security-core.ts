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

export type Classification = "General" | "Internal" | "Confidential" | "Highly Confidential";

export const ALL_CLASSIFICATIONS: Classification[] = ["General", "Internal", "Confidential", "Highly Confidential"];

export type ClassifiableDocument = {
  classification: Classification;
  authorizedRoles: string[];
  authorizedEmails: string[];
  aiExcluded: boolean;
};

/**
 * Can this specific person's role/identity see this document at all,
 * based purely on its classification level and any explicit
 * authorisation — independent of AI-specific concerns like ai_excluded.
 * Used by both the Documents module (so a Confidential HR document isn't
 * even listed to someone unauthorised) and, via canAccessDocumentForAI
 * below, by the AI Assistant.
 */
export function canAccessDocumentByClassification(
  permissions: UserPermissions,
  doc: Pick<ClassifiableDocument, "classification" | "authorizedRoles" | "authorizedEmails">
): boolean {
  if (permissions.status !== "active" && permissions.status !== "no-database") {
    return false;
  }

  if (doc.classification === "General" || doc.classification === "Internal") {
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
  doc: ClassifiableDocument
): boolean {
  // Hard override — never shown to the AI, regardless of anything else.
  if (doc.aiExcluded) {
    return false;
  }

  // Baseline: must have ordinary Documents module access at all.
  if (!hasModuleAccess(permissions, "documents")) {
    return false;
  }

  return canAccessDocumentByClassification(permissions, doc);
}

/**
 * Filters a list of documents down to only the ones this person is
 * allowed to have the AI Assistant reference. This is the single
 * function the AI chat route should call — never build document context
 * from an unfiltered list.
 */
export function filterDocumentsForAI<T extends ClassifiableDocument>(
  permissions: UserPermissions,
  documents: T[]
): T[] {
  return documents.filter((doc) => canAccessDocumentForAI(permissions, doc));
}
