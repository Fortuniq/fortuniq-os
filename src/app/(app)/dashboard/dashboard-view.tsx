"use client";

import Link from "next/link";
import { DollarSign, FileText, ClipboardList, Users, Calendar as CalendarIcon, Workflow, ArrowRight } from "lucide-react";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { formatZARCompact } from "@/lib/format";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { AttendanceCard } from "./AttendanceCard";
import { MyAttendanceHistory } from "./MyAttendanceHistory";
import { MyTasksCard } from "./MyTasksCard";
import { DocumentExpiryCard } from "./DocumentExpiryCard";
import type { MyTask, TaskGroups } from "@/lib/tasks-core";
import type { CalendarEvent } from "@/lib/calendar";
import type { AttendanceRecord } from "@/lib/attendance-core";

type ExpiringDoc = { id: string; name: string; category: string; expiryDate: string; status: string };

type DashboardProps = {
  firstName: string;
  role: string | null;
  fuelPrices: { product: string; price: number; change: number }[];
  notifications: { id: string | number; text: string; time: string; type: string }[];
  myTasks: MyTask[];
  taskGroups: TaskGroups;
  myEvents: CalendarEvent[];
  attendanceToday: AttendanceRecord | null;
  attendanceHistory: AttendanceRecord[];
  expiringDocuments: ExpiringDoc[];
  workflowByModule: Record<string, number>;
  moduleCards: { key: string; label: string; href: string; taskCount: number }[];
  hasBroadVisibility: boolean;
  orgStats: { total: number; overdue: number } | null;
  salesTrend: { month: string; sales: number }[] | null;
  orgStatsSummary: {
    todaysSales: { value: number; label: string; currency: string };
    outstandingQuotes: { value: number; label: string; total: number };
    openTenders: { value: number; label: string; closingSoon: number };
    employees: { value: number; label: string; onLeave: number };
  } | null;
};

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function eventDayLabel(dateStr: string): string {
  const today = new Date();
  const eventDate = new Date(dateStr + "T00:00:00");
  const diffDays = Math.round((eventDate.getTime() - new Date(today.toDateString()).getTime()) / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  return eventDate.toLocaleDateString("en-ZA", { weekday: "short", day: "numeric", month: "short" });
}

export function DashboardView({
  firstName, role, fuelPrices, myTasks, taskGroups, myEvents, attendanceToday, attendanceHistory, expiringDocuments, workflowByModule,
  moduleCards, hasBroadVisibility, orgStats, salesTrend, orgStatsSummary,
}: DashboardProps) {
  const workflowEntries = Object.entries(workflowByModule).filter(([, count]) => count > 0);

  return (
    <div>
      <PageHeader
        title={`${greeting()}, ${firstName}`}
        description={role ? `${role} · Here's what needs your attention today.` : "Here's what needs your attention today."}
      />

      {/* Personal stat row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="My Tasks" value={String(myTasks.length)} sub="Open, assigned to you" icon={ClipboardList} />
        <StatCard label="Due Today" value={String(taskGroups.dueToday.length)} sub="Needs action today" icon={CalendarIcon} />
        <StatCard label="Overdue" value={String(taskGroups.overdue.length)} sub="Past due date" icon={FileText} />
        <StatCard label="High Priority" value={String(taskGroups.highPriority.length)} sub="Marked High priority" icon={Users} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <AttendanceCard initial={attendanceToday} />

        {/* My Calendar / Upcoming */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>
              <span className="flex items-center gap-1.5">
                <CalendarIcon className="w-3.5 h-3.5 text-orange" /> My Calendar / Upcoming
              </span>
            </CardTitle>
          </CardHeader>
          <CardBody className="space-y-1">
            {myEvents.length === 0 && <p className="text-sm text-light-grey py-2">Nothing scheduled in the next two weeks.</p>}
            {myEvents.slice(0, 6).map((e) => (
              <div key={e.id} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                <div className="w-20 shrink-0">
                  <p className="text-xs font-semibold text-navy">{eventDayLabel(e.eventDate)}</p>
                  {e.eventTime && <p className="text-xs text-light-grey">{e.eventTime}</p>}
                </div>
                <div className="flex-1 min-w-0">
                  {e.recordUrl ? (
                    <a href={e.recordUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-navy hover:text-orange transition-colors">
                      {e.title}
                    </a>
                  ) : (
                    <p className="text-sm text-navy">{e.title}</p>
                  )}
                  <p className="text-xs text-light-grey">{e.eventType}</p>
                </div>
              </div>
            ))}
          </CardBody>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
        <MyTasksCard tasks={myTasks} openCount={myTasks.length} />

        {/* My Workflow */}
        <Card>
          <CardHeader>
            <CardTitle>
              <span className="flex items-center gap-1.5">
                <Workflow className="w-3.5 h-3.5 text-orange" /> My Workflow
              </span>
            </CardTitle>
          </CardHeader>
          <CardBody className="space-y-1">
            {workflowEntries.length === 0 && <p className="text-sm text-light-grey py-2">No workflow items waiting on you.</p>}
            {workflowEntries.map(([moduleKey, count]) => {
              const card = moduleCards.find((c) => c.key === moduleKey);
              return (
                <Link
                  key={moduleKey}
                  href={card?.href ?? "#"}
                  className="flex items-center justify-between py-2 border-b border-border last:border-0 hover:text-orange transition-colors"
                >
                  <span className="text-sm text-navy capitalize">{card?.label ?? moduleKey}</span>
                  <span className="text-xs font-semibold text-orange flex items-center gap-1">
                    {count} item{count === 1 ? "" : "s"} <ArrowRight className="w-3 h-3" />
                  </span>
                </Link>
              );
            })}
          </CardBody>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
        <MyAttendanceHistory records={attendanceHistory} />
        <DocumentExpiryCard documents={expiringDocuments} />
      </div>

      {/* Relevant module cards — only modules this person is permitted to access */}
      {moduleCards.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
          {moduleCards.slice(0, 4).map((c) => (
            <Link key={c.key} href={c.href}>
              <Card className="p-5 hover:border-orange transition-colors">
                <p className="text-xs font-semibold uppercase tracking-wide text-grey">{c.label}</p>
                <p className="font-display text-2xl font-black text-navy mt-1">{c.taskCount}</p>
                <p className="text-xs text-light-grey mt-1">Open tasks in this module</p>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {/* Organisation-wide overview — only for Super Admin / Management, per explicit broader-visibility permission */}
      {hasBroadVisibility && orgStatsSummary && (
        <>
          <p className="text-xs font-semibold uppercase tracking-wide text-grey mt-8 mb-3">Organisation Overview</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard
              label="Today's Sales"
              value={formatZARCompact(orgStatsSummary.todaysSales.value)}
              sub="Across all products"
              icon={DollarSign}
              trend={{ value: "+12% vs. yesterday", positive: true }}
            />
            <StatCard
              label="Outstanding Quotes"
              value={String(orgStatsSummary.outstandingQuotes.value)}
              sub={`${formatZARCompact(orgStatsSummary.outstandingQuotes.total)} pipeline value`}
              icon={FileText}
            />
            <StatCard
              label="Open Tenders"
              value={String(orgStatsSummary.openTenders.value)}
              sub={`${orgStatsSummary.openTenders.closingSoon} closing this week`}
              icon={ClipboardList}
            />
            <StatCard
              label="Employees & Interns"
              value={String(orgStatsSummary.employees.value)}
              sub={`${orgStatsSummary.employees.onLeave} on leave today`}
              icon={Users}
            />
          </div>

          {orgStats && (
            <p className="text-xs text-light-grey mb-4">
              Company-wide: {orgStats.total} open tasks across all employees{orgStats.overdue > 0 ? `, ${orgStats.overdue} overdue` : ""}.
            </p>
          )}

          {salesTrend && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Sales Trend — Last 6 Months</CardTitle>
                  <span className="text-xs text-light-grey">R millions</span>
                </CardHeader>
                <CardBody>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={salesTrend} margin={{ left: -20, right: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e7" vertical={false} />
                        <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#6E6E70" }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 12, fill: "#6E6E70" }} axisLine={false} tickLine={false} />
                        <Tooltip formatter={(v) => [`R${v}M`, "Sales"]} contentStyle={{ borderRadius: 8, border: "1px solid #e5e5e7", fontSize: 13 }} />
                        <Line type="monotone" dataKey="sales" stroke="#F05A28" strokeWidth={3} dot={{ fill: "#F05A28", r: 4 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardBody>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Live Fuel Prices</CardTitle>
                  <span className="text-xs text-light-grey">Gauteng / Inland</span>
                </CardHeader>
                <CardBody className="space-y-3">
                  {fuelPrices.map((f) => (
                    <div key={f.product} className="flex items-center justify-between">
                      <span className="text-sm text-navy">{f.product}</span>
                      <div className="text-right">
                        <p className="text-sm font-bold text-navy">R{f.price.toFixed(2)}</p>
                        <p className="text-xs text-emerald-600">{f.change.toFixed(2)}</p>
                      </div>
                    </div>
                  ))}
                </CardBody>
              </Card>
            </div>
          )}
        </>
      )}

      {/* Fuel prices for everyone else — public reference data, not gated */}
      {!hasBroadVisibility && fuelPrices.length > 0 && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Live Fuel Prices</CardTitle>
            <span className="text-xs text-light-grey">Gauteng / Inland</span>
          </CardHeader>
          <CardBody className="space-y-3">
            {fuelPrices.map((f) => (
              <div key={f.product} className="flex items-center justify-between">
                <span className="text-sm text-navy">{f.product}</span>
                <div className="text-right">
                  <p className="text-sm font-bold text-navy">R{f.price.toFixed(2)}</p>
                  <p className="text-xs text-emerald-600">{f.change.toFixed(2)}</p>
                </div>
              </div>
            ))}
          </CardBody>
        </Card>
      )}
    </div>
  );
}
