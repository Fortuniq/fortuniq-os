"use client";

import { useState } from "react";
import Link from "next/link";
import { ClipboardList, Sparkles, CheckSquare, Square, Calendar, Trophy, Archive, Plus, Pencil, Trash2, FolderOpen, Inbox } from "lucide-react";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { Badge, statusTone } from "@/components/ui/Badge";
import { PageHeader } from "@/components/ui/PageHeader";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { formatDate, formatZARCompact } from "@/lib/format";
import { TenderFormModal } from "./TenderFormModal";
import { deleteTender } from "./tender-actions";

type Tender = {
  id: string | number;
  ref: string;
  title: string;
  closing: string;
  status: string;
  stage: string;
  value: number;
  compliance: number;
  complianceIsCalculated?: boolean;
};

type ChecklistItem = { item: string; done: boolean };

const TENDER_BOX_URL =
  "https://iqfuels.sharepoint.com/:f:/s/FortunIQDocuments/IgBnsyJtiKwQTIqoz7J5F-u3ASuq5RRrYVK1mu13szDkpeA?e=h5XHOL";

export function TendersView({ tenders, checklist, canManage }: { tenders: Tender[]; checklist: ChecklistItem[]; canManage: boolean }) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingTender, setEditingTender] = useState<Tender | null>(null);

  const open = tenders.filter((t) => t.status === "Open");
  const won = tenders.filter((t) => t.stage === "Closed — Won").length;

  const columns: Column<Tender>[] = [
    {
      key: "title",
      header: "Tender",
      render: (r) => (
        <div>
          <p className="font-medium text-navy">{r.title}</p>
          <p className="text-xs text-light-grey">{r.ref}</p>
        </div>
      ),
    },
    { key: "closing", header: "Closing", render: (r) => formatDate(r.closing) },
    { key: "status", header: "Status", render: (r) => <Badge tone={statusTone(r.status)}>{r.status}</Badge> },
    { key: "stage", header: "Stage" },
    { key: "value", header: "Value", align: "right", render: (r) => formatZARCompact(r.value) },
    {
      key: "compliance",
      header: "Compliance",
      render: (r) => r.complianceIsCalculated === false ? (
        <span className="text-xs text-light-grey">Not yet assessed</span>
      ) : (
        <div className="flex items-center gap-2 w-28">
          <div className="h-1.5 flex-1 rounded-full bg-border overflow-hidden">
            <div
              className={`h-full rounded-full ${r.compliance === 100 ? "bg-emerald-500" : r.compliance >= 80 ? "bg-orange" : "bg-amber-400"}`}
              style={{ width: `${r.compliance}%` }}
            />
          </div>
          <span className="text-xs text-grey w-8">{r.compliance}%</span>
        </div>
      ),
    },
    {
      key: "workspace", header: "", align: "right" as const,
      render: (r: Tender) => (
        <Link href={`/tenders/${r.id}`} className="text-grey hover:text-orange transition-colors inline-block" title="Open document workspace">
          <FolderOpen className="w-3.5 h-3.5" />
        </Link>
      ),
    },
    ...(canManage ? [{
      key: "actions", header: "", align: "right" as const,
      render: (r: Tender) => (
        <div className="flex items-center gap-2 justify-end">
          <button onClick={() => setEditingTender(r)} className="text-grey hover:text-navy transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
          <button
            onClick={() => { if (confirm(`Delete "${r.title}"?`)) deleteTender(String(r.id)); }}
            className="text-grey hover:text-red-600 transition-colors"
          ><Trash2 className="w-3.5 h-3.5" /></button>
        </div>
      ),
    }] : []),
  ];

  return (
    <div>
      <PageHeader
        title="Tenders"
        description="Register, compliance tracking, and AI-assisted review for every bid."
        action={
          <div className="flex items-center gap-2">
            <a
              href={TENDER_BOX_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs font-semibold text-navy bg-white border border-border px-3 py-2 rounded-lg hover:border-orange hover:text-orange transition-colors"
              title="Open the Tender Box SharePoint folder"
            >
              <Inbox className="w-3.5 h-3.5" /> Tender Box
            </a>
            {canManage && (
              <button onClick={() => setShowAddForm(true)} className="flex items-center gap-1.5 text-xs font-semibold text-white bg-navy px-3 py-2 rounded-lg hover:bg-orange transition-colors">
                <Plus className="w-3.5 h-3.5" /> Add Tender
              </button>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Open Tenders" value={String(open.length)} icon={ClipboardList} />
        <StatCard label="Pipeline Value" value={formatZARCompact(open.reduce((s, t) => s + t.value, 0))} icon={Trophy} />
        <StatCard label="Won (12 mo.)" value={String(won)} icon={Trophy} />
        <StatCard label="Bid Library" value="34" sub="Previous submissions" icon={Archive} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Tender Register</CardTitle>
          </CardHeader>
          <CardBody className="pt-2">
            <DataTable columns={columns} data={tenders} />
          </CardBody>
        </Card>

        <div className="space-y-4">
          <Card className="border-orange/30">
            <CardHeader>
              <CardTitle>
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-orange" /> AI Tender Review
                </span>
              </CardTitle>
            </CardHeader>
            <CardBody>
              <p className="text-sm text-navy leading-relaxed">
                &ldquo;This tender favours suppliers with cold-storage capacity we don&apos;t list — recommend
                adding our compliant fuel-testing partnership to strengthen section 4.2.&rdquo;
              </p>
              <p className="text-xs text-light-grey mt-2">AI review of GDOH-2026-114 · 2 hours ago</p>
              <button className="mt-3 text-xs font-semibold text-orange hover:underline">
                Run AI review on another tender →
              </button>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Submission Checklist</CardTitle>
              <span className="text-xs text-light-grey">GDOH-2026-114</span>
            </CardHeader>
            <CardBody className="space-y-2">
              {checklist.map((item) => (
                <div key={item.item} className="flex items-center gap-2">
                  {item.done ? (
                    <CheckSquare className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <Square className="w-4 h-4 text-light-grey shrink-0" />
                  )}
                  <span className={`text-sm ${item.done ? "text-navy" : "text-grey"}`}>{item.item}</span>
                </div>
              ))}
            </CardBody>
          </Card>

          <Card>
            <CardBody className="flex items-center gap-3 py-4">
              <Calendar className="w-5 h-5 text-orange shrink-0" />
              <div>
                <p className="text-sm font-semibold text-navy">Next deadline</p>
                <p className="text-xs text-grey">Tshwane Metro Fleet — closes 12 Aug</p>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>

      {showAddForm && <TenderFormModal onClose={() => setShowAddForm(false)} />}
      {editingTender && <TenderFormModal tender={editingTender} onClose={() => setEditingTender(null)} />}
    </div>
  );
}
