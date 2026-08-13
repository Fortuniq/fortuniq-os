"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/service";
import { requirePermissionAction } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { auth } from "@/auth";
import { ensureTenderFolder, isSharePointConfigured } from "@/lib/graph";

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

  // Best-effort: create the tender's dedicated SharePoint folder (with
  // standard subfolders) using the CURRENT PERSON'S OWN Microsoft
  // permissions — see docs/TENDER_WORKSPACE.md. If SharePoint isn't
  // connected, or this specific call fails for any reason, the tender is
  // still created — the folder can be set up later; a missing document
  // workspace should never block someone from registering a tender at all.
  let sharepointFolderId: string | null = null;
  let sharepointFolderUrl: string | null = null;
  let folderWarning: string | null = null;
  if (isSharePointConfigured) {
    try {
      const session = await auth();
      if (session?.accessToken) {
        const folder = await ensureTenderFolder(session.accessToken as string, ref, title);
        sharepointFolderId = folder.folderId;
        sharepointFolderUrl = folder.folderUrl;
      } else {
        folderWarning = "Your Microsoft session needs refreshing — try signing out and back in, then set up the folder from the tender's Documents tab.";
      }
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      console.error("Failed to create SharePoint folder for new tender:", detail);
      folderWarning = `The tender was created, but its SharePoint folder couldn't be set up (${detail}). You can retry from the tender's Documents tab.`;
    }
  }

  const { error } = await supabase.from("tenders").insert({
    ref,
    title,
    closing_date: String(formData.get("closingDate") ?? ""),
    status: String(formData.get("status") ?? "Open"),
    stage: String(formData.get("stage") ?? "").trim() || null,
    value: Number(formData.get("value") ?? 0),
    compliance: Number(formData.get("compliance") ?? 0),
    sharepoint_folder_id: sharepointFolderId,
    sharepoint_folder_url: sharepointFolderUrl,
  });

  if (error) throw new Error(error.message);

  await logAudit({
    actorEmail: permissions.email!, actorName: permissions.name, action: "document_catalogued",
    targetType: "tender", targetLabel: `${ref} — ${title}`,
    metadata: { sharepoint_folder_created: !!sharepointFolderId },
  });
  revalidatePath("/tenders");
  return { folderWarning };
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

// ---------- CHECKLIST (per-tender, real add/edit) ----------
export async function toggleChecklistItem(itemId: string, tenderId: string, done: boolean) {
  const permissions = await requirePermissionAction("tenders", "Edit");
  const supabase = createServiceClient();
  await supabase.from("tender_checklist_items").update({ done }).eq("id", itemId);
  await logAudit({
    actorEmail: permissions.email!, actorName: permissions.name, action: "document_status_changed",
    targetType: "tender_checklist_item", targetId: itemId, metadata: { tenderId, done },
  });
  revalidatePath(`/tenders/${tenderId}`);
}

export async function addChecklistItem(tenderId: string, itemText: string) {
  const permissions = await requirePermissionAction("tenders", "Edit");
  const supabase = createServiceClient();
  const trimmed = itemText.trim();
  if (!trimmed) throw new Error("A checklist item needs some text.");
  await supabase.from("tender_checklist_items").insert({ tender_id: tenderId, item: trimmed, done: false });
  await logAudit({
    actorEmail: permissions.email!, actorName: permissions.name, action: "document_status_changed",
    targetType: "tender_checklist_item", targetId: tenderId, metadata: { field: "checklist_item_added", item: trimmed },
  });
  revalidatePath(`/tenders/${tenderId}`);
}

export async function deleteChecklistItem(itemId: string, tenderId: string) {
  const permissions = await requirePermissionAction("tenders", "Edit");
  const supabase = createServiceClient();
  await supabase.from("tender_checklist_items").delete().eq("id", itemId);
  await logAudit({
    actorEmail: permissions.email!, actorName: permissions.name, action: "document_status_changed",
    targetType: "tender_checklist_item", targetId: itemId, metadata: { tenderId, field: "checklist_item_deleted" },
  });
  revalidatePath(`/tenders/${tenderId}`);
}

// ---------- SUBMISSIONS TAB ----------
export async function updateSubmissionInfo(tenderId: string, formData: FormData) {
  const permissions = await requirePermissionAction("tenders", "Edit");
  const supabase = createServiceClient();

  const method = String(formData.get("submissionMethod") ?? "").trim() || null;
  const date = String(formData.get("submissionDate") ?? "").trim();
  const time = String(formData.get("submissionTime") ?? "").trim();
  const datetime = date ? `${date}T${time || "00:00"}:00` : null;

  await supabase.from("tenders").update({
    submission_method: method,
    submission_datetime: datetime,
  }).eq("id", tenderId);

  await logAudit({
    actorEmail: permissions.email!, actorName: permissions.name, action: "document_status_changed",
    targetType: "tender", targetId: tenderId, metadata: { field: "submission_info_updated", method, datetime },
  });
  revalidatePath(`/tenders/${tenderId}`);
}

// ---------- DOCUMENT WORKSPACE: retry folder creation if it failed initially ----------
export async function retryTenderFolderCreation(tenderId: string, ref: string, title: string): Promise<{ error?: string }> {
  const permissions = await requirePermissionAction("tenders", "Edit");
  // Deliberately RETURNED, not thrown, all the way through this
  // function. Next.js redacts thrown Server Action errors down to a
  // generic, unhelpful message on the client in production (only a
  // "digest" survives) — even a clean, human-written Error gets
  // stripped this way. Returning the error as normal data instead
  // completely sidesteps that redaction, so the real reason always
  // reaches the person using the app, not just the server logs.
  if (!isSharePointConfigured) return { error: "SharePoint isn't connected yet." };
  const session = await auth();
  if (!session?.accessToken) return { error: "Your Microsoft session needs refreshing — try signing out and back in." };

  const supabase = createServiceClient();

  let folder: { folderId: string; folderUrl: string };
  try {
    folder = await ensureTenderFolder(session.accessToken as string, ref, title);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error("retryTenderFolderCreation: ensureTenderFolder failed:", detail);
    return { error: `Couldn't create the SharePoint folder: ${detail}` };
  }

  await supabase.from("tenders").update({
    sharepoint_folder_id: folder.folderId,
    sharepoint_folder_url: folder.folderUrl,
  }).eq("id", tenderId);

  await logAudit({
    actorEmail: permissions.email!, actorName: permissions.name, action: "document_catalogued",
    targetType: "tender", targetId: tenderId, metadata: { field: "sharepoint_folder_created_retry" },
  });
  revalidatePath(`/tenders/${tenderId}`);
  return {};
}
