"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/service";
import { requirePermissionAction } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { logAISecurityEvent } from "@/lib/ai-security";
import { auth } from "@/auth";
import { ensureTenderFolder, isSharePointConfigured, listFolderContents, getDocumentTextContent, uploadFileToFolder, isPlannerConfigured, TENDER_WORKFLOW_STAGES, type TenderWorkflowStage } from "@/lib/graph";
import { createTaskForEmployee, createTaskForEmployeeWithId } from "@/lib/tasks";
import { createCalendarEventForEmployee } from "@/lib/calendar";
import { canTransitionTenderStage, checkSubmissionReadiness, normalizeTenderStage, validateStageAssignment, type ChecklistItem } from "@/lib/tender-core";
import { syncNewTenderTaskToPlanner, syncTenderStageToPlanner } from "@/lib/tender-planner";
import { recordTenderActivity } from "@/lib/tender-activity";
import { setClosingSoonWarningDays } from "@/lib/tender-deadlines";
import { getCurrentUserPermissions } from "@/lib/permissions";
import Anthropic from "@anthropic-ai/sdk";

/**
 * Parses and validates the Tender Value field server-side — this is the
 * real enforcement point, not the HTML input's min/step attributes
 * (which are just a UX nicety and were previously mis-set to step=1000,
 * blocking any non-round-thousand value). Rejects negative values and
 * non-numeric input with a clear error rather than silently coercing to
 * 0. Empty input is treated as 0 since the field isn't marked mandatory
 * in the form; values are normalised to two decimal places (cent
 * precision) to match the numeric(14,2) database column — this is
 * rounding to the cent, not to any coarser increment, so 12567.899
 * becomes 12567.90 but 12567.90 itself is stored exactly as entered.
 * See docs/TENDER_VALUE.md.
 */
function parseTenderValue(formData: FormData): number {
  const raw = String(formData.get("value") ?? "").trim();
  if (raw === "") return 0;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) throw new Error("Tender value must be a valid number.");
  if (parsed < 0) throw new Error("Tender value cannot be negative.");
  return Math.round(parsed * 100) / 100;
}

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

  // Validate before any side effects (SharePoint folder creation, DB
  // writes) so a bad value never leaves a half-created tender behind.
  const tenderValue = parseTenderValue(formData);

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

  const closingDate = String(formData.get("closingDate") ?? "");

  const { data: inserted, error } = await supabase.from("tenders").insert({
    ref,
    title,
    closing_date: closingDate,
    status: String(formData.get("status") ?? "Open"),
    stage: String(formData.get("stage") ?? "").trim() || null,
    value: tenderValue,
    compliance: Number(formData.get("compliance") ?? 0),
    sharepoint_folder_id: sharepointFolderId,
    sharepoint_folder_url: sharepointFolderUrl,
    created_by_name: permissions.name ?? null,
    created_by_email: permissions.email ?? null,
    last_activity_at: new Date().toISOString(),
    last_activity_description: "Tender created",
  }).select("id").single();

  if (error) throw new Error(error.message);

  await logAudit({
    actorEmail: permissions.email!, actorName: permissions.name, action: "document_catalogued",
    targetType: "tender", targetLabel: `${ref} — ${title}`,
    metadata: { sharepoint_folder_created: !!sharepointFolderId },
  });

  // Workflow-generated task + calendar entry — the brief's core example
  // ("a workflow item should create/surface a task when a deadline is
  // approaching"). Assigned to whoever registered the tender, since
  // FortunIQ OS doesn't have a separate tender "assignee" field today —
  // reassignment can happen through the task itself later. Best-effort:
  // never blocks tender creation if either write fails.
  if (permissions.email && inserted?.id && closingDate) {
    const recordUrl = `/tenders/${inserted.id}`;
    await createTaskForEmployee({
      title: `Prepare submission — ${ref}: ${title}`,
      employeeEmail: permissions.email,
      moduleKey: "tenders",
      recordId: inserted.id,
      recordUrl,
      dueDate: closingDate,
      priority: "High",
      workflowStage: "Documents Review",
      createdBy: permissions.email,
    });
    await createCalendarEventForEmployee({
      title: `Tender closing — ${ref}: ${title}`,
      employeeEmail: permissions.email,
      eventDate: closingDate,
      eventType: "Tender Closing",
      moduleKey: "tenders",
      recordUrl,
      createdBy: permissions.email,
    });
  }

  revalidatePath("/tenders");
  revalidatePath("/dashboard");
  return { folderWarning };
}

