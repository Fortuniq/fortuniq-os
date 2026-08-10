"use client";

import { useState } from "react";
import { FileText, Download, History, Search, X, ExternalLink, FolderSync, CheckCircle2, Loader2 } from "lucide-react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/ui/PageHeader";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { formatDate } from "@/lib/format";
import { catalogueSharePointFile, updateDocumentStatus, updateDocumentClassification } from "./document-actions";
import type { SharePointFile, SharePointVersion } from "@/lib/graph";

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
};

const categoryTone: Record<string, "orange" | "info" | "success" | "warning" | "neutral"> = {
  Policy: "info", Legal: "neutral", Brand: "orange", Certificate: "success",
  Licence: "success", Tax: "warning", Insurance: "warning", SOP: "info", "Company Profile": "neutral",
};

const categories = ["All", "Policy", "SOP", "Legal", "Brand", "Certificate", "Licence", "Tax", "Insurance"];

export function DocumentsView({ documents, sharePointConfigured, isAdmin }: { documents: Doc[]; sharePointConfigured: boolean; isAdmin: boolean }) {
  const [manageAccessDoc, setManageAccessDoc] = useState<Doc | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState<string | null>(null);
  const [versions, setVersions] = useState<{ docName: string; items: SharePointVersion[] } | null>(null);
  const [versionsLoading, setVersionsLoading] = useState<string | null>(null);
  const [browseOpen, setBrowseOpen] = useState(false);
  const [browseFiles, setBrowseFiles] = useState<SharePointFile[]>([]);
  const [browseLoading, setBrowseLoading] = useState(false);
  const [browseError, setBrowseError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SharePointFile[] | null>(null);
  const [searching, setSearching] = useState(false);

  const catalogued = new Set(documents.map((d) => d.sharepointItemId).filter(Boolean));

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

  async function openVersions(itemId: string, docName: string) {
    setVersionsLoading(itemId);
    try {
      const res = await fetch("/api/sharepoint/versions", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ itemId }),
      });
      const data = await res.json();
      if (res.ok) setVersions({ docName, items: data.versions });
      else alert(data.error);
    } finally {
      setVersionsLoading(null);
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

  const columns: Column<Doc>[] = [
    {
      key: "name", header: "Document",
      render: (r) => (
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-orange shrink-0" />
          <span className="font-medium">{r.name}</span>
          {r.sharepointWebUrl && (
            <a href={r.sharepointWebUrl} target="_blank" rel="noopener noreferrer" title="Open in SharePoint">
              <ExternalLink className="w-3 h-3 text-light-grey hover:text-orange" />
            </a>
          )}
        </div>
      ),
    },
    { key: "category", header: "Category", render: (r) => <Badge tone={categoryTone[r.category] ?? "neutral"}>{r.category}</Badge> },
    {
      key: "status", header: "Status",
      render: (r) => (
        <select
          value={r.status}
          onChange={(e) => updateDocumentStatus(String(r.id), e.target.value as "Draft" | "Approved" | "Archived")}
          className="text-xs font-semibold rounded-full px-2 py-1 border-0 bg-transparent cursor-pointer"
        >
          <option value="Draft">Draft</option>
          <option value="Approved">Approved</option>
          <option value="Archived">Archived</option>
        </select>
      ),
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
    { key: "version", header: "Version" },
    { key: "owner", header: "Owner" },
    { key: "updated", header: "Last Updated", render: (r) => formatDate(r.updated) },
    {
      key: "actions", header: "", align: "right",
      render: (r) => (
        <div className="flex items-center gap-2 justify-end">
          {r.sharepointItemId ? (
            <>
              <button
                onClick={() => openVersions(r.sharepointItemId!, r.name)}
                disabled={versionsLoading === r.sharepointItemId}
                className="p-1.5 rounded hover:bg-surface text-grey hover:text-orange transition-colors" title="Version history"
              >
                {versionsLoading === r.sharepointItemId ? <Loader2 className="w-4 h-4 animate-spin" /> : <History className="w-4 h-4" />}
              </button>
              <button
                onClick={() => openPreview(r.sharepointItemId!, r.name)}
                disabled={previewLoading === r.sharepointItemId}
                className="p-1.5 rounded hover:bg-surface text-grey hover:text-orange transition-colors" title="Preview"
              >
                {previewLoading === r.sharepointItemId ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              </button>
            </>
          ) : (
            <span className="text-xs text-light-grey italic">Not linked</span>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Documents"
        description="Policies, SOPs, templates, certificates, licences and company records — files live in SharePoint, catalogued here."
        action={
          sharePointConfigured ? (
            <button onClick={openBrowse} className="flex items-center gap-2 bg-navy text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-orange transition-colors">
              <FolderSync className="w-4 h-4" /> Browse SharePoint
            </button>
          ) : undefined
        }
      />

      {!sharePointConfigured && (
        <Card className="mb-4 border-amber-200 bg-amber-50">
          <CardBody className="text-sm text-amber-800">
            SharePoint isn&apos;t connected yet — showing catalogued document names only, without live previews or version
            history. See <span className="font-medium">docs/SHAREPOINT_SETUP.md</span> to connect it.
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
        {categories.map((c) => (
          <button key={c} className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${c === "All" ? "bg-navy text-white border-navy" : "border-border text-grey hover:border-orange hover:text-orange"}`}>
            {c}
          </button>
        ))}
      </div>

      <Card>
        <CardBody className="pt-5">
          <DataTable columns={columns} data={documents} />
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

      {versions && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-6" onClick={() => setVersions(null)}>
          <div className="bg-white rounded-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-border">
              <p className="font-semibold text-navy">Version History — {versions.docName}</p>
              <button onClick={() => setVersions(null)}><X className="w-5 h-5 text-grey" /></button>
            </div>
            <div className="p-4 space-y-2 max-h-96 overflow-y-auto">
              {versions.items.length === 0 && <p className="text-sm text-grey">No version history available.</p>}
              {versions.items.map((v, i) => (
                <div key={v.id} className="flex items-center justify-between py-2 border-b border-border last:border-0 text-sm">
                  <div>
                    <p className="text-navy font-medium">{i === 0 ? "Current version" : `Version ${versions.items.length - i}`}</p>
                    <p className="text-xs text-light-grey">{v.modifiedBy ?? "Unknown"} · {formatDate(v.lastModifiedDateTime)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
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
                    <form action={async (formData) => { await catalogueSharePointFile(formData); setBrowseOpen(false); }}>
                      <input type="hidden" name="sharepointItemId" value={f.id} />
                      <input type="hidden" name="name" value={f.name} />
                      <input type="hidden" name="webUrl" value={f.webUrl} />
                      <input type="hidden" name="category" value="Policy" />
                      <button type="submit" className="text-xs font-semibold text-orange hover:underline">Add to Documents</button>
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
      await updateDocumentClassification(String(doc.id), classification, roles, emailList, aiExcluded);
      onClose();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Something went wrong.");
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
