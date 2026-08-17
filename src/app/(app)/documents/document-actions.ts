"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/service";
import { requireModuleAccess } from "@/lib/permissions";
import { requirePermissionAction, checkPermissionAction } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { auth } from "@/auth";
import {
  ensureDocumentLibraryStructure, getCategoryFolder, getArchiveFolder,
  uploadFileToFolder, moveFileToFolder, isSharePointConfigured,
} from "@/lib/graph";
import { recordNewVersion, archivePreviousVersion, restoreVersion, getVersionHistory } from "@/lib/document-versions";
import { canTransitionStatus, nextVersionNumber, archivedFileName, type DocumentStatus } from "@/lib/documents-core";
import { toSATDateString } from "@/lib/attendance-core";

export async function catalogueSharePointFile(formData: FormData) {
  // Real, granular RBAC check — someone with Documents View-only access
  // (e.g. a Marketing team member under RBAC) cannot catalogue a new
  // file, only browse existing ones. See docs/RBAC.md.
  const permissions = await requirePermissionAction("documents", "Create");

  const sharepointItemId = String(formData.get("sharepointItemId") ?? "");
  const name = String(formData.get("name") ?? "");
  const webUrl = String(formData.get("webUrl") ?? "");
  const category = String(formData.get("category") ?? "Policy");
  const owner = String(formData.get("owner") ?? "");

  if (!sharepointItemId || !name) throw new Error("Missing document details.");

  const supabase = createServiceClient();
  await supabase.from("documents").insert({
    name,
    category,
    version: "v1.0",
    owner,
    status: "Draft",
    sharepoint_item_id: sharepointItemId,
    sharepoint_web_url: webUrl,
  });

  await logAudit({
    actorEmail: permissions.email!,
    actorName: permissions.name,
    action: "document_catalogued",
    targetType: "document",
    targetId: sharepointItemId,
    targetLabel: name,
  });

  revalidatePath("/documents");
}

// Note: the old free-form updateDocumentStatus(status) setter has been
// removed — it let any status be set directly, bypassing the 5-state
// lifecycle's transition rules. Use submitDocumentForApproval(),
// reviewDocumentApproval(), publishDocument(), or archiveDocument()
// instead (all below), each of which validates the transition via
// canTransitionStatus() before applying it. See docs/DOCUMENT_CONTROL.md.

/**
 * Sets a document's classification and, for Confidential and above, who
 * is explicitly authorised to see it. Restricted to Super Admins —
 * deliberately: deciding what counts as Confidential or Highly
 * Confidential, and who's authorised to see it, is exactly the kind of
 * decision that shouldn't be self-service for whoever happens to have
 * Documents module access. See docs/AI_SECURITY.md.
 */
export async function updateDocumentClassification(
  documentId: string,
  classification: "General" | "Internal" | "Confidential" | "Highly Confidential",
  authorizedRoles: string[],
  authorizedEmails: string[],
  aiExcluded: boolean
) {
  const permissions = await requireModuleAccess("documents");
  if (!permissions.isAdmin) {
    throw new Error("Only a Super Admin can change a document's classification.");
  }

  const supabase = createServiceClient();
  const { data: before } = await supabase
    .from("documents")
    .select("name, classification, ai_excluded")
    .eq("id", documentId)
    .maybeSingle();

  await supabase
    .from("documents")
    .update({
      classification,
      authorized_roles: authorizedRoles,
      authorized_emails: authorizedEmails.map((e) => e.trim().toLowerCase()).filter(Boolean),
      ai_excluded: aiExcluded,
      updated_at: new Date().toISOString(),
    })
    .eq("id", documentId);

  await logAudit({
    actorEmail: permissions.email!,
    actorName: permissions.name,
    action: "document_status_changed", // reuses the same audit action family as other document metadata changes
    targetType: "document",
    targetId: documentId,
    targetLabel: before?.name ?? documentId,
    metadata: {
      field: "classification",
      before: { classification: before?.classification ?? null, aiExcluded: before?.ai_excluded ?? false },
      after: { classification, aiExcluded },
    },
  });

  revalidatePath("/documents");
}

// =========================================================================
// ENTERPRISE DOCUMENT CONTROL SYSTEM — LINKING, VERSIONING, WORKFLOW
// =========================================================================
// See docs/DOCUMENT_CONTROL.md for the full design.

