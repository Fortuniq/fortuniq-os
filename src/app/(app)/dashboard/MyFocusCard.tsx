"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Target, ArrowRight, Sparkles, RefreshCw, CheckCircle2, Users, Clock,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/Card";
import {
  setMyFocusAction, acceptFocusRecommendationAction, continueYesterdaysFocusAction,
  updateFocusProgressAction, changeFocusAction, assignFocusToReportAction,
} from "./focus-actions";
import type { EmployeeFocus, FocusCandidate, FocusStatus } from "@/lib/focus-core";
import { daysRemaining } from "@/lib/focus-core";

const STATUS_OPTIONS: FocusStatus[] = ["Not Started", "In Progress", "Waiting", "Blocked", "Complete"];

const MODULE_LABEL: Record<string, string> = {
  tenders: "Tenders", finance: "Finance", tasks: "Tasks", calendar: "Calendar", academy: "Academy",
};

/**
 * "My Focus Today" — Project ORION. One of the dashboard's main
 * features per the brief, so it's rendered OUTSIDE the customizable
 * widget grid, pinned at the very top (same treatment as Attendance)
 * rather than something the employee could hide or bury. It is NOT
 * another task list — the underlying work stays in My Tasks/My
 * Workflow/Calendar/Tenders/Finance; this only ever highlights one of
 * them. See docs/EMPLOYEE_DASHBOARD.md.
 */
