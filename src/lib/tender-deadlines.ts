import { createServiceClient } from "@/lib/supabase/service";
import { shouldAutoMarkMissed, DEFAULT_CLOSING_SOON_WARNING_DAYS } from "@/lib/tender-core";
import { logAudit } from "@/lib/audit";

const supabaseConfigured =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * HOW THE AUTOMATIC TRANSITION ACTUALLY HAPPENS
 * =========================================================================
 * This app has no cron/scheduled-job infrastructure (documented already
 * in docs/TENDER_ASSIGNMENT.md for overdue escalation, and
 * docs/HCM_PHASE3.md for dashboard reminders — the same constraint
 * applies here). "Automatically" therefore means: the next time ANY
 * open tender is read (the Tender Register loads, a tender detail page
 * loads, the dashboard counters compute), this function checks whether
 * it has newly passed its closing date unsubmitted, and if so performs
 * the real database write — status, stage, missed_at, an audit log
 * entry, and a workflow history entry — right then, once, idempotently.
 *
 * Meanwhile, `computeEffectiveTenderStatus()`/`computeEffectiveTenderStage()`
 * in tender-core.ts (pure, no DB access) are used for DISPLAY everywhere
 * a status is shown, so the UI is always visually correct even in the
 * gap between a deadline passing and the next read that actually
 * triggers this write. Given how this app is actually used (people
 * checking the Tender Register regularly, not leaving it unopened for
 * weeks), that gap is realistically minutes to hours, not days — but
 * it is a real gap, and worth being honest about. A true "the instant
 * midnight passes" transition would need a real scheduled function
 * (e.g. a Netlify Scheduled Function) — a documented follow-up, not
 * implemented here. See docs/TENDER_DEADLINES.md.
 */
export async function applyMissedStatusIfNeeded(tender: {
  id: string;
  closingDate: string;
  status: string;
  stage: string | null;
  ref: string;
}): Promise<void> {
  if (!supabaseConfigured) return;
  if (!shouldAutoMarkMissed(tender)) return;
  try {
    const supabase = createServiceClient();
    // Re-check against the live row immediately before writing, not the
    // possibly-stale `tender` object passed in — closes the (small) race
    // window if two requests read this same overdue tender at once.
    const { data: live } = await supabase.from("tenders").select("status, stage, closing_date, ref").eq("id", tender.id).maybeSingle();
    if (!live || !shouldAutoMarkMissed({ closingDate: live.closing_date, status: live.status, stage: live.stage })) return;

    await supabase.from("tenders").update({
      status: "Missed", stage: "Closed — Missed", missed_at: new Date().toISOString(),
    }).eq("id", tender.id);

    await logAudit({
      actorEmail: "system@fortuniqos", actorName: "FortunIQ OS (automatic)", action: "tender_auto_missed",
      targetType: "tender", targetId: tender.id, targetLabel: live.ref,
      metadata: { field: "status", before: live.status, after: "Missed", reason: "Closing date expired without submission" },
    });

    await supabase.from("tender_stage_assignment_history").insert({
      tender_id: tender.id, stage: "Closed — Missed", event_type: "Missed",
      comments: "Tender automatically marked as Missed. Closing date expired.",
      actor_email: "system@fortuniqos", actor_name: "FortunIQ OS (automatic)",
    });
  } catch (err) {
    // Never let this best-effort classification break the page that
    // triggered it — the effective (computed) status still displays
    // correctly via computeEffectiveTenderStatus() regardless of
    // whether this write succeeds.
    console.error("applyMissedStatusIfNeeded failed:", err);
  }
}

/** Runs the check across every currently-Open tender — called once per Tender Register page load. Cheap: only tenders shouldAutoMarkMissed() actually flags result in a write. */
export async function applyMissedStatusToAllOpenTenders(tenders: { id: string; closingDate: string; status: string; stage: string | null; ref: string }[]): Promise<void> {
  const candidates = tenders.filter((t) => shouldAutoMarkMissed(t));
  await Promise.all(candidates.map((t) => applyMissedStatusIfNeeded(t)));
}

/** The configurable "Closing Soon" warning period — see docs/TENDER_DEADLINES.md. Falls back to the default when no setting has been saved yet. */
export async function getClosingSoonWarningDays(): Promise<number> {
  if (!supabaseConfigured) return DEFAULT_CLOSING_SOON_WARNING_DAYS;
  try {
    const supabase = createServiceClient();
    const { data } = await supabase.from("app_settings").select("value").eq("key", "tender_closing_soon_days").maybeSingle();
    const parsed = data?.value ? Number(data.value) : NaN;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_CLOSING_SOON_WARNING_DAYS;
  } catch {
    return DEFAULT_CLOSING_SOON_WARNING_DAYS;
  }
}

export async function setClosingSoonWarningDays(days: number): Promise<{ error?: string }> {
  if (!supabaseConfigured) return { error: "Not available until a database is connected." };
  if (!Number.isFinite(days) || days <= 0) return { error: "Warning period must be a positive number of days." };
  try {
    const supabase = createServiceClient();
    await supabase.from("app_settings").upsert({ key: "tender_closing_soon_days", value: days, updated_at: new Date().toISOString() }, { onConflict: "key" });
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Couldn't save the warning period." };
  }
}
