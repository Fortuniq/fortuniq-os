// Pure document-control logic — zero dependencies on Next.js or
// Supabase, same testable-core pattern as every other *-core.ts file in
// this app. See docs/DOCUMENT_CONTROL.md and documents-core.test.ts.

export type DocumentStatus = "Draft" | "Pending Approval" | "Approved" | "Published" | "Archived";

export const DOCUMENT_STATUS_ORDER: DocumentStatus[] = ["Draft", "Pending Approval", "Approved", "Published", "Archived"];

/**
 * The document lifecycle is mostly linear (Draft → Pending Approval →
 * Approved → Published) with two special moves: anything can be sent
 * straight to Archived (a document being retired doesn't need to
 * re-traverse the whole pipeline), and a rejected approval sends a
 * document back to Draft rather than leaving it stuck in limbo.
 */
const ALLOWED_TRANSITIONS: Record<DocumentStatus, DocumentStatus[]> = {
  "Draft": ["Pending Approval", "Archived"],
  "Pending Approval": ["Approved", "Draft", "Archived"], // Draft = rejected back to the author
  "Approved": ["Published", "Draft", "Archived"],
  "Published": ["Archived", "Draft"], // Draft = a published doc is being revised — see docs/DOCUMENT_CONTROL.md
  "Archived": ["Draft"], // restoring an archived document starts it back at Draft, never silently republished
};

export function canTransitionStatus(from: DocumentStatus, to: DocumentStatus): boolean {
  if (from === to) return true;
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

/** Only a Published document is considered the organisation's "active" version of record. */
export function isActiveDocument(status: DocumentStatus): boolean {
  return status === "Published";
}

/**
 * Whether a document is due to expire within `daysAhead` days (default
 * 30) — used for both the dashboard reminder card and to decide whether
 * a document needs flagging at all. A document with no expiry date
 * never expires, by definition.
 */
export function isExpiringSoon(expiryDate: string | null, daysAhead = 30, today: Date = new Date()): boolean {
  if (!expiryDate) return false;
  const expiry = new Date(expiryDate + "T00:00:00");
  const diffDays = Math.round((expiry.getTime() - new Date(today.toDateString()).getTime()) / 86400000);
  return diffDays >= 0 && diffDays <= daysAhead;
}

export function isExpired(expiryDate: string | null, today: Date = new Date()): boolean {
  if (!expiryDate) return false;
  const expiry = new Date(expiryDate + "T00:00:00");
  return expiry.getTime() < new Date(today.toDateString()).getTime();
}

export function daysUntilExpiry(expiryDate: string, today: Date = new Date()): number {
  const expiry = new Date(expiryDate + "T00:00:00");
  return Math.round((expiry.getTime() - new Date(today.toDateString()).getTime()) / 86400000);
}

/** The next version number for a new upload/link on an existing document record. */
export function nextVersionNumber(currentVersionNumber: number): number {
  return currentVersionNumber + 1;
}

/**
 * Builds the filename a superseded version is renamed to when it moves
 * into Archive, so multiple archived versions of the same document name
 * never collide — e.g. "Company Profile.docx" archived as version 4
 * becomes "Company Profile v4 (superseded 2026-08-17).docx".
 */
export function archivedFileName(originalName: string, versionNumber: number, archivedDate: string): string {
  const dotIndex = originalName.lastIndexOf(".");
  const base = dotIndex > 0 ? originalName.slice(0, dotIndex) : originalName;
  const ext = dotIndex > 0 ? originalName.slice(dotIndex) : "";
  return `${base} v${versionNumber} (superseded ${archivedDate})${ext}`;
}
