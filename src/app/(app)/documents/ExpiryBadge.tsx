import { AlertTriangle } from "lucide-react";
import { formatDate } from "@/lib/format";
import { isExpired, isExpiringSoon, daysUntilExpiry } from "@/lib/documents-core";

export function ExpiryBadge({ expiryDate }: { expiryDate: string | null }) {
  if (!expiryDate) return <span className="text-xs text-light-grey">—</span>;

  if (isExpired(expiryDate)) {
    return (
      <span className="flex items-center gap-1 text-xs font-semibold text-red-600">
        <AlertTriangle className="w-3.5 h-3.5" /> Expired {formatDate(expiryDate)}
      </span>
    );
  }
  if (isExpiringSoon(expiryDate)) {
    return (
      <span className="flex items-center gap-1 text-xs font-semibold text-amber-600">
        <AlertTriangle className="w-3.5 h-3.5" /> {daysUntilExpiry(expiryDate)}d — {formatDate(expiryDate)}
      </span>
    );
  }
  return <span className="text-xs text-grey">{formatDate(expiryDate)}</span>;
}
