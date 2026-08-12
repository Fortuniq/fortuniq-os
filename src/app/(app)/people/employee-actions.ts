"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/service";
import { getCurrentUserPermissions } from "@/lib/permissions";
import { requirePermissionAction } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";

// Real, granular RBAC enforcement — matching the pattern established for
// Tenders (see docs/RBAC.md). A person needs the specific "Create" or
// "Edit" action on the People module, not just Super Admin — the HR
// Manager role template, for example, is deliberately granted "Manage"
// on People specifically so HR can do this work without needing full
// Super Admin rights across the whole system.
//
// Restricted fields (banking, tax number) are handled separately and
// more strictly, below — holding "Edit" on People is not by itself
// enough to submit those two fields; see stripRestrictedFieldsIfUnauthorised().
async function assertCanEditEmployees(action: "Create" | "Edit") {
  return requirePermissionAction("people", action);
}

// If the person submitting this form isn't authorised to see restricted
// financial data in the first place (see employee-hub-core.ts for the
// exact rule — self, HR/Admin, Finance, Super Admin), any banking/tax
// values they tried to submit are silently dropped rather than saved.
// This matters because "Edit" on People and "authorised to see banking
// details" are two different questions — someone could reasonably have
// People Edit rights (e.g. to update someone's department) without also
// being trusted with their bank account number.
function stripRestrictedFieldsIfUnauthorised(formData: FormData, caller: Awaited<ReturnType<typeof getCurrentUserPermissions>>) {
  const authorised = caller.isAdmin || caller.role === "HR/Admin" || caller.role === "Finance";
  if (!authorised) {
    formData.delete("bankName");
    formData.delete("bankAccountNumber");
    formData.delete("bankBranchCode");
    formData.delete("bankAccountType");
    formData.delete("taxNumber");
  }
}

function jsonField(formData: FormData, prefix: string) {
  const name = String(formData.get(`${prefix}Name`) ?? "").trim();
  if (!name) return null;
  return {
    name,
    relationship: String(formData.get(`${prefix}Relationship`) ?? "").trim() || undefined,
    phone: String(formData.get(`${prefix}Phone`) ?? "").trim() || undefined,
  };
}

function bankingField(formData: FormData) {
  const bank = String(formData.get("bankName") ?? "").trim();
  const accountNumber = String(formData.get("bankAccountNumber") ?? "").trim();
  if (!bank && !accountNumber) return null;
  return {
    bank: bank || undefined,
    accountNumber: accountNumber || undefined,
    branchCode: String(formData.get("bankBranchCode") ?? "").trim() || undefined,
    accountType: String(formData.get("bankAccountType") ?? "").trim() || undefined,
  };
}

export async function addEmployee(formData: FormData) {
  const caller = await assertCanEditEmployees("Create");
  stripRestrictedFieldsIfUnauthorised(formData, caller);
  const supabase = createServiceClient();

  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("A name is required.");

  // employee_number is deliberately NOT set here — the database assigns
  // it automatically (see the DEFAULT on the column, added in
  // migration_v11_employee_and_tender_actions.sql), so every employee,
  // however they're created, gets a properly sequential number with no
  // risk of a client-side race condition.
  const { error } = await supabase.from("employees").insert({
    name,
    preferred_name: String(formData.get("preferredName") ?? "").trim() || null,
    photo_url: String(formData.get("photoUrl") ?? "").trim() || null,
    role: String(formData.get("role") ?? "").trim(),
    dept: String(formData.get("dept") ?? "").trim(),
    manager_id: String(formData.get("managerId") ?? "") || null,
    office_location: String(formData.get("officeLocation") ?? "").trim() || null,
    employment_type: String(formData.get("employmentType") ?? "") || null,
    status: String(formData.get("status") ?? "Onboarding"),
    start_date: String(formData.get("startDate") ?? new Date().toISOString().slice(0, 10)),
    probation_status: String(formData.get("probationStatus") ?? "Not Applicable"),
    email: String(formData.get("email") ?? "").trim().toLowerCase() || null,
    phone: String(formData.get("phone") ?? "").trim() || null,
    emergency_contact: jsonField(formData, "emergency"),
    next_of_kin: jsonField(formData, "kin"),
    banking_details: bankingField(formData),
    tax_number: String(formData.get("taxNumber") ?? "").trim() || null,
    skills: String(formData.get("skills") ?? "").split(",").map((s) => s.trim()).filter(Boolean),
    performance_rating: String(formData.get("performanceRating") ?? "").trim() || null,
    type: String(formData.get("employmentType") ?? "") === "Intern" ? "Intern" : "Employee",
  });

  if (error) throw new Error(error.message);

  await logAudit({ actorEmail: caller.email!, actorName: caller.name, action: "team_member_added", targetType: "employee", targetLabel: name });
  revalidatePath("/people");
}

