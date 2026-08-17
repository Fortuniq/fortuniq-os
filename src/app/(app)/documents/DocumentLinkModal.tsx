"use client";

import { useState, useEffect, useTransition } from "react";
import { FileText, X, Loader2, ExternalLink, Upload, FolderSync, Search, Link2, RefreshCw, Unlink } from "lucide-react";
import {
  linkDocumentToFile, uploadAndLinkDocument, replaceDocumentVersion, removeDocumentLink,
} from "./document-actions";
import type { SharePointFile } from "@/lib/graph";

type Doc = {
  id: string | number;
  name: string;
  category: string;
  sharepointItemId: string | null;
  sharepointWebUrl: string | null;
};

type Mode = "menu" | "browse" | "search" | "upload" | "confirmRemove";

/**
 * One modal handles both states: a document with no file yet ("Attach
 * Document" — Browse SharePoint / Upload New / Link Existing) and an
 * already-linked document ("Linked Document" — Replace Current Version
 * / Remove Link), per the brief. Which buttons show depends entirely on
 * whether doc.sharepointItemId is set.
 */
export function DocumentLinkModal({ doc, onClose, onOpenVersions }: { doc: Doc; onClose: () => void; onOpenVersions: () => void }) {
  const [mode, setMode] = useState<Mode>("menu");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isLinked = !!doc.sharepointItemId;

  // "Replace" reuses the same browse/search/upload sub-views as
  // "Attach," just calling a different action at the end (replace
  // instead of link) — replaceMode tracks that distinction while
  // `mode` tracks which sub-view is showing.
  const [replaceMode, setReplaceMode] = useState(false);

  function linkPicked(file: SharePointFile) {
    setError(null);
    startTransition(async () => {
      try {
        if (replaceMode) {
          const fd = new FormData();
          fd.set("documentId", String(doc.id));
          fd.set("mode", "existing");
          fd.set("sharepointItemId", file.id);
          fd.set("webUrl", file.webUrl);
          await replaceDocumentVersion(fd);
        } else {
          await linkDocumentToFile({ documentId: String(doc.id), sharepointItemId: file.id, sharepointWebUrl: file.webUrl });
        }
        onClose();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  function handleUpload(formData: FormData) {
    setError(null);
    formData.set("documentId", String(doc.id));
    startTransition(async () => {
      try {
        if (replaceMode) {
          formData.set("mode", "upload");
          await replaceDocumentVersion(formData);
        } else {
          await uploadAndLinkDocument(formData);
        }
        onClose();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  function handleRemove() {
    setError(null);
    startTransition(async () => {
      try {
        await removeDocumentLink(String(doc.id));
        onClose();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-6" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-lg max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-border">
          <p className="font-semibold text-navy">
            {mode === "menu" ? (isLinked ? "Linked Document" : "Attach Document") : doc.name}
          </p>
          <button onClick={onClose}><X className="w-5 h-5 text-grey" /></button>
        </div>

        <div className="p-4 overflow-y-auto flex-1">
          {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

          {mode === "menu" && (
            <div className="space-y-2">
              <p className="text-sm text-navy font-medium mb-3">{doc.name}</p>

              {!isLinked && (
                <>
                  <MenuButton icon={FolderSync} label="Browse SharePoint" onClick={() => { setReplaceMode(false); setMode("browse"); }} />
                  <MenuButton icon={Upload} label="Upload New Document" onClick={() => { setReplaceMode(false); setMode("upload"); }} />
                  <MenuButton icon={Search} label="Link Existing Document" onClick={() => { setReplaceMode(false); setMode("search"); }} />
                </>
              )}

              {isLinked && (
                <>
                  <MenuButton icon={Upload} label="Replace Current Version — Upload" onClick={() => { setReplaceMode(true); setMode("upload"); }} />
                  <MenuButton icon={FolderSync} label="Replace Current Version — Browse SharePoint" onClick={() => { setReplaceMode(true); setMode("browse"); }} />
                  <MenuButton icon={Search} label="Replace Current Version — Link Existing" onClick={() => { setReplaceMode(true); setMode("search"); }} />
                  <MenuButton icon={Link2} label="View Version History" onClick={onOpenVersions} />
                  {doc.sharepointWebUrl && (
                    <a
                      href={doc.sharepointWebUrl} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-navy px-3 py-2.5 rounded-lg hover:bg-surface transition-colors"
                    >
                      <ExternalLink className="w-4 h-4 text-orange" /> Open in SharePoint
                    </a>
                  )}
                  <MenuButton icon={Unlink} label="Remove Link" danger onClick={() => setMode("confirmRemove")} />
                </>
              )}
            </div>
          )}

          {mode === "confirmRemove" && (
            <div>
              <p className="text-sm text-navy mb-4">
                This removes the link between this record and its SharePoint file. The file itself is <b>not</b> deleted or
                moved — it stays exactly where it is in SharePoint.
              </p>
              <div className="flex justify-end gap-2">
                <button onClick={() => setMode("menu")} className="text-sm text-grey px-4 py-2 rounded-lg hover:bg-surface transition-colors">Cancel</button>
                <button onClick={handleRemove} disabled={isPending} className="text-sm font-semibold text-white bg-red-600 px-4 py-2 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50">
                  {isPending ? "Removing…" : "Remove Link"}
                </button>
              </div>
            </div>
          )}

          {mode === "browse" && <BrowseCategoryPanel category={doc.category} onPick={linkPicked} isPending={isPending} onBack={() => setMode("menu")} />}
          {mode === "search" && <SearchLibraryPanel onPick={linkPicked} isPending={isPending} onBack={() => setMode("menu")} />}
          {mode === "upload" && <UploadPanel isPending={isPending} onBack={() => setMode("menu")} onSubmit={handleUpload} />}
        </div>
      </div>
    </div>
  );
}

function MenuButton({ icon: Icon, label, onClick, danger }: { icon: React.ElementType; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2 text-sm px-3 py-2.5 rounded-lg hover:bg-surface transition-colors text-left ${danger ? "text-red-600" : "text-navy"}`}
    >
      <Icon className={`w-4 h-4 ${danger ? "text-red-500" : "text-orange"}`} /> {label}
    </button>
  );
}

function BrowseCategoryPanel({ category, onPick, isPending, onBack }: { category: string; onPick: (f: SharePointFile) => void; isPending: boolean; onBack: () => void }) {
  const [files, setFiles] = useState<SharePointFile[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/sharepoint/documents-browse", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ category }) })
      .then((res) => res.json())
      .then((data) => { if (data.error) setLoadError(data.error); else setFiles(data.files); })
      .catch(() => setLoadError("Couldn't reach SharePoint."))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <button onClick={onBack} className="text-xs text-grey hover:text-orange mb-3">← Back</button>
      <p className="text-xs text-light-grey mb-3">Files in "{category}"</p>
      {loading && <p className="text-sm text-grey flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</p>}
      {loadError && <p className="text-sm text-red-600">{loadError}</p>}
      {files?.length === 0 && <p className="text-sm text-grey">No files in this category folder yet — try Upload New Document instead.</p>}
      {files?.map((f) => (
        <button
          key={f.id} onClick={() => onPick(f)} disabled={isPending}
          className="w-full flex items-center gap-2 text-sm text-navy px-3 py-2.5 rounded-lg hover:bg-surface transition-colors text-left disabled:opacity-50"
        >
          <FileText className="w-4 h-4 text-orange shrink-0" /> {f.name}
        </button>
      ))}
    </div>
  );
}

function SearchLibraryPanel({ onPick, isPending, onBack }: { onPick: (f: SharePointFile) => void; isPending: boolean; onBack: () => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SharePointFile[] | null>(null);
  const [searching, setSearching] = useState(false);

  function runSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    fetch("/api/sharepoint/search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query }) })
      .then((res) => res.json())
      .then((data) => setResults((data.files ?? []).filter((f: SharePointFile) => !f.isFolder)))
      .finally(() => setSearching(false));
  }

  return (
    <div>
      <button onClick={onBack} className="text-xs text-grey hover:text-orange mb-3">← Back</button>
      <form onSubmit={runSearch} className="flex gap-2 mb-3">
        <input
          value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search SharePoint…"
          className="flex-1 text-sm px-3 py-2 rounded-lg border border-border"
        />
        <button type="submit" disabled={searching} className="text-sm font-semibold text-white bg-navy px-3 py-2 rounded-lg disabled:opacity-50">
          {searching ? "…" : "Search"}
        </button>
      </form>
      {results?.length === 0 && <p className="text-sm text-grey">No matching files.</p>}
      {results?.map((f) => (
        <button
          key={f.id} onClick={() => onPick(f)} disabled={isPending}
          className="w-full flex items-center gap-2 text-sm text-navy px-3 py-2.5 rounded-lg hover:bg-surface transition-colors text-left disabled:opacity-50"
        >
          <FileText className="w-4 h-4 text-orange shrink-0" /> {f.name}
        </button>
      ))}
    </div>
  );
}

function UploadPanel({ isPending, onBack, onSubmit }: { isPending: boolean; onBack: () => void; onSubmit: (fd: FormData) => void }) {
  const [comments, setComments] = useState("");
  return (
    <form
      action={(fd) => { fd.set("comments", comments); onSubmit(fd); }}
    >
      <button type="button" onClick={onBack} className="text-xs text-grey hover:text-orange mb-3 block">← Back</button>
      <label className="text-xs font-medium text-grey block mb-1">Choose a file</label>
      <input type="file" name="file" required className="w-full text-sm mb-3" />
      <label className="text-xs font-medium text-grey block mb-1">Comments (optional)</label>
      <textarea
        value={comments} onChange={(e) => setComments(e.target.value)} rows={2}
        placeholder="What changed in this version?"
        className="w-full text-sm px-3 py-2 rounded-lg border border-border mb-3"
      />
      <p className="text-xs text-light-grey mb-3">Files up to 4MB are supported.</p>
      <button type="submit" disabled={isPending} className="text-sm font-semibold text-white bg-navy px-4 py-2 rounded-lg hover:bg-orange transition-colors disabled:opacity-50 flex items-center gap-2">
        {isPending ? <><RefreshCw className="w-4 h-4 animate-spin" /> Uploading…</> : "Upload"}
      </button>
    </form>
  );
}
