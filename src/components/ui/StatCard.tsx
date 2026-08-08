import { LucideIcon } from "lucide-react";
import clsx from "clsx";
import { Card } from "./Card";

export function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  trend,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: LucideIcon;
  trend?: { value: string; positive: boolean };
}) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-grey">{label}</p>
          <p className="font-display text-2xl font-black text-navy mt-1">{value}</p>
          {sub && <p className="text-xs text-light-grey mt-1">{sub}</p>}
        </div>
        <div className="w-10 h-10 rounded-lg bg-orange/10 flex items-center justify-center shrink-0">
          <Icon className="w-5 h-5 text-orange" strokeWidth={2} />
        </div>
      </div>
      {trend && (
        <p
          className={clsx(
            "text-xs font-semibold mt-3",
            trend.positive ? "text-emerald-600" : "text-red-600"
          )}
        >
          {trend.value}
        </p>
      )}
    </Card>
  );
}
