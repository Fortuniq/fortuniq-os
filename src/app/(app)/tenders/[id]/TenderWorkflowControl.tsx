"use client";

import { useState, useTransition } from "react";
import { ArrowRight, ArrowLeft, Send, Upload, User, AlertTriangle, RefreshCw } from "lucide-react";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatDate } from "@/lib/format";
import { moveTenderStage, recordTenderSubmission, reassignTenderStage } from "../tender-actions";
import { normalizeTenderStage, isStageOverdue } from "@/lib/tender-core";
import type { TenderStageAssignment } from "@/lib/tender-assignments";

const STAGES = ["Drafting", "Pricing", "Assessment & Verification", "Submission Ready", "Submitted"] as const;
type Stage = (typeof STAGES)[number];

export function TenderWorkflowControl({
  tenderId, currentStage, canEdit, canApprove, currentAssignment,
}: {
  tenderId: string; currentStage: string; canEdit: boolean; canApprove: boolean;
  currentAssignment: TenderStageAssignment | null;
}) {
  const stage = normalizeTenderStage(currentStage) as Stage;
  const idx = STAGES.indexOf(stage);
  const [showSubmit, setShowSubmit] = useState(false);
  const [showReassign, setShowReassign] = useState(false);
  const [pendingMove, setPendingMove] = useState<Stage | null>(null);

  const nextStage = idx < STAGES.length - 1 ? STAGES[idx + 1] : null;
  const prevStage = idx > 0 ? STAGES[idx - 1] : null;
  const overdue = currentAssignment ? isStageOverdue(currentAssignment) : false;

  return (
    <Card>
      <CardHeader><CardTitle>Tender Workflow</CardTitle></CardHeader>
      <CardBody>
        <div className="flex flex-wrap gap-1.5 mb-4">
          {STAGES.map((s, i) => (
            <Badge key={s} tone={i === idx ? "info" : i < idx ? "success" : "neutral"}>{s}</Badge>
          ))}
        </div>

        {currentAssignment ? (
          <div className="flex items-center justify-between mb-4 p-3 rounded-lg bg-surface">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-orange" />
              <div>
                <p className="text-sm text-navy font-medium">{currentAssignment.ownerName ?? currentAssignment.ownerEmail}</p>
                <p className="text-xs text-light-grey">
                  {currentAssignment.priority} priority{currentAssignment.dueDate ? ` · Due ${formatDate(currentAssignment.dueDate)}` : ""}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {overdue && <span className="flex items-center gap-1 text-xs font-semibold text-red-600"><AlertTriangle className="w-3.5 h-3.5" /> Overdue</span>}
              {canEdit && (
                <button onClick={() => setShowReassign(true)} className="flex items-center gap-1 text-xs text-grey hover:text-orange">
                  <RefreshCw className="w-3.5 h-3.5" /> Reassign
                </button>
              )}
            </div>
          </div>
        ) : (
          <p className="text-xs text-amber-700 mb-4">No owner assigned to this stage yet.</p>
        )}

        <div className="flex items-center gap-2 flex-wrap">
          {prevStage && canEdit && (
            <button onClick={() => setPendingMove(prevStage)} className="flex items-center gap-1 text-xs font-semibold text-grey border border-border px-3 py-2 rounded-lg hover:border-orange hover:text-orange transition-colors">
              <ArrowLeft className="w-3.5 h-3.5" /> Back to {prevStage}
            </button>
          )}
          {nextStage && nextStage !== "Submitted" && (canEdit || canApprove) && (
            <button
              onClick={() => setPendingMove(nextStage)}
              disabled={nextStage === "Submission Ready" && !canApprove}
              title={nextStage === "Submission Ready" && !canApprove ? "Requires Approve permission" : undefined}
              className="flex items-center gap-1 text-xs font-semibold text-white bg-navy px-3 py-2 rounded-lg hover:bg-orange transition-colors disabled:opacity-50"
            >
              Move to {nextStage} <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
          {stage === "Submission Ready" && canEdit && (
            <button onClick={() => setShowSubmit(true)} className="flex items-center gap-1 text-xs font-semibold text-white bg-orange px-3 py-2 rounded-lg hover:bg-navy transition-colors">
              <Send className="w-3.5 h-3.5" /> Record Submission
            </button>
          )}
        </div>
      </CardBody>

      {pendingMove && <AssignStageModal tenderId={tenderId} newStage={pendingMove} onClose={() => setPendingMove(null)} />}
      {showSubmit && <RecordSubmissionModal tenderId={tenderId} onClose={() => setShowSubmit(false)} />}
      {showReassign && currentAssignment && (
        <ReassignModal tenderId={tenderId} stage={stage} currentOwner={currentAssignment.ownerName ?? currentAssignment.ownerEmail} onClose={() => setShowReassign(false)} />
      )}
    </Card>
  );
}

/**
 * "The stage cannot become active until an owner has been assigned" —
 * this modal is what makes that literally true: there is no code path
 * that moves a tender's stage without going through this form and its
 * required Assign To field. See docs/TENDER_ASSIGNMENT.md.
 */
function AssignStageModal({ tenderId, newStage, onClose }: { tenderId: string; newStage: Stage; onClose: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await moveTenderStage(tenderId, newStage, formData);
      if (result?.error) setError(result.error);
      else onClose();
    });
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-6" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b border-border"><p className="font-semibold text-navy">Move to {newStage}</p></div>
        <form action={handleSubmit} className="p-4 space-y-3">
          {error && <p className="text-sm text-red-600">{error}</p>}
          <p className="text-xs text-navy font-medium">New Stage: {newStage}</p>
          <div>
            <label className="text-xs font-medium text-grey block mb-1">Assign To (email) *</label>
            <input name="assignTo" type="email" required placeholder="person@iqfuels.co.za" className="w-full text-sm px-3 py-2 rounded-lg border border-border" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-grey block mb-1">Due Date</label>
              <input name="dueDate" type="date" className="w-full text-sm px-3 py-2 rounded-lg border border-border" />
            </div>
            <div>
              <label className="text-xs font-medium text-grey block mb-1">Priority</label>
              <select name="priority" defaultValue="Medium" className="w-full text-sm px-3 py-2 rounded-lg border border-border">
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-grey block mb-1">Comments</label>
            <textarea name="comments" rows={2} className="w-full text-sm px-3 py-2 rounded-lg border border-border" />
          </div>
          <button type="submit" disabled={isPending} className="w-full text-sm font-semibold text-white bg-navy px-4 py-2 rounded-lg hover:bg-orange transition-colors disabled:opacity-50">
            {isPending ? "Assigning…" : "Confirm & Move Stage"}
          </button>
        </form>
      </div>
    </div>
  );
}

