"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { getCurrentUserPermissions } from "@/lib/permissions";
import { requirePermissionAction } from "@/lib/rbac";
import { getEmployeeByEmail } from "@/lib/data";
import { logAudit } from "@/lib/audit";
import * as attendance from "@/lib/attendance";

/**
 * Clock In — identity always comes from the authenticated session, never
 * from anything the client submits. See docs/ATTENDANCE.md.
 */
export async function clockInAction(): Promise<{ error?: string }> {
  const permissions = await getCurrentUserPermissions();
  if (permissions.status !== "active" && permissions.status !== "no-database") {
    return { error: "You need to be signed in to clock in." };
  }
  if (!permissions.email) return { error: "Your session doesn't have an email on record." };

  const employee = await getEmployeeByEmail(permissions.email);
  const session = await auth();

  const result = await attendance.clockIn({
    employeeId: employee?.id ?? null,
    employeeEmail: permissions.email,
    employeeName: employee?.name ?? permissions.name ?? permissions.email,
    department: employee?.dept ?? null,
    role: employee?.role ?? permissions.role ?? null,
    graphAccessToken: session?.accessToken ?? null,
  });

  if (result.error) return { error: result.error };

  await logAudit({
    actorEmail: permissions.email, actorName: permissions.name, action: "clocked_in",
    targetType: "attendance", targetLabel: "Clocked in",
    metadata: { clockInAt: result.record?.clockInAt },
  });

  revalidatePath("/dashboard");
  revalidatePath("/attendance");
  return {};
}

export async function clockOutAction(): Promise<{ error?: string }> {
  const permissions = await getCurrentUserPermissions();
  if (permissions.status !== "active" && permissions.status !== "no-database") {
    return { error: "You need to be signed in to clock out." };
  }
  if (!permissions.email) return { error: "Your session doesn't have an email on record." };

  const employee = await getEmployeeByEmail(permissions.email);
  const session = await auth();

  const result = await attendance.clockOut({
    employeeEmail: permissions.email,
    employeeName: employee?.name ?? permissions.name ?? permissions.email,
    department: employee?.dept ?? null,
    graphAccessToken: session?.accessToken ?? null,
  });

  if (result.error) return { error: result.error };

  await logAudit({
    actorEmail: permissions.email, actorName: permissions.name, action: "clocked_out",
    targetType: "attendance", targetLabel: "Clocked out",
    metadata: { clockOutAt: result.record?.clockOutAt, totalMinutes: result.record?.totalMinutes },
  });

  revalidatePath("/dashboard");
  revalidatePath("/attendance");
  return {};
}

/** An employee requesting a correction to their own already-recorded time. */
export async function requestCorrectionAction(formData: FormData): Promise<{ error?: string }> {
  const permissions = await getCurrentUserPermissions();
  if (!permissions.email) return { error: "You need to be signed in." };

  const attendanceId = String(formData.get("attendanceId") ?? "");
  const attendanceDate = String(formData.get("attendanceDate") ?? "");
  const requestedField = String(formData.get("requestedField") ?? "") as "clock_in_at" | "clock_out_at";
  const correctedTime = String(formData.get("correctedTime") ?? ""); // "HH:MM"
  const reason = String(formData.get("reason") ?? "").trim();

  if (!attendanceId || !attendanceDate || !correctedTime || !reason) {
    return { error: "Please fill in the corrected time and a reason." };
  }
  if (requestedField !== "clock_in_at" && requestedField !== "clock_out_at") {
    return { error: "Invalid field." };
  }

  const correctedValue = `${attendanceDate}T${correctedTime}:00`;

  const result = await attendance.requestAttendanceCorrection({
    attendanceId, employeeEmail: permissions.email, attendanceDate, requestedField, correctedValue, reason,
  });
  if (result.error) return result;

  await logAudit({
    actorEmail: permissions.email, actorName: permissions.name, action: "attendance_correction_requested",
    targetType: "attendance_correction", targetId: attendanceId, metadata: { requestedField, correctedValue, reason },
  });

  revalidatePath("/attendance");
  revalidatePath("/dashboard");
  return {};
}

/** HR / Super Admin only — enforced server-side via requirePermissionAction, not just hidden UI. */
export async function reviewCorrectionAction(correctionId: string, approve: boolean, reviewNotes?: string): Promise<{ error?: string }> {
  const permissions = await requirePermissionAction("attendance", "Approve");
  if (!permissions.email) return { error: "Session error." };

  const result = await attendance.reviewAttendanceCorrection({
    correctionId, approve, reviewerEmail: permissions.email, reviewNotes,
  });
  if (result.error) return result;

  await logAudit({
    actorEmail: permissions.email, actorName: permissions.name, action: "attendance_correction_reviewed",
    targetType: "attendance_correction", targetId: correctionId, metadata: { approved: approve },
  });

  revalidatePath("/attendance");
  return {};
}
