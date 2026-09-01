import { createServiceClient } from "@/lib/supabase/service";

const supabaseConfigured =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Updates a tender's last_activity_at/last_activity_description —
 * called from every MEANINGFUL mutation point in tender-actions.ts
 * (stage changes, assignments, checklist updates, submissions, value/
 * due-date edits, AI checklist generation). Deliberately NEVER called
 * from a read/view action — viewing a tender is explicitly excluded
 * per the brief ("Do not update Last Activity for passive actions such
 * as simply viewing the tender"). Best-effort: a failure here never
 * blocks the real action that triggered it, same principle as
 * logAudit(). See docs/TENDER_REGISTER.md.
 */
export async function recordTenderActivity(tenderId: string, description: string): Promise<void> {
  if (!supabaseConfigured) return;
  try {
    const supabase = createServiceClient();
    await supabase.from("tenders").update({
      last_activity_at: new Date().toISOString(),
      last_activity_description: description,
    }).eq("id", tenderId);
  } catch (err) {
    console.error("recordTenderActivity failed:", err);
  }
}