function ReassignModal({ tenderId, stage, currentOwner, onClose }: { tenderId: string; stage: Stage; currentOwner: string; onClose: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await reassignTenderStage(tenderId, stage, formData);
      if (result?.error) setError(result.error);
      else onClose();
    });
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-6" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b border-border"><p className="font-semibold text-navy">Reassign {stage}</p></div>
        <form action={handleSubmit} className="p-4 space-y-3">
          {error && <p className="text-sm text-red-600">{error}</p>}
          <p className="text-xs text-light-grey">Current Owner: <span className="text-navy font-medium">{currentOwner}</span></p>
          <div>
            <label className="text-xs font-medium text-grey block mb-1">Reassign To (email) *</label>
            <input name="newOwnerEmail" type="email" required className="w-full text-sm px-3 py-2 rounded-lg border border-border" />
          </div>
          <div>
            <label className="text-xs font-medium text-grey block mb-1">Reason</label>
            <textarea name="reason" rows={2} placeholder="e.g. Commercial review required." className="w-full text-sm px-3 py-2 rounded-lg border border-border" />
          </div>
          <button type="submit" disabled={isPending} className="w-full text-sm font-semibold text-white bg-navy px-4 py-2 rounded-lg hover:bg-orange transition-colors disabled:opacity-50">
            {isPending ? "Reassigning…" : "Confirm Reassignment"}
          </button>
        </form>
      </div>
    </div>
  );
}

function RecordSubmissionModal({ tenderId, onClose }: { tenderId: string; onClose: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await recordTenderSubmission(tenderId, formData);
      if (result?.error) setError(result.error);
      else onClose();
    });
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-6" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b border-border"><p className="font-semibold text-navy">Record Submission</p></div>
        <form action={handleSubmit} className="p-4 space-y-3">
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div>
            <label className="text-xs font-medium text-grey block mb-1">Submission Method</label>
            <input name="submissionMethod" placeholder="e.g. Online portal, Email, Hand delivery" className="w-full text-sm px-3 py-2 rounded-lg border border-border" />
          </div>
          <div>
            <label className="text-xs font-medium text-grey block mb-1">Submission Reference / Receipt</label>
            <input name="submissionReference" className="w-full text-sm px-3 py-2 rounded-lg border border-border" />
          </div>
          <div>
            <label className="text-xs font-medium text-grey block mb-1 flex items-center gap-1"><Upload className="w-3 h-3" /> Final Tender Pack (optional)</label>
            <input type="file" name="finalPack" className="w-full text-sm" />
          </div>
          <div>
            <label className="text-xs font-medium text-grey block mb-1 flex items-center gap-1"><Upload className="w-3 h-3" /> Proof of Submission (optional)</label>
            <input type="file" name="proofOfSubmission" className="w-full text-sm" />
          </div>
          <p className="text-[11px] text-light-grey">Submission Date/Time and Submitted By are recorded automatically.</p>
          <button type="submit" disabled={isPending} className="w-full text-sm font-semibold text-white bg-navy px-4 py-2 rounded-lg hover:bg-orange transition-colors disabled:opacity-50">
            {isPending ? "Recording…" : "Confirm Submission"}
          </button>
        </form>
      </div>
    </div>
  );
}
