import { createServiceClient } from "@/lib/supabase/service";
import { upsertAttendanceListItem, isSharePointConfigured } from "@/lib/graph";
import {
  canClockIn, canClockOut, computeMinutesWorked, isLateClockIn, toSATDateString,
  type AttendanceRecord, type WorkingHoursConfig,
} from "@/lib/attendance-core";

const supabaseConfigured =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY;

// Default working hours — deliberately just a sensible starting point,
// not a hard-coded policy. Structured so this can move to a real
// Settings-driven config later without changing any calling code, per
// the brief's "do not hard-code employment rules unnecessarily."
export const DEFAULT_WORKING_HOURS: WorkingHoursConfig = { startHour: 8, startMinute: 0, graceMinutes: 15 };

function mapRow(row: Record<string, unknown>): AttendanceRecord {
  return {
    id: row.id as string,
    employeeEmail: row.employee_email as string,
    attendanceDate: row.attendance_date as string,
    clockInAt: (row.clock_in_at as string) ?? null,
    clockOutAt: (row.clock_out_at as string) ?? null,
    totalMinutes: (row.total_minutes as number) ?? null,
    status: row.status as AttendanceRecord["status"],
    late: !!row.late,
  };
}

export async function getTodayAttendance(employeeEmail: string): Promise<AttendanceRecord | null> {
  if (!supabaseConfigured) return null;
  try {
    const supabase = createServiceClient();
    const today = toSATDateString(new Date());
    const { data } = await supabase
      .from("attendance")
      .select("*")
      .eq("employee_email", employeeEmail.toLowerCase())
      .eq("attendance_date", today)
      .maybeSingle();
    return data ? mapRow(data) : null;
  } catch {
    return null;
  }
}

export async function getMyAttendanceHistory(employeeEmail: string, limit = 30): Promise<AttendanceRecord[]> {
  if (!supabaseConfigured) return [];
  try {
    const supabase = createServiceClient();
    const { data } = await supabase
      .from("attendance")
      .select("*")
      .eq("employee_email", employeeEmail.toLowerCase())
      .order("attendance_date", { ascending: false })
      .limit(limit);
    return (data ?? []).map(mapRow);
  } catch {
    return [];
  }
}

/**
 * The real Clock In. Server-generated timestamp only — the caller never
 * passes in a client-supplied time, matching the brief's "must never
 * trust a timestamp manually supplied by the browser." Duplicate Clock
 * Ins are blocked by canClockIn() plus the DB's own unique
 * (employee_email, attendance_date) constraint as a second line of
 * defence against a race condition between two near-simultaneous requests.
 */
export async function clockIn(params: {
  employeeId: string | null;
  employeeEmail: string;
  employeeName: string;
  department: string | null;
  role: string | null;
  graphAccessToken?: string | null;
}): Promise<{ error?: string; record?: AttendanceRecord }> {
  if (!supabaseConfigured) return { error: "Attendance isn't available until a database is connected." };
  const supabase = createServiceClient();
  const now = new Date();
  const today = toSATDateString(now);
  const nowIso = now.toISOString();

  const existing = await getTodayAttendance(params.employeeEmail);
  const check = canClockIn(existing);
  if (!check.allowed) return { error: check.reason };

  const late = isLateClockIn(nowIso, DEFAULT_WORKING_HOURS);

  const { data, error } = await supabase
    .from("attendance")
    .insert({
      employee_id: params.employeeId,
      employee_email: params.employeeEmail.toLowerCase(),
      employee_name: params.employeeName,
      department: params.department,
      role: params.role,
      attendance_date: today,
      clock_in_at: nowIso,
      status: "Clocked In",
      late,
    })
    .select("*")
    .single();

  if (error) {
    // Unique constraint violation means someone else's request won the
    // race — treat it the same as "already clocked in," not a crash.
    return { error: "You clocked in already — refresh to see the latest status." };
  }

  syncAttendanceToSharePoint(params.graphAccessToken ?? null, mapRow(data), params.employeeName, params.department).catch(() => {});

  return { record: mapRow(data) };
}

/**
 * The real Clock Out. Same server-generated-timestamp guarantee as
 * clockIn(). Computes total minutes worked from the stored clock-in
 * time, never from anything the client provides.
 */
