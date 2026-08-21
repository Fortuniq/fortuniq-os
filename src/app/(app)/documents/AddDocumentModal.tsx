"use client";

import { useState, useTransition } from "react";
import { X, Upload, Search, FileText } from "lucide-react";
import { createDocumentRecord } from "./document-actions";
import type { SharePointFile } from "@/lib/graph";

const CLASSIFICATIONS = ["Public", "Internal", "Confidential", "Highly Confidential"];
const STATUSES = ["Draft", "Pending Approval", "Approved", "Published"];

export function AddDocumentModal({ categories, onClose }: { categories: readonly string[]; onClose: () => void }) {
  const [category, setCategory] = useState(categories[0] ?? "Policies");
  const [fileMode, setFileMode] = useState<"none" | "upload" | "existing">("none");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SharePointFile[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [linkedFile, setLinkedFile] = useState<SharePointFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function runSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const res = await fetch("/api/sharepoint/search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: searchQuery }) });
      const data = await res.json();
      setSearchResults((data.files ?? []).filter((f: SharePointFile) => !f.isFolder));
    } finally {
      setSearching(false);
    }
  }

  function handleSubmit(formData: FormData) {
    setError(null);
    formData.set("category", category);
    formData.set("fileMode", fileMode);
    if (fileMode === "existing" && linkedFile) {
      formData.set("sharepointItemId", linkedFile.id);
      formData.set("webUrl", linkedFile.webUrl);
    }
    startTransition(async () => {
      const result = await createDocumentRecord(formData);
      if (result?.error) setError(result.error);
      else onClose();
    });
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-6" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-lg max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-border">
          <p className="font-semibold text-navy">Add Document</p>
          <button onClick={onClose}><X className="w-5 h-5 text-grey" /></button>
        </div>

        <form action={handleSubmit} className="p-4 overflow-y-auto flex-1 space-y-3">
          {error && <p className="text-sm text-red-600">{error}</p>}

          <div>
            <label className="text-xs font-medium text-grey block mb-1">Document Name</label>
            <input name="name" required className="w-full text-sm px-3 py-2 rounded-lg border border-border" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-grey block mb-1">Category (SharePoint Folder)</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full text-sm px-3 py-2 rounded-lg border border-border">
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-grey block mb-1">Owner</label>
              <input name="owner" className="w-full text-sm px-3 py-2 rounded-lg border border-border" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium text-grey block mb-1">Classification</label>
              <select name="classification" defaultValue="Internal" className="w-full text-sm px-3 py-2 rounded-lg border border-border">
                {CLASSIFICATIONS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-grey block mb-1">Version</label>
              <input name="version" defaultValue="v1" className="w-full text-sm px-3 py-2 rounded-lg border border-border" />
            </div>
            <div>
              <label className="text-xs font-medium text-grey block mb-1">Status</label>
              <select name="status" defaultValue="Draft" className="w-full text-sm px-3 py-2 rounded-lg border border-border">
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-grey block mb-1">Expiry Date (optional)</label>
              <input type="date" name="expiryDate" className="w-full text-sm px-3 py-2 rounded-lg border border-border" />
            </div>
            <div>
              <label className="text-xs font-medium text-grey block mb-1">Review Date (optional)</label>
              <input type="date" name="reviewDate" className="w-full text-sm px-3 py-2 rounded-lg border border-border" />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-grey block mb-1">Description / Notes</label>
            <textarea name="description" rows={2} className="w-full text-sm px-3 py-2 rounded-lg border border-border" />
          </div>

          <div className="border-t border-border pt-3">
            <p className="text-xs font-medium text-grey mb-2">Document File</p>
            <div className="flex gap-2 mb-3">
              <button type="button" onClick={() => setFileMode("none")} className={`text-xs px-3 py-1.5 rounded-full border ${fileMode === "none" ? "bg-navy text-white border-navy" : "border-border text-grey"}`}>No file yet</button>
              <button type="button" onClick={() => setFileMode("upload")} className={`text-xs px-3 py-1.5 rounded-full border flex items-center gap-1 ${fileMode === "upload" ? "bg-navy text-white border-navy" : "border-border text-grey"}`}><Upload className="w-3 h-3" /> Upload New</button>
              <button type="button" onClick={() => setFileMode("existing")} className={`text-xs px-3 py-1.5 rounded-full border flex items-center gap-1 ${fileMode === "existing" ? "bg-navy text-white border-navy" : "border-border text-grey"}`}><Search className="w-3 h-3" /> Link Existing</button>
            </div>

            {fileMode === "upload" && (
              <div>
                <input type="file" name="file" className="w-full text-sm" />
                <p className="text-[11px] text-light-grey mt-1">Files up to 8MB are supported.</p>
              </div>
            )}

            {fileMode === "existing" && (
              <div>
                <div className="flex gap-2 mb-2">
                  <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search SharePoint…" className="flex-1 text-sm px-3 py-2 rounded-lg border border-border" />
                  <button type="button" onClick={runSearch} disabled={searching} className="text-xs font-semibold text-white bg-navy px-3 py-2 rounded-lg disabled:opacity-50">{searching ? "…" : "Search"}</button>
                </div>
                {linkedFile && <p className="text-xs text-emerald-600 mb-2">Linked: {linkedFile.name}</p>}
                {searchResults?.map((f) => (
                  <button key={f.id} type="button" onClick={() => { setLinkedFile(f); setSearchResults(null); }} className="w-full flex items-center gap-2 text-sm text-navy px-2 py-1.5 rounded hover:bg-surface text-left">
                    <FileText className="w-3.5 h-3.5 text-orange shrink-0" /> {f.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button type="submit" disabled={isPending} className="w-full text-sm font-semibold text-white bg-navy px-4 py-2 rounded-lg hover:bg-orange transition-colors disabled:opacity-50">
            {isPending ? "Creating…" : "Create Document"}
          </button>
        </form>
      </div>
    </div>
  );
}
