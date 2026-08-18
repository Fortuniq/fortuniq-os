import { createServiceClient } from "@/lib/supabase/service";
import { calculateWorkingDays, deductLeaveBalance, restoreLeaveBalance, canTransitionLeaveStatus, type LeaveType, type LeaveStatus, type LeaveBalance } from "@/lib/hcm-core";

const supabaseConfigured =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY;

export type LeaveRequest = {
  id: string;
  employeeId: string;
  employeeEmail: string;
  employeeName: string;
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  workingDays: number;
  reason: string | null;
  attachmentWebUrl: string | null;
  status: LeaveStatus;
  requestedAt: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNotes: string | null;
};

function mapRow(row: Record<string, unknown>): LeaveRequest {
  return {
    id: row.id as string,
    employeeId: row.employee_id as string,
    employeeEmail: row.employee_email as string,
    employeeName: row.employee_name as string,
    leaveType: row.leave_type as LeaveType,
    startDate: row.start_date as string,
    endDate: row.end_date as string,
    workingDays: Number(row.working_days),
    reason: (row.reason as string) ?? null,
    attachmentWebUrl: (row.attachment_web_url as string) ?? null,
    status: row.status as LeaveStatus,
    requestedAt: row.requested_at as string,
    reviewedBy: (row.reviewed_by as string) ?? null,
    reviewedAt: (row.reviewed_at as string) ?? null,
    reviewNotes: (row.review_notes as string) ?? null,
  };
}

export async function getMyLeaveRequests(employeeId: string): Promise<LeaveRequest[]> {
  if (!supabaseConfigured) return [];
  try {
    const supabase = createServiceClient();
    const { data } = await supabase.from("leave_requests").select("*").eq("employee_id", employeeId).order("requested_at", { ascending: false });
    return (data ?? []).map(mapRow);
  } catch {
    return [];
  }
}

/** Every pending request across the organisation — for HR's approval queue. */
export async function getPendingLeaveRequests(): Promise<LeaveRequest[]> {
  if (!supabaseConfigured) return [];
  try {
    const supabase = createServiceClient();
    const { data } = await supabase.from("leave_requests").select("*").eq("status", "Pending").order("requested_at", { ascending: true });
    return (data ?? []).map(mapRow);
  } catch {
    return [];
  }
}

/** Pending + approved requests for a manager's direct reports — used for the Manager-scoped Leave view. */
export async function getTeamLeaveRequests(managerId: string): Promise<LeaveRequest[]> {
  if (!supabaseConfigured) return [];
  try {
    const supabase = createServiceClient();
    const { data: reports } = await supabase.from("employees").select("id").eq("manager_id", managerId);
    const reportIds = (reports ?? []).map((r) => r.id);
    if (reportIds.length === 0) return [];
    const { data } = await supabase.from("leave_requests").select("*").in("employee_id", reportIds).order("requested_at", { ascending: false });
    return (data ?? []).map(mapRow);
  } catch {
    return [];
  }
}

/**
 * Creates a leave request. Working days are computed SERVER-SIDE from
 * the submitted dates (calculateWorkingDays) — never trusted from the
 * client, same "never trust a client-computed number" principle used
 * for tender values and attendance timestamps elsewhere in this app.
 */
export async function createLeaveRequest(params: {
  employeeId: string; employeeEmail: string; employeeName: string;
  leaveType: LeaveType; startDate: string; endDate: string; reason: string | null;
  attachmentSharepointItemId?: string; attachmentWebUrl?: string;
}): Promise<{ error?: string; workingDays?: number }> {
  if (!supabaseConfigured) return { error: "Leave management isn't available until a database is connected." };
  try {
    const workingDays = calculateWorkingDays(params.startDate, params.endDate);
    if (workingDays <= 0) return { error: "End date must be on or after the start date, and cover at least one working day." };

    const supabase = createServiceClient();
    const { error } = await supabase.from("leave_requests").insert({
      employee_id: params.employeeId,
      employee_email: params.employeeEmail,
      employee_name: params.employeeName,
      leave_type: params.leaveType,
      start_date: params.startDate,
      end_date: params.endDate,
      working_days: workingDays,
      reason: params.reason,
      attachment_sharepoint_item_id: params.attachmentSharepointItemId ?? null,
      attachment_web_url: params.attachmentWebUrl ?? null,
      status: "Pending",
    });
    if (error) return { error: error.message };
    return { workingDays };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Couldn't submit your leave request." };
  }
}

/**
 * The single place leave balance math happens. Approving deducts;
 * rejecting never touches the balance (a rejected request never drew
 * down anything); cancelling an already-Approved request restores the
 * previously-deducted days. All in application code, never a database
 * trigger, so the exact reasoning is always visible and testable (see
 * hcm-core.ts). See docs/HCM_PHASE3.md.
 */
export async function reviewLeaveRequest(params: {
  requestId: string; decision: "Approved" | "Rejected" | "Cancelled"; reviewerEmail: string; reviewNotes?: string;
}): Promise<{ error?: string }> {
  if (!supabaseConfigured) return { error: "Leave management isn't available until a database is connected." };
  try {
    const supabase = createServiceClient();
    const { data: request } = await supabase.from("leave_requests").select("*").eq("id", params.requestId).maybeSingle();
    if (!request) return { error: "Leave request not found." };

    const from = request.status as LeaveStatus;
    if (!canTransitionLeaveStatus(from, params.decision)) {
      return { error: `Can't move a leave request from "${from}" to "${params.decision}".` };
    }

    if (params.decision === "Approved") {
      const { data: employee } = await supabase.from("employees").select("leave_balance").eq("id", request.employee_id).maybeSingle();
      const currentBalance = (employee?.leave_balance ?? { annual: 0, sick: 0, family_responsibility: 0, study: 0 }) as LeaveBalance;
      const newBalance = deductLeaveBalance(currentBalance, request.leave_type as LeaveType, Number(request.working_days));
      await supabase.from("employees").update({ leave_balance: newBalance }).eq("id", request.employee_id);
    } else if (params.decision === "Cancelled" && from === "Approved") {
      const { data: employee } = await supabase.from("employees").select("leave_balance").eq("id", request.employee_id).maybeSingle();
      const currentBalance = (employee?.leave_balance ?? { annual: 0, sick: 0, family_responsibility: 0, study: 0 }) as LeaveBalance;
      const newBalance = restoreLeaveBalance(currentBalance, request.leave_type as LeaveType, Number(request.working_days));
      await supabase.from("employees").update({ leave_balance: newBalance }).eq("id", request.employee_id);
    }
    // Rejected, or Cancelled from Pending: no balance change needed — nothing was ever deducted.

    await supabase.from("leave_requests").update({
      status: params.decision, reviewed_by: params.reviewerEmail, reviewed_at: new Date().toISOString(), review_notes: params.reviewNotes ?? null,
    }).eq("id", params.requestId);

    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Couldn't update this leave request." };
  }
}
