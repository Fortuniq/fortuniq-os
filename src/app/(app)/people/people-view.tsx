"use client";

import { Plus, Mail } from "lucide-react";
import { Card, CardBody } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { Badge, statusTone } from "@/components/ui/Badge";
import { PageHeader } from "@/components/ui/PageHeader";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Users, GraduationCap, UserCheck, Clock } from "lucide-react";
import { formatDate } from "@/lib/format";

type Employee = {
  id: string | number;
  name: string;
  role: string;
  dept: string;
  type: string;
  status: string;
  start: string;
};

const columns: Column<Employee>[] = [
  {
    key: "name",
    header: "Name",
    render: (r) => (
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-full bg-navy text-white text-[10px] font-bold flex items-center justify-center shrink-0">
          {r.name.split(" ").map((n) => n[0]).join("")}
        </div>
        <span className="font-medium">{r.name}</span>
      </div>
    ),
  },
  { key: "role", header: "Role" },
  { key: "dept", header: "Department" },
  { key: "type", header: "Type", render: (r) => <Badge tone={r.type === "Intern" ? "orange" : "neutral"}>{r.type}</Badge> },
  { key: "status", header: "Status", render: (r) => <Badge tone={statusTone(r.status)}>{r.status}</Badge> },
  { key: "start", header: "Start Date", render: (r) => formatDate(r.start) },
];

export function PeopleView({ employees }: { employees: Employee[] }) {
  const interns = employees.filter((e) => e.type === "Intern").length;
  const onboarding = employees.filter((e) => e.status === "Onboarding").length;

  return (
    <div>
      <PageHeader
        title="People"
        description="Employees and interns across FortunIQ Fuels."
        action={
          <button className="flex items-center gap-2 bg-navy text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-orange transition-colors">
            <Plus className="w-4 h-4" /> Add Person
          </button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Headcount" value={String(employees.length)} icon={Users} />
        <StatCard label="Interns" value={String(interns)} sub="Across 3 departments" icon={GraduationCap} />
        <StatCard label="Active" value={String(employees.filter((e) => e.status === "Active").length)} icon={UserCheck} />
        <StatCard label="Onboarding" value={String(onboarding)} sub="Starting this month" icon={Clock} />
      </div>

      <Card>
        <CardBody className="pt-5">
          <DataTable columns={columns} data={employees} />
        </CardBody>
      </Card>

      <div className="mt-4 flex items-center gap-2 text-xs text-light-grey">
        <Mail className="w-3.5 h-3.5" />
        People data here reflects the FortunIQ Fuels Employee & Intern Handbook — appointment, confidentiality and Code of Conduct records link from each profile in the full build.
      </div>
    </div>
  );
}
