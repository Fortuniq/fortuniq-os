"use client";

import Link from "next/link";
import { DollarSign, FileText, ClipboardList, Users, Calendar as CalendarIcon } from "lucide-react";
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
import { MyWorkflowCard } from "./MyWorkflowCard";
import { DocumentExpiryCard } from "./DocumentExpiryCard";
import { HCMRemindersCard } from "./HCMRemindersCard";
import { MyTenderTasksCard } from "./MyTenderTasksCard";
import { FuelPricesCard } from "./FuelPricesCard";
import { MarketNewsCard } from "./MarketNewsCard";
import { MyNotesCard } from "./MyNotesCard";
import { MyFocusCard } from "./MyFocusCard";
import { DailyPlannerCard } from "./DailyPlannerCard";
import { CustomizableDashboardGrid } from "./CustomizableDashboardGrid";
import type { MyTask, TaskGroups } from "@/lib/tasks-core";
import type { CalendarEvent } from "@/lib/calendar";
import type { AttendanceRecord } from "@/lib/attendance-core";
import type { DashboardWidgetLayoutEntry } from "@/lib/dashboard-widgets";
import type { MarketNewsArticle } from "@/lib/market-news-core";
import type { WorkflowItem, WorkflowHistoryEntry } from "@/lib/workflow-core";
import type { PersonalNote } from "@/lib/notes-core";
import type { EmployeeFocus, FocusCandidate } from "@/lib/focus-core";
import type { PlannerBlock } from "@/lib/planner-core";
import type { SpecialDay } from "@/lib/holidays-core";

type ExpiringDoc = { id: string; name: string; category: string; expiryDate: string; status: string };

