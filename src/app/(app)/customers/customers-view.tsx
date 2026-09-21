"use client";

import { useState } from "react";
import { UserSquare2, TrendingUp, Building, Star, Plus, Pencil } from "lucide-react";
import { Card, CardBody } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { Badge, statusTone } from "@/components/ui/Badge";
import { PageHeader } from "@/components/ui/PageHeader";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { formatZARCompact } from "@/lib/format";
import { CustomerModal, type CustomerFormValue } from "./CustomerModal";

type Customer = {
  id: string | number;
  customerCode?: string | null;
  name: string;
  industry: string;
  accountValue: number;
  status: string;
  contact: string;
  email?: string | null;
  phone?: string | null;
  billingAddress?: string | null;
  notes?: string | null;
  accountOwnerEmail?: string | null;
};

export function CustomersView({ customers, canEdit }: { customers: Customer[]; canEdit: boolean }) {
  const [modalCustomer, setModalCustomer] = useState<CustomerFormValue | null | undefined>(undefined);

  const active = customers.filter((c) => c.status === "Active").length;
  const totalValue = customers.reduce((s, c) => s + c.accountValue, 0);
  const topAccount = [...customers].sort((a, b) => b.accountValue - a.accountValue)[0];

  const columns: Column<Customer>[] = [
    {
      key: "name",
      header: "Account",
      render: (r) => (
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-navy text-white text-[10px] font-bold flex items-center justify-center shrink-0">
            {r.name.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <p className="font-medium leading-tight">{r.name}</p>
            {r.customerCode && <p className="text-[11px] text-light-grey leading-tight">{r.customerCode}</p>}
          </div>
        </div>
      ),
    },
    { key: "industry", header: "Industry" },
    { key: "contact", header: "Primary Contact" },
    { key: "accountValue", header: "Account Value", align: "right", render: (r) => formatZARCompact(r.accountValue) },
    { key: "status", header: "Status", render: (r) => <Badge tone={statusTone(r.status)}>{r.status}</Badge> },
    ...(canEdit
      ? [{
          key: "actions",
          header: "",
          align: "right" as const,
          render: (r: Customer) => (
            <button
              onClick={() => setModalCustomer({ id: r.id, name: r.name, industry: r.industry, contact: r.contact, email: r.email, phone: r.phone, billingAddress: r.billingAddress, notes: r.notes, status: r.status, accountValue: r.accountValue, accountOwnerEmail: r.accountOwnerEmail })}
              className="text-grey hover:text-navy p-1"
              aria-label={`Edit ${r.name}`}
            >
              <Pencil className="w-4 h-4" />
            </button>
          ),
        }]
      : []),
  ];

  return (
    <div>
      <PageHeader
        title="Customers"
        description="Client accounts across FortunIQ Fuels — the shared source of customer data for Sales, Quotations and Invoices."
        action={canEdit ? (
          <button onClick={() => setModalCustomer(null)} className="flex items-center gap-1.5 text-sm font-semibold text-white bg-navy px-3.5 py-2 rounded-lg hover:bg-orange transition-colors">
            <Plus className="w-4 h-4" /> Add Customer
          </button>
        ) : undefined}
      />

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

      {modalCustomer !== undefined && (
        <CustomerModal customer={modalCustomer ?? undefined} onClose={() => setModalCustomer(undefined)} />
      )}
    </div>
  );
}
