import Link from "next/link";
import { Workflow, ArrowRight } from "lucide-react";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/Card";

/**
 * Counts of this person's own open tasks, grouped by the module they
 * came from — reuses the unified task layer, not a separate workflow
 * system (see docs/EMPLOYEE_DASHBOARD.md). Extracted from
 * dashboard-view.tsx into its own file so it can be a customizable
 * widget like every other card here (Project ORION Phase 1).
 */
export function MyWorkflowCard({
  workflowByModule,
  moduleCards,
}: {
  workflowByModule: Record<string, number>;
  moduleCards: { key: string; label: string; href: string; taskCount: number }[];
}) {
  const workflowEntries = Object.entries(workflowByModule).filter(([, count]) => count > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <span className="flex items-center gap-1.5">
            <Workflow className="w-3.5 h-3.5 text-orange" /> My Workflow
          </span>
        </CardTitle>
      </CardHeader>
      <CardBody className="space-y-1">
        {workflowEntries.length === 0 && <p className="text-sm text-light-grey py-2">No workflow items waiting on you.</p>}
        {workflowEntries.map(([moduleKey, count]) => {
          const card = moduleCards.find((c) => c.key === moduleKey);
          return (
            <Link
              key={moduleKey}
              href={card?.href ?? "#"}
              className="flex items-center justify-between py-2 border-b border-border last:border-0 hover:text-orange transition-colors"
            >
              <span className="text-sm text-navy capitalize">{card?.label ?? moduleKey}</span>
              <span className="text-xs font-semibold text-orange flex items-center gap-1">
                {count} item{count === 1 ? "" : "s"} <ArrowRight className="w-3 h-3" />
              </span>
            </Link>
          );
        })}
      </CardBody>
    </Card>
  );
}
