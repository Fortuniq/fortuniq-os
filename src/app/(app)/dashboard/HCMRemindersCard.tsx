import { CalendarDays, Cake, PartyPopper, Users } from "lucide-react";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/Card";
import { formatDate } from "@/lib/format";

type HCMReminders = {
  upcomingLeave: { leaveType: string; startDate: string; endDate: string }[];
  myPendingLeaveCount: number;
  orgPendingLeaveCount: number;
  probationEndingSoon: boolean;
  isBirthdayToday: boolean;
  isWorkAnniversaryToday: boolean;
};

/**
 * Only renders when there's actually something to show — see
 * docs/HCM_PHASE3.md, "Dashboard." Performance Review Due and Mandatory
 * Training Outstanding are deliberately not shown here — see that doc
 * for why.
 */
export function HCMRemindersCard({ reminders, isHR }: { reminders: HCMReminders; isHR: boolean }) {
  const hasAnything =
    reminders.upcomingLeave.length > 0 || reminders.myPendingLeaveCount > 0 ||
    (isHR && reminders.orgPendingLeaveCount > 0) || reminders.probationEndingSoon ||
    reminders.isBirthdayToday || reminders.isWorkAnniversaryToday;

  if (!hasAnything) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle><span className="flex items-center gap-1.5"><CalendarDays className="w-3.5 h-3.5 text-orange" /> Reminders</span></CardTitle>
      </CardHeader>
      <CardBody className="space-y-2">
        {reminders.isBirthdayToday && (
          <p className="text-sm text-navy flex items-center gap-2"><Cake className="w-4 h-4 text-orange" /> Happy Birthday! 🎉</p>
        )}
        {reminders.isWorkAnniversaryToday && (
          <p className="text-sm text-navy flex items-center gap-2"><PartyPopper className="w-4 h-4 text-orange" /> Happy Work Anniversary!</p>
        )}
        {reminders.probationEndingSoon && (
          <p className="text-sm text-amber-700">Your probation period ends within the next 14 days.</p>
        )}
        {reminders.upcomingLeave.map((l, i) => (
          <p key={i} className="text-sm text-navy">
            Upcoming: {l.leaveType} leave, {formatDate(l.startDate)} – {formatDate(l.endDate)}
          </p>
        ))}
        {reminders.myPendingLeaveCount > 0 && (
          <p className="text-sm text-grey">{reminders.myPendingLeaveCount} of your leave request{reminders.myPendingLeaveCount === 1 ? "" : "s"} awaiting approval.</p>
        )}
        {isHR && reminders.orgPendingLeaveCount > 0 && (
          <p className="text-sm text-grey flex items-center gap-2">
            <Users className="w-4 h-4 text-orange" /> {reminders.orgPendingLeaveCount} leave request{reminders.orgPendingLeaveCount === 1 ? "" : "s"} pending your review.
          </p>
        )}
      </CardBody>
    </Card>
  );
}
