"use client";

import Link from "next/link";
import { Receipt, Plus, TrendingUp, AlertCircle } from "lucide-react";
import { Card, CardBody } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { Badge, statusTone } from "@/components/ui/Badge";
import { PageHeader } from "@/components/ui/PageHeader";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { formatZARFull, formatDate } from "@/lib/format";
import type { InvoiceListRow, CustomerPickerOption } from "@/lib/invoices-data";

export function InvoicesView({
  invoices,
  customers,
  canCreate,
}: {
  invoices: InvoiceListRow[];
  customers: CustomerPickerOption[];
  canCreate: boolean;
}) {
  const outstanding = invoices.filter((i) => i.status !== "Paid" && i.status !== "Cancelled").reduce((s, i) => s + Math.max(0, i.total - i.paidAmount), 0);
  const overdueCount = invoices.filter((i) => i.status === "Overdue").length;
  const totalValue = invoices.reduce((s, i) => s + i.total, 0);

  const columns: Column<InvoiceListRow>[] = [
    {
      key: "invoiceNumber",
      header: "Invoice",
      render: (r) => (
        <Link href={`/finance/invoices/${r.id}`} className="flex items-center gap-2 group">
          <Receipt className="w-4 h-4 text-orange shrink-0" />
          <span className="font-medium text-navy group-hover:underline">{r.invoiceNumber ?? "Draft (unnumbered)"}</span>
        </Link>
      ),
    },
    { key: "customerName", header: "Customer" },
    { key: "status", header: "Status", render: (r) => <Badge tone={statusTone(r.status)}>{r.status}</Badge> },
    { key: "total", header: "Total", align: "right", render: (r) => <span>{formatZARFull(r.total)}{!r.vatApplied && <span className="text-[10px] text-light-grey block">excl. VAT — n/a</span>}</span> },
    { key: "createdByName", header: "Created By", render: (r) => r.createdByName ?? "—" },
    { key: "createdAt", header: "Created On", render: (r) => formatDate(r.createdAt) },
    { key: "dueDate", header: "Due", render: (r) => (r.dueDate ? formatDate(r.dueDate) : "—") },
  ];

  return (
    <div>
      <PageHeader
        title="Invoices"
        description="Formal, numbered invoices issued to customers."
        action={canCreate ? (
          <Link href="/finance/invoices/new" className="flex items-center gap-1.5 text-sm font-semibold text-white bg-navy px-3.5 py-2 rounded-lg hover:bg-orange transition-colors">
            <Plus className="w-4 h-4" /> New Invoice
          </Link>
        ) : undefined}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Invoices" value={String(invoices.length)} icon={Receipt} />
        <StatCard label="Overdue" value={String(overdueCount)} icon={AlertCircle} />
        <StatCard label="Outstanding" value={formatZARFull(outstanding)} icon={TrendingUp} />
        <StatCard label="Total Value" value={formatZARFull(totalValue)} icon={TrendingUp} />
      </div>

      <Card>
        <CardBody className="pt-5">
          {invoices.length === 0 ? (
            <p className="text-sm text-grey py-8 text-center">
              No invoices yet.{canCreate && customers.length > 0 && " Create the first one."}
              {canCreate && customers.length === 0 && " You need at least one customer authorised to you first."}
            </p>
          ) : (
            <DataTable columns={columns} data={invoices} />
          )}
        </CardBody>
      </Card>
    </div>
  );
}
