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

// =========================================================================
// WHY EVERY EXPORTED ACTION RETURNS {error?: string} INSTEAD OF THROWING
// =========================================================================
// Next.js redacts the message of any error THROWN from a Server Action
// once deployed in production — the browser only ever sees a generic
// "An error occurred in the Server Components render" plus a digest,
// regardless of try/catch on the calling client component. This is
// documented, intentional Next.js behaviour (a security measure against
// leaking server internals), not a bug in this app — but it means a
// perfectly correct, deliberate validation message like "This document
// already has a linked file" never reaches the person who needs to see
// it. The fix: every exported action here catches its own errors and
// returns them as plain, serialisable data instead — return values are
// never redacted, only thrown exceptions are. See docs/DOCUMENT_CONTROL.md.
//
// Internal (non-exported) helper functions below still throw normally —
// that's fine and even preferable, since it keeps their control flow
// simple; only the OUTERMOST exported function, called directly from a
// client component, needs to catch and convert to {error}.

type ActionResult = { error?: string };

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Something went wrong. Please try again.";
}

export async function catalogueSharePointFile(formData: FormData): Promise<ActionResult> {
  try {
    // Real, granular RBAC check — someone with Documents View-only access
    // (e.g. a Marketing team member under RBAC) cannot catalogue a new
    // file, only browse existing ones. See docs/RBAC.md.
    const permissions = await requirePermissionAction("documents", "Create");

    const sharepointItemId = String(formData.get("sharepointItemId") ?? "");
    const name = String(formData.get("name") ?? "");
    const webUrl = String(formData.get("webUrl") ?? "");
    const category = String(formData.get("category") ?? "Policies");
    const owner = String(formData.get("owner") ?? "");

    if (!sharepointItemId || !name) return { error: "Missing document details." };

    const supabase = createServiceClient();
    const { error } = await supabase.from("documents").insert({
      name,
      category,
      version: "v1.0",
      owner,
      status: "Draft",
      sharepoint_item_id: sharepointItemId,
      sharepoint_web_url: webUrl,
    });
    if (error) return { error: error.message };

    await logAudit({
      actorEmail: permissions.email!,
      actorName: permissions.name,
      action: "document_catalogued",
      targetType: "document",
      targetId: sharepointItemId,
      targetLabel: name,
    });

    revalidatePath("/documents");
    return {};
  } catch (err) {
    return { error: errorMessage(err) };
  }
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
): Promise<ActionResult> {
  try {
    const permissions = await requireModuleAccess("documents");
    if (!permissions.isAdmin) {
      return { error: "Only a Super Admin can change a document's classification." };
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
      action: "document_status_changed",
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
    return {};
  } catch (err) {
    return { error: errorMessage(err) };
  }
}

// =========================================================================
// ENTERPRISE DOCUMENT CONTROL SYSTEM — LINKING, VERSIONING, WORKFLOW
// =========================================================================
// See docs/DOCUMENT_CONTROL.md for the full design.

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
 * Documents" SharePoint library structure. Called automatically the
 * first time someone opens the Attach Document menu.
 */
export async function ensureDocumentLibrary(): Promise<ActionResult> {
  try {
    await requireModuleAccess("documents");
    const accessToken = await requireGraphAccessToken();
    await ensureDocumentLibraryStructure(accessToken);
    return {};
  } catch (err) {
    return { error: errorMessage(err) };
  }
}

/**
 * Internal implementation — throws normally. Called both by the
 * exported linkDocumentToFile() wrapper below AND directly by
 * uploadAndLinkDocument() (so a failure partway through an upload+link
 * sequence surfaces as ONE error, not two separate revalidations).
 */
async function _linkDocumentToFile(params: {
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
}): Promise<ActionResult> {
  try {
    await _linkDocumentToFile(params);
    return {};
  } catch (err) {
    return { error: errorMessage(err) };
  }
}

/**
 * Uploads a brand-new file's bytes to SharePoint (into the document's
 * category folder, creating the library structure first if needed) and
 * links it as the document's first version — "Upload New Document" for
 * a record that has no file yet.
 */
export async function uploadAndLinkDocument(formData: FormData): Promise<ActionResult> {
  try {
    const permissions = await requirePermissionAction("documents", "Edit");
    const documentId = String(formData.get("documentId") ?? "");
    const comments = String(formData.get("comments") ?? "").trim() || undefined;
    const file = formData.get("file") as File | null;
    if (!documentId || !file || file.size === 0) return { error: "Choose a file to upload." };

    const doc = await fetchDocumentRow(documentId);
    if (doc.sharepoint_item_id) return { error: "This document already has a linked file — use Replace Current Version instead." };

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

    await _linkDocumentToFile({ documentId, sharepointItemId: uploaded.id, sharepointWebUrl: uploaded.webUrl, comments });
    return {};
  } catch (err) {
    return { error: errorMessage(err) };
  }
}

/**
 * Replaces the current active file on an already-linked document —
 * "Replace Current Version." Handles both sub-cases (upload a new file,
 * or point at a different existing SharePoint file) through the same
 * archive-then-relink sequence. A document that was Approved or
 * Published automatically reverts to Draft — its content just changed,
 * so the prior approval no longer applies. See docs/DOCUMENT_CONTROL.md.
 */
export async function replaceDocumentVersion(formData: FormData): Promise<ActionResult> {
  try {
    const permissions = await requirePermissionAction("documents", "Edit");
    const documentId = String(formData.get("documentId") ?? "");
    const comments = String(formData.get("comments") ?? "").trim() || undefined;
    const mode = String(formData.get("mode") ?? "upload"); // "upload" | "existing"
    if (!documentId) return { error: "Missing document." };

    const doc = await fetchDocumentRow(documentId);
    if (!doc.sharepoint_item_id) return { error: "This document has no current version to replace — use Attach Document instead." };

    const accessToken = await requireGraphAccessToken();
    await ensureDocumentLibraryStructure(accessToken);

    let newItemId: string;
    let newWebUrl: string;

    if (mode === "existing") {
      newItemId = String(formData.get("sharepointItemId") ?? "");
      newWebUrl = String(formData.get("webUrl") ?? "");
      if (!newItemId) return { error: "Choose a file to link." };
    } else {
      const file = formData.get("file") as File | null;
      if (!file || file.size === 0) return { error: "Choose a file to upload." };
      const folder = await getCategoryFolder(accessToken, doc.category);
      const bytes = await file.arrayBuffer();
      const uploaded = await uploadFileToFolder(accessToken, folder.id, file.name, bytes, file.type);
      newItemId = uploaded.id;
      newWebUrl = uploaded.webUrl;
    }

    const archiveFolder = await getArchiveFolder(accessToken, doc.category);
    const archivedName = archivedFileName(doc.name, doc.current_version_number ?? 1, toSATDateString(new Date()));
    const movedOld = await moveFileToFolder(accessToken, doc.sharepoint_item_id, archiveFolder.id, archivedName);

    await archivePreviousVersion(documentId, permissions.email!);
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
    return {};
  } catch (err) {
    return { error: errorMessage(err) };
  }
}

/**
 * Unlinks a document record from its SharePoint file WITHOUT touching
 * the file itself — it stays exactly where it is in SharePoint.
 */
export async function removeDocumentLink(documentId: string): Promise<ActionResult> {
  try {
    const permissions = await requirePermissionAction("documents", "Edit");
    const doc = await fetchDocumentRow(documentId);
    if (!doc.sharepoint_item_id) return {};

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
    return {};
  } catch (err) {
    return { error: errorMessage(err) };
  }
}

/** Restores a previously archived version as the current one. Also moves the physical file back out of Archive in SharePoint. */
export async function restoreDocumentVersion(documentId: string, versionId: string): Promise<ActionResult> {
  try {
    const permissions = await requirePermissionAction("documents", "Edit");
    const doc = await fetchDocumentRow(documentId);

    const supabase = createServiceClient();
    const { data: version } = await supabase.from("document_versions").select("*").eq("id", versionId).eq("document_id", documentId).maybeSingle();
    if (!version) return { error: "That version couldn't be found." };
    if (version.is_current) return { error: "That version is already the current one." };

    const accessToken = await requireGraphAccessToken();
    const categoryFolder = await getCategoryFolder(accessToken, doc.category);
    const restored = await moveFileToFolder(accessToken, version.sharepoint_item_id, categoryFolder.id);

    await restoreVersion({ documentId, versionId, restoredBy: permissions.email! });

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
    return {};
  } catch (err) {
    return { error: errorMessage(err) };
  }
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
export async function submitDocumentForApproval(documentId: string): Promise<ActionResult> {
  try {
    const permissions = await requirePermissionAction("documents", "Edit");
    const { doc, from } = await transitionDocumentStatus(documentId, "Pending Approval", {
      submitted_for_approval_by: permissions.email, submitted_for_approval_at: new Date().toISOString(),
    });
    await logAudit({
      actorEmail: permissions.email!, actorName: permissions.name, action: "document_status_changed",
      targetType: "document", targetId: documentId, targetLabel: doc.name, metadata: { before: from, after: "Pending Approval" },
    });
    revalidatePath("/documents");
    return {};
  } catch (err) {
    return { error: errorMessage(err) };
  }
}

/**
 * Approve or reject a document pending approval. Gated by the RBAC
 * "Approve" action, not just "Edit".
 */
export async function reviewDocumentApproval(documentId: string, decision: "approve" | "reject", notes?: string): Promise<ActionResult> {
  try {
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
    return {};
  } catch (err) {
    return { error: errorMessage(err) };
  }
}

/** Approved -> Published — the document becomes the organisation's active version of record. Also Approve-gated. */
export async function publishDocument(documentId: string): Promise<ActionResult> {
  try {
    const permissions = await requirePermissionAction("documents", "Approve");
    const { doc, from } = await transitionDocumentStatus(documentId, "Published", {
      published_by: permissions.email, published_at: new Date().toISOString(),
    });
    await logAudit({
      actorEmail: permissions.email!, actorName: permissions.name, action: "document_published",
      targetType: "document", targetId: documentId, targetLabel: doc.name, metadata: { before: from, after: "Published" },
    });
    revalidatePath("/documents");
    return {};
  } catch (err) {
    return { error: errorMessage(err) };
  }
}

/** Any status -> Archived — retiring a document without deleting its record or file. */
export async function archiveDocument(documentId: string): Promise<ActionResult> {
  try {
    const permissions = await requirePermissionAction("documents", "Edit");
    const { doc, from } = await transitionDocumentStatus(documentId, "Archived");
    await logAudit({
      actorEmail: permissions.email!, actorName: permissions.name, action: "document_archived",
      targetType: "document", targetId: documentId, targetLabel: doc.name, metadata: { before: from, after: "Archived" },
    });
    revalidatePath("/documents");
    return {};
  } catch (err) {
    return { error: errorMessage(err) };
  }
}

/**
 * Deletes the FortunIQ OS catalog record only — NEVER the actual
 * SharePoint file. Restricted to Delete permission and Super Admin.
 */
export async function deleteDocumentRecord(documentId: string): Promise<ActionResult> {
  try {
    const permissions = await requirePermissionAction("documents", "Delete");
    if (!permissions.isAdmin) return { error: "Only a Super Admin can delete a document record." };
    const doc = await fetchDocumentRow(documentId);

    const supabase = createServiceClient();
    await supabase.from("document_versions").delete().eq("document_id", documentId);
    await supabase.from("documents").delete().eq("id", documentId);

    await logAudit({
      actorEmail: permissions.email!, actorName: permissions.name, action: "document_deleted",
      targetType: "document", targetId: documentId, targetLabel: doc.name,
    });

    revalidatePath("/documents");
    return {};
  } catch (err) {
    return { error: errorMessage(err) };
  }
}

/**
 * Full version history for a document, with archived versions filtered
 * out entirely for anyone not authorised to see the Archive. Left
 * throwing (not the {error} pattern) since its caller
 * (VersionHistoryModal) already treats any failure the same way —
 * showing an empty list — so no user-facing message is lost.
 */
export async function getDocumentVersionsAction(documentId: string) {
  const permissions = await requireModuleAccess("documents");
  const versions = await getVersionHistory(documentId);
  const canSeeArchive = permissions.isAdmin || permissions.role === "HR/Admin" || (await checkPermissionAction(permissions, "documents", "Manage"));
  if (canSeeArchive) return versions;
  return versions.filter((v) => v.isCurrent);
}
