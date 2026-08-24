"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Users, AlertTriangle, Send } from "lucide-react";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatDate } from "@/lib/format";
import { isStageOverdue } from "@/lib/tender-core";
import { sendOverdueStageEscalation } from "./tender-actions";

type Assignment = {
  id: string; tenderId: string; tenderRef: string; tenderTitle: string; stage: string;
  ownerEmail: string; ownerName: string | null; dueDate: string | null; priority: string;
  status: string; compliance: number;
};

const PRIORITY_TONE: Record<string, "danger" | "warning" | "neutral"> = { High: "danger", Medium: "warning", Low: "neutral" };

/** "CEO / Manager Dashboard" — see docs/TENDER_ASSIGNMENT.md. The data passed in is already server-side filtered to what this viewer is allowed to see (everyone, or just their own reports) — this component only adds a convenience employee filter on top of that. */
export function TeamAssignmentsWidget({ assignments }: { assignments: Assignment[] }) {
  const [employeeFilter, setEmployeeFilter] = useState("");
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();

  const owners = useMemo(() => Array.from(new Set(assignments.map((a) => a.ownerName ?? a.ownerEmail))).sort(), [assignments]);

  const filtered = useMemo(
    () => (employeeFilter ? assignments.filter((a) => (a.ownerName ?? a.ownerEmail) === employeeFilter) : assignments),
    [assignments, employeeFilter]
  );

  function handleEscalate(assignmentId: string) {
    setSendingId(assignmentId);
    startTransition(async () => {
      const result = await sendOverdueStageEscalation(assignmentId);
      setSendingId(null);
      if (result?.error) alert(result.error);
      else setSentIds((prev) => new Set(prev).add(assignmentId));
    });
  }

  if (assignments.length === 0) return null;

  return (
    <Card className="mb-4">
      <CardHeader>
        <CardTitle><span className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5 text-orange" /> Team Tender Assignments</span></CardTitle>
        <select value={employeeFilter} onChange={(e) => setEmployeeFilter(e.target.value)} className="text-xs border border-border rounded-lg px-2 py-1.5">
          <option value="">All employees</option>
          {owners.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </CardHeader>
      <CardBody className="space-y-1">
        {filtered.map((a) => {
          const overdue = isStageOverdue({ status: a.status as "Active" | "Completed" | "Reassigned", dueDate: a.dueDate });
          return (
            <div key={a.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
              <Link href={`/tenders/${a.tenderId}`} className="min-w-0 hover:text-orange transition-colors">
                <p className="text-sm text-navy truncate">{a.tenderRef} — {a.stage}</p>
                <p className="text-xs text-light-grey truncate">{a.ownerName ?? a.ownerEmail} · {a.compliance}% compliant</p>
              </Link>
              <div className="flex items-center gap-2 shrink-0">
                {a.dueDate && <span className="text-xs text-light-grey">{formatDate(a.dueDate)}</span>}
                <Badge tone={PRIORITY_TONE[a.priority] ?? "neutral"}>{a.priority}</Badge>
                {overdue && (
                  <>
                    <span className="flex items-center gap-1 text-xs font-semibold text-red-600"><AlertTriangle className="w-3.5 h-3.5" /> Overdue</span>
                    {sentIds.has(a.id) ? (
                      <span className="text-xs text-emerald-600">Notified</span>
                    ) : (
                      <button
                        onClick={() => handleEscalate(a.id)}
                        disabled={isPending && sendingId === a.id}
                        className="flex items-center gap-1 text-xs font-semibold text-orange hover:underline disabled:opacity-50"
                      >
                        <Send className="w-3 h-3" /> Escalate
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && <p className="text-sm text-light-grey py-2">No assignments for this employee.</p>}
      </CardBody>
    </Card>
  );
}
