import { History } from "lucide-react";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/Card";
import { formatDate } from "@/lib/format";
import type { StageAssignmentHistoryEntry } from "@/lib/tender-assignments";

const EVENT_LABEL: Record<string, string> = {
  Assigned: "Assigned",
  Reassigned: "Reassigned",
  Completed: "Completed",
  "Due Date Changed": "Due date changed",
};

/**
 * Permanent audit trail for stage ownership — Assignment, Reassignment,
 * Completion, Due Date Changes, with who and when. See
 * docs/TENDER_ASSIGNMENT.md, "Audit Trail." Read-only; nothing here is
 * ever edited or deleted.
 */
export function AssignmentHistoryCard({ history }: { history: StageAssignmentHistoryEntry[] }) {
  if (history.length === 0) return null;

  return (
    <Card>
      <CardHeader><CardTitle><span className="flex items-center gap-1.5"><History className="w-3.5 h-3.5 text-orange" /> Assignment History</span></CardTitle></CardHeader>
      <CardBody className="space-y-2">
        {history.map((h) => (
          <div key={h.id} className="py-2 border-b border-border last:border-0">
            <p className="text-sm text-navy">
              <span className="font-medium">{EVENT_LABEL[h.eventType] ?? h.eventType}</span> — {h.stage}
            </p>
            {h.eventType === "Reassigned" && (
              <p className="text-xs text-grey">{h.previousOwnerEmail} → {h.newOwnerEmail}{h.reason ? ` — "${h.reason}"` : ""}</p>
            )}
            {h.eventType === "Assigned" && (
              <p className="text-xs text-grey">
                Assigned to {h.newOwnerEmail}{h.newDueDate ? `, due ${formatDate(h.newDueDate)}` : ""}
              </p>
            )}
            {h.comments && <p className="text-xs text-light-grey italic">&ldquo;{h.comments}&rdquo;</p>}
            <p className="text-[11px] text-light-grey mt-0.5">{h.actorName ?? h.actorEmail} · {formatDate(h.createdAt)}</p>
          </div>
        ))}
      </CardBody>
    </Card>
  );
}
