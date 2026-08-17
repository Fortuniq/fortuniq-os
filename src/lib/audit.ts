import { createServiceClient } from "@/lib/supabase/service";

export type AuditAction =
  | "sign_in"
  | "role_changed"
  | "team_member_added"
  | "team_member_removed"
  | "team_member_modules_changed"
  | "document_status_changed"
  | "document_catalogued"
  | "document_previewed"
  | "document_uploaded"
  | "document_replaced"
  | "document_archived"
  | "document_restored"
  | "document_approved"
  | "document_published"
  | "document_deleted"
  | "document_downloaded"
  | "document_link_removed"
  | "clocked_in"
  | "clocked_out"
  | "attendance_correction_requested"
  | "attendance_correction_reviewed";

/**
 * Records an entry in the audit log. Used across the app wherever a
 * meaningful, security-relevant action happens — see
 * docs/AUDIT_LOGS.md for the full list of what is and isn't currently
 * logged, and why.
 *
 * Deliberately never throws: a failure to write an audit log entry should
 * never break the actual feature the person is using. Failures are logged
 * to the server console instead, so they're still visible to you without
 * risking the user-facing action.
 */
export async function logAudit(params: {
  actorEmail: string;
  actorName?: string | null;
  action: AuditAction;
  targetType?: string;
  targetId?: string;
  targetLabel?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const supabase = createServiceClient();
    await supabase.from("audit_logs").insert({
      actor_email: params.actorEmail,
      actor_name: params.actorName ?? null,
      action: params.action,
      target_type: params.targetType ?? null,
      target_id: params.targetId ?? null,
      target_label: params.targetLabel ?? null,
      metadata: params.metadata ?? null,
    });
  } catch (err) {
    console.error("Failed to write audit log entry:", err);
  }
}