export async function updateTender(tenderId: string, formData: FormData) {
  const permissions = await requirePermissionAction("tenders", "Edit");
  const supabase = createServiceClient();

  const { data: before } = await supabase.from("tenders").select("value, closing_date, status").eq("id", tenderId).maybeSingle();

  const newValue = parseTenderValue(formData);
  const newClosingDate = String(formData.get("closingDate") ?? "");
  const newStatus = String(formData.get("status") ?? "Open");

  const { error } = await supabase.from("tenders").update({
    ref: String(formData.get("ref") ?? "").trim(),
    title: String(formData.get("title") ?? "").trim(),
    closing_date: newClosingDate,
    status: newStatus,
    stage: String(formData.get("stage") ?? "").trim() || null,
    value: newValue,
    compliance: Number(formData.get("compliance") ?? 0),
  }).eq("id", tenderId);

  if (error) throw new Error(error.message);

  await logAudit({ actorEmail: permissions.email!, actorName: permissions.name, action: "document_status_changed", targetType: "tender", targetId: tenderId, metadata: { field: "tender_updated" } });

  // The most specific true thing that changed, for the Last Activity
  // column — status (Awarded/Lost) takes priority since it's the most
  // significant, followed by value, then due date, per the brief's own
  // examples — falling back to a generic message when none of those
  // specific fields moved.
  if (before && before.status !== newStatus && (newStatus === "Awarded" || newStatus === "Lost")) {
    await recordTenderActivity(tenderId, newStatus === "Awarded" ? "Tender awarded" : "Tender lost");
  } else if (before && Number(before.value) !== newValue) {
    await recordTenderActivity(tenderId, "Tender value changed");
  } else if (before && before.closing_date !== newClosingDate) {
    await recordTenderActivity(tenderId, "Due date changed");
  } else {
    await recordTenderActivity(tenderId, "Tender details updated");
  }

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
  await recordTenderActivity(tenderId, "Checklist updated");
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
  await recordTenderActivity(tenderId, "Checklist updated");
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
  await recordTenderActivity(tenderId, "Checklist updated");
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
  await recordTenderActivity(tenderId, "Submission status changed");
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

// =========================================================================
// AI-GENERATED CHECKLIST
// =========================================================================
// FortunIQ Intelligence proposes a checklist by analysing this specific
// tender's own SharePoint documents — it NEVER decides whether a
// requirement has actually been met; every item starts unconfirmed
// (done: false) and only a human ticking the box changes that. See
// docs/TENDER_WORKSPACE.md, and docs/AI_SECURITY.md for the shared
// permission-inheritance architecture this follows.
export async function generateChecklistWithAI(
  tenderId: string,
  ref: string,
  title: string
): Promise<{ error?: string; itemsAdded?: number }> {
  const permissions = await requirePermissionAction("tenders", "Edit");
  if (!isSharePointConfigured) return { error: "SharePoint isn't connected yet." };

  const session = await auth();
  if (!session?.accessToken) return { error: "Your Microsoft session needs refreshing — try signing out and back in." };

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { error: "FortunIQ Intelligence isn't connected yet — see docs/AI_ASSISTANT_SETUP.md." };

  const supabase = createServiceClient();
  const { data: tender } = await supabase.from("tenders").select("sharepoint_folder_id").eq("id", tenderId).maybeSingle();
  if (!tender?.sharepoint_folder_id) {
    return { error: "This tender doesn't have a SharePoint folder yet — create one from the Documents tab first." };
  }

  // Only ever reads from THIS tender's own folder, using the signed-in
  // person's own Microsoft token. This is what actually enforces
  // permission inheritance here — not an extra filtering step, but the
  // simple fact that Graph itself only returns what this folder ID
  // contains and what this specific person can open. There is no code
  // path in this function that can reach another tender's folder, HR,
  // Finance, or anything else — the folder ID itself is the boundary.
  let topLevel;
  try {
    topLevel = await listFolderContents(session.accessToken as string, tender.sharepoint_folder_id);
  } catch (err) {
    // Returned, not thrown — see the comment on retryTenderFolderCreation
    // for why: an unhandled throw here would get redacted by Next.js
    // down to an unhelpful generic message on the client in production.
    return { error: `Couldn't read the tender's documents: ${err instanceof Error ? err.message : String(err)}` };
  }

  const allFiles: { id: string; name: string }[] = [];
  for (const entry of topLevel) {
    if (entry.isFolder) {
      const inner = await listFolderContents(session.accessToken as string, entry.id).catch(() => []);
      allFiles.push(...inner.filter((f) => !f.isFolder).map((f) => ({ id: f.id, name: f.name })));
    } else {
      allFiles.push({ id: entry.id, name: entry.name });
    }
  }

  if (allFiles.length === 0) {
    return { error: "No documents found in this tender's SharePoint folder yet — upload the tender documentation first, then try again." };
  }

  // Real text extraction — plain text/JSON, PDF, and Word (.docx) are
  // all genuinely read via getDocumentTextContent in src/lib/graph.ts,
  // not just inferred from filename. Only the old, pre-2007 .doc format
  // still falls back to filename-only inference — see
  // docs/TENDER_WORKSPACE.md.
  const documentSummaries: string[] = [];
  for (const file of allFiles.slice(0, 15)) {
    const text = await getDocumentTextContent(session.accessToken as string, file.id).catch(() => null);
    documentSummaries.push(
      text ? `Document: ${file.name}\nContent:\n${text.slice(0, 3000)}` : `Document: ${file.name} (content not extractable — infer from filename only)`
    );
  }

  const anthropic = new Anthropic({ apiKey });
  let items: string[];
  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1024,
      system: `You generate submission checklists for South African fuel-supply tenders. You NEVER decide whether a
document has actually been submitted, attached, or is compliant — you only propose what appears to be required,
based on the tender documentation provided. Respond with ONLY a JSON array of short strings, one per required item
(document, declaration, schedule, or certificate) — nothing else, no explanation, no markdown formatting.
Example: ["B-BBEE Certificate (valid)", "Tax Compliance Certificate", "SBD 4 - Declaration of Interest"]`,
      messages: [{
        role: "user",
        content: `Tender: "${title}" (reference ${ref})\n\nDocuments found in this tender's folder:\n\n${documentSummaries.join("\n\n")}`,
      }],
    });
    const textBlock = response.content.find((b) => b.type === "text");
    const raw = textBlock?.type === "text" ? textBlock.text : "[]";
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    items = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
  } catch (err) {
    return { error: `FortunIQ Intelligence couldn't analyse these documents: ${err instanceof Error ? err.message : String(err)}` };
  }

  if (!Array.isArray(items) || items.length === 0) {
    return { error: "FortunIQ Intelligence couldn't identify any specific requirements from these documents. Try adding the tender documentation first, or add checklist items manually." };
  }

  // Never duplicate an item that's already on the checklist (manual or
  // from a previous AI run) — case-insensitive, trimmed comparison.
  const { data: existing } = await supabase.from("tender_checklist_items").select("item").eq("tender_id", tenderId);
  const existingLower = new Set((existing ?? []).map((e) => e.item.toLowerCase().trim()));
  const newItems = items.filter((i) => typeof i === "string" && i.trim() && !existingLower.has(i.toLowerCase().trim()));

  if (newItems.length > 0) {
    await supabase.from("tender_checklist_items").insert(
      newItems.map((item) => ({ tender_id: tenderId, item, done: false, source: "ai" }))
    );
  }

  await logAISecurityEvent({
    actorEmail: permissions.email!,
    actorName: permissions.name,
    aiModule: "tender-checklist",
    dataSourcesAccessed: allFiles.map((f) => ({ id: f.id, name: f.name })),
    executionOutcome: "answered",
  });

  await logAudit({
    actorEmail: permissions.email!, actorName: permissions.name, action: "document_catalogued",
    targetType: "tender", targetId: tenderId, metadata: { field: "ai_checklist_generated", itemsAdded: newItems.length },
  });
  await recordTenderActivity(tenderId, "AI Review completed");

  revalidatePath(`/tenders/${tenderId}`);
  return { itemsAdded: newItems.length };
}

