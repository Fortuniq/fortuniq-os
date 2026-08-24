import Link from "next/link";
import { ClipboardList, AlertTriangle } from "lucide-react";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatDate } from "@/lib/format";

type MyTenderAssignment = {
  id: string; tenderId: string; tenderRef: string; tenderTitle: string;
  stage: string; dueDate: string | null; priority: string; overdue: boolean;
};

const PRIORITY_TONE: Record<string, "danger" | "warning" | "neutral"> = { High: "danger", Medium: "warning", Low: "neutral" };

/** "My Tender Tasks" — see docs/TENDER_ASSIGNMENT.md, "Employee Dashboard." Only renders when the person has active tender stage assignments. */
export function MyTenderTasksCard({ assignments }: { assignments: MyTenderAssignment[] }) {
  if (assignments.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle><span className="flex items-center gap-1.5"><ClipboardList className="w-3.5 h-3.5 text-orange" /> My Tender Tasks</span></CardTitle>
        <span className="text-xs text-light-grey">{assignments.length} assigned</span>
      </CardHeader>
      <CardBody className="space-y-1">
        {assignments.slice(0, 6).map((a) => (
          <Link key={a.id} href={`/tenders/${a.tenderId}`} className="flex items-center justify-between py-2 border-b border-border last:border-0 hover:text-orange transition-colors">
            <div className="min-w-0">
              <p className="text-sm text-navy truncate">{a.tenderRef} — {a.stage}</p>
              <p className="text-xs text-light-grey truncate">{a.tenderTitle}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {a.overdue && <span className="flex items-center gap-1 text-xs font-semibold text-red-600"><AlertTriangle className="w-3.5 h-3.5" /> Overdue</span>}
              {!a.overdue && a.dueDate && <span className="text-xs text-light-grey">{formatDate(a.dueDate)}</span>}
              <Badge tone={PRIORITY_TONE[a.priority] ?? "neutral"}>{a.priority}</Badge>
            </div>
          </Link>
        ))}
      </CardBody>
    </Card>
  );
}
