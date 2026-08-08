"use client";

import { DollarSign, FileText, ClipboardList, Users, CheckCircle2, Circle } from "lucide-react";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { Badge, statusTone } from "@/components/ui/Badge";
import { PageHeader } from "@/components/ui/PageHeader";
import { formatZARCompact } from "@/lib/format";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

type DashboardData = {
  fuelPrices: { product: string; price: number; change: number }[];
  tasks: { id: string | number; title: string; due: string; priority: string; owner: string }[];
  notifications: { id: string | number; text: string; time: string; type: string }[];
  salesTrend: { month: string; sales: number }[];
  stats: {
    todaysSales: { value: number; label: string; currency: string };
    outstandingQuotes: { value: number; label: string; total: number };
    openTenders: { value: number; label: string; closingSoon: number };
    employees: { value: number; label: string; onLeave: number };
  };
};

export function DashboardView({ fuelPrices, tasks, notifications, salesTrend, stats }: DashboardData) {
  return (
    <div>
      <PageHeader
        title="Good morning, Thabo"
        description="Here's what's happening across FortunIQ Fuels today."
      />

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Today's Sales"
          value={formatZARCompact(stats.todaysSales.value)}
          sub="Across all products"
          icon={DollarSign}
          trend={{ value: "+12% vs. yesterday", positive: true }}
        />
        <StatCard
          label="Outstanding Quotes"
          value={String(stats.outstandingQuotes.value)}
          sub={`${formatZARCompact(stats.outstandingQuotes.total)} pipeline value`}
          icon={FileText}
        />
        <StatCard
          label="Open Tenders"
          value={String(stats.openTenders.value)}
          sub={`${stats.openTenders.closingSoon} closing this week`}
          icon={ClipboardList}
        />
        <StatCard
          label="Employees & Interns"
          value={String(stats.employees.value)}
          sub={`${stats.employees.onLeave} on leave today`}
          icon={Users}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Sales trend chart */}
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
                  <Tooltip
                    formatter={(v) => [`R${v}M`, "Sales"]}
                    contentStyle={{ borderRadius: 8, border: "1px solid #e5e5e7", fontSize: 13 }}
                  />
                  <Line type="monotone" dataKey="sales" stroke="#F05A28" strokeWidth={3} dot={{ fill: "#F05A28", r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardBody>
        </Card>

        {/* Fuel prices */}
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
        {/* Tasks */}
        <Card>
          <CardHeader>
            <CardTitle>My Tasks</CardTitle>
            <span className="text-xs text-orange font-semibold">{tasks.length} open</span>
          </CardHeader>
          <CardBody className="space-y-1">
            {tasks.map((t) => (
              <div key={t.id} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                <Circle className="w-4 h-4 text-light-grey shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-navy truncate">{t.title}</p>
                  <p className="text-xs text-light-grey">{t.owner} · Due {t.due}</p>
                </div>
                <Badge tone={statusTone(t.priority)}>{t.priority}</Badge>
              </div>
            ))}
          </CardBody>
        </Card>

        {/* Notifications */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardBody className="space-y-1">
            {notifications.map((n) => (
              <div key={n.id} className="flex items-start gap-3 py-2 border-b border-border last:border-0">
                <CheckCircle2 className="w-4 h-4 text-orange shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-navy leading-snug">{n.text}</p>
                  <p className="text-xs text-light-grey mt-0.5">{n.time}</p>
                </div>
              </div>
            ))}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