/**
 * Every action below that touches SharePoint needs the signed-in
 * person's own Graph access token — same "as that specific person, not
 * a shared app identity" principle as everywhere else in this app (see
 * graph.ts's file header). Throws a clear, actionable error rather than
 * a confusing downstream Graph failure if SharePoint isn't connected or
 * the session is stale.
 */
async function requireGraphAccessToken(): Promise<string> {
  if (!isSharePointConfigured) throw new Error("SharePoint isn't connected yet — see docs/SHAREPOINT_SETUP.md.");
  const session = await auth();
  if (!session?.accessToken) throw new Error("Your Microsoft session needs refreshing — try signing out and back in.");
  return session.accessToken as string;
}

async function fetchDocumentRow(documentId: string) {
  const supabase = createServiceClient();
  const { data } = await supabase.from("documents").select("*").eq("id", documentId).maybeSingle();
  if (!data) throw new Error("Document record not found.");
  return data;
}

/**
 * One-time (but safe to call repeatedly) setup of the "FortunIQ
 * Documents" SharePoint library structure — root folder, every category
 * subfolder, and a mirrored Archive/{category} structure. Called
 * automatically the first time someone opens the Attach Document menu,
 * so nobody has to remember to run a separate setup step.
 */
export async function ensureDocumentLibrary() {
  await requireModuleAccess("documents");
  const accessToken = await requireGraphAccessToken();
  await ensureDocumentLibraryStructure(accessToken);
}

/**
 * Links an EXISTING SharePoint file (already chosen via Browse or
 * global Link Existing search) to a document record that has no file
 * linked yet — the first version. For an already-linked record, use
 * replaceDocumentVersion() instead, which additionally archives the
 * superseded file.
 */
export async function linkDocumentToFile(params: {
  documentId: string;
  sharepointItemId: string;
  sharepointWebUrl: string;
  comments?: string;
}) {
  const permissions = await requirePermissionAction("documents", "Edit");
  const doc = await fetchDocumentRow(params.documentId);
  if (doc.sharepoint_item_id) {
    throw new Error("This document already has a linked file — use Replace Current Version instead.");
  }

  const supabase = createServiceClient();
  const versionNumber = doc.current_version_number ?? 1;

  await supabase.from("documents").update({
    sharepoint_item_id: params.sharepointItemId,
    sharepoint_web_url: params.sharepointWebUrl,
    version: `v${versionNumber}`,
    current_version_number: versionNumber,
    modified_by: permissions.email,
    updated_at: new Date().toISOString(),
  }).eq("id", params.documentId);

  await recordNewVersion({
    documentId: params.documentId,
    versionNumber,
    sharepointItemId: params.sharepointItemId,
    sharepointWebUrl: params.sharepointWebUrl,
    uploadedBy: permissions.email!,
    uploadedByName: permissions.name ?? null,
    comments: params.comments,
  });

  await logAudit({
    actorEmail: permissions.email!, actorName: permissions.name, action: "document_catalogued",
    targetType: "document", targetId: params.documentId, targetLabel: doc.name,
    metadata: { sharepointItemId: params.sharepointItemId },
  });

  revalidatePath("/documents");
}

/**
 * Uploads a brand-new file's bytes to SharePoint (into the document's
 * category folder, creating the library structure first if needed) and
 * links it as the document's first version — "Upload New Document" for
 * a record that has no file yet.
 */
export async function uploadAndLinkDocument(formData: FormData) {
  const permissions = await requirePermissionAction("documents", "Edit");
  const documentId = String(formData.get("documentId") ?? "");
  const comments = String(formData.get("comments") ?? "").trim() || undefined;
  const file = formData.get("file") as File | null;
  if (!documentId || !file || file.size === 0) throw new Error("Choose a file to upload.");

  const doc = await fetchDocumentRow(documentId);
  if (doc.sharepoint_item_id) throw new Error("This document already has a linked file — use Replace Current Version instead.");

  const accessToken = await requireGraphAccessToken();
  await ensureDocumentLibraryStructure(accessToken);
  const folder = await getCategoryFolder(accessToken, doc.category);
  const bytes = await file.arrayBuffer();
  const uploaded = await uploadFileToFolder(accessToken, folder.id, file.name, bytes, file.type);

  await logAudit({
    actorEmail: permissions.email!, actorName: permissions.name, action: "document_uploaded",
    targetType: "document", targetId: documentId, targetLabel: doc.name,
    metadata: { fileName: file.name, sizeBytes: file.size },
  });

  await linkDocumentToFile({ documentId, sharepointItemId: uploaded.id, sharepointWebUrl: uploaded.webUrl, comments });
}

