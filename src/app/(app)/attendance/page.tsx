import { requireModuleAccess } from "@/lib/permissions";
import { getAllAttendance, getMissingClockOuts, getPendingCorrections } from "@/lib/attendance";
import { AttendanceView } from "./attendance-view";

export default async function AttendancePage() {
  // Coarse gate: only people explicitly granted the "attendance" module
  // (HR Manager, Super Admin, or Administrator role templates by
  // default) can open this page at all — see docs/ATTENDANCE.md. Clock
  // In/Clock Out for oneself does NOT require this — that lives on the
  // Dashboard, available to everyone.
  await requireModuleAccess("attendance");

  const [records, missingClockOuts, pendingCorrections] = await Promise.all([
    getAllAttendance(),
    getMissingClockOuts(),
    getPendingCorrections(),
  ]);

  return <AttendanceView records={records} missingClockOuts={missingClockOuts} pendingCorrections={pendingCorrections} />;
}