export async function updateEmployee(employeeId: string, formData: FormData) {
  const caller = await assertCanEditEmployees("Edit");
  stripRestrictedFieldsIfUnauthorised(formData, caller);
  const supabase = createServiceClient();

  const { error } = await supabase.from("employees").update({
    name: String(formData.get("name") ?? "").trim(),
    preferred_name: String(formData.get("preferredName") ?? "").trim() || null,
    photo_url: String(formData.get("photoUrl") ?? "").trim() || null,
    role: String(formData.get("role") ?? "").trim(),
    dept: String(formData.get("dept") ?? "").trim(),
    manager_id: String(formData.get("managerId") ?? "") || null,
    office_location: String(formData.get("officeLocation") ?? "").trim() || null,
    employment_type: String(formData.get("employmentType") ?? "") || null,
    status: String(formData.get("status") ?? "Active"),
    start_date: String(formData.get("startDate") ?? ""),
    probation_status: String(formData.get("probationStatus") ?? "Not Applicable"),
    email: String(formData.get("email") ?? "").trim().toLowerCase() || null,
    phone: String(formData.get("phone") ?? "").trim() || null,
    emergency_contact: jsonField(formData, "emergency"),
    next_of_kin: jsonField(formData, "kin"),
    banking_details: bankingField(formData),
    tax_number: String(formData.get("taxNumber") ?? "").trim() || null,
    skills: String(formData.get("skills") ?? "").split(",").map((s) => s.trim()).filter(Boolean),
    performance_rating: String(formData.get("performanceRating") ?? "").trim() || null,
    updated_at: new Date().toISOString(),
  }).eq("id", employeeId);

  if (error) throw new Error(error.message);

  await logAudit({ actorEmail: caller.email!, actorName: caller.name, action: "team_member_modules_changed", targetType: "employee", targetId: employeeId, metadata: { field: "profile_updated" } });
  revalidatePath("/people");
  revalidatePath(`/people/${employeeId}`);
}

export async function archiveEmployee(employeeId: string) {
  const caller = await requirePermissionAction("people", "Delete");
  const supabase = createServiceClient();
  // Never permanently deleted — becomes Archived, per the offboarding
  // principle from the original Employee Hub brief.
  await supabase.from("employees").update({ status: "Archived", archived: true, archived_at: new Date().toISOString() }).eq("id", employeeId);
  await logAudit({ actorEmail: caller.email!, actorName: caller.name, action: "team_member_modules_changed", targetType: "employee", targetId: employeeId, metadata: { field: "archived" } });
  revalidatePath("/people");
  revalidatePath(`/people/${employeeId}`);
}

// ---------- EQUIPMENT ----------
export async function addEquipment(employeeId: string, formData: FormData) {
  await assertCanEditEmployees("Edit");
  const supabase = createServiceClient();
  await supabase.from("employee_equipment").insert({
    employee_id: employeeId,
    item: String(formData.get("item") ?? "").trim(),
    serial_number: String(formData.get("serialNumber") ?? "").trim() || null,
    issued_date: String(formData.get("issuedDate") ?? new Date().toISOString().slice(0, 10)),
  });
  revalidatePath(`/people/${employeeId}`);
}

export async function returnEquipment(equipmentId: string, employeeId: string) {
  await assertCanEditEmployees("Edit");
  const supabase = createServiceClient();
  await supabase.from("employee_equipment").update({ status: "Returned", returned_date: new Date().toISOString().slice(0, 10) }).eq("id", equipmentId);
  revalidatePath(`/people/${employeeId}`);
}

// ---------- CERTIFICATIONS ----------
export async function addCertification(employeeId: string, formData: FormData) {
  await assertCanEditEmployees("Edit");
  const supabase = createServiceClient();
  await supabase.from("employee_certifications").insert({
    employee_id: employeeId,
    name: String(formData.get("name") ?? "").trim(),
    issued_date: String(formData.get("issuedDate") ?? "") || null,
    expiry_date: String(formData.get("expiryDate") ?? "") || null,
  });
  revalidatePath(`/people/${employeeId}`);
}
