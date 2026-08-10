import { createServiceClient } from "@/lib/supabase/service";

/**
 * Records a security-relevant AI interaction — separate from the general
 * audit_logs table (see src/lib/audit.ts) because AI events have a
 * distinct shape worth tracking on their own: not just "the AI Assistant
 * was used," but exactly which documents were actually available to the
 * model when it answered.
 *
 * Deliberately never logs the prompt text or document content itself —
 * only which document IDs/names were in scope, and how long the message
 * was. See docs/AI_SECURITY.md, requirement 8.
 *
 * Never throws: a logging failure should never break the AI Assistant
 * itself for the person using it.
 */
export async function logAISecurityEvent(params: {
  actorEmail: string;
  actorName?: string | null;
  aiModule?: string;
  dataSourcesAccessed?: { id: string; name: string }[];
  messageLength?: number;
  executionOutcome: "answered" | "denied" | "error" | "rate_limited";
  error?: string;
}): Promise<void> {
  try {
    const supabase = createServiceClient();
    await supabase.from("ai_security_logs").insert({
      actor_email: params.actorEmail,
      actor_name: params.actorName ?? null,
      ai_module: params.aiModule ?? "chat",
      data_sources_accessed: params.dataSourcesAccessed ?? null,
      message_length: params.messageLength ?? null,
      execution_outcome: params.executionOutcome,
      error: params.error ?? null,
    });
  } catch (err) {
    console.error("Failed to write AI security log entry:", err);
  }
}
