"use client";

import { useState, useMemo } from "react";
import { FileText, Download, Search, X, ExternalLink, FolderSync, CheckCircle2, Loader2, Paperclip, Plus, Trash2, AlertTriangle } from "lucide-react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/ui/PageHeader";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { formatDate } from "@/lib/format";
import { catalogueSharePointFile, updateDocumentClassification, deleteDocumentRecord } from "./document-actions";
import { DocumentLinkModal } from "./DocumentLinkModal";
import { VersionHistoryModal } from "./VersionHistoryModal";
import { DocumentWorkflowControl } from "./DocumentWorkflowControl";
import { ExpiryBadge } from "./ExpiryBadge";
import { isExpiringSoon, isExpired } from "@/lib/documents-core";
import type { SharePointFile } from "@/lib/graph";

type Doc = {
  id: string | number;
  name: string;
  category: string;
  version: string;
  owner: string;
  updated: string;
  status: string;
  sharepointItemId: string | null;
  sharepointWebUrl: string | null;
  classification: "General" | "Internal" | "Confidential" | "Highly Confidential";
  authorizedRoles: string[];
  authorizedEmails: string[];
  aiExcluded: boolean;
  expiryDate: string | null;
  currentVersionNumber: number;
  modifiedBy: string | null;
};

const categoryTone: Record<string, "orange" | "info" | "success" | "warning" | "neutral"> = {
  Policies: "info", Legal: "neutral", Brand: "orange", Certificates: "success",
  Licences: "success", Tax: "warning", Insurance: "warning", SOPs: "info", "Company Profile": "neutral",
  Marketing: "orange", Finance: "warning", Operations: "info", HR: "neutral", Templates: "neutral",
};

