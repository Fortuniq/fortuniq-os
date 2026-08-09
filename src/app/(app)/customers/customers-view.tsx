"use client";

import { UserSquare2, TrendingUp, Building, Star } from "lucide-react";
import { Card, CardBody } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { Badge, statusTone } from "@/components/ui/Badge";
import { PageHeader } from "@/components/ui/PageHeader";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { formatZARCompact } from "@/lib/format";

type Customer = { id: string | number; name: string; industry: string; accountValue: number; status: string; contact: string };

const columns: Column<Customer>[] = [
  {
    key: "name",
    header: "Account",
    render: (r) => (
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-navy text-white text-[10px] font-bold flex items-center justify-center shrink-0">
          {r.name.slice(0, 2).toUpperCase()}
        </div>
        <span className="font-medium">{r.name}</span>
      </div>
    ),
  },
  { key: "industry", header: "Industry" },
  { key: "contact", header: "Primary Contact" },
  { key: "accountValue", header: "Account Value", align: "right", render: (r) => formatZARCompact(r.accountValue) },
  { key: "status", header: "Status", render: (r) => <Badge tone={statusTone(r.status)}>{r.status}</Badge> },
];

export function CustomersView({ customers }: { customers: Customer[] }) {
  const active = customers.filter((c) => c.status === "Active").length;
  const totalValue = customers.reduce((s, c) => s + c.accountValue, 0);
  const topAccount = [...customers].sort((a, b) => b.accountValue - a.accountValue)[0];

  return (
    <div>
      <PageHeader title="Customers" description="Client accounts across FortunIQ Fuels." />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Accounts" value={String(customers.length)} icon={UserSquare2} />
        <StatCard label="Active" value={String(active)} icon={Building} />
        <StatCard label="Total Account Value" value={formatZARCompact(totalValue)} icon={TrendingUp} />
        <StatCard label="Largest Account" value={topAccount ? formatZARCompact(topAccount.accountValue) : "—"} sub={topAccount?.name} icon={Star} />
      </div>

      <Card>
        <CardBody className="pt-5">
          <DataTable columns={columns} data={customers} />
        </CardBody>
      </Card>
    </div>
  );
}
