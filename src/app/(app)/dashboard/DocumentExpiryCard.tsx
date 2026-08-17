import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/Card";
import { isExpired, isExpiringSoon, daysUntilExpiry } from "@/lib/documents-core";

type ExpiringDoc = { id: string; name: string; category: string; expiryDate: string; status: string };

/**
 * Only renders when there's something to show — an empty expiry list
 * (or Documents module access the person doesn't have, filtered
 * upstream in getPersonalisedDashboardData) means no card at all, not
 * an empty one. See docs/DOCUMENT_CONTROL.md, "Expiry reminders."
 */
export function DocumentExpiryCard({ documents }: { documents: ExpiringDoc[] }) {
  const relevant = documents.filter((d) => isExpired(d.expiryDate) || isExpiringSoon(d.expiryDate));
  if (relevant.length === 0) return null;

  return (
    <Card className="border-amber-200">
      <CardHeader>
        <CardTitle>
          <span className="flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" /> Document Expiry
          </span>
        </CardTitle>
      </CardHeader>
      <CardBody className="space-y-1">
        {relevant.slice(0, 6).map((d) => {
          const expired = isExpired(d.expiryDate);
          const days = daysUntilExpiry(d.expiryDate);
          return (
            <Link key={d.id} href="/documents" className="flex items-center justify-between py-2 border-b border-border last:border-0 hover:text-orange transition-colors">
              <span className="text-sm text-navy truncate">{d.name}</span>
              <span className={`text-xs font-semibold shrink-0 ${expired ? "text-red-600" : "text-amber-600"}`}>
                {expired ? `Expired ${Math.abs(days)}d ago` : `${days}d left`}
              </span>
            </Link>
          );
        })}
      </CardBody>
    </Card>
  );
}
