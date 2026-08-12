"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/service";
import { requirePermissionAction } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";

export async function addTender(formData: FormData) {
  // Real, backend-enforced RBAC — not just a hidden button. Someone with
  // Tenders module access but no "Create" action granted (e.g. a Sales
  // Representative who can only View tenders) is blocked here even if
  // they somehow triggered this action directly, not just via the UI.
  const permissions = await requirePermissionAction("tenders", "Create");
  const supabase = createServiceClient();

  const ref = String(formData.get("ref") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  if (!ref || !title) throw new Error("A reference number and title are required.");

  const { error } = await supabase.from("tenders").insert({
    ref,
    title,
    closing_date: String(formData.get("closingDate") ?? ""),
    status: String(formData.get("status") ?? "Open"),
    stage: String(formData.get("stage") ?? "").trim() || null,
    value: Number(formData.get("value") ?? 0),
    compliance: Number(formData.get("compliance") ?? 0),
  });

  if (error) throw new Error(error.message);

  await logAudit({ actorEmail: permissions.email!, actorName: permissions.name, action: "document_catalogued", targetType: "tender", targetLabel: `${ref} — ${title}` });
  revalidatePath("/tenders");
}

export async function updateTender(tenderId: string, formData: FormData) {
  const permissions = await requirePermissionAction("tenders", "Edit");
  const supabase = createServiceClient();

  const { error } = await supabase.from("tenders").update({
    ref: String(formData.get("ref") ?? "").trim(),
    title: String(formData.get("title") ?? "").trim(),
    closing_date: String(formData.get("closingDate") ?? ""),
    status: String(formData.get("status") ?? "Open"),
    stage: String(formData.get("stage") ?? "").trim() || null,
    value: Number(formData.get("value") ?? 0),
    compliance: Number(formData.get("compliance") ?? 0),
  }).eq("id", tenderId);

  if (error) throw new Error(error.message);

  await logAudit({ actorEmail: permissions.email!, actorName: permissions.name, action: "document_status_changed", targetType: "tender", targetId: tenderId, metadata: { field: "tender_updated" } });
  revalidatePath("/tenders");
}

export async function deleteTender(tenderId: string) {
  const permissions = await requirePermissionAction("tenders", "Delete");
  const supabase = createServiceClient();
  await supabase.from("tender_checklist_items").delete().eq("tender_id", tenderId);
  await supabase.from("tenders").delete().eq("id", tenderId);
  await logAudit({ actorEmail: permissions.email!, actorName: permissions.name, action: "document_status_changed", targetType: "tender", targetId: tenderId, metadata: { field: "tender_deleted" } });
  revalidatePath("/tenders");
}
