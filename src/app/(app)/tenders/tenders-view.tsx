"use client";

import { useState } from "react";
import Link from "next/link";
import { ClipboardList, Sparkles, CheckSquare, Square, Calendar, Trophy, Archive, Plus, Pencil, Trash2, FolderOpen, Inbox } from "lucide-react";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { Badge, statusTone } from "@/components/ui/Badge";
import { PageHeader } from "@/components/ui/PageHeader";
import { StickyScrollDataTable } from "@/components/ui/StickyScrollDataTable";
import { type Column } from "@/components/ui/DataTable";
import { formatDate, formatZARCompact } from "@/lib/format";
import { formatRelativeActivityTime, isTenderStale, computeEffectiveTenderStatus, computeEffectiveTenderStage, calculateDaysRemaining, formatDaysRemaining, isClosingSoon, isDueToday } from "@/lib/tender-core";
import { TenderFormModal } from "./TenderFormModal";
import { deleteTender, updateClosingSoonWarningDaysAction } from "./tender-actions";
import { TeamAssignmentsWidget } from "./TeamAssignmentsWidget";
import { NextDeadlinesWidget } from "./NextDeadlinesWidget";

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
  createdByName: string | null;
  createdByEmail: string | null;
  createdAt: string | null;
  assignedToName: string | null;
  assignedToEmail: string | null;
  currentPriority: string | null;
  lastActivityAt: string | null;
  lastActivityDescription: string | null;
};

type ChecklistItem = { item: string; done: boolean };

const TENDER_BOX_URL =
  "https://iqfuels.sharepoint.com/:f:/s/FortunIQDocuments/IgBnsyJtiKwQTIqoz7J5F-u3ASuq5RRrYVK1mu13szDkpeA?e=h5XHOL";

