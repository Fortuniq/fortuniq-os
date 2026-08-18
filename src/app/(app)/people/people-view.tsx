"use client";

import { useState } from "react";
import Link from "next/link";
import { Search, Users, GraduationCap, UserCheck, Clock, MapPin, Plus } from "lucide-react";
import { Card, CardBody } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { Badge, statusTone } from "@/components/ui/Badge";
import { PageHeader } from "@/components/ui/PageHeader";
import type { EmployeeDirectoryEntry } from "@/lib/data";
import { EmployeeFormModal } from "./EmployeeFormModal";
import { DocumentAcknowledgementsWidget } from "./DocumentAcknowledgementsWidget";
import type { AcknowledgementRow } from "@/lib/employee-documents";

function initials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
}

export function PeopleView({
  employees, isAdmin, isHR, acknowledgements,
}: {
  employees: EmployeeDirectoryEntry[];
  isAdmin: boolean;
  isHR: boolean;
  acknowledgements: AcknowledgementRow[];
}) {
  const [query, setQuery] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);

  const interns = employees.filter((e) => e.employmentType === "Intern").length;
  const onboarding = employees.filter((e) => e.status === "Onboarding").length;
  const active = employees.filter((e) => e.status === "Active").length;

  const filtered = employees.filter((e) => {
    const q = query.toLowerCase();
    return (
      e.name.toLowerCase().includes(q) ||
      e.role.toLowerCase().includes(q) ||
      e.dept.toLowerCase().includes(q) ||
      (e.employeeNumber ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <div>
      <PageHeader
        title="Employee Hub"
        description="The single source of truth for every employee at FortunIQ Fuels — directory, profiles, and personnel records."
        action={
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-4 h-4 text-light-grey absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name, role, department…"
                className="pl-9 pr-4 py-2 rounded-lg bg-white border border-border text-sm w-64 focus:outline-none focus:ring-2 focus:ring-orange/40"
              />
            </div>
            {isAdmin && (
              <button
                onClick={() => setShowAddForm(true)}
                className="flex items-center gap-1.5 text-xs font-semibold text-white bg-navy px-3 py-2.5 rounded-lg hover:bg-orange transition-colors shrink-0"
              >
                <Plus className="w-3.5 h-3.5" /> Add Employee
              </button>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Headcount" value={String(employees.length)} icon={Users} />
        <StatCard label="Interns" value={String(interns)} icon={GraduationCap} />
        <StatCard label="Active" value={String(active)} icon={UserCheck} />
        <StatCard label="Onboarding" value={String(onboarding)} sub="Starting this month" icon={Clock} />
      </div>

      {isHR && <DocumentAcknowledgementsWidget rows={acknowledgements} />}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map((emp) => (
          <Link key={emp.id} href={`/people/${emp.id}`}>
            <Card className="p-4 hover:border-orange transition-colors cursor-pointer h-full">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-navy text-white text-sm font-bold flex items-center justify-center shrink-0 overflow-hidden">
                  {emp.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={emp.photoUrl} alt={emp.name} className="w-full h-full object-cover" />
                  ) : (
                    initials(emp.name)
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-navy text-sm truncate">{emp.preferredName || emp.name}</p>
                  <p className="text-xs text-grey truncate">{emp.role}</p>
                </div>
                <Badge tone={statusTone(emp.status)}>{emp.status}</Badge>
              </div>
              <div className="mt-3 pt-3 border-t border-border flex items-center justify-between text-xs text-light-grey">
                <span>{emp.dept}</span>
                {emp.officeLocation && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> {emp.officeLocation}
                  </span>
                )}
              </div>
              {emp.employeeNumber && (
                <p className="text-[10px] text-light-grey mt-1.5 font-mono">{emp.employeeNumber}</p>
              )}
            </Card>
          </Link>
        ))}
      </div>

      {filtered.length === 0 && (
        <Card>
          <CardBody className="text-center py-12">
            <p className="text-sm text-grey">No one matches &ldquo;{query}&rdquo;.</p>
          </CardBody>
        </Card>
      )}

      {showAddForm && (
        <EmployeeFormModal
          managers={employees.map((e) => ({ id: e.id, name: e.name }))}
          onClose={() => setShowAddForm(false)}
        />
      )}
    </div>
  );
}
