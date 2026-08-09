"use client";

import { Wallet, TrendingDown, AlertCircle, Building2 } from "lucide-react";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { Badge, statusTone } from "@/components/ui/Badge";
import { PageHeader } from "@/components/ui/PageHeader";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { formatZAR, formatZARCompact, formatDate } from "@/lib/format";

type Invoice = { id: string | number; customer: string; amount: number; status: string; due: string };
type Expense = { id: string | number; category: string; amount: number; date: string };
type Supplier = { id: string | number; name: string; category: string; terms: string; status: string };

const invoiceColumns: Column<Invoice>[] = [
  { key: "id", header: "Invoice" },
  { key: "customer", header: "Customer" },
  { key: "amount", header: "Amount", align: "right", render: (r) => formatZAR(r.amount) },
  { key: "status", header: "Status", render: (r) => <Badge tone={statusTone(r.status)}>{r.status}</Badge> },
  { key: "due", header: "Due", render: (r) => formatDate(r.due) },
];

export function FinanceView({
  invoices,
  expenses,
  suppliers,
}: {
  invoices: Invoice[];
  expenses: Expense[];
  suppliers: Supplier[];
}) {
  const totalOutstanding = invoices.filter((i) => i.status !== "Paid").reduce((s, i) => s + i.amount, 0);
  const overdueCount = invoices.filter((i) => i.status === "Overdue").length;
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);

  return (
    <div>
      <PageHeader title="Finance" description="Invoices, expenses, purchase orders, suppliers and budgets." />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Outstanding" value={formatZARCompact(totalOutstanding)} icon={Wallet} />
        <StatCard label="Overdue Invoices" value={String(overdueCount)} icon={AlertCircle} />
        <StatCard label="Expenses (MTD)" value={formatZARCompact(totalExpenses)} icon={TrendingDown} />
        <StatCard label="Active Suppliers" value={String(suppliers.length)} icon={Building2} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Invoices</CardTitle>
          </CardHeader>
          <CardBody className="pt-2">
            <DataTable columns={invoiceColumns} data={invoices} />
          </CardBody>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Expenses</CardTitle>
            </CardHeader>
            <CardBody className="space-y-3">
              {expenses.map((e) => (
                <div key={e.id} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-navy">{e.category}</p>
                    <p className="text-xs text-light-grey">{formatDate(e.date)}</p>
                  </div>
                  <p className="text-sm font-semibold text-navy">{formatZARCompact(e.amount)}</p>
                </div>
              ))}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Suppliers</CardTitle>
            </CardHeader>
            <CardBody className="space-y-3">
              {suppliers.map((s) => (
                <div key={s.id} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-navy font-medium">{s.name}</p>
                    <p className="text-xs text-light-grey">{s.category} · {s.terms}</p>
                  </div>
                  <Badge tone="success">{s.status}</Badge>
                </div>
              ))}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
