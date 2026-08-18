"use client";

import { useEffect, useState, useTransition } from "react";
import { X, RotateCcw, Loader2 } from "lucide-react";
import { formatDate } from "@/lib/format";
import { getDocumentVersionsAction, restoreDocumentVersion } from "./document-actions";
import type { DocumentVersion } from "@/lib/document-versions";

export function VersionHistoryModal({
  documentId, docName, canRestore, onClose,
}: { documentId: string; docName: string; canRestore: boolean; onClose: () => void }) {
  const [versions, setVersions] = useState<DocumentVersion[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    getDocumentVersionsAction(documentId).then(setVersions).catch(() => setVersions([]));
  }, [documentId]);

  function handleRestore(versionId: string) {
    setError(null);
    startTransition(async () => {
      const result = await restoreDocumentVersion(documentId, versionId);
      if (result?.error) setError(result.error);
      else onClose();
    });
  }

  const current = versions?.find((v) => v.isCurrent);
  const archived = versions?.filter((v) => !v.isCurrent) ?? [];

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-6" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-lg max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-border">
          <p className="font-semibold text-navy">Version History — {docName}</p>
          <button onClick={onClose}><X className="w-5 h-5 text-grey" /></button>
        </div>

        <div className="p-4 overflow-y-auto flex-1">
          {versions === null && <p className="text-sm text-grey flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</p>}
          {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

          {versions && versions.length === 0 && <p className="text-sm text-grey">No version history recorded yet.</p>}

          {current && (
            <div className="mb-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-grey mb-2">Current Version</p>
              <VersionRow v={current} isCurrent />
            </div>
          )}

          {archived.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-grey mb-2">Archived Versions</p>
              {archived.map((v) => (
                <VersionRow key={v.id} v={v} isCurrent={false} onRestore={canRestore ? () => handleRestore(v.id) : undefined} restoring={isPending} />
              ))}
            </div>
          )}

          {versions && versions.length > 0 && archived.length === 0 && current && (
            <p className="text-xs text-light-grey mt-2">
              No archived versions yet — or archived versions are only visible to authorised roles (Super Admin, HR, or explicitly granted Documents Manage access).
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function VersionRow({ v, isCurrent, onRestore, restoring }: { v: DocumentVersion; isCurrent: boolean; onRestore?: () => void; restoring?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-border last:border-0">
      <div className="min-w-0">
        <p className="text-sm text-navy font-medium">Version {v.versionNumber}{isCurrent ? " (active)" : ""}</p>
        <p className="text-xs text-light-grey">
          {v.uploadedByName ?? v.uploadedBy ?? "Unknown"} · {formatDate(v.uploadedAt)}
        </p>
        {v.comments && <p className="text-xs text-grey mt-0.5 italic">&ldquo;{v.comments}&rdquo;</p>}
      </div>
      {onRestore && (
        <button
          onClick={onRestore} disabled={restoring}
          className="flex items-center gap-1 text-xs font-semibold text-orange hover:underline shrink-0 disabled:opacity-50"
        >
          <RotateCcw className="w-3.5 h-3.5" /> Restore
        </button>
      )}
    </div>
  );
}
