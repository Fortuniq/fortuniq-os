"use client";

import { useMemo, useState } from "react";
import { Bell } from "lucide-react";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/Card";
import { calculateDaysRemaining, isDueToday, isClosingSoon } from "@/lib/tender-core";

type Tender = { id: string | number; ref: string; title: string; closing: string; status: string; stage: string };

const EXCLUDED_STATUSES = new Set(["Awarded", "Lost", "Missed"]);
const EXCLUDED_STAGES = new Set(["Submitted", "Archived"]);

function indicatorFor(daysRemaining: number, warningDays: number): { emoji: string; label: string } {
  if (daysRemaining === 0) return { emoji: "🔴", label: "Today" };
  if (daysRemaining === 1) return { emoji: "🟠", label: "Tomorrow" };
  if (daysRemaining <= 3) return { emoji: "🟡", label: `In ${daysRemaining} Days` };
  if (daysRemaining <= warningDays) return { emoji: "🟢", label: `In ${daysRemaining} Days` };
  return { emoji: "⚪", label: `In ${daysRemaining} Days` };
}

/**
 * "NEXT DEADLINES" — replaces the old static "Next Deadline" card with
 * a live, sorted widget. Only Open, not-yet-submitted tenders appear —
 * Awarded/Lost/Submitted/Missed/Archived are explicitly excluded per
 * the brief. See docs/TENDER_DEADLINES.md.
 */
export function NextDeadlinesWidget({ tenders, warningDays, onSelect }: { tenders: Tender[]; warningDays: number; onSelect?: (id: string | number) => void }) {
  const [limit, setLimit] = useState(6);

  const upcoming = useMemo(() => {
    return tenders
      .filter((t) => !EXCLUDED_STATUSES.has(t.status) && !EXCLUDED_STAGES.has(t.stage))
      .map((t) => ({ ...t, daysRemaining: calculateDaysRemaining(t.closing) }))
      .filter((t) => t.daysRemaining >= 0)
      .sort((a, b) => a.daysRemaining - b.daysRemaining);
  }, [tenders]);

  if (upcoming.length === 0) return null;

  return (
    <Card>
      <CardHeader><CardTitle><span className="flex items-center gap-1.5"><Bell className="w-3.5 h-3.5 text-orange" /> Next Deadlines</span></CardTitle></CardHeader>
      <CardBody className="space-y-1">
        {upcoming.slice(0, limit).map((t) => {
          const { emoji, label } = indicatorFor(t.daysRemaining, warningDays);
          return (
            <a
              key={t.id}
              href={`/tenders/${t.id}`}
              onClick={onSelect ? (e) => { e.preventDefault(); onSelect(t.id); } : undefined}
              className="block py-2.5 border-b border-border last:border-0 hover:bg-surface/60 -mx-1 px-1 rounded transition-colors"
            >
              <p className="text-xs font-semibold text-navy">{emoji} {label}</p>
              <p className="text-sm text-grey truncate">{t.title}</p>
            </a>
          );
        })}
        {upcoming.length > limit && (
          <button onClick={() => setLimit((l) => l + 6)} className="text-xs text-orange hover:underline pt-1">
            Show more ({upcoming.length - limit} remaining)
          </button>
        )}
      </CardBody>
    </Card>
  );
}