export async function clockOut(params: {
  employeeEmail: string;
  employeeName: string;
  department: string | null;
  graphAccessToken?: string | null;
}): Promise<{ error?: string; record?: AttendanceRecord }> {
  if (!supabaseConfigured) return { error: "Attendance isn't available until a database is connected." };
  const supabase = createServiceClient();

  const existing = await getTodayAttendance(params.employeeEmail);
  const check = canClockOut(existing);
  if (!check.allowed) return { error: check.reason };

  const now = new Date();
  const nowIso = now.toISOString();
  const totalMinutes = computeMinutesWorked(existing!.clockInAt!, nowIso);

  const { data, error } = await supabase
    .from("attendance")
    .update({ clock_out_at: nowIso, total_minutes: totalMinutes, status: "Clocked Out", updated_at: nowIso })
    .eq("id", existing!.id)
    .select("*")
    .single();

  if (error || !data) return { error: "Couldn't record your clock-out — please try again." };

  syncAttendanceToSharePoint(params.graphAccessToken ?? null, mapRow(data), params.employeeName, params.department).catch(() => {});

  return { record: mapRow(data) };
}

/** Fire-and-forget SharePoint List mirror — never allowed to affect the real Clock In/Out result. */
async function syncAttendanceToSharePoint(
  accessToken: string | null,
  record: AttendanceRecord,
  employeeName: string,
  department: string | null
): Promise<void> {
  if (!accessToken || !isSharePointConfigured) return;
  try {
    const hoursWorked = record.totalMinutes != null ? (record.totalMinutes / 60).toFixed(2) : "";
    const listItemId = await upsertAttendanceListItem(accessToken, null, {
      employeeName,
      employeeEmail: record.employeeEmail,
      department,
      attendanceDate: record.attendanceDate,
      clockIn: record.clockInAt,
      clockOut: record.clockOutAt,
      hoursWorked,
      status: record.status,
    });
    const supabase = createServiceClient();
    await supabase.from("attendance").update({ sharepoint_item_id: listItemId }).eq("id", record.id);
  } catch (err) {
    console.error("syncAttendanceToSharePoint failed (attendance record is still saved in FortunIQ OS):", err);
  }
}

// ---------- HR / SUPER ADMIN VIEW ----------

export type AttendanceFilter = { employeeEmail?: string; department?: string; from?: string; to?: string; status?: string };

export async function getAllAttendance(filter: AttendanceFilter = {}): Promise<AttendanceRecord[]> {
  if (!supabaseConfigured) return [];
  try {
    const supabase = createServiceClient();
    let query = supabase.from("attendance").select("*").order("attendance_date", { ascending: false });
    if (filter.employeeEmail) query = query.eq("employee_email", filter.employeeEmail.toLowerCase());
    if (filter.department) query = query.eq("department", filter.department);
    if (filter.status) query = query.eq("status", filter.status);
    if (filter.from) query = query.gte("attendance_date", filter.from);
    if (filter.to) query = query.lte("attendance_date", filter.to);
    const { data } = await query.limit(1000);
    return (data ?? []).map(mapRow);
  } catch {
    return [];
  }
}

export async function getMissingClockOuts(): Promise<AttendanceRecord[]> {
  if (!supabaseConfigured) return [];
  try {
    const supabase = createServiceClient();
    const today = toSATDateString(new Date());
    const { data } = await supabase
      .from("attendance")
      .select("*")
      .eq("status", "Clocked In")
      .lt("attendance_date", today)
      .order("attendance_date", { ascending: false });
    return (data ?? []).map(mapRow);
  } catch {
    return [];
  }
}

// ---------- CORRECTIONS ----------

export type AttendanceCorrection = {
  id: string;
  attendanceId: string;
  employeeEmail: string;
  attendanceDate: string;
  requestedField: "clock_in_at" | "clock_out_at";
  originalValue: string | null;
  correctedValue: string;
  reason: string;
  status: "Pending" | "Approved" | "Rejected";
  requestedBy: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
};

