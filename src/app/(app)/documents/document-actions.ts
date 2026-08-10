"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/service";
import { requireModuleAccess } from "@/lib/permissions";

export async function catalogueSharePointFile(formData: FormData) {
  await requireModuleAccess("documents");

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

  revalidatePath("/documents");
}

export async function updateDocumentStatus(documentId: string, status: "Draft" | "Approved" | "Archived") {
  await requireModuleAccess("documents");
  const supabase = createServiceClient();
  await supabase
    .from("documents")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", documentId);
  revalidatePath("/documents");
}