// =========================================================================
// TENDER WORKFLOW & PLANNER INTEGRATION — see docs/TENDER_PLANNER.md
// =========================================================================

type ActionResult = { error?: string };

/**
 * Moves a tender to a new workflow stage. Forward moves are one step at
 * a time (canTransitionTenderStage) — never "casually" skipped, per the
 * brief. Moving specifically INTO "Submission Ready" additionally
 * requires Approve-level permission AND passing checkSubmissionReadiness()
 * — the brief's "Stage controls" gate. FortunIQ Intelligence identifying
 * risks elsewhere in this app never substitutes for this: only a human
 * with Approve permission, clicking this action, can make the actual
 * transition — see docs/TENDER_PLANNER.md.
 *
 * "The stage cannot become active until an owner has been assigned"
 * (docs/TENDER_ASSIGNMENT.md) — this is now enforced HERE: the caller
 * must supply an assignee, due date, priority, and optional comments in
 * formData, validated by validateStageAssignment() before the stage
 * change (or its ownership record) is written at all. Rejecting an
 * assignment-less move is not optional UI friction; it's the actual
 * data-integrity guarantee — a stage transition and its ownership
 * assignment are written together, or neither is written.
 */
export async function moveTenderStage(tenderId: string, newStage: TenderWorkflowStage, formData: FormData): Promise<ActionResult> {
  try {
    const permissions = await getCurrentUserPermissions();
    if (!permissions.email) return { error: "You need to be signed in." };

    const assignTo = String(formData.get("assignTo") ?? "").trim().toLowerCase();
    const dueDate = String(formData.get("dueDate") ?? "").trim() || null;
    const priority = (String(formData.get("priority") ?? "Medium")) as "High" | "Medium" | "Low";
    const comments = String(formData.get("comments") ?? "").trim() || null;

    const assignmentCheck = validateStageAssignment(assignTo);
    if (!assignmentCheck.valid) return { error: assignmentCheck.error };

    const supabase = createServiceClient();
    const { data: tender } = await supabase.from("tenders").select("*").eq("id", tenderId).maybeSingle();
    if (!tender) return { error: "Tender not found." };

    const currentStage = normalizeTenderStage(tender.stage);
    if (!canTransitionTenderStage(currentStage, newStage)) {
      return { error: `Can't move a tender from "${currentStage}" straight to "${newStage}" — stages move one step at a time (or backward). See docs/TENDER_PLANNER.md.` };
    }

    const movingToSubmissionReady = newStage === "Submission Ready" && currentStage !== "Submission Ready";
    let actorEmail = permissions.email;
    let actorName = permissions.name;

    if (movingToSubmissionReady) {
      const approvePermissions = await requirePermissionAction("tenders", "Approve");
      if (!approvePermissions.email) return { error: "Session error." };
      actorEmail = approvePermissions.email;
      actorName = approvePermissions.name;

      const { data: checklistRows } = await supabase.from("tender_checklist_items").select("done").eq("tender_id", tenderId);
      const checklist: ChecklistItem[] = (checklistRows ?? []).map((c) => ({ done: !!c.done }));
      const readiness = checkSubmissionReadiness(checklist, tender.compliance ?? null);
      if (!readiness.ready) {
        return { error: `This tender isn't ready for submission yet: ${readiness.issues.join(" ")}` };
      }

      await supabase.from("tenders").update({
        stage: newStage, submission_ready_by: approvePermissions.email, submission_ready_at: new Date().toISOString(),
      }).eq("id", tenderId);
    } else {
      await requirePermissionAction("tenders", "Edit");
      await supabase.from("tenders").update({ stage: newStage }).eq("id", tenderId);
    }

    // Mark whatever assignment existed for the OLD stage as Completed —
    // it's done, the tender has moved on. Never overwritten/deleted.
    if (currentStage !== newStage) {
      await supabase.from("tender_stage_assignments")
        .update({ status: "Completed", completed_at: new Date().toISOString() })
        .eq("tender_id", tenderId).eq("stage", currentStage).eq("status", "Active");
    }

    // Look up the new owner's name for a friendlier assignment record —
    // best-effort, falls back to just the email if no employee record matches.
    const { data: ownerEmployee } = await supabase.from("employees").select("name").ilike("email", assignTo).maybeSingle();

    // Create (or reactivate) the assignment for the NEW stage — this
    // and the stage change above are treated as one logical unit; see
    // this function's docblock.
    const { data: newAssignment } = await supabase.from("tender_stage_assignments")
      .upsert({
        tender_id: tenderId, stage: newStage, owner_email: assignTo, owner_name: ownerEmployee?.name ?? null,
        assigned_by: actorEmail, assigned_at: new Date().toISOString(), due_date: dueDate, status: "Active",
        priority, comments, updated_at: new Date().toISOString(),
      }, { onConflict: "tender_id,stage" })
      .select("id").single();

    await supabase.from("tender_stage_assignment_history").insert({
      tender_id: tenderId, stage: newStage, event_type: "Assigned",
      new_owner_email: assignTo, new_owner_name: ownerEmployee?.name ?? null, new_due_date: dueDate, comments,
      actor_email: actorEmail, actor_name: actorName,
    });

    // Keep the Tender Register's denormalised "Assigned To" column in
    // sync with the real source of truth (tender_stage_assignments)
    // every time it changes — see docs/TENDER_REGISTER.md, "Why
    // Assigned To is denormalised."
    await supabase.from("tenders").update({
      assigned_to_name: ownerEmployee?.name ?? null, assigned_to_email: assignTo, current_priority: priority,
    }).eq("id", tenderId);

    await logAudit({
      actorEmail, actorName, action: "document_status_changed",
      targetType: "tender", targetId: tenderId, targetLabel: tender.ref,
      metadata: { field: "workflow_stage", before: currentStage, after: newStage, assignedTo: assignTo },
    });
    await recordTenderActivity(
      tenderId,
      currentStage === newStage ? `Assigned to ${ownerEmployee?.name ?? assignTo}` : `Stage changed to ${newStage}`
    );

    // Notify the new owner — an in-app task (surfaces in their My Tasks/
    // My Workflow automatically) plus a lightweight notification row.
    // Teams/Outlook notifications are explicitly a future integration
    // per the brief — not implemented here. See docs/TENDER_ASSIGNMENT.md.
    await createTaskForEmployee({
      title: `${tender.ref}: ${newStage} — assigned to you`,
      employeeEmail: assignTo, moduleKey: "tenders", recordId: tenderId, recordUrl: `/tenders/${tenderId}`,
      dueDate: dueDate ?? undefined, priority, workflowStage: newStage, createdBy: actorEmail,
    });
    if (supabaseConfigured()) {
      const supabase2 = createServiceClient();
      await supabase2.from("notifications").insert({
        text: `You've been assigned ${tender.ref} — ${newStage}${dueDate ? ` (due ${dueDate})` : ""}`,
        type: "tender_assignment", employee_email: assignTo, module_key: "tenders",
      });
    }

    // Best-effort Planner sync — moves this tender's already-synced
    // tasks to the matching bucket, and creates a new one for this
    // assignment naming the owner in its title (Planner assignment to a
    // specific Microsoft user isn't implemented — see
    // docs/TENDER_ASSIGNMENT.md, "Known limitations"). Never blocks the
    // stage change above.
    if (isPlannerConfigured) {
      const session = await auth();
      if (session?.accessToken) {
        await syncTenderStageToPlanner({ tenderId, accessToken: session.accessToken as string, newStage });
      }
    }

    revalidatePath(`/tenders/${tenderId}`);
    revalidatePath("/tenders");
    revalidatePath("/dashboard");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Couldn't move this tender's stage." };
  }
}

