"use client";

import Link from "next/link";
import { FileText, Plus, TrendingUp, Clock } from "lucide-react";
import { Card, CardBody } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { Badge, statusTone } from "@/components/ui/Badge";
import { PageHeader } from "@/components/ui/PageHeader";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { formatZARFull, formatDate } from "@/lib/format";
import type { QuotationListRow, CustomerPickerOption } from "@/lib/quotations-data";

export function QuotationsView({
  quotations,
  customers,
  canCreate,
}: {
  quotations: QuotationListRow[];
  customers: CustomerPickerOption[];
  canCreate: boolean;
}) {
  const pendingApproval = quotations.filter((q) => q.status === "Pending Approval").length;
  const approvedOrSent = quotations.filter((q) => q.status === "Approved" || q.status === "Sent").length;
  const totalValue = quotations.reduce((s, q) => s + q.total, 0);

  const columns: Column<QuotationListRow>[] = [
    {
      key: "quotationNumber",
      header: "Quotation",
      render: (r) => (
        <Link href={`/finance/quotations/${r.id}`} className="flex items-center gap-2 group">
          <FileText className="w-4 h-4 text-orange shrink-0" />
          <span className="font-medium text-navy group-hover:underline">{r.quotationNumber ?? "Draft (unnumbered)"}</span>
        </Link>
      ),
    },
    { key: "customerName", header: "Customer" },
    { key: "status", header: "Status", render: (r) => <Badge tone={statusTone(r.status)}>{r.status}</Badge> },
    { key: "total", header: "Total", align: "right", render: (r) => <span>{formatZARFull(r.total)}{!r.vatApplied && <span className="text-[10px] text-light-grey block">excl. VAT — n/a</span>}</span> },
    { key: "createdByName", header: "Created By", render: (r) => r.createdByName ?? "—" },
    { key: "createdAt", header: "Created On", render: (r) => formatDate(r.createdAt) },
    { key: "validUntil", header: "Valid Until", render: (r) => (r.validUntil ? formatDate(r.validUntil) : "—") },
  ];

  return (
    <div>
      <PageHeader
        title="Quotations"
        description="Formal, numbered quotations issued to customers — not the Sales pipeline."
        action={canCreate ? (
          <Link href="/finance/quotations/new" className="flex items-center gap-1.5 text-sm font-semibold text-white bg-navy px-3.5 py-2 rounded-lg hover:bg-orange transition-colors">
            <Plus className="w-4 h-4" /> New Quotation
          </Link>
        ) : undefined}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Quotations" value={String(quotations.length)} icon={FileText} />
        <StatCard label="Pending Approval" value={String(pendingApproval)} icon={Clock} />
        <StatCard label="Approved / Sent" value={String(approvedOrSent)} icon={FileText} />
        <StatCard label="Total Value" value={formatZARFull(totalValue)} icon={TrendingUp} />
      </div>

      <Card>
        <CardBody className="pt-5">
          {quotations.length === 0 ? (
            <p className="text-sm text-grey py-8 text-center">
              No quotations yet.{canCreate && customers.length > 0 && " Create the first one."}
              {canCreate && customers.length === 0 && " You need at least one customer authorised to you first."}
            </p>
          ) : (
            <DataTable columns={columns} data={quotations} />
          )}
        </CardBody>
      </Card>
    </div>
  );
}