/**
 * Replaces the current active file on an already-linked document —
 * "Replace Current Version." Handles both sub-cases (upload a new file,
 * or point at a different existing SharePoint file) through the same
 * archive-then-relink sequence:
 *   1. The new file is either uploaded fresh or was already chosen.
 *   2. The OLD file is renamed and moved into Archive/{category} in
 *      SharePoint — never deleted.
 *   3. The old document_versions row is marked archived.
 *   4. A new document_versions row is created for the new file.
 *   5. The documents row itself is updated to point at the new file,
 *      with the version number incremented and Modified By/Last
 *      Updated set automatically.
 * A document that was Approved or Published automatically reverts to
 * Draft — its content just changed, so the prior approval no longer
 * applies. See docs/DOCUMENT_CONTROL.md, "Replacing a published
 * document."
 */
export async function replaceDocumentVersion(formData: FormData) {
  const permissions = await requirePermissionAction("documents", "Edit");
  const documentId = String(formData.get("documentId") ?? "");
  const comments = String(formData.get("comments") ?? "").trim() || undefined;
  const mode = String(formData.get("mode") ?? "upload"); // "upload" | "existing"
  if (!documentId) throw new Error("Missing document.");

  const doc = await fetchDocumentRow(documentId);
  if (!doc.sharepoint_item_id) throw new Error("This document has no current version to replace — use Attach Document instead.");

  const accessToken = await requireGraphAccessToken();
  await ensureDocumentLibraryStructure(accessToken);

  let newItemId: string;
  let newWebUrl: string;

  if (mode === "existing") {
    newItemId = String(formData.get("sharepointItemId") ?? "");
    newWebUrl = String(formData.get("webUrl") ?? "");
    if (!newItemId) throw new Error("Choose a file to link.");
  } else {
    const file = formData.get("file") as File | null;
    if (!file || file.size === 0) throw new Error("Choose a file to upload.");
    const folder = await getCategoryFolder(accessToken, doc.category);
    const bytes = await file.arrayBuffer();
    const uploaded = await uploadFileToFolder(accessToken, folder.id, file.name, bytes, file.type);
    newItemId = uploaded.id;
    newWebUrl = uploaded.webUrl;
  }

  // Archive the outgoing file: rename to avoid collisions, then move it
  // into Archive/{category}. Graph preserves the item's id across a
  // move, so document_versions can keep referencing it by the same id —
  // only its physical location and name change.
  const archiveFolder = await getArchiveFolder(accessToken, doc.category);
  const archivedName = archivedFileName(doc.name, doc.current_version_number ?? 1, toSATDateString(new Date()));
  const movedOld = await moveFileToFolder(accessToken, doc.sharepoint_item_id, archiveFolder.id, archivedName);

  await archivePreviousVersion(documentId, permissions.email!);
  // Keep the archived version row's link pointing at where the file
  // actually lives now, since its webUrl changes after the move+rename.
  const supabase = createServiceClient();
  await supabase.from("document_versions")
    .update({ sharepoint_web_url: movedOld.webUrl })
    .eq("document_id", documentId).eq("sharepoint_item_id", doc.sharepoint_item_id).eq("is_current", false);

  const newVersionNumber = nextVersionNumber(doc.current_version_number ?? 1);
  const currentStatus = doc.status as DocumentStatus;
  const revertsToDraft = currentStatus === "Approved" || currentStatus === "Published";

  await supabase.from("documents").update({
    sharepoint_item_id: newItemId,
    sharepoint_web_url: newWebUrl,
    version: `v${newVersionNumber}`,
    current_version_number: newVersionNumber,
    modified_by: permissions.email,
    status: revertsToDraft ? "Draft" : currentStatus,
    approved_by: revertsToDraft ? null : doc.approved_by,
    approved_at: revertsToDraft ? null : doc.approved_at,
    published_by: revertsToDraft ? null : doc.published_by,
    published_at: revertsToDraft ? null : doc.published_at,
    updated_at: new Date().toISOString(),
  }).eq("id", documentId);

  await recordNewVersion({
    documentId, versionNumber: newVersionNumber, sharepointItemId: newItemId, sharepointWebUrl: newWebUrl,
    uploadedBy: permissions.email!, uploadedByName: permissions.name ?? null, comments,
  });

  await logAudit({
    actorEmail: permissions.email!, actorName: permissions.name, action: "document_replaced",
    targetType: "document", targetId: documentId, targetLabel: doc.name,
    metadata: { fromVersion: doc.current_version_number, toVersion: newVersionNumber, revertedToDraft: revertsToDraft },
  });
  if (revertsToDraft) {
    await logAudit({
      actorEmail: permissions.email!, actorName: permissions.name, action: "document_status_changed",
      targetType: "document", targetId: documentId, targetLabel: doc.name,
      metadata: { before: currentStatus, after: "Draft", reason: "New version uploaded — requires re-approval" },
    });
  }

  revalidatePath("/documents");
}