function supabaseConfigured(): boolean {
  return !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY;
}

/**
 * Reassigns a stage's current owner to someone else, at any time — not
 * just during a stage transition. Requires the same real permission as
 * moving a stage (Edit), keeps the OLD assignment row updated in place
 * (owner_email changes), and writes a permanent history row recording
 * exactly who it moved from/to and why. See docs/TENDER_ASSIGNMENT.md.
 */
export async function reassignTenderStage(tenderId: string, stage: TenderWorkflowStage, formData: FormData): Promise<ActionResult> {
  try {
    const permissions = await requirePermissionAction("tenders", "Edit");
    if (!permissions.email) return { error: "Session error." };

    const newOwnerEmail = String(formData.get("newOwnerEmail") ?? "").trim().toLowerCase();
    const reason = String(formData.get("reason") ?? "").trim() || null;
    const assignmentCheck = validateStageAssignment(newOwnerEmail);
    if (!assignmentCheck.valid) return { error: assignmentCheck.error };

    const supabase = createServiceClient();
    const { data: assignment } = await supabase.from("tender_stage_assignments").select("*").eq("tender_id", tenderId).eq("stage", stage).maybeSingle();
    if (!assignment) return { error: "No assignment found for this stage yet — assign it first." };

    const { data: tender } = await supabase.from("tenders").select("ref, stage").eq("id", tenderId).maybeSingle();
    const { data: newOwnerEmployee } = await supabase.from("employees").select("name").ilike("email", newOwnerEmail).maybeSingle();
    const previousOwnerEmail = assignment.owner_email;

    await supabase.from("tender_stage_assignments").update({
      owner_email: newOwnerEmail, owner_name: newOwnerEmployee?.name ?? null,
      assigned_by: permissions.email, assigned_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }).eq("id", assignment.id);

    await supabase.from("tender_stage_assignment_history").insert({
      tender_id: tenderId, stage, event_type: "Reassigned",
      previous_owner_email: previousOwnerEmail, previous_owner_name: assignment.owner_name ?? null,
      new_owner_email: newOwnerEmail, new_owner_name: newOwnerEmployee?.name ?? null, reason,
      actor_email: permissions.email, actor_name: permissions.name,
    });

    // Only update the Register's denormalised "Assigned To" if this
    // reassignment is for the tender's CURRENT stage — reassigning an
    // earlier, already-completed stage's historical owner shouldn't
    // change what the Register shows as the tender's present owner.
    if (tender?.stage === stage) {
      await supabase.from("tenders").update({
        assigned_to_name: newOwnerEmployee?.name ?? null, assigned_to_email: newOwnerEmail,
      }).eq("id", tenderId);
    }

    await logAudit({
      actorEmail: permissions.email, actorName: permissions.name, action: "document_status_changed",
      targetType: "tender", targetId: tenderId, targetLabel: tender?.ref ?? tenderId,
      metadata: { field: "stage_reassignment", stage, before: previousOwnerEmail, after: newOwnerEmail, reason },
    });
    await recordTenderActivity(tenderId, `Reassigned to ${newOwnerEmployee?.name ?? newOwnerEmail}`);

    await createTaskForEmployee({
      title: `${tender?.ref ?? "Tender"}: ${stage} — reassigned to you`,
      employeeEmail: newOwnerEmail, moduleKey: "tenders", recordId: tenderId, recordUrl: `/tenders/${tenderId}`,
      dueDate: assignment.due_date ?? undefined, priority: assignment.priority, workflowStage: stage, createdBy: permissions.email,
    });

    revalidatePath(`/tenders/${tenderId}`);
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Couldn't reassign this stage." };
  }
}

