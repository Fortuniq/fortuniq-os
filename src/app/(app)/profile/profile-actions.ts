"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/service";
import { getCurrentUserPermissions } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { getMyEmployeeRecord } from "@/lib/employee-documents";

// Same lesson as docs/DOCUMENT_CONTROL.md's fix: Next.js redacts the
// message of anything THROWN from a Server Action in production, so
// every action here returns {error?} instead. See that doc for the
// full explanation — this is not a one-off pattern, it's how every
// user-facing Server Action in this app should be written.
type ActionResult = { error?: string };

/**
 * Records the signed-in employee's acknowledgement of a specific
 * document — always for that document's CURRENT version, and always
 * for the signed-in person's own employee record. A person can never
 * acknowledge a document that isn't theirs, or on someone else's
 * behalf — enforced here server-side, not just by what buttons the UI
 * happens to show. See docs/EMPLOYEE_SELF_SERVICE.md.
 */
export async function acknowledgeDocumentAction(documentId: string): Promise<ActionResult> {
  try {
    const permissions = await getCurrentUserPermissions();
    if (!permissions.email) return { error: "You need to be signed in." };

    const employee = await getMyEmployeeRecord(permissions);
    if (!employee) return { error: "No employee record is linked to your account." };

    const supabase = createServiceClient();
    const { data: doc } = await supabase.from("documents").select("*").eq("id", documentId).maybeSingle();
    if (!doc) return { error: "Document not found." };
    if (doc.employee_id !== employee.id) return { error: "This document doesn't belong to your employment file." };
    if (!doc.acknowledgement_required) return { error: "This document doesn't require acknowledgement." };

    const versionNumber = doc.current_version_number ?? 1;
    const hdrs = await headers();
    const ip = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    const userAgent = hdrs.get("user-agent") ?? null;

    // Idempotent — acknowledging the same version twice (e.g. a double
    // click) just returns success rather than erroring on the unique
    // constraint, since the intent ("I've acknowledged this") is
    // already satisfied.
    const { data: existing } = await supabase
      .from("document_acknowledgements")
      .select("id")
      .eq("document_id", documentId).eq("version_number", versionNumber).eq("employee_id", employee.id)
      .maybeSingle();

    if (!existing) {
      const { error } = await supabase.from("document_acknowledgements").insert({
        document_id: documentId,
        version_number: versionNumber,
        employee_id: employee.id,
        employee_email: permissions.email,
        employee_name: employee.name,
        document_name: doc.name,
        document_category: doc.category,
        status: "Acknowledged",
        acknowledged_at: new Date().toISOString(),
        ip_address: ip,
        device_info: userAgent,
      });
      if (error) return { error: error.message };
    }

    await logAudit({
      actorEmail: permissions.email, actorName: permissions.name, action: "document_acknowledged",
      targetType: "document", targetId: documentId, targetLabel: `${doc.name} v${versionNumber}`,
      metadata: { versionNumber, employeeId: employee.id },
    });

    revalidatePath("/profile");
    revalidatePath("/people");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Couldn't record your acknowledgement. Please try again." };
  }
}