function mapCorrectionRow(row: Record<string, unknown>): AttendanceCorrection {
  return {
    id: row.id as string,
    attendanceId: row.attendance_id as string,
    employeeEmail: row.employee_email as string,
    attendanceDate: row.attendance_date as string,
    requestedField: row.requested_field as AttendanceCorrection["requestedField"],
    originalValue: (row.original_value as string) ?? null,
    correctedValue: row.corrected_value as string,
    reason: row.reason as string,
    status: row.status as AttendanceCorrection["status"],
    requestedBy: row.requested_by as string,
    reviewedBy: (row.reviewed_by as string) ?? null,
    reviewedAt: (row.reviewed_at as string) ?? null,
  };
}

export async function requestAttendanceCorrection(params: {
  attendanceId: string;
  employeeEmail: string;
  attendanceDate: string;
  requestedField: "clock_in_at" | "clock_out_at";
  correctedValue: string;
  reason: string;
}): Promise<{ error?: string }> {
  if (!supabaseConfigured) return { error: "Attendance isn't available until a database is connected." };
  try {
    const supabase = createServiceClient();
    const { data: record } = await supabase.from("attendance").select("*").eq("id", params.attendanceId).maybeSingle();
    if (!record || record.employee_email !== params.employeeEmail.toLowerCase()) {
      return { error: "You can only request corrections on your own attendance records." };
    }
    const originalValue = params.requestedField === "clock_in_at" ? record.clock_in_at : record.clock_out_at;
    await supabase.from("attendance_corrections").insert({
      attendance_id: params.attendanceId,
      employee_email: params.employeeEmail.toLowerCase(),
      attendance_date: params.attendanceDate,
      requested_field: params.requestedField,
      original_value: originalValue,
      corrected_value: params.correctedValue,
      reason: params.reason,
      status: "Pending",
      requested_by: params.employeeEmail.toLowerCase(),
    });
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to submit correction request." };
  }
}

export async function getPendingCorrections(): Promise<AttendanceCorrection[]> {
  if (!supabaseConfigured) return [];
  try {
    const supabase = createServiceClient();
    const { data } = await supabase.from("attendance_corrections").select("*").eq("status", "Pending").order("created_at", { ascending: true });
    return (data ?? []).map(mapCorrectionRow);
  } catch {
    return [];
  }
}

/**
 * Approving a correction updates the underlying attendance row AND
 * keeps the correction record itself as permanent history — never
 * overwritten, per the brief's audit-trail requirement.
 */
export async function reviewAttendanceCorrection(params: {
  correctionId: string;
  approve: boolean;
  reviewerEmail: string;
  reviewNotes?: string;
}): Promise<{ error?: string }> {
  if (!supabaseConfigured) return { error: "Attendance isn't available until a database is connected." };
  try {
    const supabase = createServiceClient();
    const { data: correction } = await supabase.from("attendance_corrections").select("*").eq("id", params.correctionId).maybeSingle();
    if (!correction) return { error: "Correction request not found." };
    if (correction.status !== "Pending") return { error: "This correction has already been reviewed." };

    await supabase.from("attendance_corrections").update({
      status: params.approve ? "Approved" : "Rejected",
      reviewed_by: params.reviewerEmail,
      reviewed_at: new Date().toISOString(),
      review_notes: params.reviewNotes ?? null,
    }).eq("id", params.correctionId);

    if (params.approve) {
      const updateField = correction.requested_field === "clock_in_at" ? { clock_in_at: correction.corrected_value } : { clock_out_at: correction.corrected_value };
      const { data: record } = await supabase.from("attendance").select("*").eq("id", correction.attendance_id).maybeSingle();
      if (record) {
        const clockIn = correction.requested_field === "clock_in_at" ? correction.corrected_value : record.clock_in_at;
        const clockOut = correction.requested_field === "clock_out_at" ? correction.corrected_value : record.clock_out_at;
        const totalMinutes = clockIn && clockOut ? computeMinutesWorked(clockIn, clockOut) : record.total_minutes;
        await supabase.from("attendance").update({
          ...updateField,
          total_minutes: totalMinutes,
          status: clockOut ? "Clocked Out" : record.status,
          updated_at: new Date().toISOString(),
        }).eq("id", correction.attendance_id);
      }
    }
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to review correction." };
  }
}
