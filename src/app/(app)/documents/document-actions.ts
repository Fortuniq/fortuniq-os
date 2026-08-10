"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/service";
import { requireModuleAccess } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";

export async function catalogueSharePointFile(formData: FormData) {
  const permissions = await requireModuleAccess("documents");

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
  const permissions = await requireModuleAccess("documents");
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
