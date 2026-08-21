"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUserPermissions } from "@/lib/permissions";
import { getEmployeeByEmail } from "@/lib/data";
import { createLeaveRequest, reviewLeaveRequest } from "@/lib/leave";
import { canManagerAccessTeamMember, type LeaveType } from "@/lib/hcm-core";
import { createServiceClient } from "@/lib/supabase/service";
import { logAudit } from "@/lib/audit";
import { isSharePointConfigured, ensureDocumentLibraryStructure, uploadFileToFolder, getEmployeeRootFolder } from "@/lib/graph";
import { auth } from "@/auth";

type ActionResult = { error?: string; workingDays?: number };

/** Employee submits a leave request for THEMSELVES only — identity comes from the session, never the client. */
export async function requestLeaveAction(formData: FormData): Promise<ActionResult> {
  try {
    const permissions = await getCurrentUserPermissions();
    if (!permissions.email) return { error: "You need to be signed in." };
    const employee = await getEmployeeByEmail(permissions.email);
    if (!employee) return { error: "No employee record is linked to your account." };

    const leaveType = String(formData.get("leaveType") ?? "") as LeaveType;
    if (!["Annual", "Sick", "Family Responsibility", "Study", "Maternity", "Paternity", "Unpaid"].includes(leaveType)) {
      return { error: "Invalid leave type." };
    }
    const startDate = String(formData.get("startDate") ?? "");
    const endDate = String(formData.get("endDate") ?? "");
    const reason = String(formData.get("reason") ?? "").trim() || null;
    if (!leaveType || !startDate || !endDate) return { error: "Leave type and dates are required." };

    let attachmentSharepointItemId: string | undefined;
    let attachmentWebUrl: string | undefined;
    const file = formData.get("attachment") as File | null;
    if (file && file.size > 0) {
      if (file.size > 8 * 1024 * 1024) return { error: "Attachment is larger than 8MB — not supported yet." };
      if (!isSharePointConfigured) return { error: "SharePoint isn't connected — can't attach a file right now. Try submitting without an attachment." };
      const session = await auth();
      if (!session?.accessToken) return { error: "Your Microsoft session needs refreshing — try signing out and back in." };
      const accessToken = session.accessToken as string;
      await ensureDocumentLibraryStructure(accessToken);
      const folder = await getEmployeeRootFolder(accessToken, employee.employeeNumber, employee.name);
      const bytes = await file.arrayBuffer();
      const uploaded = await uploadFileToFolder(accessToken, folder.id, file.name, bytes, file.type);
      attachmentSharepointItemId = uploaded.id;
      attachmentWebUrl = uploaded.webUrl;
    }

    const result = await createLeaveRequest({
      employeeId: employee.id, employeeEmail: permissions.email, employeeName: employee.name,
      leaveType, startDate, endDate, reason, attachmentSharepointItemId, attachmentWebUrl,
    });
    if (result.error) return result;

    await logAudit({
      actorEmail: permissions.email, actorName: permissions.name, action: "leave_requested",
      targetType: "leave_request", targetLabel: `${leaveType} — ${startDate} to ${endDate}`,
      metadata: { workingDays: result.workingDays },
    });

    revalidatePath("/profile");
    revalidatePath("/people");
    return { workingDays: result.workingDays };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Couldn't submit your leave request." };
  }
}

/**
 * HR/Super Admin approve/reject any request; a Manager may only act on
 * their own direct report's request — enforced here server-side via
 * canManagerAccessTeamMember(), not just by which buttons the UI shows.
 */
export async function reviewLeaveRequestAction(requestId: string, decision: "Approved" | "Rejected" | "Cancelled", reviewNotes?: string): Promise<ActionResult> {
  try {
    const permissions = await getCurrentUserPermissions();
    if (!permissions.email) return { error: "You need to be signed in." };

    const supabase = createServiceClient();
    const { data: request } = await supabase.from("leave_requests").select("employee_id").eq("id", requestId).maybeSingle();
    if (!request) return { error: "Leave request not found." };

    const isHR = permissions.isAdmin || permissions.role === "HR/Admin";
    if (!isHR) {
      const viewerEmployee = await getEmployeeByEmail(permissions.email);
      const { data: targetEmployee } = await supabase.from("employees").select("manager_id").eq("id", request.employee_id).maybeSingle();
      const allowed = canManagerAccessTeamMember(permissions, viewerEmployee?.id ?? null, targetEmployee?.manager_id ?? null);
      if (!allowed) return { error: "You can only review leave requests for your own direct reports." };
    }

    const result = await reviewLeaveRequest({ requestId, decision, reviewerEmail: permissions.email, reviewNotes });
    if (result.error) return result;

    await logAudit({
      actorEmail: permissions.email, actorName: permissions.name, action: "leave_reviewed",
      targetType: "leave_request", targetId: requestId, metadata: { decision, reviewNotes },
    });

    revalidatePath("/profile");
    revalidatePath("/people");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Couldn't update this leave request." };
  }
}

/** An employee cancelling their OWN still-pending request — separate from HR/Manager review above. */
export async function cancelMyLeaveRequestAction(requestId: string): Promise<ActionResult> {
  try {
    const permissions = await getCurrentUserPermissions();
    if (!permissions.email) return { error: "You need to be signed in." };
    const supabase = createServiceClient();
    const { data: request } = await supabase.from("leave_requests").select("employee_email").eq("id", requestId).maybeSingle();
    if (!request) return { error: "Leave request not found." };
    if (request.employee_email.toLowerCase() !== permissions.email.toLowerCase()) {
      return { error: "You can only cancel your own leave requests." };
    }
    const result = await reviewLeaveRequest({ requestId, decision: "Cancelled", reviewerEmail: permissions.email });
    if (result.error) return result;
    revalidatePath("/profile");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Couldn't cancel this leave request." };
  }
}
