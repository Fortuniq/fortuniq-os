"use client";

import { useMemo, useState, useTransition } from "react";
import { CheckCircle2, AlertTriangle, Download, Send } from "lucide-react";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatDate } from "@/lib/format";
import { sendAcknowledgementReminder } from "./employee-actions";
import type { AcknowledgementRow } from "@/lib/employee-documents";

/**
 * "Document Acknowledgements" HR widget — see docs/EMPLOYEE_SELF_SERVICE.md.
 * Only rendered for HR/Super Admin (gated by the caller, people-view.tsx),
 * and only appears at all when there's at least one acknowledgement-
 * required document somewhere in the organisation, to avoid showing an
 * empty widget to companies not yet using this feature.
 */
export function DocumentAcknowledgementsWidget({ rows }: { rows: AcknowledgementRow[] }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"All" | "Pending" | "Acknowledged" | "Overdue">("All");
  const [sendingKey, setSendingKey] = useState<string | null>(null);
  const [sentKeys, setSentKeys] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();

  if (rows.length === 0) return null;

  const OVERDUE_DAYS = 14;

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (search) {
        const q = search.toLowerCase();
        if (!r.employeeName.toLowerCase().includes(q) && !r.documentName.toLowerCase().includes(q)) return false;
      }
      if (statusFilter === "Pending") return r.status === "Pending";
      if (statusFilter === "Acknowledged") return r.status === "Acknowledged";
      if (statusFilter === "Overdue") return r.status === "Pending" && (r.outstandingDays ?? 0) >= OVERDUE_DAYS;
      return true;
    });
  }, [rows, search, statusFilter]);

  function statusBadge(r: AcknowledgementRow) {
    if (r.status === "Acknowledged") return <Badge tone="success">🟢 Complete</Badge>;
    if ((r.outstandingDays ?? 0) >= OVERDUE_DAYS) return <Badge tone="danger">🔴 Overdue</Badge>;
    return <Badge tone="warning">🟡 Pending</Badge>;
  }

  function handleExport() {
    const header = "Employee,Document,Version,Status,Acknowledged On,Outstanding Days\n";
    const body = filtered.map((r) =>
      [r.employeeName, r.documentName, `v${r.versionNumber}`, r.status, r.acknowledgedAt ? formatDate(r.acknowledgedAt) : "", r.outstandingDays ?? ""].join(",")
    ).join("\n");
    const blob = new Blob([header + body], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "document-acknowledgements.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  function handleRemind(r: AcknowledgementRow) {
    const key = `${r.documentId}-${r.employeeId}`;
    setSendingKey(key);
    startTransition(async () => {
      const result = await sendAcknowledgementReminder({ employeeEmail: r.employeeEmail, documentId: r.documentId, documentName: r.documentName });
      setSendingKey(null);
      if (result?.error) alert(result.error);
      else setSentKeys((prev) => new Set(prev).add(key));
    });
  }

  const outstandingCount = rows.filter((r) => r.status === "Pending").length;

  return (
    <Card className="mb-4">
      <CardHeader>
        <CardTitle>
          <span className="flex items-center gap-1.5">
            {outstandingCount > 0 ? <AlertTriangle className="w-3.5 h-3.5 text-amber-600" /> : <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
            Document Acknowledgements
          </span>
        </CardTitle>
        <span className="text-xs text-light-grey">{outstandingCount} outstanding of {rows.length}</span>
      </CardHeader>
      <CardBody>
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <input
            value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search employee or document…"
            className="text-sm border border-border rounded-lg px-3 py-1.5 flex-1 min-w-[180px]"
          />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)} className="text-sm border border-border rounded-lg px-2 py-1.5">
            <option value="All">All statuses</option>
            <option value="Pending">Pending</option>
            <option value="Overdue">Overdue</option>
            <option value="Acknowledged">Acknowledged</option>
          </select>
          <button onClick={handleExport} className="flex items-center gap-1 text-xs font-semibold text-navy border border-border px-3 py-1.5 rounded-lg hover:border-orange hover:text-orange transition-colors">
            <Download className="w-3.5 h-3.5" /> Export
          </button>
        </div>

        <div className="space-y-1">
          {filtered.map((r) => {
            const key = `${r.documentId}-${r.employeeId}`;
            const sent = sentKeys.has(key);
            return (
              <div key={key} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <div className="min-w-0">
                  <p className="text-sm text-navy font-medium">{r.employeeName}</p>
                  <p className="text-xs text-light-grey">{r.documentName} v{r.versionNumber}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {r.status === "Acknowledged" ? (
                    <span className="text-xs text-light-grey">{r.acknowledgedAt ? formatDate(r.acknowledgedAt) : ""}</span>
                  ) : (
                    <span className="text-xs text-light-grey">{r.outstandingDays}d outstanding</span>
                  )}
                  {statusBadge(r)}
                  {r.status === "Pending" && (
                    sent ? (
                      <span className="text-xs text-emerald-600">Sent</span>
                    ) : (
                      <button
                        onClick={() => handleRemind(r)}
                        disabled={isPending && sendingKey === key}
                        className="flex items-center gap-1 text-xs font-semibold text-orange hover:underline disabled:opacity-50"
                      >
                        <Send className="w-3 h-3" /> Remind
                      </button>
                    )
                  )}
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && <p className="text-sm text-light-grey py-2">No matching records.</p>}
        </div>
      </CardBody>
    </Card>
  );
}
