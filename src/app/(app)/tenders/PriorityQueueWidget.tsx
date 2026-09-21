"use client";

import { useMemo, useState } from "react";
import { ListChecks } from "lucide-react";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/Card";
import { calculateDaysRemaining, formatDaysRemaining, rankTenderPriority, computeEffectiveTenderStatus, computeEffectiveTenderStage, deriveOutstandingIssue } from "@/lib/tender-core";

type Tender = { id: string | number; ref: string; title: string; closing: string; status: string; stage: string; compliance: number };
type Assignment = { tenderId: string; ownerName: string | null; ownerEmail: string; dueDate: string | null; priority: string; status: string };

const LEVEL_STYLE: Record<string, { emoji: string; color: string }> = {
  HIGH: { emoji: "🔴", color: "text-red-600" },
  MEDIUM: { emoji: "🟠", color: "text-orange" },
  LOW: { emoji: "🟢", color: "text-emerald-600" },
};

/**
 * "Priority Queue" — replaces the old static Next Deadlines list.
 * Ranks by overall urgency (see rankTenderPriority in tender-core.ts),
 * not just closing date. See docs/TENDER_DASHBOARD.md.
 */
export function PriorityQueueWidget({
  tenders, assignments, outstandingChecklist, onSelect,
}: {
  tenders: Tender[];
  assignments: Assignment[];
  outstandingChecklist: Record<string, string>;
  onSelect?: (id: string | number) => void;
}) {
  const [limit, setLimit] = useState(6);

  const assignmentByTender = useMemo(() => {
    const map = new Map<string, Assignment>();
    for (const a of assignments) map.set(a.tenderId, a);
    return map;
  }, [assignments]);

  const queue = useMemo(() => {
    return tenders
      .filter((t) => {
        const effective = computeEffectiveTenderStatus({ closingDate: t.closing, status: t.status, stage: t.stage });
        return effective === "Open" && t.stage !== "Submitted";
      })
      .map((t) => {
        const daysRemaining = calculateDaysRemaining(t.closing);
        const assignment = assignmentByTender.get(String(t.id));
        const stageAssignmentOverdue = !!assignment?.dueDate && new Date(assignment.dueDate + "T23:59:59") < new Date();
        const ranking = rankTenderPriority({
          daysRemaining,
          stageAssignmentOverdue,
          compliancePct: t.compliance,
          assignmentPriority: (assignment?.priority as "High" | "Medium" | "Low") ?? null,
        });
        const outstanding = outstandingChecklist[String(t.id)];
        const stage = computeEffectiveTenderStage({ closingDate: t.closing, status: t.status, stage: t.stage });
        const issue = deriveOutstandingIssue({
          stage, hasOverdueAssignment: stageAssignmentOverdue,
          firstIncompleteChecklistItem: outstanding ?? (t.compliance < 100 ? "compliance items" : null),
        });
        return { tender: t, daysRemaining, assignment, ranking, stage, issue };
      })
      .sort((a, b) => b.ranking.score - a.ranking.score);
  }, [tenders, assignmentByTender, outstandingChecklist]);

  if (queue.length === 0) return null;

  return (
    <Card>
      <CardHeader><CardTitle><span className="flex items-center gap-1.5"><ListChecks className="w-3.5 h-3.5 text-orange" /> Priority Queue</span></CardTitle></CardHeader>
      <CardBody className="space-y-1">
        {queue.slice(0, limit).map(({ tender, daysRemaining, assignment, ranking, stage, issue }) => {
          const style = LEVEL_STYLE[ranking.level];
          return (
            <a
              key={tender.id}
              href={`/tenders/${tender.id}`}
              onClick={onSelect ? (e) => { e.preventDefault(); onSelect(tender.id); } : undefined}
              className="block py-2.5 border-b border-border last:border-0 hover:bg-surface/60 -mx-1 px-1 rounded transition-colors"
            >
              <p className={`text-xs font-bold ${style.color}`}>{style.emoji} {ranking.level}</p>
              <p className="text-sm font-medium text-navy truncate">{tender.title}</p>
              <p className="text-xs text-grey">{formatDaysRemaining(daysRemaining)} · {stage}</p>
              {assignment?.ownerName && <p className="text-xs text-light-grey">Assigned To {assignment.ownerName}</p>}
              <p className={issue.endsWith("Complete") ? "text-xs text-emerald-600" : "text-xs text-amber-700"}>{issue}</p>
            </a>
          );
        })}
        {queue.length > limit && (
          <button onClick={() => setLimit((l) => l + 6)} className="text-xs text-orange hover:underline pt-1">
            Show more ({queue.length - limit} remaining)
          </button>
        )}
      </CardBody>
    </Card>
  );
}
