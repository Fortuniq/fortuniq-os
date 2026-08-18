import { createServiceClient } from "@/lib/supabase/service";
import type { UserPermissions } from "@/lib/permissions";
import { canSeeInEmploymentFile, type DocumentVisibility } from "@/lib/employee-hub-core";
import { computeComplianceStatus, type ComplianceItem } from "@/lib/compliance-status-core";

const supabaseConfigured =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY;

export type EmploymentFileDocument = {
  id: string;
  name: string;
  category: string;
  version: string;
  currentVersionNumber: number;
  updated: string;
  modifiedBy: string | null;
  sharepointItemId: string | null;
  sharepointWebUrl: string | null;
  acknowledgementRequired: boolean;
  acknowledged: boolean;
  acknowledgedAt: string | null;
};

/**
 * The signed-in employee's own employment record. Returns null if no
 * `employees` row matches their sign-in email — never guesses or falls
 * back to a different record. See docs/EMPLOYEE_SELF_SERVICE.md.
 */
export async function getMyEmployeeRecord(permissions: UserPermissions) {
  if (!supabaseConfigured || !permissions.email) return null;
  try {
    const supabase = createServiceClient();
    const { data } = await supabase
      .from("employees")
      .select("*, manager:manager_id(id, name, role)")
      .ilike("email", permissions.email)
      .maybeSingle();
    return data ?? null;
  } catch {
    return null;
  }
}

/**
 * Documents in the signed-in employee's My Employment File — filtered
 * server-side by canSeeInEmploymentFile(), never by hiding rows only in
 * the UI. Each document is paired with its own acknowledgement status
 * for the CURRENT version specifically (see docs/EMPLOYEE_SELF_SERVICE.md,
 * "Version Control" — an old acknowledgement never counts for a new version).
 */
export async function getMyEmploymentFile(employeeId: string): Promise<EmploymentFileDocument[]> {
  if (!supabaseConfigured) return [];
  try {
    const supabase = createServiceClient();
    const { data: docs } = await supabase
      .from("documents")
      .select("*")
      .eq("employee_id", employeeId)
      .order("updated_at", { ascending: false });
    if (!docs) return [];

    const visible = docs.filter((d) =>
      canSeeInEmploymentFile({
        viewerEmployeeId: employeeId,
        documentOwnerEmployeeId: d.employee_id,
        visibility: (d.visibility ?? "HR Restricted") as DocumentVisibility,
        status: d.status,
      })
    );

    if (visible.length === 0) return [];

    const { data: acks } = await supabase
      .from("document_acknowledgements")
      .select("document_id, version_number, status, acknowledged_at")
      .eq("employee_id", employeeId)
      .in("document_id", visible.map((d) => d.id));

    return visible.map((d) => {
      const ack = acks?.find((a) => a.document_id === d.id && a.version_number === (d.current_version_number ?? 1));
      return {
        id: d.id,
        name: d.name,
        category: d.category,
        version: d.version ?? `v${d.current_version_number ?? 1}`,
        currentVersionNumber: d.current_version_number ?? 1,
        updated: d.updated_at,
        modifiedBy: d.modified_by ?? null,
        sharepointItemId: d.sharepoint_item_id,
        sharepointWebUrl: d.sharepoint_web_url,
        acknowledgementRequired: !!d.acknowledgement_required,
        acknowledged: ack?.status === "Acknowledged",
        acknowledgedAt: ack?.acknowledged_at ?? null,
      };
    });
  } catch {
    return [];
  }
}

/** Compliance Status card data — standing checks plus every acknowledgement-required document's current status. */
export async function getMyComplianceStatus(employeeId: string, employmentFile: EmploymentFileDocument[]): Promise<ComplianceItem[]> {
  if (!supabaseConfigured) return [];
  try {
    const supabase = createServiceClient();
    const [{ data: employee }, { data: equipment }] = await Promise.all([
      supabase.from("employees").select("emergency_contact").eq("id", employeeId).maybeSingle(),
      supabase.from("employee_equipment").select("id").eq("employee_id", employeeId).eq("status", "Issued").limit(1),
    ]);

    return computeComplianceStatus({
      hasEmergencyContact: !!employee?.emergency_contact,
      equipmentIssued: (equipment?.length ?? 0) > 0,
      requiredAcknowledgements: employmentFile
        .filter((d) => d.acknowledgementRequired)
        .map((d) => ({ label: d.name, acknowledged: d.acknowledged })),
    });
  } catch {
    return [];
  }
}

