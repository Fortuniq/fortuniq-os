"use client";

import { useMemo, useState, useTransition } from "react";
import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { Badge, statusTone } from "@/components/ui/Badge";
import { PageHeader } from "@/components/ui/PageHeader";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { formatDuration, type AttendanceRecord } from "@/lib/attendance-core";
import { reviewCorrectionAction } from "./attendance-actions";
import type { AttendanceCorrection } from "@/lib/attendance";

type Row = AttendanceRecord & { id: string };

function fmtDateTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-ZA", { timeZone: "Africa/Johannesburg", hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" });
}

export function AttendanceView({
  records, missingClockOuts, pendingCorrections,
}: {
  records: AttendanceRecord[];
  missingClockOuts: AttendanceRecord[];
  pendingCorrections: AttendanceCorrection[];
}) {
  const [employeeFilter, setEmployeeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [corrections, setCorrections] = useState(pendingCorrections);
  const [isPending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    return records.filter((r) => {
      if (employeeFilter && !r.employeeEmail.toLowerCase().includes(employeeFilter.toLowerCase())) return false;
      if (statusFilter && r.status !== statusFilter) return false;
      return true;
    });
  }, [records, employeeFilter, statusFilter]);

  function handleReview(correctionId: string, approve: boolean) {
    startTransition(async () => {
      const result = await reviewCorrectionAction(correctionId, approve);
      if (!result.error) {
        setCorrections((prev) => prev.filter((c) => c.id !== correctionId));
      }
    });
  }

  const columns: Column<Row>[] = [
    { key: "employeeName", header: "Employee", render: (r) => (
      <div>
        <p className="font-medium text-navy">{r.employeeEmail}</p>
      </div>
    ) },
    { key: "attendanceDate", header: "Date" },
    { key: "clockInAt", header: "Clock In", render: (r) => fmtDateTime(r.clockInAt) },
    { key: "clockOutAt", header: "Clock Out", render: (r) => fmtDateTime(r.clockOutAt) },
    { key: "totalMinutes", header: "Hours", align: "right", render: (r) => formatDuration(r.totalMinutes) },
    { key: "status", header: "Status", render: (r) => (
      <div className="flex items-center gap-1.5">
        <Badge tone={r.status === "Missing Clock-Out" ? "danger" : statusTone(r.status === "Clocked In" ? "pending" : "active")}>{r.status}</Badge>
        {r.late && <Badge tone="warning">Late</Badge>}
      </div>
    ) },
  ];

  const rows: Row[] = filtered.map((r) => ({ ...r, id: r.id }));

  return (
    <div>
      <PageHeader title="Attendance" description="Clock-in register, missing clock-outs, and correction requests." />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard label="Records" value={String(records.length)} sub="Total attendance rows" icon={CheckCircle2} />
        <StatCard label="Missing Clock-Outs" value={String(missingClockOuts.length)} sub="Needs review" icon={AlertTriangle} />
        <StatCard label="Pending Corrections" value={String(corrections.length)} sub="Awaiting your approval" icon={AlertTriangle} />
      </div>

      {corrections.length > 0 && (
        <Card className="mb-4 border-amber-300">
          <CardHeader>
            <CardTitle>Pending Correction Requests</CardTitle>
          </CardHeader>
          <CardBody className="space-y-3">
            {corrections.map((c) => (
              <div key={c.id} className="flex items-center justify-between border-b border-border last:border-0 py-2">
                <div>
                  <p className="text-sm text-navy">
                    <span className="font-semibold">{c.employeeEmail}</span> — {c.attendanceDate} — {c.requestedField === "clock_in_at" ? "Clock In" : "Clock Out"}
                  </p>
                  <p className="text-xs text-light-grey">
                    {fmtDateTime(c.originalValue)} → {fmtDateTime(c.correctedValue)} · &ldquo;{c.reason}&rdquo;
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => handleReview(c.id, true)} disabled={isPending} className="text-emerald-600 hover:text-emerald-800" title="Approve">
                    <CheckCircle2 className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleReview(c.id, false)} disabled={isPending} className="text-red-600 hover:text-red-800" title="Reject">
                    <XCircle className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </CardBody>
        </Card>
      )}

      {missingClockOuts.length > 0 && (
        <Card className="mb-4 border-red-300">
          <CardHeader>
            <CardTitle>Missing Clock-Outs</CardTitle>
          </CardHeader>
          <CardBody className="space-y-1">
            {missingClockOuts.map((r) => (
              <p key={r.id} className="text-sm text-navy py-1">
                {r.employeeEmail} — {r.attendanceDate} — clocked in at {fmtDateTime(r.clockInAt)}, never clocked out.
              </p>
            ))}
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Attendance Register</CardTitle>
        </CardHeader>
        <CardBody className="pt-2">
          <div className="flex items-center gap-3 mb-4">
            <input
              placeholder="Filter by employee email…"
              value={employeeFilter}
              onChange={(e) => setEmployeeFilter(e.target.value)}
              className="text-sm border border-border rounded-lg px-3 py-2 flex-1"
            />
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="text-sm border border-border rounded-lg px-3 py-2">
              <option value="">All statuses</option>
              <option value="Clocked In">Clocked In</option>
              <option value="Clocked Out">Clocked Out</option>
              <option value="Missing Clock-Out">Missing Clock-Out</option>
            </select>
          </div>
          <DataTable columns={columns} data={rows} />
        </CardBody>
      </Card>
    </div>
  );
}
