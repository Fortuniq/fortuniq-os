"use client";

import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { BarChart3, TrendingUp, Fuel, Users } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from "recharts";

type RevenueRow = { product: string; revenue: number };
type PipelineStage = { stage: string; count: number; value: number };
type Customer = { id: string | number; name: string; industry: string; accountValue: number; status: string };

const COLORS = ["#F05A28", "#1c1b1c", "#b08d57", "#a8a8aa"];

export function ReportsView({
  revenueByProduct,
  pipeline,
  customers,
}: {
  revenueByProduct: RevenueRow[];
  pipeline: PipelineStage[];
  customers: Customer[];
}) {
  const industries = Object.entries(
    customers.reduce((acc: Record<string, number>, c) => {
      acc[c.industry] = (acc[c.industry] ?? 0) + c.accountValue;
      return acc;
    }, {})
  ).map(([name, value]) => ({ name, value }));

  return (
    <div>
      <PageHeader title="Reports" description="Cross-module analytics for FortunIQ Fuels." />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Products Sold" value={String(revenueByProduct.length)} icon={Fuel} />
        <StatCard label="Pipeline Stages" value={String(pipeline.length)} icon={TrendingUp} />
        <StatCard label="Customer Segments" value={String(industries.length)} icon={Users} />
        <StatCard label="Reporting Period" value="Jul 2026" icon={BarChart3} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Volume by Product</CardTitle>
          </CardHeader>
          <CardBody>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueByProduct} margin={{ left: -20, right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e7" vertical={false} />
                  <XAxis dataKey="product" tick={{ fontSize: 11, fill: "#6E6E70" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: "#6E6E70" }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e5e5e7", fontSize: 13 }} />
                  <Bar dataKey="revenue" fill="#F05A28" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Account Value by Industry</CardTitle>
          </CardHeader>
          <CardBody>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={industries} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={(e) => e.name}>
                    {industries.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e5e5e7", fontSize: 13 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardBody>
        </Card>
      </div>

      <Card className="mt-4">
        <CardBody className="py-4">
          <p className="text-xs text-light-grey">
            This dashboard combines live data from Operations, Sales, and Customers. For deeper analysis
            (custom date ranges, drill-downs, exports), connect Power BI or Metabase directly to your
            Supabase database — both integrate natively with PostgreSQL. See <span className="text-orange font-medium">Settings → Integrations</span> for connection details.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
