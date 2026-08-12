"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/service";
import { requireModuleAccess } from "@/lib/permissions";
import { requirePermissionAction } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";

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

export async function updateDocumentStatus(documentId: string, status: "Draft" | "Approved" | "Archived") {
  const permissions = await requirePermissionAction("documents", "Edit");
  const supabase = createServiceClient();

  const { data: before } = await supabase.from("documents").select("name, status").eq("id", documentId).maybeSingle();

  await supabase
    .from("documents")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", documentId);

  await logAudit({
    actorEmail: permissions.email!,
    actorName: permissions.name,
    action: "document_status_changed",
    targetType: "document",
    targetId: documentId,
    targetLabel: before?.name ?? documentId,
    metadata: { before: before?.status ?? null, after: status },
  });

  revalidatePath("/documents");
}

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