/**
 * Unlinks a document record from its SharePoint file WITHOUT touching
 * the file itself — it stays exactly where it is in SharePoint. This is
 * deliberately different from Replace/Archive: "Remove Link" is for
 * correcting a mistaken link, not retiring a document. The file remains
 * fully findable directly in SharePoint even though FortunIQ OS no
 * longer shows it as this record's current version.
 */
export async function removeDocumentLink(documentId: string) {
  const permissions = await requirePermissionAction("documents", "Edit");
  const doc = await fetchDocumentRow(documentId);
  if (!doc.sharepoint_item_id) return; // already unlinked — nothing to do

  const supabase = createServiceClient();
  await supabase.from("documents").update({
    sharepoint_item_id: null, sharepoint_web_url: null, modified_by: permissions.email, updated_at: new Date().toISOString(),
  }).eq("id", documentId);

  await supabase.from("document_versions")
    .update({ is_current: false, archived_at: new Date().toISOString(), archived_by: permissions.email })
    .eq("document_id", documentId).eq("is_current", true);

  await logAudit({
    actorEmail: permissions.email!, actorName: permissions.name, action: "document_link_removed",
    targetType: "document", targetId: documentId, targetLabel: doc.name,
  });

  revalidatePath("/documents");
}

/** Restores a previously archived version as the current one. Also moves the physical file back out of Archive in SharePoint. */
export async function restoreDocumentVersion(documentId: string, versionId: string) {
  const permissions = await requirePermissionAction("documents", "Edit");
  const doc = await fetchDocumentRow(documentId);

  const supabase = createServiceClient();
  const { data: version } = await supabase.from("document_versions").select("*").eq("id", versionId).eq("document_id", documentId).maybeSingle();
  if (!version) throw new Error("That version couldn't be found.");
  if (version.is_current) throw new Error("That version is already the current one.");

  const accessToken = await requireGraphAccessToken();
  const categoryFolder = await getCategoryFolder(accessToken, doc.category);
  const restored = await moveFileToFolder(accessToken, version.sharepoint_item_id, categoryFolder.id);

  await restoreVersion({ documentId, versionId, restoredBy: permissions.email! });

  // A restored version's content is, by definition, not the most
  // recently approved thing — send it back to Draft so it goes through
  // approval again before becoming the active/Published version, same
  // reasoning as replaceDocumentVersion().
  await supabase.from("documents").update({
    sharepoint_item_id: restored.id,
    sharepoint_web_url: restored.webUrl,
    version: `v${version.version_number}`,
    current_version_number: version.version_number,
    status: "Draft",
    approved_by: null, approved_at: null, published_by: null, published_at: null,
    modified_by: permissions.email,
    updated_at: new Date().toISOString(),
  }).eq("id", documentId);

  await logAudit({
    actorEmail: permissions.email!, actorName: permissions.name, action: "document_restored",
    targetType: "document", targetId: documentId, targetLabel: doc.name,
    metadata: { restoredVersion: version.version_number },
  });

  revalidatePath("/documents");
}

// ---------- APPROVAL WORKFLOW ----------

async function transitionDocumentStatus(documentId: string, to: DocumentStatus, extra: Record<string, unknown> = {}) {
  const supabase = createServiceClient();
  const doc = await fetchDocumentRow(documentId);
  const from = doc.status as DocumentStatus;
  if (!canTransitionStatus(from, to)) {
    throw new Error(`Can't move a document from "${from}" to "${to}" — see docs/DOCUMENT_CONTROL.md for the allowed lifecycle.`);
  }
  await supabase.from("documents").update({ status: to, updated_at: new Date().toISOString(), ...extra }).eq("id", documentId);
  return { doc, from };
}

