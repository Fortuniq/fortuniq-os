"use client";

import { useTransition } from "react";
import { Badge } from "@/components/ui/Badge";
import { submitDocumentForApproval, reviewDocumentApproval, publishDocument, archiveDocument } from "./document-actions";

type Status = "Draft" | "Pending Approval" | "Approved" | "Published" | "Archived";

const STATUS_TONE: Record<Status, "neutral" | "warning" | "info" | "success" | "danger"> = {
  "Draft": "neutral",
  "Pending Approval": "warning",
  "Approved": "info",
  "Published": "success",
  "Archived": "danger",
};

/**
 * Shows the document's current lifecycle status plus, where relevant,
 * the ONE valid next action for the signed-in person's permissions —
 * never a free dropdown that implies any status is reachable from any
 * other. See docs/DOCUMENT_CONTROL.md, "Approval workflow."
 */
export function DocumentWorkflowControl({
  documentId, status, canEdit, canApprove,
}: { documentId: string; status: string; canEdit: boolean; canApprove: boolean }) {
  const [isPending, startTransition] = useTransition();
  const s = status as Status;

  function run(fn: () => Promise<{ error?: string }>) {
    startTransition(async () => {
      const result = await fn();
      if (result?.error) alert(result.error);
    });
  }

  return (
    <div className="flex items-center gap-2">
      <Badge tone={STATUS_TONE[s] ?? "neutral"}>{status}</Badge>

      {s === "Draft" && canEdit && (
        <button
          onClick={() => run(() => submitDocumentForApproval(documentId))}
          disabled={isPending}
          className="text-xs font-semibold text-orange hover:underline disabled:opacity-50"
        >
          Submit for Approval
        </button>
      )}

      {s === "Pending Approval" && canApprove && (
        <>
          <button onClick={() => run(() => reviewDocumentApproval(documentId, "approve"))} disabled={isPending} className="text-xs font-semibold text-emerald-600 hover:underline disabled:opacity-50">
            Approve
          </button>
          <button onClick={() => run(() => reviewDocumentApproval(documentId, "reject"))} disabled={isPending} className="text-xs font-semibold text-red-600 hover:underline disabled:opacity-50">
            Reject
          </button>
        </>
      )}

      {s === "Approved" && canApprove && (
        <button onClick={() => run(() => publishDocument(documentId))} disabled={isPending} className="text-xs font-semibold text-orange hover:underline disabled:opacity-50">
          Publish
        </button>
      )}

      {(s === "Published" || s === "Draft" || s === "Approved") && canEdit && (
        <button
          onClick={() => { if (confirm("Archive this document? It will no longer be treated as the active version.")) run(() => archiveDocument(documentId)); }}
          disabled={isPending}
          className="text-xs text-light-grey hover:text-red-600 disabled:opacity-50"
          title="Archive"
        >
          Archive
        </button>
      )}
    </div>
  );
}