export function MyFocusCard({
  activeFocus, resetPrompt, recommendation, candidates, todayISO, directReports,
}: {
  activeFocus: EmployeeFocus | null;
  resetPrompt: EmployeeFocus | null; // yesterday's incomplete focus, when a daily-reset decision is owed
  recommendation: FocusCandidate | null;
  candidates: FocusCandidate[];
  todayISO: string;
  directReports: { email: string; name: string }[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [choosing, setChoosing] = useState(false);
  const [updatingProgress, setUpdatingProgress] = useState(false);
  const [assigning, setAssigning] = useState(false);

  function runAction(fn: () => Promise<{ error?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (result?.error) setError(result.error);
      else router.refresh();
    });
  }

  function handlePickCandidate(c: FocusCandidate) {
    runAction(() =>
      setMyFocusAction({
        title: c.title, moduleKey: c.moduleKey, relatedLabel: c.relatedLabel, relatedUrl: c.relatedUrl,
        workflowStage: c.workflowStage, priority: c.priority, dueDate: c.dueDate,
      }).then((r) => {
        if (!r.error) setChoosing(false);
        return r;
      })
    );
  }

  function handleAcceptRecommendation() {
    if (!recommendation) return;
    runAction(() =>
      acceptFocusRecommendationAction({
        title: recommendation.title, moduleKey: recommendation.moduleKey, relatedLabel: recommendation.relatedLabel,
        relatedUrl: recommendation.relatedUrl, workflowStage: recommendation.workflowStage, priority: recommendation.priority,
        dueDate: recommendation.dueDate,
      })
    );
  }

  // ---- Daily reset: yesterday's focus is incomplete ----
  if (resetPrompt) {
    return (
      <Card className="border-orange/40">
        <CardHeader>
          <CardTitle><span className="flex items-center gap-1.5"><Target className="w-4 h-4 text-orange" /> My Focus Today</span></CardTitle>
        </CardHeader>
        <CardBody className="space-y-3">
          <p className="text-sm text-navy">
            Yesterday&rsquo;s focus, <strong>&ldquo;{resetPrompt.title}&rdquo;</strong>, wasn&rsquo;t marked complete. What would you like to do with it?
          </p>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <button disabled={isPending} onClick={() => runAction(() => continueYesterdaysFocusAction(resetPrompt.id))} className="text-xs font-semibold text-white bg-navy px-3 py-1.5 rounded-lg hover:bg-orange transition-colors disabled:opacity-50">
              Continue Yesterday&rsquo;s Focus
            </button>
            <button disabled={isPending} onClick={() => runAction(() => changeFocusAction(resetPrompt.id).then((r) => { if (!r.error) setChoosing(true); return r; }))} className="text-xs font-semibold text-navy border border-border px-3 py-1.5 rounded-lg hover:border-orange transition-colors disabled:opacity-50">
              Choose New Focus
            </button>
            <button disabled={isPending} onClick={() => runAction(() => updateFocusProgressAction(resetPrompt.id, "Blocked", resetPrompt.progressPct, resetPrompt.notes))} className="text-xs font-semibold text-grey px-3 py-1.5 rounded-lg hover:text-navy transition-colors disabled:opacity-50">
              Mark Blocked
            </button>
            <button disabled={isPending} onClick={() => runAction(() => updateFocusProgressAction(resetPrompt.id, "Complete", 100, resetPrompt.notes))} className="text-xs font-semibold text-grey px-3 py-1.5 rounded-lg hover:text-navy transition-colors disabled:opacity-50">
              Mark Complete
            </button>
          </div>
        </CardBody>
      </Card>
    );
  }

  // ---- No active focus: recommend or choose ----
  if (!activeFocus) {
    return (
      <Card className="border-orange/40">
        <CardHeader>
          <CardTitle><span className="flex items-center gap-1.5"><Target className="w-4 h-4 text-orange" /> My Focus Today</span></CardTitle>
        </CardHeader>
        <CardBody className="space-y-3">
          {error && <p className="text-sm text-red-600">{error}</p>}
          <p className="text-sm text-light-grey">What&rsquo;s the single most important thing you need to accomplish today?</p>

          {recommendation && !choosing && (
            <div className="border border-orange/30 bg-orange/5 rounded-lg p-3 space-y-2">
              <p className="text-xs font-semibold text-orange flex items-center gap-1"><Sparkles className="w-3.5 h-3.5" /> FortunIQ Intelligence recommends</p>
              <p className="text-sm font-semibold text-navy">{recommendation.title}</p>
              {recommendation.relatedLabel && <p className="text-xs text-light-grey">{recommendation.relatedLabel}</p>}
              <div className="flex gap-2">
                <button disabled={isPending} onClick={handleAcceptRecommendation} className="text-xs font-semibold text-white bg-navy px-3 py-1.5 rounded-lg hover:bg-orange transition-colors disabled:opacity-50">
                  Accept
                </button>
                <button onClick={() => setChoosing(true)} className="text-xs font-semibold text-grey hover:text-navy transition-colors">
                  Choose another
                </button>
              </div>
            </div>
          )}

          {(!recommendation || choosing) && (
            <div className="space-y-1">
              {candidates.length === 0 && <p className="text-sm text-light-grey py-2">Nothing eligible yet — add a task or check My Workflow, then come back here.</p>}
              {candidates.slice(0, 8).map((c) => (
                <button key={c.key} disabled={isPending} onClick={() => handlePickCandidate(c)} className="w-full flex items-center justify-between gap-2 text-left px-2.5 py-2 rounded-lg border border-border hover:border-orange transition-colors disabled:opacity-50">
                  <div className="min-w-0">
                    <p className="text-sm text-navy truncate">{c.title}</p>
                    <p className="text-xs text-light-grey">{c.moduleKey ? MODULE_LABEL[c.moduleKey] : "Personal"}{c.dueDate ? ` · Due ${c.dueDate}` : ""}</p>
                  </div>
                  <span className="text-xs font-semibold text-orange shrink-0">Set as My Focus</span>
                </button>
              ))}
            </div>
          )}

          <AssignFocusSection directReports={directReports} assigning={assigning} setAssigning={setAssigning} isPending={isPending} runAction={runAction} />
        </CardBody>
      </Card>
    );
  }

  // ---- Active focus ----
  const remaining = daysRemaining(activeFocus.dueDate, todayISO);

  return (
    <Card className="border-orange/40">
      <CardHeader>
        <CardTitle><span className="flex items-center gap-1.5"><Target className="w-4 h-4 text-orange" /> My Focus Today</span></CardTitle>
        {activeFocus.source === "Manager" && activeFocus.assignedBy && (
          <span className="text-xs font-semibold text-grey flex items-center gap-1"><Users className="w-3.5 h-3.5" /> Assigned by your manager</span>
        )}
      </CardHeader>
      <CardBody className="space-y-3">
        {error && <p className="text-sm text-red-600">{error}</p>}

        <div>
          <p className="font-display text-lg font-bold text-navy">{activeFocus.title}</p>
          {activeFocus.relatedLabel && <p className="text-sm text-light-grey">{activeFocus.relatedLabel}</p>}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1.5 text-xs">
          {activeFocus.moduleKey && <Field label="Module" value={MODULE_LABEL[activeFocus.moduleKey] ?? activeFocus.moduleKey} />}
          {activeFocus.workflowStage && <Field label="Stage" value={activeFocus.workflowStage} />}
          {activeFocus.priority && <Field label="Priority" value={activeFocus.priority} />}
          {activeFocus.dueDate && <Field label="Due" value={activeFocus.dueDate} />}
          {remaining !== null && <Field label="Days Remaining" value={remaining < 0 ? `${Math.abs(remaining)} overdue` : String(remaining)} />}
          {activeFocus.estimatedTime && <Field label="Est. Time" value={activeFocus.estimatedTime} />}
          <Field label="Status" value={activeFocus.status} />
          {activeFocus.progressPct !== null && <Field label="Progress" value={`${activeFocus.progressPct}%`} />}
          <Field label="Assigned By" value={activeFocus.source === "Manager" ? (activeFocus.assignedBy ?? "Manager") : activeFocus.source === "Intelligence" ? "FortunIQ Intelligence" : "You"} />
          <Field label="Last Activity" value={new Date(activeFocus.lastActivityAt).toLocaleString("en-ZA", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })} />
        </div>

        {activeFocus.progressPct !== null && (
          <div className="h-1.5 rounded-full bg-border overflow-hidden">
            <div className="h-full bg-orange rounded-full" style={{ width: `${activeFocus.progressPct}%` }} />
          </div>
        )}

        <div className="flex flex-wrap gap-2 pt-1">
          {activeFocus.relatedUrl && (
            <a href={activeFocus.relatedUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs font-semibold text-white bg-navy px-3 py-1.5 rounded-lg hover:bg-orange transition-colors">
              Continue <ArrowRight className="w-3.5 h-3.5" />
            </a>
          )}
          <button onClick={() => setUpdatingProgress((v) => !v)} className="flex items-center gap-1 text-xs font-semibold text-navy border border-border px-3 py-1.5 rounded-lg hover:border-orange transition-colors">
            <Clock className="w-3.5 h-3.5" /> Update Progress
          </button>
          <button disabled={isPending} onClick={() => runAction(() => changeFocusAction(activeFocus.id))} className="flex items-center gap-1 text-xs font-semibold text-grey hover:text-navy transition-colors">
            <RefreshCw className="w-3.5 h-3.5" /> Change Focus
          </button>
        </div>

        {updatingProgress && (
          <ProgressForm
            focus={activeFocus}
            isPending={isPending}
            onSubmit={(status, pct, notes) => runAction(() => updateFocusProgressAction(activeFocus.id, status, pct, notes).then((r) => { if (!r.error) setUpdatingProgress(false); return r; }))}
            onCancel={() => setUpdatingProgress(false)}
          />
        )}

        <AssignFocusSection directReports={directReports} assigning={assigning} setAssigning={setAssigning} isPending={isPending} runAction={runAction} />
      </CardBody>
    </Card>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-light-grey uppercase tracking-wide text-[10px]">{label}</p>
      <p className="text-navy font-semibold">{value}</p>
    </div>
  );
}

function ProgressForm({
  focus, isPending, onSubmit, onCancel,
}: {
  focus: EmployeeFocus;
  isPending: boolean;
  onSubmit: (status: FocusStatus, pct: number | null, notes: string | null) => void;
  onCancel: () => void;
}) {
  const [status, setStatus] = useState<FocusStatus>(focus.status);
  const [pct, setPct] = useState<string>(focus.progressPct !== null ? String(focus.progressPct) : "");
  const [notes, setNotes] = useState(focus.notes ?? "");

  return (
    <div className="border border-border rounded-lg p-2.5 space-y-2 bg-surface">
      <div className="flex flex-wrap gap-1.5">
        {STATUS_OPTIONS.map((s) => (
          <button key={s} type="button" onClick={() => setStatus(s)} className={`text-xs font-semibold px-2.5 py-1 rounded-full border transition-colors ${status === s ? "bg-navy text-white border-navy" : "border-border text-grey hover:border-navy"}`}>
            {s}
          </button>
        ))}
      </div>
      <input type="number" min={0} max={100} value={pct} onChange={(e) => setPct(e.target.value)} placeholder="Progress % (optional)" className="w-full text-sm px-2.5 py-1.5 rounded-lg border border-border" />
      <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes (optional)" rows={2} className="w-full text-sm px-2.5 py-1.5 rounded-lg border border-border" />
      <div className="flex gap-2">
        <button
          type="button"
          disabled={isPending}
          onClick={() => onSubmit(status, pct === "" ? null : Math.max(0, Math.min(100, Number(pct))), notes.trim() || null)}
          className="flex items-center gap-1 text-xs font-semibold text-white bg-navy px-2.5 py-1.5 rounded-lg hover:bg-orange transition-colors disabled:opacity-50"
        >
          <CheckCircle2 className="w-3.5 h-3.5" /> Save
        </button>
        <button type="button" onClick={onCancel} className="text-xs font-semibold text-grey hover:text-navy transition-colors">Cancel</button>
      </div>
    </div>
  );
}

function AssignFocusSection({
  directReports, assigning, setAssigning, isPending, runAction,
}: {
  directReports: { email: string; name: string }[];
  assigning: boolean;
  setAssigning: (v: boolean) => void;
  isPending: boolean;
  runAction: (fn: () => Promise<{ error?: string }>) => void;
}) {
  const [targetEmail, setTargetEmail] = useState(directReports[0]?.email ?? "");
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");

  if (directReports.length === 0) return null;

  return (
    <div className="pt-2 border-t border-border">
      {!assigning ? (
        <button onClick={() => setAssigning(true)} className="flex items-center gap-1 text-xs font-semibold text-grey hover:text-navy transition-colors">
          <Users className="w-3.5 h-3.5" /> Assign a focus to your team
        </button>
      ) : (
        <div className="space-y-2">
          <select value={targetEmail} onChange={(e) => setTargetEmail(e.target.value)} className="w-full text-sm px-2.5 py-1.5 rounded-lg border border-border">
            {directReports.map((r) => <option key={r.email} value={r.email}>{r.name}</option>)}
          </select>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Objective title" className="w-full text-sm px-2.5 py-1.5 rounded-lg border border-border" />
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-full text-sm px-2.5 py-1.5 rounded-lg border border-border" />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={isPending || !title.trim() || !targetEmail}
              onClick={() =>
                runAction(() =>
                  assignFocusToReportAction(targetEmail, { title, dueDate: dueDate || null }).then((r) => {
                    if (!r.error) { setAssigning(false); setTitle(""); setDueDate(""); }
                    return r;
                  })
                )
              }
              className="text-xs font-semibold text-white bg-navy px-2.5 py-1.5 rounded-lg hover:bg-orange transition-colors disabled:opacity-50"
            >
              Assign
            </button>
            <button type="button" onClick={() => setAssigning(false)} className="text-xs font-semibold text-grey hover:text-navy transition-colors">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
