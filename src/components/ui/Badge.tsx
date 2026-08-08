import clsx from "clsx";

type BadgeTone = "success" | "warning" | "danger" | "info" | "neutral" | "orange";

const TONE_STYLES: Record<BadgeTone, string> = {
  success: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  warning: "bg-amber-50 text-amber-700 ring-amber-600/20",
  danger: "bg-red-50 text-red-700 ring-red-600/20",
  info: "bg-blue-50 text-blue-700 ring-blue-600/20",
  neutral: "bg-gray-100 text-gray-700 ring-gray-500/20",
  orange: "bg-orange-50 text-orange-700 ring-orange-600/20",
};

export function Badge({ tone = "neutral", children }: { tone?: BadgeTone; children: React.ReactNode }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset whitespace-nowrap",
        TONE_STYLES[tone]
      )}
    >
      {children}
    </span>
  );
}

export function statusTone(status: string): BadgeTone {
  const s = status.toLowerCase();
  if (["active", "paid", "won", "delivered", "open", "available"].includes(s)) return "success";
  if (["overdue", "lost", "maintenance", "high"].includes(s)) return "danger";
  if (["pending", "sent", "draft", "scheduled", "medium", "onboarding"].includes(s)) return "warning";
  if (["in transit", "loading", "negotiation", "on route", "prospect"].includes(s)) return "info";
  return "neutral";
}
