import { createServiceClient } from "@/lib/supabase/service";
import { isStageOverdue, type TenderWorkflowStage, type StageAssignmentStatus, type AssignmentPriority } from "@/lib/tender-core";

const supabaseConfigured =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY;

export type TenderStageAssignment = {
  id: string;
  tenderId: string;
  stage: TenderWorkflowStage;
  ownerEmail: string;
  ownerName: string | null;
  assignedBy: string;
  assignedAt: string;
  dueDate: string | null;
  status: StageAssignmentStatus;
  priority: AssignmentPriority;
  comments: string | null;
  completedAt: string | null;
};

function mapRow(row: Record<string, unknown>): TenderStageAssignment {
  return {
    id: row.id as string,
    tenderId: row.tender_id as string,
    stage: row.stage as TenderWorkflowStage,
    ownerEmail: row.owner_email as string,
    ownerName: (row.owner_name as string) ?? null,
    assignedBy: row.assigned_by as string,
    assignedAt: row.assigned_at as string,
    dueDate: (row.due_date as string) ?? null,
    status: row.status as StageAssignmentStatus,
    priority: row.priority as AssignmentPriority,
    comments: (row.comments as string) ?? null,
    completedAt: (row.completed_at as string) ?? null,
  };
}

export async function getTenderStageAssignments(tenderId: string): Promise<TenderStageAssignment[]> {
  if (!supabaseConfigured) return [];
  try {
    const supabase = createServiceClient();
    const { data } = await supabase.from("tender_stage_assignments").select("*").eq("tender_id", tenderId).order("assigned_at", { ascending: true });
    return (data ?? []).map(mapRow);
  } catch {
    return [];
  }
}

/** The signed-in employee's own active tender stage assignments — powers the "My Tender Tasks" dashboard widget. */
export async function getMyTenderStageAssignments(employeeEmail: string): Promise<(TenderStageAssignment & { tenderRef: string; tenderTitle: string })[]> {
  if (!supabaseConfigured) return [];
  try {
    const supabase = createServiceClient();
    const { data } = await supabase
      .from("tender_stage_assignments")
      .select("*, tenders(ref, title)")
      .eq("owner_email", employeeEmail.toLowerCase())
      .eq("status", "Active")
      .order("due_date", { ascending: true, nullsFirst: false });
    return (data ?? []).map((row) => {
      const tender = Array.isArray(row.tenders) ? row.tenders[0] : row.tenders;
      return { ...mapRow(row), tenderRef: tender?.ref ?? "", tenderTitle: tender?.title ?? "" };
    });
  } catch {
    return [];
  }
}

/**
 * Every active tender stage assignment org-wide, for the CEO/Manager
 * dashboard — see docs/TENDER_ASSIGNMENT.md, "CEO / Manager Dashboard."
 * Filtering by employee (for a Manager who should only see their own
 * reports) happens in the caller, not here — this always returns the
 * full set, since who's authorised to see how much of it depends on
 * the viewer's own permissions, which this data-layer function doesn't
 * know about.
 */
export async function getAllActiveTenderAssignments(): Promise<(TenderStageAssignment & { tenderRef: string; tenderTitle: string; compliance: number })[]> {
  if (!supabaseConfigured) return [];
  try {
    const supabase = createServiceClient();
    const { data } = await supabase
      .from("tender_stage_assignments")
      .select("*, tenders(ref, title, compliance)")
      .eq("status", "Active")
      .order("due_date", { ascending: true, nullsFirst: false });
    return (data ?? []).map((row) => {
      const tender = Array.isArray(row.tenders) ? row.tenders[0] : row.tenders;
      return { ...mapRow(row), tenderRef: tender?.ref ?? "", tenderTitle: tender?.title ?? "", compliance: tender?.compliance ?? 0 };
    });
  } catch {
    return [];
  }
}

export async function getOverdueTenderAssignments(): Promise<(TenderStageAssignment & { tenderRef: string; tenderTitle: string })[]> {
  const all = await getAllActiveTenderAssignments();
  return all.filter((a) => isStageOverdue(a));
}

// ---------- ASSIGNMENT / REASSIGNMENT HISTORY ----------

export type StageAssignmentHistoryEntry = {
  id: string;
  stage: TenderWorkflowStage;
  eventType: "Assigned" | "Reassigned" | "Completed" | "Due Date Changed" | "Missed" | "Reopened";
  previousOwnerEmail: string | null;
  previousOwnerName: string | null;
  newOwnerEmail: string | null;
  newOwnerName: string | null;
  previousDueDate: string | null;
  newDueDate: string | null;
  reason: string | null;
  comments: string | null;
  actorEmail: string;
  actorName: string | null;
  createdAt: string;
};

/** Full, permanent assignment/reassignment history for a tender — see docs/TENDER_ASSIGNMENT.md, "Audit Trail." */
export async function getTenderStageAssignmentHistory(tenderId: string): Promise<StageAssignmentHistoryEntry[]> {
  if (!supabaseConfigured) return [];
  try {
    const supabase = createServiceClient();
    const { data } = await supabase
      .from("tender_stage_assignment_history")
      .select("*")
      .eq("tender_id", tenderId)
      .order("created_at", { ascending: false });
    return (data ?? []).map((row) => ({
      id: row.id as string,
      stage: row.stage as TenderWorkflowStage,
      eventType: row.event_type as StageAssignmentHistoryEntry["eventType"],
      previousOwnerEmail: (row.previous_owner_email as string) ?? null,
      previousOwnerName: (row.previous_owner_name as string) ?? null,
      newOwnerEmail: (row.new_owner_email as string) ?? null,
      newOwnerName: (row.new_owner_name as string) ?? null,
      previousDueDate: (row.previous_due_date as string) ?? null,
      newDueDate: (row.new_due_date as string) ?? null,
      reason: (row.reason as string) ?? null,
      comments: (row.comments as string) ?? null,
      actorEmail: row.actor_email as string,
      actorName: (row.actor_name as string) ?? null,
      createdAt: row.created_at as string,
    }));
  } catch {
    return [];
  }
}