export function DocumentsView({
  documents, expiringDocuments, sharePointConfigured, isAdmin, canCreate, canEdit, canApprove, canDelete, canViewArchive, categories,
}: {
  documents: Doc[];
  expiringDocuments: { id: string; name: string; category: string; expiryDate: string; status: string }[];
  sharePointConfigured: boolean;
  isAdmin: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canApprove: boolean;
  canDelete: boolean;
  canViewArchive: boolean;
  categories: readonly string[];
}) {
  const [manageAccessDoc, setManageAccessDoc] = useState<Doc | null>(null);
  const [linkModalDoc, setLinkModalDoc] = useState<Doc | null>(null);
  const [versionsDoc, setVersionsDoc] = useState<Doc | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState<string | null>(null);
  const [browseOpen, setBrowseOpen] = useState(false);
  const [browseFiles, setBrowseFiles] = useState<SharePointFile[]>([]);
  const [browseLoading, setBrowseLoading] = useState(false);
  const [browseError, setBrowseError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SharePointFile[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("All");

  const catalogued = new Set(documents.map((d) => d.sharepointItemId).filter(Boolean));

  const relevantExpiring = useMemo(
    () => expiringDocuments.filter((d) => isExpired(d.expiryDate) || isExpiringSoon(d.expiryDate)),
    [expiringDocuments]
  );

  const filteredDocuments = useMemo(
    () => (categoryFilter === "All" ? documents : documents.filter((d) => d.category === categoryFilter)),
    [documents, categoryFilter]
  );

  async function openPreview(itemId: string, name: string) {
    setPreviewLoading(itemId);
    try {
      const res = await fetch("/api/sharepoint/preview", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ itemId, name }),
      });
      const data = await res.json();
      if (res.ok) setPreviewUrl(data.previewUrl);
      else alert(data.error);
    } finally {
      setPreviewLoading(null);
    }
  }

  async function openBrowse() {
    setBrowseOpen(true);
    setBrowseLoading(true);
    setBrowseError(null);
    try {
      const res = await fetch("/api/sharepoint/list");
      const data = await res.json();
      if (res.ok) setBrowseFiles(data.files.filter((f: SharePointFile) => !f.isFolder));
      else setBrowseError(data.error);
    } catch {
      setBrowseError("Couldn't reach SharePoint.");
    } finally {
      setBrowseLoading(false);
    }
  }

  async function runSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!searchQuery.trim()) { setSearchResults(null); return; }
    setSearching(true);
    try {
      const res = await fetch("/api/sharepoint/search", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: searchQuery }),
      });
      const data = await res.json();
      if (res.ok) setSearchResults(data.files.filter((f: SharePointFile) => !f.isFolder));
    } finally {
      setSearching(false);
    }
  }

  async function handleDelete(doc: Doc) {
    if (!confirm(`Delete the FortunIQ OS record for "${doc.name}"? The SharePoint file itself will NOT be deleted.`)) return;
    const result = await deleteDocumentRecord(String(doc.id));
    if (result?.error) alert(result.error);
  }

  const columns: Column<Doc>[] = [
    {
      key: "name", header: "Document",
      render: (r) => (
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-orange shrink-0" />
          <span className="font-medium">{r.name}</span>
        </div>
      ),
    },
    { key: "category", header: "Category", render: (r) => <Badge tone={categoryTone[r.category] ?? "neutral"}>{r.category}</Badge> },
    {
      key: "status", header: "Status",
      render: (r) => <DocumentWorkflowControl documentId={String(r.id)} status={r.status} canEdit={canEdit} canApprove={canApprove} />,
    },
    {
      key: "classification", header: "Classification",
      render: (r) => {
        const tone = r.classification === "Highly Confidential" ? "danger"
          : r.classification === "Confidential" ? "warning"
          : r.classification === "Internal" ? "neutral" : "success";
        if (!isAdmin) {
          return (
            <span className="flex items-center gap-1.5">
              <Badge tone={tone}>{r.classification}</Badge>
              {r.aiExcluded && <span title="Excluded from AI Assistant" className="text-[10px] text-light-grey">🚫 AI</span>}
            </span>
          );
        }
        return (
          <button
            onClick={() => setManageAccessDoc(r)}
            className="flex items-center gap-1.5 hover:opacity-75 transition-opacity"
            title="Manage classification and access"
          >
            <Badge tone={tone}>{r.classification}</Badge>
            {r.aiExcluded && <span title="Excluded from AI Assistant" className="text-[10px] text-light-grey">🚫 AI</span>}
          </button>
        );
      },
    },
    { key: "version", header: "Version", render: (r) => <span className="text-sm text-navy">{r.version ?? `v${r.currentVersionNumber}`}</span> },
    { key: "expiry", header: "Expiry", render: (r) => <ExpiryBadge expiryDate={r.expiryDate} /> },
    { key: "owner", header: "Owner" },
    {
      key: "updated", header: "Last Updated",
      render: (r) => (
        <div>
          <p className="text-sm">{formatDate(r.updated)}</p>
          {r.modifiedBy && <p className="text-xs text-light-grey">by {r.modifiedBy}</p>}
        </div>
      ),
    },
    {
      key: "linked", header: "Linked Document",
      render: (r) => (
        <div className="flex items-center gap-1.5 justify-end">
          {r.sharepointItemId ? (
            <>
              <button
                onClick={() => setVersionsDoc(r)}
                className="text-xs font-medium text-grey hover:text-orange transition-colors flex items-center gap-1"
                title="Version history"
              >
                📎 Linked Document
              </button>
              <button
                onClick={() => openPreview(r.sharepointItemId!, r.name)}
                disabled={previewLoading === r.sharepointItemId}
                className="p-1.5 rounded hover:bg-surface text-grey hover:text-orange transition-colors" title="Preview"
              >
                {previewLoading === r.sharepointItemId ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              </button>
              {r.sharepointWebUrl && (
                <a href={r.sharepointWebUrl} target="_blank" rel="noopener noreferrer" title="Open in SharePoint">
                  <ExternalLink className="w-3.5 h-3.5 text-light-grey hover:text-orange" />
                </a>
              )}
              <button onClick={() => setLinkModalDoc(r)} className="p-1.5 rounded hover:bg-surface text-grey hover:text-orange transition-colors" title="Manage link">
                <Paperclip className="w-4 h-4" />
              </button>
            </>
          ) : canEdit ? (
            <button
              onClick={() => setLinkModalDoc(r)}
              className="text-xs font-semibold text-orange hover:underline flex items-center gap-1"
            >
              ➕ Attach Document
            </button>
          ) : (
            <span className="text-xs text-light-grey italic">Not linked</span>
          )}
          {canDelete && (
            <button onClick={() => handleDelete(r)} className="p-1.5 rounded hover:bg-red-50 text-light-grey hover:text-red-600 transition-colors" title="Delete record">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Documents"
        description="Enterprise document control — files live in SharePoint, with versioning, approval workflow, and audit trail managed here."
        action={
          sharePointConfigured && canCreate ? (
            <button onClick={openBrowse} className="flex items-center gap-2 bg-navy text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-orange transition-colors">
              <FolderSync className="w-4 h-4" /> Browse SharePoint
            </button>
          ) : undefined
        }
      />

      {!sharePointConfigured && (
        <Card className="mb-4 border-amber-200 bg-amber-50">
          <CardBody className="text-sm text-amber-800">
            SharePoint isn&apos;t connected yet — showing catalogued document names only, without live previews, upload, or version
            history. See <span className="font-medium">docs/SHAREPOINT_SETUP.md</span> to connect it.
          </CardBody>
        </Card>
      )}

      {relevantExpiring.length > 0 && (
        <Card className="mb-4 border-amber-200 bg-amber-50">
          <CardBody>
            <p className="text-sm font-semibold text-amber-800 flex items-center gap-1.5 mb-2">
              <AlertTriangle className="w-4 h-4" /> {relevantExpiring.length} document{relevantExpiring.length === 1 ? "" : "s"} expiring soon or expired
            </p>
            <div className="space-y-1">
              {relevantExpiring.slice(0, 5).map((d) => (
                <p key={d.id} className="text-xs text-amber-800">
                  {d.name} ({d.category}) — <ExpiryBadge expiryDate={d.expiryDate} />
                </p>
              ))}
            </div>
          </CardBody>
        </Card>
      )}

      {sharePointConfigured && (
        <form onSubmit={runSearch} className="mb-4 flex gap-2">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-light-grey absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search all documents in SharePoint…"
              className="pl-9 pr-4 py-2 rounded-lg bg-white border border-border text-sm w-full focus:outline-none focus:ring-2 focus:ring-orange/40"
            />
          </div>
          <button type="submit" disabled={searching} className="text-sm font-semibold text-white bg-navy px-4 py-2 rounded-lg hover:bg-orange transition-colors disabled:opacity-50">
            {searching ? "Searching…" : "Search"}
          </button>
          {searchResults && (
            <button type="button" onClick={() => { setSearchResults(null); setSearchQuery(""); }} className="text-sm text-grey px-3">
              Clear
            </button>
          )}
        </form>
      )}

      {searchResults && (
        <Card className="mb-4">
          <CardHeader><CardTitle>Search Results ({searchResults.length})</CardTitle></CardHeader>
          <CardBody className="space-y-2">
            {searchResults.length === 0 && <p className="text-sm text-grey">No matching files found in SharePoint.</p>}
            {searchResults.map((f) => (
              <div key={f.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-orange" />
                  <span className="text-sm text-navy">{f.name}</span>
                </div>
                <a href={f.webUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-orange font-medium hover:underline">
                  Open in SharePoint →
                </a>
              </div>
            ))}
          </CardBody>
        </Card>
      )}

      <div className="flex flex-wrap gap-2 mb-4">
        {["All", ...categories, ...(canViewArchive ? ["Archive"] : [])].map((c) => (
          <button
            key={c}
            onClick={() => setCategoryFilter(c)}
            className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${categoryFilter === c ? "bg-navy text-white border-navy" : "border-border text-grey hover:border-orange hover:text-orange"}`}
          >
            {c}
          </button>
        ))}
      </div>

      <Card>
        <CardBody className="pt-5">
          <DataTable columns={columns} data={filteredDocuments} />
        </CardBody>
      </Card>

      {previewUrl && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-6" onClick={() => setPreviewUrl(null)}>
          <div className="bg-white rounded-xl w-full max-w-4xl h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-border">
              <p className="font-semibold text-navy">Document Preview</p>
              <button onClick={() => setPreviewUrl(null)}><X className="w-5 h-5 text-grey" /></button>
            </div>
            <iframe src={previewUrl} className="flex-1 rounded-b-xl" title="Document preview" />
          </div>
        </div>
      )}

      {manageAccessDoc && (
        <ManageAccessModal doc={manageAccessDoc} onClose={() => setManageAccessDoc(null)} />
      )}

      {linkModalDoc && (
        <DocumentLinkModal
          doc={linkModalDoc}
          onClose={() => setLinkModalDoc(null)}
          onOpenVersions={() => { setVersionsDoc(linkModalDoc); setLinkModalDoc(null); }}
        />
      )}

      {versionsDoc && (
        <VersionHistoryModal
          documentId={String(versionsDoc.id)}
          docName={versionsDoc.name}
          canRestore={canEdit}
          onClose={() => setVersionsDoc(null)}
        />
      )}

      {browseOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-6" onClick={() => setBrowseOpen(false)}>
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-border">
              <p className="font-semibold text-navy">Browse SharePoint Library</p>
              <button onClick={() => setBrowseOpen(false)}><X className="w-5 h-5 text-grey" /></button>
            </div>
            <div className="p-4 overflow-y-auto">
              {browseLoading && <p className="text-sm text-grey flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading files…</p>}
              {browseError && <p className="text-sm text-red-600">{browseError}</p>}
              {!browseLoading && !browseError && browseFiles.map((f) => (
                <div key={f.id} className="flex items-center justify-between py-3 border-b border-border last:border-0">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-orange" />
                    <span className="text-sm text-navy">{f.name}</span>
                  </div>
                  {catalogued.has(f.id) ? (
                    <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium"><CheckCircle2 className="w-3.5 h-3.5" /> Catalogued</span>
                  ) : (
                    <form action={async (formData) => { const result = await catalogueSharePointFile(formData); if (result?.error) alert(result.error); else setBrowseOpen(false); }} className="flex items-center gap-2">
                      <select name="category" defaultValue="Policies" className="text-xs border border-border rounded px-1.5 py-1">
                        {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <input type="hidden" name="sharepointItemId" value={f.id} />
                      <input type="hidden" name="name" value={f.name} />
                      <input type="hidden" name="webUrl" value={f.webUrl} />
                      <button type="submit" className="text-xs font-semibold text-orange hover:underline flex items-center gap-1">
                        <Plus className="w-3 h-3" /> Add to Documents
                      </button>
                    </form>
                  )}
                </div>
              ))}
              {!browseLoading && !browseError && browseFiles.length === 0 && (
                <p className="text-sm text-grey">No files found in your configured SharePoint library.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const ALL_ROLE_OPTIONS = ["Super Admin", "Management", "HR/Admin", "Finance", "Sales/Marketing", "Employee"];
const CLASSIFICATION_OPTIONS = ["General", "Internal", "Confidential", "Highly Confidential"] as const;

function ManageAccessModal({ doc, onClose }: { doc: Doc; onClose: () => void }) {
  const [classification, setClassification] = useState(doc.classification);
  const [roles, setRoles] = useState<string[]>(doc.authorizedRoles);
  const [emails, setEmails] = useState(doc.authorizedEmails.join(", "));
  const [aiExcluded, setAiExcluded] = useState(doc.aiExcluded);
  const [saving, setSaving] = useState(false);

  const needsExplicitAccess = classification === "Confidential" || classification === "Highly Confidential";

  function toggleRole(role: string) {
    setRoles((r) => (r.includes(role) ? r.filter((x) => x !== role) : [...r, role]));
  }

  async function save() {
    setSaving(true);
    try {
      const emailList = emails.split(",").map((e) => e.trim()).filter(Boolean);
      const result = await updateDocumentClassification(String(doc.id), classification, roles, emailList, aiExcluded);
      if (result?.error) alert(result.error);
      else onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-6" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-border">
          <p className="font-semibold text-navy">Manage Access — {doc.name}</p>
          <button onClick={onClose}><X className="w-5 h-5 text-grey" /></button>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <label className="text-xs font-medium text-grey block mb-1">Classification</label>
            <select
              value={classification}
              onChange={(e) => setClassification(e.target.value as Doc["classification"])}
              className="w-full text-sm px-3 py-2 rounded-lg border border-border"
            >
              {CLASSIFICATION_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <p className="text-[11px] text-light-grey mt-1">
              General and Internal are visible to anyone with Documents access. Confidential and Highly
              Confidential require explicit authorisation below.
            </p>
          </div>

          {needsExplicitAccess && (
            <>
              <div>
                <label className="text-xs font-medium text-grey block mb-2">Authorised roles</label>
                <div className="flex flex-wrap gap-2">
                  {ALL_ROLE_OPTIONS.map((role) => (
                    <label key={role} className="flex items-center gap-1.5 text-xs text-navy bg-surface px-2.5 py-1.5 rounded-full">
                      <input type="checkbox" checked={roles.includes(role)} onChange={() => toggleRole(role)} className="w-3.5 h-3.5 accent-orange" />
                      {role}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-grey block mb-1">Additionally authorised people (comma-separated emails)</label>
                <input
                  type="text"
                  value={emails}
                  onChange={(e) => setEmails(e.target.value)}
                  placeholder="cfo@iqfuels.co.za, board.member@iqfuels.co.za"
                  className="w-full text-sm px-3 py-2 rounded-lg border border-border"
                />
                <p className="text-[11px] text-light-grey mt-1">
                  Named individuals see this document regardless of their role — useful for board/legal/executive
                  material that shouldn&apos;t be tied to a whole role.
                </p>
              </div>
            </>
          )}

          <div className="border-t border-border pt-4">
            <label className="flex items-center gap-2 text-sm text-navy">
              <input type="checkbox" checked={aiExcluded} onChange={(e) => setAiExcluded(e.target.checked)} className="w-4 h-4 accent-orange" />
              Exclude entirely from AI Assistant
            </label>
            <p className="text-[11px] text-light-grey mt-1 ml-6">
              When checked, the AI Assistant never sees or references this document, for anyone — regardless of
              classification or authorisation. Authorised people can still open it normally in Documents.
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2 p-4 border-t border-border">
          <button onClick={onClose} className="text-sm text-grey px-4 py-2 rounded-lg hover:bg-surface transition-colors">Cancel</button>
          <button
            onClick={save}
            disabled={saving}
            className="text-sm font-semibold text-white bg-navy px-4 py-2 rounded-lg hover:bg-orange transition-colors disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
