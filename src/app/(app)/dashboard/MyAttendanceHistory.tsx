import { History } from "lucide-react";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatDuration, type AttendanceRecord } from "@/lib/attendance-core";

/**
 * Shows only the signed-in employee's own attendance history — the data
 * passed in here (attendanceHistory from getPersonalisedDashboardData)
 * is already scoped to permissions.email server-side via
 * getMyAttendanceHistory(); this component never fetches anything
 * itself, so there's no way for it to accidentally render someone
 * else's records. See docs/ATTENDANCE.md.
 */
export function MyAttendanceHistory({ records }: { records: AttendanceRecord[] }) {
  if (records.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <span className="flex items-center gap-1.5">
            <History className="w-3.5 h-3.5 text-orange" /> My Attendance
          </span>
        </CardTitle>
      </CardHeader>
      <CardBody className="space-y-1">
        {records.map((r) => (
          <div key={r.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
            <span className="text-sm text-navy">{r.attendanceDate}</span>
            <span className="text-xs text-light-grey">{formatDuration(r.totalMinutes)}</span>
            <Badge tone={r.status === "Missing Clock-Out" ? "danger" : r.status === "Clocked In" ? "warning" : "success"}>
              {r.status}
            </Badge>
          </div>
        ))}
      </CardBody>
    </Card>
  );
}