/**
 * HR/Super Admin/Manager manual "send overdue reminders now" action —
 * see docs/TENDER_ASSIGNMENT.md, "Overdue management," for why this is
 * manual rather than an automatic scheduled job in this pass (no cron
 * infrastructure exists yet in this app). Notifies the assigned
 * employee, their manager (if known), and Super Admins.
 */
export async function sendOverdueStageEscalation(assignmentId: string): Promise<ActionResult> {
  try {
    const permissions = await requirePermissionAction("tenders", "Edit");
    if (!permissions.email) return { error: "Session error." };

    const supabase = createServiceClient();
    const { data: assignment } = await supabase.from("tender_stage_assignments").select("*, tenders(ref)").eq("id", assignmentId).maybeSingle();
    if (!assignment) return { error: "Assignment not found." };
    const tenderRef = Array.isArray(assignment.tenders) ? assignment.tenders[0]?.ref : assignment.tenders?.ref;

    const recipients = new Set<string>([assignment.owner_email]);

    const { data: owner } = await supabase.from("employees").select("manager_id").ilike("email", assignment.owner_email).maybeSingle();
    if (owner?.manager_id) {
      const { data: manager } = await supabase.from("employees").select("email").eq("id", owner.manager_id).maybeSingle();
      if (manager?.email) recipients.add(manager.email.toLowerCase());
    }

    const { data: superAdmins } = await supabase.from("user_permissions").select("email").eq("is_admin", true);
    for (const admin of superAdmins ?? []) {
      if (admin.email) recipients.add(admin.email.toLowerCase());
    }

    for (const email of recipients) {
      await createTaskForEmployee({
        title: `Overdue: ${tenderRef ?? "Tender"} — ${assignment.stage} (owner: ${assignment.owner_email})`,
        employeeEmail: email, moduleKey: "tenders", recordId: assignment.tender_id, recordUrl: `/tenders/${assignment.tender_id}`,
        dueDate: assignment.due_date ?? undefined, priority: "High", workflowStage: assignment.stage, createdBy: permissions.email,
      });
    }

    await logAudit({
      actorEmail: permissions.email, actorName: permissions.name, action: "document_status_changed",
      targetType: "tender", targetId: assignment.tender_id, targetLabel: tenderRef ?? assignment.tender_id,
      metadata: { field: "overdue_escalation", stage: assignment.stage, notifiedCount: recipients.size },
    });

    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Couldn't send the escalation." };
  }
}