/**
 * ALL documents linked to an employee, regardless of visibility — for
 * HR's own Document Centre view on the Employee Profile screen. Unlike
 * getMyEmploymentFile(), this is never shown to the employee
 * themselves — it's the HR-facing counterpart.
 */
export async function getEmployeeDocuments(employeeId: string) {
  if (!supabaseConfigured) return [];
  try {
    const supabase = createServiceClient();
    const { data } = await supabase.from("documents").select("*").eq("employee_id", employeeId).order("updated_at", { ascending: false });
    return (data ?? []).map((d) => ({
      id: d.id as string,
      name: d.name as string,
      category: d.category as string,
      version: (d.version as string) ?? `v${d.current_version_number ?? 1}`,
      status: d.status as string,
      visibility: (d.visibility ?? "HR Restricted") as DocumentVisibility,
      acknowledgementRequired: !!d.acknowledgement_required,
      sharepointItemId: d.sharepoint_item_id as string | null,
      sharepointWebUrl: d.sharepoint_web_url as string | null,
      updated: d.updated_at as string,
    }));
  } catch {
    return [];
  }
}

// ---------- HR: DOCUMENT ACKNOWLEDGEMENTS DASHBOARD ----------

export type AcknowledgementRow = {
  documentId: string;
  documentName: string;
  documentCategory: string | null;
  versionNumber: number;
  employeeId: string | null;
  employeeName: string;
  employeeEmail: string;
  status: "Pending" | "Acknowledged";
  acknowledgedAt: string | null;
  outstandingDays: number | null;
  documentUpdatedAt: string;
};

/**
 * Every acknowledgement-required document paired with the employee it
 * belongs to, showing Acknowledged where a matching row exists in
 * document_acknowledgements for the CURRENT version, or Pending
 * (computed, not stored — see migration_v19's comment on why "Pending"
 * rows are never written) otherwise. Powers the HR "Document
 * Acknowledgements" widget.
 */
export async function getAllAcknowledgementStatuses(): Promise<AcknowledgementRow[]> {
  if (!supabaseConfigured) return [];
  try {
    const supabase = createServiceClient();
    const { data: docs } = await supabase
      .from("documents")
      .select("id, name, category, current_version_number, updated_at, employee_id, employees(id, name, email)")
      .eq("acknowledgement_required", true)
      .not("employee_id", "is", null);
    if (!docs || docs.length === 0) return [];

    const { data: acks } = await supabase
      .from("document_acknowledgements")
      .select("document_id, version_number, status, acknowledged_at")
      .in("document_id", docs.map((d) => d.id));

    const today = new Date();
    return docs.map((d) => {
      const versionNumber = d.current_version_number ?? 1;
      const ack = acks?.find((a) => a.document_id === d.id && a.version_number === versionNumber);
      const employee = Array.isArray(d.employees) ? d.employees[0] : d.employees;
      const outstandingDays = ack?.status === "Acknowledged"
        ? null
        : Math.max(0, Math.round((today.getTime() - new Date(d.updated_at).getTime()) / 86400000));
      return {
        documentId: d.id,
        documentName: d.name,
        documentCategory: d.category ?? null,
        versionNumber,
        employeeId: d.employee_id,
        employeeName: employee?.name ?? "Unknown",
        employeeEmail: employee?.email ?? "",
        status: ack?.status === "Acknowledged" ? "Acknowledged" : "Pending",
        acknowledgedAt: ack?.acknowledged_at ?? null,
        outstandingDays,
        documentUpdatedAt: d.updated_at,
      };
    });
  } catch {
    return [];
  }
}
