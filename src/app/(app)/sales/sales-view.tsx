"use client";

import { TrendingUp, FileText, Target, Award } from "lucide-react";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { Badge, statusTone } from "@/components/ui/Badge";
import { PageHeader } from "@/components/ui/PageHeader";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { formatZAR, formatZARCompact } from "@/lib/format";

type Quote = { id: string | number; customer: string; value: number; stage: string; owner: string };
type PipelineStage = { stage: string; count: number; value: number };

const columns: Column<Quote>[] = [
  { key: "id", header: "Quote" },
  { key: "customer", header: "Customer" },
  { key: "value", header: "Value", align: "right", render: (r) => formatZAR(r.value) },
  { key: "stage", header: "Stage", render: (r) => <Badge tone={statusTone(r.stage)}>{r.stage}</Badge> },
  { key: "owner", header: "Owner" },
];

export function SalesView({ quotes, pipeline }: { quotes: Quote[]; pipeline: PipelineStage[] }) {
  const totalPipelineValue = pipeline.reduce((s, p) => s + p.value, 0);
  const wonValue = pipeline.find((p) => p.stage === "Won")?.value ?? 0;
  const maxValue = Math.max(...pipeline.map((p) => p.value));

  return (
    <div>
      <PageHeader title="Sales" description="Pipeline, quotes, meetings and follow-ups." />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Pipeline Value" value={formatZARCompact(totalPipelineValue)} icon={TrendingUp} />
        <StatCard label="Open Quotes" value={String(quotes.length)} icon={FileText} />
        <StatCard label="Won (this quarter)" value={formatZARCompact(wonValue)} icon={Award} />
        <StatCard label="Deals in Pipeline" value={String(pipeline.reduce((s, p) => s + p.count, 0))} icon={Target} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Quotes</CardTitle>
          </CardHeader>
          <CardBody className="pt-2">
            <DataTable columns={columns} data={quotes} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pipeline by Stage</CardTitle>
          </CardHeader>
          <CardBody className="space-y-3">
            {pipeline.map((p) => (
              <div key={p.stage}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-navy font-medium">{p.stage}</span>
                  <span className="text-light-grey">{p.count} deals</span>
                </div>
                <div className="h-2 rounded-full bg-border overflow-hidden">
                  <div
                    className="h-full rounded-full bg-orange"
                    style={{ width: `${(p.value / maxValue) * 100}%` }}
                  />
                </div>
                <p className="text-xs text-light-grey mt-1">{formatZARCompact(p.value)}</p>
              </div>
            ))}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