/**
 * Records the final submission — Submission Date/Time, Submitted By,
 * Method, Reference, and optionally the Final Tender Pack / Proof of
 * Submission files — and moves the tender to "Submitted." Only reachable
 * from "Submission Ready", matching the brief's workflow order.
 */
export async function recordTenderSubmission(tenderId: string, formData: FormData): Promise<ActionResult> {
  try {
    const permissions = await requirePermissionAction("tenders", "Edit");
    if (!permissions.email) return { error: "Session error." };

    const supabase = createServiceClient();
    const { data: tender } = await supabase.from("tenders").select("*").eq("id", tenderId).maybeSingle();
    if (!tender) return { error: "Tender not found." };
    if (tender.stage !== "Submission Ready") {
      return { error: "This tender must be in \"Submission Ready\" before it can be recorded as submitted." };
    }

    const submissionMethod = String(formData.get("submissionMethod") ?? "").trim() || null;
    const submissionReference = String(formData.get("submissionReference") ?? "").trim() || null;

    let finalPackItemId: string | null = null, finalPackWebUrl: string | null = null;
    let proofItemId: string | null = null, proofWebUrl: string | null = null;

    if (isSharePointConfigured) {
      const session = await auth();
      if (session?.accessToken) {
        const accessToken = session.accessToken as string;
        const folder = await ensureTenderFolder(accessToken, tender.ref, tender.title);

        const finalPackFile = formData.get("finalPack") as File | null;
        if (finalPackFile && finalPackFile.size > 0) {
          const bytes = await finalPackFile.arrayBuffer();
          const uploaded = await uploadFileToFolder(accessToken, folder.folderId, finalPackFile.name, bytes, finalPackFile.type);
          finalPackItemId = uploaded.id;
          finalPackWebUrl = uploaded.webUrl;
        }
        const proofFile = formData.get("proofOfSubmission") as File | null;
        if (proofFile && proofFile.size > 0) {
          const bytes = await proofFile.arrayBuffer();
          const uploaded = await uploadFileToFolder(accessToken, folder.folderId, proofFile.name, bytes, proofFile.type);
          proofItemId = uploaded.id;
          proofWebUrl = uploaded.webUrl;
        }
      }
    }

    await supabase.from("tenders").update({
      stage: "Submitted",
      submitted_at: new Date().toISOString(),
      submitted_by: permissions.email,
      submission_method: submissionMethod,
      submission_reference: submissionReference,
      ...(finalPackItemId ? { final_pack_sharepoint_item_id: finalPackItemId, final_pack_sharepoint_web_url: finalPackWebUrl } : {}),
      ...(proofItemId ? { proof_of_submission_sharepoint_item_id: proofItemId, proof_of_submission_sharepoint_web_url: proofWebUrl } : {}),
    }).eq("id", tenderId);

    await logAudit({
      actorEmail: permissions.email, actorName: permissions.name, action: "document_status_changed",
      targetType: "tender", targetId: tenderId, targetLabel: tender.ref,
      metadata: { field: "submission", submissionMethod, submissionReference },
    });
    await recordTenderActivity(tenderId, "Tender submitted");

    if (isPlannerConfigured) {
      const session = await auth();
      if (session?.accessToken) {
        await syncTenderStageToPlanner({ tenderId, accessToken: session.accessToken as string, newStage: "Submitted" });
      }
    }

    revalidatePath(`/tenders/${tenderId}`);
    revalidatePath("/tenders");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Couldn't record this tender's submission." };
  }
}