/** Draft -> Pending Approval. Anyone with Edit access can submit; only someone with Approve can move it further. */
export async function submitDocumentForApproval(documentId: string) {
  const permissions = await requirePermissionAction("documents", "Edit");
  const { doc, from } = await transitionDocumentStatus(documentId, "Pending Approval", {
    submitted_for_approval_by: permissions.email, submitted_for_approval_at: new Date().toISOString(),
  });
  await logAudit({
    actorEmail: permissions.email!, actorName: permissions.name, action: "document_status_changed",
    targetType: "document", targetId: documentId, targetLabel: doc.name, metadata: { before: from, after: "Pending Approval" },
  });
  revalidatePath("/documents");
}

/**
 * Approve or reject a document pending approval. Gated by the RBAC
 * "Approve" action, not just "Edit" — only someone explicitly granted
 * approval authority for the Documents module can move a document past
 * Pending Approval, matching "Only Approved documents become active."
 */
export async function reviewDocumentApproval(documentId: string, decision: "approve" | "reject", notes?: string) {
  const permissions = await requirePermissionAction("documents", "Approve");
  const to: DocumentStatus = decision === "approve" ? "Approved" : "Draft";
  const { doc, from } = await transitionDocumentStatus(documentId, to,
    decision === "approve" ? { approved_by: permissions.email, approved_at: new Date().toISOString() } : {}
  );
  await logAudit({
    actorEmail: permissions.email!, actorName: permissions.name,
    action: decision === "approve" ? "document_approved" : "document_status_changed",
    targetType: "document", targetId: documentId, targetLabel: doc.name,
    metadata: { before: from, after: to, notes },
  });
  revalidatePath("/documents");
}

/** Approved -> Published — the document becomes the organisation's active version of record. Also Approve-gated. */
export async function publishDocument(documentId: string) {
  const permissions = await requirePermissionAction("documents", "Approve");
  const { doc, from } = await transitionDocumentStatus(documentId, "Published", {
    published_by: permissions.email, published_at: new Date().toISOString(),
  });
  await logAudit({
    actorEmail: permissions.email!, actorName: permissions.name, action: "document_published",
    targetType: "document", targetId: documentId, targetLabel: doc.name, metadata: { before: from, after: "Published" },
  });
  revalidatePath("/documents");
}

/** Any status -> Archived — retiring a document without deleting its record or file. */
export async function archiveDocument(documentId: string) {
  const permissions = await requirePermissionAction("documents", "Edit");
  const { doc, from } = await transitionDocumentStatus(documentId, "Archived");
  await logAudit({
    actorEmail: permissions.email!, actorName: permissions.name, action: "document_archived",
    targetType: "document", targetId: documentId, targetLabel: doc.name, metadata: { before: from, after: "Archived" },
  });
  revalidatePath("/documents");
}

/**
 * Deletes the FortunIQ OS catalog record only — NEVER the actual
 * SharePoint file. An enterprise document control system should not
 * let a single accidental click permanently destroy a real, possibly
 * legally significant, file; deleting a document record here just
 * removes it from FortunIQ OS's view. The file remains exactly where it
 * is in SharePoint (in its current or Archive folder), findable and
 * deletable there under SharePoint's own, separate controls if that's
 * genuinely needed. Restricted to Delete permission, and to Super Admin
 * as an extra guardrail given how significant this action is.
 */
export async function deleteDocumentRecord(documentId: string) {
  const permissions = await requirePermissionAction("documents", "Delete");
  if (!permissions.isAdmin) throw new Error("Only a Super Admin can delete a document record.");
  const doc = await fetchDocumentRow(documentId);

  const supabase = createServiceClient();
  await supabase.from("document_versions").delete().eq("document_id", documentId);
  await supabase.from("documents").delete().eq("id", documentId);

  await logAudit({
    actorEmail: permissions.email!, actorName: permissions.name, action: "document_deleted",
    targetType: "document", targetId: documentId, targetLabel: doc.name,
  });

  revalidatePath("/documents");
}

/**
 * Full version history for a document, with archived versions filtered
 * out entirely for anyone not authorised to see the Archive — matches
 * "Archived versions should not appear in normal searches" extended to
 * version history too. Super Admin, HR/Admin, or anyone explicitly
 * granted the Documents "Manage" RBAC action (the mechanism for
 * granting Compliance/Legal without inventing new top-level roles) can
 * see the full history.
 */
export async function getDocumentVersionsAction(documentId: string) {
  const permissions = await requireModuleAccess("documents");
  const versions = await getVersionHistory(documentId);
  const canSeeArchive = permissions.isAdmin || permissions.role === "HR/Admin" || (await checkPermissionAction(permissions, "documents", "Manage"));
  if (canSeeArchive) return versions;
  return versions.filter((v) => v.isCurrent);
}
