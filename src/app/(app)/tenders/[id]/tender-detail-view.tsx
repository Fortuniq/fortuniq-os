"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, ClipboardList, CheckSquare, FolderOpen, Send, Plus, Trash2,
  ExternalLink, FolderSync, FileText, Folder, X, Sparkles,
} from "lucide-react";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge, statusTone } from "@/components/ui/Badge";
import { formatDate, formatZARFull } from "@/lib/format";
import type { TenderDetail } from "@/lib/data";
import {
  toggleChecklistItem, addChecklistItem, deleteChecklistItem,
  updateSubmissionInfo, retryTenderFolderCreation, generateChecklistWithAI,
} from "../tender-actions";

type Tab = "overview" | "compliance" | "documents" | "submissions";

export function TenderDetailView({ tender, canEdit, sharePointConfigured }: { tender: TenderDetail; canEdit: boolean; sharePointConfigured: boolean }) {
  const [tab, setTab] = useState<Tab>("overview");

  const tabs: { key: Tab; label: string; icon: typeof ClipboardList }[] = [
    { key: "overview", label: "Overview", icon: ClipboardList },
    { key: "compliance", label: "Compliance", icon: CheckSquare },
    { key: "documents", label: "Documents", icon: FolderOpen },
    { key: "submissions", label: "Submissions", icon: Send },
  ];

  return (
    <div>
      <Link href="/tenders" className="flex items-center gap-1.5 text-sm text-grey hover:text-navy transition-colors mb-4">
        <ArrowLeft className="w-4 h-4" /> Back to Tender Register
      </Link>

      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="font-display text-2xl font-black text-navy">{tender.title}</h1>
            <Badge tone={statusTone(tender.status)}>{tender.status}</Badge>
          </div>
          <p className="text-sm text-grey mt-1 font-mono">{tender.ref}</p>
        </div>
      </div>

      <div className="flex gap-1 border-b border-border mb-5">
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 text-sm font-medium px-4 py-2.5 border-b-2 transition-colors ${
                tab === t.key ? "border-orange text-navy" : "border-transparent text-grey hover:text-navy"
              }`}
            >
              <Icon className="w-4 h-4" /> {t.label}
            </button>
          );
        })}
      </div>

      {tab === "overview" && <OverviewTab tender={tender} />}
      {tab === "compliance" && <ComplianceTab tender={tender} canEdit={canEdit} />}
      {tab === "documents" && <DocumentsTab tender={tender} canEdit={canEdit} sharePointConfigured={sharePointConfigured} />}
      {tab === "submissions" && <SubmissionsTab tender={tender} canEdit={canEdit} />}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between py-2.5 border-b border-border last:border-0 text-sm">
      <span className="text-grey">{label}</span>
      <span className="text-navy font-medium">{value ?? "—"}</span>
    </div>
  );
}

function OverviewTab({ tender }: { tender: TenderDetail }) {
  return (
    <Card className="max-w-xl">
      <CardBody>
        <InfoRow label="Reference" value={tender.ref} />
        <InfoRow label="Closing Date" value={formatDate(tender.closing)} />
        <InfoRow label="Status" value={tender.status} />
        <InfoRow label="Stage" value={tender.stage} />
        <InfoRow label="Value" value={formatZARFull(tender.value)} />
        <InfoRow label="Compliance" value={`${tender.compliance}%`} />
      </CardBody>
    </Card>
  );
}

function ComplianceTab({ tender, canEdit }: { tender: TenderDetail; canEdit: boolean }) {
  const [newItem, setNewItem] = useState("");
  const [adding, setAdding] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<string | null>(null);

  const completedCount = tender.checklist.filter((c) => c.done).length;
  const barTone = tender.compliance === 100 ? "bg-emerald-500" : tender.compliance >= 80 ? "bg-orange" : "bg-amber-400";

  async function handleAdd() {
    if (!newItem.trim()) return;
    setAdding(true);
    try {
      await addChecklistItem(tender.id, newItem);
      setNewItem("");
    } finally {
      setAdding(false);
    }
  }

  async function handleGenerate() {
    setGenerating(true);
    setAiError(null);
    setAiResult(null);
    try {
      const result = await generateChecklistWithAI(tender.id, tender.ref, tender.title);
      if (result?.error) {
        setAiError(result.error);
      } else {
        setAiResult(
          result?.itemsAdded
            ? `FortunIQ Intelligence added ${result.itemsAdded} new requirement${result.itemsAdded === 1 ? "" : "s"} — review and confirm each one below.`
            : "FortunIQ Intelligence didn't find any new requirements beyond what's already on this checklist."
        );
      }
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "Something went wrong generating the checklist.");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <Card className="max-w-xl">
      <CardBody>
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-sm font-semibold text-navy">
              {tender.complianceIsCalculated ? `${tender.compliance}% compliant` : "Not yet assessed"}
            </p>
            <p className="text-xs text-light-grey">{completedCount} of {tender.checklist.length} confirmed</p>
          </div>
          {tender.checklist.length > 0 && (
            <div className="h-1.5 rounded-full bg-border overflow-hidden">
              <div className={`h-full rounded-full ${barTone} transition-all`} style={{ width: `${tender.compliance}%` }} />
            </div>
          )}
          {!tender.complianceIsCalculated && (
            <p className="text-[11px] text-light-grey mt-1.5">
              Add or generate checklist items below — compliance is calculated automatically once a checklist exists.
            </p>
          )}
        </div>

        <div className="space-y-1">
          {tender.checklist.map((item) => (
            <div key={item.id} className="flex items-center gap-2 group py-1">
              <input
                type="checkbox"
                checked={item.done}
                disabled={!canEdit}
                onChange={(e) => toggleChecklistItem(item.id, tender.id, e.target.checked)}
                className="w-4 h-4 accent-orange shrink-0"
              />
              <span className={`text-sm flex-1 ${item.done ? "text-navy" : "text-grey"}`}>{item.item}</span>
              {item.source === "ai" && (
                <span className="flex items-center gap-1 text-[10px] text-orange bg-orange/10 px-1.5 py-0.5 rounded-full shrink-0" title="Proposed by FortunIQ Intelligence">
                  <Sparkles className="w-2.5 h-2.5" /> AI
                </span>
              )}
              {canEdit && (
                <button
                  onClick={() => deleteChecklistItem(item.id, tender.id)}
                  className="text-grey hover:text-red-600 transition-colors opacity-0 group-hover:opacity-100"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
          {tender.checklist.length === 0 && <p className="text-sm text-grey py-4">No checklist items yet.</p>}
        </div>

        {canEdit && (
          <div className="flex gap-2 mt-4 pt-4 border-t border-border">
            <input
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              placeholder="Add a requirement…"
              className="flex-1 text-sm px-3 py-2 rounded-lg border border-border"
            />
            <button
              onClick={handleAdd}
              disabled={adding || !newItem.trim()}
              className="flex items-center gap-1 text-xs font-semibold text-white bg-navy px-3 py-2 rounded-lg hover:bg-orange transition-colors disabled:opacity-50"
            >
              <Plus className="w-3.5 h-3.5" /> Add
            </button>
          </div>
        )}

        {canEdit && (
          <div className="mt-3">
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="flex items-center gap-1.5 text-xs font-semibold text-orange border border-orange/30 bg-orange/5 px-3 py-2 rounded-lg hover:bg-orange/10 transition-colors disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5" /> {generating ? "Analysing tender documents…" : "Generate Checklist with FortunIQ Intelligence"}
            </button>
            <p className="text-[11px] text-light-grey mt-1.5">
              Proposes requirements from this tender&apos;s own documents only — it never confirms an item itself,
              and never sees other tenders, HR, or Finance documents.
            </p>
          </div>
        )}
        {aiError && <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2 mt-3">{aiError}</div>}
        {aiResult && <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-lg px-3 py-2 mt-3">{aiResult}</div>}
      </CardBody>
    </Card>
  );
}

type WorkspaceFile = { id: string; name: string; webUrl: string; isFolder: boolean; lastModifiedDateTime: string };

function DocumentsTab({ tender, canEdit, sharePointConfigured }: { tender: TenderDetail; canEdit: boolean; sharePointConfigured: boolean }) {
  const [files, setFiles] = useState<WorkspaceFile[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  async function loadFiles() {
    if (!tender.sharepointFolderId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/sharepoint/tender-folder", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folderId: tender.sharepointFolderId }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error ?? "Couldn't load documents.");
      else setFiles(data.files);
    } catch {
      setError("Couldn't reach SharePoint.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateFolder() {
    setCreating(true);
    setError(null);
    try {
      const result = await retryTenderFolderCreation(tender.id, tender.ref, tender.title);
      if (result?.error) {
        setError(result.error);
      } else {
        window.location.reload();
      }
    } catch (err) {
      // Should be rare now that retryTenderFolderCreation returns its
      // errors instead of throwing them — this only catches something
      // genuinely unexpected (e.g. a network failure reaching the server
      // at all), not the normal SharePoint/Graph failure paths.
      setError(err instanceof Error ? err.message : "Couldn't create the SharePoint folder.");
    } finally {
      setCreating(false);
    }
  }

  if (!sharePointConfigured) {
    return (
      <Card className="max-w-xl">
        <CardBody className="text-center py-10">
          <p className="text-sm text-grey">SharePoint isn&apos;t connected yet. See docs/SHAREPOINT_SETUP.md.</p>
        </CardBody>
      </Card>
    );
  }

  if (!tender.sharepointFolderId) {
    return (
      <Card className="max-w-xl">
        <CardBody className="text-center py-10">
          <FolderSync className="w-10 h-10 text-light-grey mx-auto mb-3" />
          <p className="text-sm text-grey mb-4">
            This tender doesn&apos;t have a SharePoint folder yet — it may not have been created successfully
            when the tender was added.
          </p>
          {canEdit && (
            <button
              onClick={handleCreateFolder}
              disabled={creating}
              className="text-sm font-semibold text-white bg-navy px-4 py-2 rounded-lg hover:bg-orange transition-colors disabled:opacity-50"
            >
              {creating ? "Creating…" : "Create SharePoint Folder"}
            </button>
          )}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2 mt-4 text-left">
              {error}
            </div>
          )}
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardBody>
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={loadFiles}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs font-semibold text-white bg-navy px-3 py-2 rounded-lg hover:bg-orange transition-colors disabled:opacity-50"
          >
            <FolderSync className="w-3.5 h-3.5" /> {loading ? "Loading…" : files === null ? "Load Documents" : "Refresh"}
          </button>
          {tender.sharepointFolderUrl && (
            <a
              href={tender.sharepointFolderUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs font-semibold text-navy border border-border px-3 py-2 rounded-lg hover:border-orange transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" /> Open in SharePoint
            </a>
          )}
        </div>

        {error && <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2 mb-3">{error}</div>}

        {files && files.length === 0 && <p className="text-sm text-grey py-6 text-center">No files or folders yet.</p>}

        {files && files.length > 0 && (
          <div className="divide-y divide-border">
            {files.map((f) => (
              <a
                key={f.id} href={f.webUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-3 py-2.5 hover:bg-surface/60 transition-colors -mx-2 px-2 rounded"
              >
                {f.isFolder ? <Folder className="w-4 h-4 text-orange shrink-0" /> : <FileText className="w-4 h-4 text-grey shrink-0" />}
                <span className="text-sm text-navy flex-1 truncate">{f.name}</span>
                <span className="text-xs text-light-grey shrink-0">{formatDate(f.lastModifiedDateTime)}</span>
              </a>
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function SubmissionsTab({ tender, canEdit }: { tender: TenderDetail; canEdit: boolean }) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(formData: FormData) {
    setSaving(true);
    setSaved(false);
    try {
      await updateSubmissionInfo(tender.id, formData);
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  const [existingDate, existingTime] = tender.submissionDatetime
    ? tender.submissionDatetime.split("T").map((s, i) => (i === 1 ? s.slice(0, 5) : s))
    : ["", ""];

  return (
    <Card className="max-w-md">
      <CardBody>
        <form action={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-medium text-grey block mb-1">Submission Method</label>
            <select name="submissionMethod" defaultValue={tender.submissionMethod ?? ""} disabled={!canEdit} className="w-full text-sm px-3 py-2 rounded-lg border border-border disabled:opacity-60">
              <option value="">Not yet submitted</option>
              <option value="Online">Online</option>
              <option value="Hand Delivery">Hand Delivery</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-grey block mb-1">Submission Date</label>
              <input name="submissionDate" type="date" defaultValue={existingDate} disabled={!canEdit} className="w-full text-sm px-3 py-2 rounded-lg border border-border disabled:opacity-60" />
            </div>
            <div>
              <label className="text-xs font-medium text-grey block mb-1">Submission Time</label>
              <input name="submissionTime" type="time" defaultValue={existingTime} disabled={!canEdit} className="w-full text-sm px-3 py-2 rounded-lg border border-border disabled:opacity-60" />
            </div>
          </div>
          {canEdit && (
            <button type="submit" disabled={saving} className="text-sm font-semibold text-white bg-navy px-4 py-2 rounded-lg hover:bg-orange transition-colors disabled:opacity-50">
              {saving ? "Saving…" : "Save"}
            </button>
          )}
          {saved && <p className="text-xs text-emerald-600">Saved.</p>}
        </form>
      </CardBody>
    </Card>
  );
}
