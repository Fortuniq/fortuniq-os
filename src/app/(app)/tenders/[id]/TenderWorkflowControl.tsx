"use client";

import { useState, useTransition } from "react";
import { ArrowRight, ArrowLeft, Send, Upload } from "lucide-react";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { moveTenderStage, recordTenderSubmission } from "../tender-actions";

const STAGES = ["Drafting", "Pricing", "Assessment & Verification", "Submission Ready", "Submitted"] as const;
type Stage = (typeof STAGES)[number];

export function TenderWorkflowControl({ tenderId, currentStage, canEdit, canApprove }: { tenderId: string; currentStage: string; canEdit: boolean; canApprove: boolean }) {
  const stage = (STAGES.includes(currentStage as Stage) ? currentStage : "Drafting") as Stage;
  const idx = STAGES.indexOf(stage);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [showSubmit, setShowSubmit] = useState(false);

  function move(to: Stage) {
    setError(null);
    startTransition(async () => {
      const result = await moveTenderStage(tenderId, to);
      if (result?.error) setError(result.error);
    });
  }

  const nextStage = idx < STAGES.length - 1 ? STAGES[idx + 1] : null;
  const prevStage = idx > 0 ? STAGES[idx - 1] : null;

  return (
    <Card>
      <CardHeader><CardTitle>Tender Workflow</CardTitle></CardHeader>
      <CardBody>
        <div className="flex flex-wrap gap-1.5 mb-4">
          {STAGES.map((s, i) => (
            <Badge key={s} tone={i === idx ? "info" : i < idx ? "success" : "neutral"}>{s}</Badge>
          ))}
        </div>
        {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
        <div className="flex items-center gap-2 flex-wrap">
          {prevStage && canEdit && (
            <button onClick={() => move(prevStage)} disabled={isPending} className="flex items-center gap-1 text-xs font-semibold text-grey border border-border px-3 py-2 rounded-lg hover:border-orange hover:text-orange transition-colors disabled:opacity-50">
              <ArrowLeft className="w-3.5 h-3.5" /> Back to {prevStage}
            </button>
          )}
          {nextStage && nextStage !== "Submitted" && (canEdit || canApprove) && (
            <button
              onClick={() => move(nextStage)}
              disabled={isPending || (nextStage === "Submission Ready" && !canApprove)}
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

      {showSubmit && <RecordSubmissionModal tenderId={tenderId} onClose={() => setShowSubmit(false)} />}
    </Card>
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