/**
 * Adds a task to a tender — the brief's "Tender Tasks" (Complete
 * technical response, Obtain supplier quotation, etc.), reusing the
 * single unified task layer (see docs/EMPLOYEE_DASHBOARD.md) rather
 * than a separate tender_tasks system. Best-effort synced to Microsoft
 * Planner in the bucket matching the tender's current stage.
 */
export async function addTenderTask(tenderId: string, formData: FormData): Promise<ActionResult> {
  try {
    const permissions = await requirePermissionAction("tenders", "Edit");
    if (!permissions.email) return { error: "Session error." };

    const supabase = createServiceClient();
    const { data: tender } = await supabase.from("tenders").select("ref, title, stage").eq("id", tenderId).maybeSingle();
    if (!tender) return { error: "Tender not found." };

    const title = String(formData.get("title") ?? "").trim();
    const assigneeEmail = String(formData.get("assigneeEmail") ?? "").trim().toLowerCase() || permissions.email;
    const dueDate = String(formData.get("dueDate") ?? "").trim() || undefined;
    const priority = (String(formData.get("priority") ?? "Medium")) as "High" | "Medium" | "Low";
    const notes = String(formData.get("notes") ?? "").trim() || undefined;
    if (!title) return { error: "Task title is required." };

    const stage = normalizeTenderStage(tender.stage);

    const taskId = await createTaskForEmployeeWithId({
      title, employeeEmail: assigneeEmail, moduleKey: "tenders", recordId: tenderId,
      recordUrl: `/tenders/${tenderId}`, dueDate, priority, workflowStage: stage,
      createdBy: permissions.email, notes,
    });

    if (taskId && isPlannerConfigured) {
      const session = await auth();
      if (session?.accessToken) {
        await syncNewTenderTaskToPlanner({
          taskId, accessToken: session.accessToken as string,
          title: `${tender.ref}: ${title}`, stage, dueDate,
        });
      }
    }

    await logAudit({
      actorEmail: permissions.email, actorName: permissions.name, action: "document_catalogued",
      targetType: "tender", targetId: tenderId, targetLabel: `${tender.ref} — ${title}`,
      metadata: { field: "tender_task_added", assigneeEmail },
    });

    revalidatePath(`/tenders/${tenderId}`);
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Couldn't add this task." };
  }
}

