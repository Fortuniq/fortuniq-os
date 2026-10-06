import Link from "next/link";
import { CalendarDays, Cake, PartyPopper, Users, ChevronRight } from "lucide-react";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/Card";
import { formatDate } from "@/lib/format";

type HCMReminders = {
  upcomingLeave: { leaveType: string; startDate: string; endDate: string }[];
  myPendingLeaveCount: number;
  orgPendingLeaveCount: number;
  orgPendingLeaveItems: { employeeId: string; employeeName: string; leaveType: string; startDate: string; endDate: string }[];
  probationEndingSoon: boolean;
  isBirthdayToday: boolean;
  isWorkAnniversaryToday: boolean;
};

const rowLink = "flex items-center justify-between gap-2 rounded-lg -mx-2 px-2 py-1.5 hover:bg-surface transition-colors group";

/**
 * Only renders when there's actually something to show — see
 * docs/HCM_PHASE3.md, "Dashboard." Performance Review Due and Mandatory
 * Training Outstanding are deliberately not shown here — see that doc
 * for why.
 *
 * Actionable reminders are links: your own leave/probation items open My
 * Profile; HR's pending-review items open the requesting employee's
 * profile, where the Leave section has the Approve/Reject buttons.
 */
export function HCMRemindersCard({ reminders, isHR }: { reminders: HCMReminders; isHR: boolean }) {
  const hasAnything =
    reminders.upcomingLeave.length > 0 || reminders.myPendingLeaveCount > 0 ||
    (isHR && reminders.orgPendingLeaveCount > 0) || reminders.probationEndingSoon ||
    reminders.isBirthdayToday || reminders.isWorkAnniversaryToday;

  if (!hasAnything) return null;

  const moreOrgPending = reminders.orgPendingLeaveCount - reminders.orgPendingLeaveItems.length;

  return (
    <Card>
      <CardHeader>
        <CardTitle><span className="flex items-center gap-1.5"><CalendarDays className="w-3.5 h-3.5 text-orange" /> Reminders</span></CardTitle>
      </CardHeader>
      <CardBody className="space-y-1">
        {reminders.isBirthdayToday && (
          <p className="text-sm text-navy flex items-center gap-2 py-1.5"><Cake className="w-4 h-4 text-orange" /> Happy Birthday! 🎉</p>
        )}
        {reminders.isWorkAnniversaryToday && (
          <p className="text-sm text-navy flex items-center gap-2 py-1.5"><PartyPopper className="w-4 h-4 text-orange" /> Happy Work Anniversary!</p>
        )}
        {reminders.probationEndingSoon && (
          <Link href="/profile" className={rowLink}>
            <span className="text-sm text-amber-700">Your probation period ends within the next 14 days.</span>
            <ChevronRight className="w-4 h-4 text-light-grey group-hover:text-orange shrink-0" />
          </Link>
        )}
        {reminders.upcomingLeave.map((l, i) => (
          <Link key={i} href="/profile" className={rowLink}>
            <span className="text-sm text-navy">Upcoming: {l.leaveType} leave, {formatDate(l.startDate)} – {formatDate(l.endDate)}</span>
            <ChevronRight className="w-4 h-4 text-light-grey group-hover:text-orange shrink-0" />
          </Link>
        ))}
        {reminders.myPendingLeaveCount > 0 && (
          <Link href="/profile" className={rowLink}>
            <span className="text-sm text-grey">{reminders.myPendingLeaveCount} of your leave request{reminders.myPendingLeaveCount === 1 ? "" : "s"} awaiting approval.</span>
            <ChevronRight className="w-4 h-4 text-light-grey group-hover:text-orange shrink-0" />
          </Link>
        )}
        {isHR && reminders.orgPendingLeaveCount > 0 && (
          <div className="pt-1">
            <p className="text-sm text-grey flex items-center gap-2 py-1">
              <Users className="w-4 h-4 text-orange" /> {reminders.orgPendingLeaveCount} leave request{reminders.orgPendingLeaveCount === 1 ? "" : "s"} pending your review
            </p>
            {reminders.orgPendingLeaveItems.map((r, i) => (
              <Link key={`${r.employeeId}-${i}`} href={`/people/${r.employeeId}`} className={rowLink}>
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-navy truncate">{r.employeeName}</span>
                  <span className="block text-xs text-light-grey">{r.leaveType} · {formatDate(r.startDate)} – {formatDate(r.endDate)}</span>
                </span>
                <span className="flex items-center gap-1 text-xs font-semibold text-orange shrink-0">Review <ChevronRight className="w-4 h-4" /></span>
              </Link>
            ))}
            {moreOrgPending > 0 && <p className="text-xs text-light-grey px-0 pt-1">+ {moreOrgPending} more — they appear here as these are reviewed.</p>}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