type DashboardProps = {
  firstName: string;
  role: string | null;
  fuelPrices: { product: string; price: number; change: number }[];
  notifications: { id: string | number; text: string; time: string; type: string }[];
  myTasks: MyTask[];
  companyTasks: MyTask[];
  personalTasks: MyTask[];
  taskGroups: TaskGroups;
  myEvents: CalendarEvent[];
  attendanceToday: AttendanceRecord | null;
  attendanceHistory: AttendanceRecord[];
  expiringDocuments: ExpiringDoc[];
  myTenderAssignments: { id: string; tenderId: string; tenderRef: string; tenderTitle: string; stage: string; dueDate: string | null; priority: string; overdue: boolean }[];
  hcmReminders: {
    upcomingLeave: { leaveType: string; startDate: string; endDate: string }[];
    myPendingLeaveCount: number;
    orgPendingLeaveCount: number;
    probationEndingSoon: boolean;
    isBirthdayToday: boolean;
    isWorkAnniversaryToday: boolean;
  };
  workflowByModule: Record<string, number>;
  workflowItems: WorkflowItem[];
  workflowHistory: WorkflowHistoryEntry[];
  moduleCards: { key: string; label: string; href: string; taskCount: number }[];
  dashboardLayout: DashboardWidgetLayoutEntry[];
  marketNewsArticles: MarketNewsArticle[];
  canManageMarketNews: boolean;
  myNotes: PersonalNote[];
  activeFocus: EmployeeFocus | null;
  focusResetPrompt: EmployeeFocus | null;
  focusRecommendation: FocusCandidate | null;
  focusCandidates: FocusCandidate[];
  directReports: { email: string; name: string }[];
  todayISO: string;
  dailyPlannerBlocks: PlannerBlock[];
  upcomingSpecialDays: SpecialDay[];
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
  firstName, role, fuelPrices, myTasks, companyTasks, personalTasks, taskGroups, myEvents, attendanceToday, attendanceHistory, expiringDocuments, myTenderAssignments, hcmReminders, workflowItems, workflowHistory,
  moduleCards, dashboardLayout, marketNewsArticles, canManageMarketNews, myNotes, activeFocus, focusResetPrompt, focusRecommendation, focusCandidates, directReports, todayISO, dailyPlannerBlocks, upcomingSpecialDays, hasBroadVisibility, orgStats, salesTrend, orgStatsSummary,
}: DashboardProps) {
  // Merges real calendar events with computed public holidays/
  // international observance days for the "My Calendar / Upcoming"
  // preview — see holidays-core.ts. Special days have no time (they're
  // all-day) and no record to open.
  const upcomingCombined = [
    ...myEvents.map((e) => ({ date: e.eventDate, time: e.eventTime, title: e.title, sub: e.eventType, url: e.recordUrl as string | null, isSpecialDay: false })),
    ...upcomingSpecialDays.map((d) => ({ date: d.date, time: null as string | null, title: d.name, sub: d.kind === "public-holiday" ? "Public Holiday" : "International Day", url: null as string | null, isSpecialDay: true })),
  ].sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? "").localeCompare(b.time ?? ""));
  return (
    <div>
      <PageHeader
        title={`${greeting()}, ${firstName}`}
        description={role ? `${role} · Here's what needs your attention today.` : "Here's what needs your attention today."}
      />

      {/* My Focus Today (Project ORION) — deliberately pinned here, OUTSIDE
          the customizable widget grid below, same treatment as Attendance.
          The brief calls this "one of the main features of the dashboard":
          it must be the first thing an employee sees, not something that
          could be hidden, resized down, or buried by personal layout
          choices. See MyFocusCard.tsx / docs/EMPLOYEE_DASHBOARD.md. */}
      <div className="mb-6">
        <MyFocusCard
          activeFocus={activeFocus}
          resetPrompt={focusResetPrompt}
          recommendation={focusRecommendation}
          candidates={focusCandidates}
          todayISO={todayISO}
          directReports={directReports}
        />
      </div>

      {/* Personal stat row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="My Tasks" value={String(myTasks.length)} sub="Open, assigned to you" icon={ClipboardList} />
        <StatCard label="Due Today" value={String(taskGroups.dueToday.length)} sub="Needs action today" icon={CalendarIcon} />
        <StatCard label="Overdue" value={String(taskGroups.overdue.length)} sub="Past due date" icon={FileText} />
        <StatCard label="High Priority" value={String(taskGroups.highPriority.length)} sub="Marked High priority" icon={Users} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <AttendanceCard initial={attendanceToday} />

        {/* My Calendar / Upcoming — Personal Calendar redesign (Project
            ORION): this preview stays a quick glance, and now links to a
            full interactive month view with Outlook two-way sync at
            /dashboard/calendar. */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>
              <span className="flex items-center gap-1.5">
                <CalendarIcon className="w-3.5 h-3.5 text-orange" /> My Calendar / Upcoming
              </span>
            </CardTitle>
            <Link href="/dashboard/calendar" className="text-xs font-semibold text-navy hover:text-orange transition-colors">
              Open full calendar
            </Link>
          </CardHeader>
          <CardBody className="space-y-1">
            {upcomingCombined.length === 0 && <p className="text-sm text-light-grey py-2">Nothing scheduled in the next two weeks.</p>}
            {upcomingCombined.slice(0, 6).map((e, i) => (
              <div key={`${e.date}-${e.title}-${i}`} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                <div className="w-20 shrink-0">
                  <p className="text-xs font-semibold text-navy">{eventDayLabel(e.date)}</p>
                  {e.time && <p className="text-xs text-light-grey">{e.time}</p>}
                </div>
                <div className="flex-1 min-w-0">
                  {e.url ? (
                    <a href={e.url} target="_blank" rel="noopener noreferrer" className="text-sm text-navy hover:text-orange transition-colors">
                      {e.title}
                    </a>
                  ) : (
                    <p className={`text-sm ${e.isSpecialDay ? "text-orange" : "text-navy"}`}>{e.title}</p>
                  )}
                  <p className="text-xs text-light-grey">{e.sub}</p>
                </div>
              </div>
            ))}
          </CardBody>
        </Card>
      </div>

      {/* Customizable "My Workspace" widgets — Project ORION Phase 1. Show/
          hide/resize/reorder, saved per employee. Deliberately excludes
          Attendance (pinned above, per the brief) and Calendar (getting
          its own full redesign in a later phase) — see
          CustomizableDashboardGrid.tsx / dashboard-widgets.ts. */}
      <CustomizableDashboardGrid
        initialLayout={dashboardLayout}
        content={{
          myTasks: <MyTasksCard companyTasks={companyTasks} personalTasks={personalTasks} />,
          myWorkflow: <MyWorkflowCard workflowItems={workflowItems} workflowHistory={workflowHistory} moduleCards={moduleCards} />,
          attendanceHistory: <MyAttendanceHistory records={attendanceHistory} />,
          documentExpiry: <DocumentExpiryCard documents={expiringDocuments} />,
          hcmReminders: <HCMRemindersCard reminders={hcmReminders} isHR={role === "HR/Admin" || hasBroadVisibility} />,
          myTenderTasks: <MyTenderTasksCard assignments={myTenderAssignments} />,
          fuelPrices: !hasBroadVisibility ? <FuelPricesCard fuelPrices={fuelPrices} /> : undefined,
          marketNews: <MarketNewsCard articles={marketNewsArticles} canManage={canManageMarketNews} />,
          myNotes: <MyNotesCard notes={myNotes} />,
          dailyPlanner: <DailyPlannerCard blocks={dailyPlannerBlocks} todayISO={todayISO} />,
        }}
      />

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
      {/* Note: for non-broad-visibility users, Live Fuel Prices now renders
          as the "fuelPrices" customizable widget above (FuelPricesCard),
          not as a separate hard-coded block — avoids showing it twice. */}
    </div>
  );
}