export function TendersView({ tenders, checklist, canManage, workflowCounts, teamAssignments, showTeamAssignments, closingSoonWarningDays, canManageSettings }: {
  tenders: Tender[]; checklist: ChecklistItem[]; canManage: boolean;
  workflowCounts: {
    drafting: number; pricing: number; awaitingAssessment: number; submissionReady: number; dueThisWeek: number; overdueTasks: number;
    dueToday: number; closingThisWeek: number; closingThisMonth: number; missed: number; submitted: number; awarded: number; lost: number;
  };
  teamAssignments: { id: string; tenderId: string; tenderRef: string; tenderTitle: string; stage: string; ownerEmail: string; ownerName: string | null; dueDate: string | null; priority: string; status: string; compliance: number }[];
  showTeamAssignments: boolean;
  closingSoonWarningDays: number;
  canManageSettings: boolean;
}) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingTender, setEditingTender] = useState<Tender | null>(null);
  const [stageFilter, setStageFilter] = useState<string | null>(null);

  // ---------- Filtering & Sorting — see docs/TENDER_REGISTER.md ----------
  const [createdByFilter, setCreatedByFilter] = useState("");
  const [assignedToFilter, setAssignedToFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [sortKey, setSortKey] = useState<"closing" | "createdAt" | "lastActivityAt" | "value" | "createdByName" | "assignedToName" | "status" | "stage">("closing");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const createdByOptions = Array.from(new Set(tenders.map((t) => t.createdByName).filter((n): n is string => !!n))).sort();
  const assignedToOptions = Array.from(new Set(tenders.map((t) => t.assignedToName).filter((n): n is string => !!n))).sort();

  function toggleSort(key: typeof sortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  }

  let visibleTenders = tenders;
  if (stageFilter) visibleTenders = visibleTenders.filter((t) => t.stage === stageFilter);
  if (createdByFilter) visibleTenders = visibleTenders.filter((t) => t.createdByName === createdByFilter);
  if (assignedToFilter) visibleTenders = visibleTenders.filter((t) => t.assignedToName === assignedToFilter);
  if (statusFilter) visibleTenders = visibleTenders.filter((t) => t.status === statusFilter);
  if (priorityFilter) visibleTenders = visibleTenders.filter((t) => t.currentPriority === priorityFilter);

  visibleTenders = [...visibleTenders].sort((a, b) => {
    let cmp = 0;
    switch (sortKey) {
      case "closing": cmp = a.closing.localeCompare(b.closing); break;
      case "createdAt": cmp = (a.createdAt ?? "").localeCompare(b.createdAt ?? ""); break;
      case "lastActivityAt": cmp = (a.lastActivityAt ?? "").localeCompare(b.lastActivityAt ?? ""); break;
      case "value": cmp = a.value - b.value; break;
      case "createdByName": cmp = (a.createdByName ?? "").localeCompare(b.createdByName ?? ""); break;
      case "assignedToName": cmp = (a.assignedToName ?? "").localeCompare(b.assignedToName ?? ""); break;
      case "status": cmp = a.status.localeCompare(b.status); break;
      case "stage": cmp = (a.stage ?? "").localeCompare(b.stage ?? ""); break;
    }
    return sortDir === "asc" ? cmp : -cmp;
  });

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
    {
      key: "closing", header: "Closing",
      render: (r) => {
        const days = calculateDaysRemaining(r.closing);
        const effectiveStatus = computeEffectiveTenderStatus({ closingDate: r.closing, status: r.status, stage: r.stage });
        const showIndicator = effectiveStatus === "Open" && (isDueToday(days) || isClosingSoon(days, closingSoonWarningDays));
        return (
          <div>
            <p className="text-sm text-navy">{formatDate(r.closing)}</p>
            {showIndicator && (
              <p className={`text-xs font-semibold ${isDueToday(days) ? "text-amber-600" : "text-orange"}`}>
                {isDueToday(days) ? "🟡 Due Today" : "🟠 Closing Soon"}
              </p>
            )}
            {effectiveStatus === "Missed" && <p className="text-xs font-semibold text-red-600">🔴 {formatDaysRemaining(days)}</p>}
          </div>
        );
      },
    },
    {
      key: "status", header: "Status",
      render: (r) => {
        const effective = computeEffectiveTenderStatus({ closingDate: r.closing, status: r.status, stage: r.stage });
        return <Badge tone={statusTone(effective)}>{effective}</Badge>;
      },
    },
    {
      key: "stage", header: "Stage",
      render: (r) => computeEffectiveTenderStage({ closingDate: r.closing, status: r.status, stage: r.stage }) ?? "—",
    },
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
      key: "createdBy", header: "Created By",
      render: (r) => <span className="text-sm text-navy" title={r.createdByEmail ?? undefined}>{r.createdByName ?? "—"}</span>,
    },
    {
      key: "assignedTo", header: "Assigned To",
      render: (r) => <span className="text-sm text-navy" title={r.assignedToEmail ?? undefined}>{r.assignedToName ?? "Not Assigned"}</span>,
    },
    { key: "createdOn", header: "Created On", render: (r) => <span className="text-sm text-grey whitespace-nowrap">{r.createdAt ? formatDate(r.createdAt) : "—"}</span> },
    {
      key: "lastActivity", header: "Last Activity",
      render: (r) => {
        const stale = isTenderStale(r.lastActivityAt, r.status);
        return (
          <div>
            <p className={`text-sm ${stale ? "text-amber-700 font-semibold" : "text-navy"}`}>
              {formatRelativeActivityTime(r.lastActivityAt)}{stale ? " ⚠" : ""}
            </p>
            {r.lastActivityDescription && <p className="text-xs text-light-grey">{r.lastActivityDescription}</p>}
          </div>
        );
      },
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

      {/* Tender workflow indicators — click a metric to filter the register below. See docs/TENDER_PLANNER.md. */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        {[
          { label: "Drafting", value: workflowCounts.drafting, stage: "Drafting" },
          { label: "Pricing", value: workflowCounts.pricing, stage: "Pricing" },
          { label: "Awaiting Assessment", value: workflowCounts.awaitingAssessment, stage: "Assessment & Verification" },
          { label: "Submission Ready", value: workflowCounts.submissionReady, stage: "Submission Ready" },
          { label: "Due This Week", value: workflowCounts.dueThisWeek, stage: null },
          { label: "Overdue Tasks", value: workflowCounts.overdueTasks, stage: null },
        ].map((m) => (
          <button
            key={m.label}
            onClick={() => m.stage && setStageFilter(stageFilter === m.stage ? null : m.stage)}
            className={`text-left p-3 rounded-lg border transition-colors ${stageFilter === m.stage && m.stage ? "border-orange bg-orange/5" : "border-border hover:border-orange"}`}
          >
            <p className="text-lg font-black text-navy">{m.value}</p>
            <p className="text-[11px] text-grey">{m.label}</p>
          </button>
        ))}
      </div>

      {/* Deadline & outcome counters (section 10) — same clickable-filter pattern as the workflow row above. See docs/TENDER_DEADLINES.md. */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
        {[
          { label: "Due Today", value: workflowCounts.dueToday, status: null },
          { label: "Closing This Week", value: workflowCounts.closingThisWeek, status: null },
          { label: "Closing This Month", value: workflowCounts.closingThisMonth, status: null },
          { label: "Missed", value: workflowCounts.missed, status: "Missed" },
          { label: "Submitted", value: workflowCounts.submitted, status: null },
          { label: "Awarded", value: workflowCounts.awarded, status: "Awarded" },
          { label: "Lost", value: workflowCounts.lost, status: "Lost" },
        ].map((m) => (
          <button
            key={m.label}
            onClick={() => m.status && setStatusFilter(statusFilter === m.status ? "" : m.status)}
            className={`text-left p-3 rounded-lg border transition-colors ${statusFilter === m.status && m.status ? "border-orange bg-orange/5" : "border-border hover:border-orange"}`}
          >
            <p className="text-lg font-black text-navy">{m.value}</p>
            <p className="text-[11px] text-grey">{m.label}</p>
          </button>
        ))}
      </div>

      {showTeamAssignments && <TeamAssignmentsWidget assignments={teamAssignments} />}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Tender Register{stageFilter ? ` — ${stageFilter}` : ""}</CardTitle>
            {stageFilter && <button onClick={() => setStageFilter(null)} className="text-xs text-orange hover:underline">Clear stage filter</button>}
          </CardHeader>
          <CardBody className="pt-2">
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <select value={createdByFilter} onChange={(e) => setCreatedByFilter(e.target.value)} className="text-xs border border-border rounded-lg px-2 py-1.5">
                <option value="">All creators</option>
                {createdByOptions.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
              <select value={assignedToFilter} onChange={(e) => setAssignedToFilter(e.target.value)} className="text-xs border border-border rounded-lg px-2 py-1.5">
                <option value="">All owners</option>
                {assignedToOptions.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="text-xs border border-border rounded-lg px-2 py-1.5">
                <option value="">All statuses</option>
                <option value="Open">Open</option>
                <option value="Awarded">Awarded</option>
                <option value="Lost">Lost</option>
              </select>
              <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} className="text-xs border border-border rounded-lg px-2 py-1.5">
                <option value="">All priorities</option>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
              <span className="text-xs text-light-grey ml-1">Sort:</span>
              <select value={sortKey} onChange={(e) => setSortKey(e.target.value as typeof sortKey)} className="text-xs border border-border rounded-lg px-2 py-1.5">
                <option value="closing">Closing Date</option>
                <option value="createdAt">Created On</option>
                <option value="lastActivityAt">Last Activity</option>
                <option value="value">Tender Value</option>
                <option value="createdByName">Created By</option>
                <option value="assignedToName">Assigned To</option>
                <option value="status">Status</option>
                <option value="stage">Stage</option>
              </select>
              <button onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))} className="text-xs border border-border rounded-lg px-2 py-1.5 text-grey hover:text-orange hover:border-orange transition-colors">
                {sortDir === "asc" ? "↑ Asc" : "↓ Desc"}
              </button>
              {(createdByFilter || assignedToFilter || statusFilter || priorityFilter) && (
                <button
                  onClick={() => { setCreatedByFilter(""); setAssignedToFilter(""); setStatusFilter(""); setPriorityFilter(""); }}
                  className="text-xs text-orange hover:underline"
                >
                  Clear filters
                </button>
              )}
            </div>
            <StickyScrollDataTable columns={columns} data={visibleTenders} />
          </CardBody>
        </Card>

        <div className="space-y-4">
          <NextDeadlinesWidget tenders={tenders} warningDays={closingSoonWarningDays} />
          {canManageSettings && <ClosingSoonSettingsCard currentDays={closingSoonWarningDays} />}
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

/** "Allow the warning period to be configurable in Settings" — a compact inline control, Super Admin only. See docs/TENDER_DEADLINES.md. */
function ClosingSoonSettingsCard({ currentDays }: { currentDays: number }) {
  const [value, setValue] = useState(String(currentDays));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    const days = Number(value);
    if (!Number.isFinite(days) || days <= 0) return;
    setSaving(true);
    setSaved(false);
    const result = await updateClosingSoonWarningDaysAction(days);
    setSaving(false);
    if (result?.error) alert(result.error);
    else { setSaved(true); setTimeout(() => setSaved(false), 2000); }
  }

  return (
    <Card>
      <CardBody>
        <p className="text-xs font-semibold text-grey uppercase tracking-wide mb-2">Closing Soon Warning</p>
        <div className="flex items-center gap-2">
          <input
            type="number" min={1} value={value} onChange={(e) => setValue(e.target.value)}
            className="w-16 text-sm px-2 py-1.5 rounded-lg border border-border"
          />
          <span className="text-xs text-grey">days</span>
          <button onClick={save} disabled={saving} className="text-xs font-semibold text-white bg-navy px-3 py-1.5 rounded-lg hover:bg-orange transition-colors disabled:opacity-50 ml-auto">
            {saving ? "Saving…" : saved ? "Saved" : "Save"}
          </button>
        </div>
      </CardBody>
    </Card>
  );
}