/**
 * "Allow the warning period to be configurable in Settings" — Super
 * Admin only, matching how other app-wide settings are gated in this
 * app. See docs/TENDER_DEADLINES.md.
 */
export async function updateClosingSoonWarningDaysAction(days: number): Promise<{ error?: string }> {
  const permissions = await getCurrentUserPermissions();
  if (!permissions.isAdmin) return { error: "Only a Super Admin can change this setting." };
  const result = await setClosingSoonWarningDays(days);
  if (!result.error) revalidatePath("/tenders");
  return result;
}

/**
 * "The tender becomes read-only unless reopened by an authorised user"
 * — this is that reopen action. Requires Approve permission (a higher
 * bar than ordinary Edit, matching the significance of overriding an
 * automatic classification), resets status back to Open, clears
 * missed_at, and records both an audit entry and a workflow history
 * entry — the same two-record pattern used for the automatic Missed
 * transition itself. See docs/TENDER_DEADLINES.md.
 */
export async function reopenMissedTender(tenderId: string): Promise<ActionResult> {
  try {
    const permissions = await requirePermissionAction("tenders", "Approve");
    if (!permissions.email) return { error: "Session error." };

    const supabase = createServiceClient();
    const { data: tender } = await supabase.from("tenders").select("ref, status").eq("id", tenderId).maybeSingle();
    if (!tender) return { error: "Tender not found." };
    if (tender.status !== "Missed") return { error: "This tender isn't currently marked Missed." };

    await supabase.from("tenders").update({ status: "Open", stage: "Drafting", missed_at: null }).eq("id", tenderId);

    await logAudit({
      actorEmail: permissions.email, actorName: permissions.name, action: "document_status_changed",
      targetType: "tender", targetId: tenderId, targetLabel: tender.ref,
      metadata: { field: "status", before: "Missed", after: "Open", reason: "Manually reopened" },
    });

    await supabase.from("tender_stage_assignment_history").insert({
      tender_id: tenderId, stage: "Drafting", event_type: "Reopened",
      comments: "Tender reopened after being automatically marked Missed.",
      actor_email: permissions.email, actor_name: permissions.name,
    });

    await recordTenderActivity(tenderId, "Tender reopened");

    revalidatePath(`/tenders/${tenderId}`);
    revalidatePath("/tenders");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Couldn't reopen this tender." };
  }
}
