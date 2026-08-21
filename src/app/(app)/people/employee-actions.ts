"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/service";
import { getCurrentUserPermissions } from "@/lib/permissions";
import { requirePermissionAction } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { ensureEmployeeFolder, isSharePointConfigured } from "@/lib/graph";
import { auth } from "@/auth";
import { createTaskForEmployee } from "@/lib/tasks";

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

export async function addEmployee(formData: FormData): Promise<{ error?: string }> {
  try {
    const caller = await assertCanEditEmployees("Create");
    stripRestrictedFieldsIfUnauthorised(formData, caller);
    const supabase = createServiceClient();

    const name = String(formData.get("name") ?? "").trim();
    if (!name) return { error: "A name is required." };

    // Email is deliberately required, not optional — it's how this person
    // is matched to their Microsoft sign-in and to their System Access &
    // Permissions record. Without it, that entire section on their profile
    // has nothing to attach to and simply can't work.
    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    if (!email) return { error: "An email address is required — it's how this person's sign-in and permissions get linked to their record." };

    // employee_number is deliberately NOT set here — the database assigns
    // it automatically (see the DEFAULT on the column, added in
    // migration_v11_employee_and_tender_actions.sql), so every employee,
    // however they're created, gets a properly sequential number with no
    // risk of a client-side race condition. .select() gets that assigned
    // number back so the SharePoint folder below can use it.
    const { data: inserted, error } = await supabase.from("employees").insert({
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
      email,
      phone: String(formData.get("phone") ?? "").trim() || null,
      emergency_contact: jsonField(formData, "emergency"),
      next_of_kin: jsonField(formData, "kin"),
      banking_details: bankingField(formData),
      tax_number: String(formData.get("taxNumber") ?? "").trim() || null,
      skills: String(formData.get("skills") ?? "").split(",").map((s) => s.trim()).filter(Boolean),
      performance_rating: String(formData.get("performanceRating") ?? "").trim() || null,
      type: String(formData.get("employmentType") ?? "") === "Intern" ? "Intern" : "Employee",
    }).select("id, employee_number").single();

    if (error) return { error: error.message };

    await logAudit({ actorEmail: caller.email!, actorName: caller.name, action: "team_member_added", targetType: "employee", targetLabel: name });

    // Best-effort SharePoint folder creation — an employee record must
    // never fail to save just because SharePoint had a hiccup, same
    // "never block the real action" principle used everywhere else in
    // this app (see ensureTenderFolder's behaviour in tender-actions.ts).
    if (isSharePointConfigured && inserted?.employee_number) {
      try {
        const session = await auth();
        if (session?.accessToken) {
          const folder = await ensureEmployeeFolder(session.accessToken as string, inserted.employee_number, name);
          await supabase.from("employees").update({
            sharepoint_folder_id: folder.id, sharepoint_folder_url: folder.webUrl,
          }).eq("id", inserted.id);
        }
      } catch (err) {
        console.error("ensureEmployeeFolder failed (employee record is still saved in FortunIQ OS):", err);
      }
    }

    revalidatePath("/people");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Something went wrong. Please try again." };
  }
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

// =========================================================================
// EMPLOYEE SELF-SERVICE — HR-side controls
// =========================================================================
// See docs/EMPLOYEE_SELF_SERVICE.md.

/**
 * Sets which My Employment File visibility level a document has, and
 * whether it requires acknowledgement. Both are HR/Super Admin
 * decisions, same reasoning as document classification elsewhere in
 * this app — not something that should be self-service for anyone who
 * merely has People module Edit access.
 */
export async function setEmployeeDocumentVisibility(
  documentId: string,
  visibility: "Employee Visible" | "Manager Visible" | "HR Restricted" | "Finance Restricted" | "Super Admin Only",
  acknowledgementRequired: boolean
): Promise<{ error?: string }> {
  try {
    const permissions = await getCurrentUserPermissions();
    if (!permissions.isAdmin && permissions.role !== "HR/Admin") {
      return { error: "Only HR or a Super Admin can change document visibility." };
    }

    const supabase = createServiceClient();
    const { data: before } = await supabase.from("documents").select("name, visibility, acknowledgement_required").eq("id", documentId).maybeSingle();

    const { error } = await supabase.from("documents").update({
      visibility, acknowledgement_required: acknowledgementRequired, updated_at: new Date().toISOString(),
    }).eq("id", documentId);
    if (error) return { error: error.message };

    await logAudit({
      actorEmail: permissions.email!, actorName: permissions.name, action: "document_status_changed",
      targetType: "document", targetId: documentId, targetLabel: before?.name ?? documentId,
      metadata: {
        field: "employee_visibility",
        before: { visibility: before?.visibility, acknowledgementRequired: before?.acknowledgement_required },
        after: { visibility, acknowledgementRequired },
      },
    });

    revalidatePath("/people");
    revalidatePath("/profile");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Something went wrong. Please try again." };
  }
}

/**
 * HR's "Send Reminder" action on the Document Acknowledgements widget —
 * creates a My Tasks item for the employee via the same unified task
 * layer used everywhere else in this app (see docs/EMPLOYEE_DASHBOARD.md),
 * rather than a separate reminder/notification system.
 */
export async function sendAcknowledgementReminder(params: {
  employeeEmail: string;
  documentId: string;
  documentName: string;
}): Promise<{ error?: string }> {
  try {
    const permissions = await getCurrentUserPermissions();
    if (!permissions.isAdmin && permissions.role !== "HR/Admin") {
      return { error: "Only HR or a Super Admin can send acknowledgement reminders." };
    }
    await createTaskForEmployee({
      title: `Please acknowledge: ${params.documentName}`,
      employeeEmail: params.employeeEmail,
      moduleKey: "people",
      priority: "High",
      workflowStage: "Acknowledgement Required",
      createdBy: permissions.email ?? undefined,
    });
    await logAudit({
      actorEmail: permissions.email!, actorName: permissions.name, action: "document_status_changed",
      targetType: "document", targetId: params.documentId, targetLabel: params.documentName,
      metadata: { reminderSentTo: params.employeeEmail },
    });
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Couldn't send the reminder." };
  }
}

/**
 * HR/Super Admin uploads a document directly into an employee's
 * personnel file — "Employee Profile → Employee Handbook → Upload
 * Document → Select Category → Upload to SharePoint → Save metadata →
 * Immediately available in My Profile" per the brief's exact workflow.
 * Uploaded documents go straight to Published (skipping the general
 * Draft/Pending Approval pipeline in document-actions.ts) — an HR
 * person uploading a signed contract to someone's personnel file IS the
 * approval; there's no separate reviewer to route it to. See
 * docs/EMPLOYEE_SELF_SERVICE.md.
 */
export async function uploadEmployeeDocument(formData: FormData): Promise<{ error?: string }> {
  try {
    const permissions = await getCurrentUserPermissions();
    if (!permissions.isAdmin && permissions.role !== "HR/Admin") {
      return { error: "Only HR or a Super Admin can upload documents to an employee's personnel file." };
    }

    const employeeId = String(formData.get("employeeId") ?? "");
    const name = String(formData.get("name") ?? "").trim();
    const category = String(formData.get("category") ?? "").trim();
    const visibility = String(formData.get("visibility") ?? "HR Restricted");
    const acknowledgementRequired = formData.get("acknowledgementRequired") === "on";
    const file = formData.get("file") as File | null;

    if (!employeeId || !name || !category) return { error: "Name and category are required." };
    if (!file || file.size === 0) return { error: "Choose a file to upload." };
    if (file.size > 8 * 1024 * 1024) return { error: "File is larger than 8MB — not supported yet." };
    if (!isSharePointConfigured) return { error: "SharePoint isn't connected yet." };

    const session = await auth();
    if (!session?.accessToken) return { error: "Your Microsoft session needs refreshing — try signing out and back in." };
    const accessToken = session.accessToken as string;

    const supabase = createServiceClient();
    const { data: employee } = await supabase.from("employees").select("employee_number, name").eq("id", employeeId).maybeSingle();
    if (!employee) return { error: "Employee not found." };

    const PERFORMANCE_CATEGORIES = ["Performance Review", "Performance"];
    const SKILLS_CATEGORIES = ["Training Certificate", "Qualification", "Skills & Certifications"];

    const { getEmployeeRootFolder, getEmployeeSubfolder, uploadFileToFolder } = await import("@/lib/graph");
    const folder = PERFORMANCE_CATEGORIES.includes(category)
      ? await getEmployeeSubfolder(accessToken, employee.employee_number, employee.name, "Performance")
      : SKILLS_CATEGORIES.includes(category)
      ? await getEmployeeSubfolder(accessToken, employee.employee_number, employee.name, "Skills & Certifications")
      : await getEmployeeRootFolder(accessToken, employee.employee_number, employee.name);

    const bytes = await file.arrayBuffer();
    const uploaded = await uploadFileToFolder(accessToken, folder.id, file.name, bytes, file.type);

    const { data: inserted, error } = await supabase.from("documents").insert({
      name,
      category,
      version: "v1",
      owner: employee.name,
      status: "Published",
      published_by: permissions.email,
      published_at: new Date().toISOString(),
      employee_id: employeeId,
      visibility,
      acknowledgement_required: acknowledgementRequired,
      current_version_number: 1,
      modified_by: permissions.email,
      sharepoint_item_id: uploaded.id,
      sharepoint_web_url: uploaded.webUrl,
    }).select("id").single();
    if (error) return { error: error.message };

    const { recordNewVersion } = await import("@/lib/document-versions");
    await recordNewVersion({
      documentId: inserted.id, versionNumber: 1, sharepointItemId: uploaded.id, sharepointWebUrl: uploaded.webUrl,
      uploadedBy: permissions.email!, uploadedByName: permissions.name ?? null,
    });

    await logAudit({
      actorEmail: permissions.email!, actorName: permissions.name, action: "document_uploaded",
      targetType: "document", targetId: inserted.id, targetLabel: name,
      metadata: { employeeId, fileName: file.name },
    });

    revalidatePath(`/people/${employeeId}`);
    revalidatePath("/profile");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Something went wrong. Please try again." };
  }
}

// =========================================================================
// HCM PHASE 3 — Identity, Employment (extra), Payroll edits
// =========================================================================
// Kept as separate, targeted actions rather than folding into the
// general updateEmployee()/EmployeeFormModal flow — these are
// permission-gated differently (Payroll needs Finance access too,
// Identity/Employment-extra are HR/Super-Admin-only) and are edited
// from their own dedicated cards on the HR Employee Profile screen. See
// docs/HCM_PHASE3.md.

export async function updateIdentity(employeeId: string, formData: FormData): Promise<{ error?: string }> {
  try {
    const caller = await getCurrentUserPermissions();
    if (!caller.isAdmin && caller.role !== "HR/Admin") return { error: "Only HR or a Super Admin can edit Identity information." };

    const supabase = createServiceClient();
    const { error } = await supabase.from("employees").update({
      id_number: String(formData.get("idNumber") ?? "").trim() || null,
      passport_number: String(formData.get("passportNumber") ?? "").trim() || null,
      date_of_birth: String(formData.get("dateOfBirth") ?? "").trim() || null,
      nationality: String(formData.get("nationality") ?? "").trim() || null,
      gender: String(formData.get("gender") ?? "").trim() || null,
      home_address: String(formData.get("homeAddress") ?? "").trim() || null,
      drivers_licence: String(formData.get("driversLicence") ?? "").trim() || null,
      work_permit: String(formData.get("workPermit") ?? "").trim() || null,
      updated_at: new Date().toISOString(),
    }).eq("id", employeeId);
    if (error) return { error: error.message };

    await logAudit({ actorEmail: caller.email!, actorName: caller.name, action: "team_member_modules_changed", targetType: "employee", targetId: employeeId, metadata: { field: "identity" } });
    revalidatePath(`/people/${employeeId}`);
    revalidatePath("/profile");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Couldn't save Identity information." };
  }
}

export async function updateEmploymentExtra(employeeId: string, formData: FormData): Promise<{ error?: string }> {
  try {
    const caller = await getCurrentUserPermissions();
    if (!caller.isAdmin && caller.role !== "HR/Admin") return { error: "Only HR or a Super Admin can edit Employment information." };

    const supabase = createServiceClient();
    const { error } = await supabase.from("employees").update({
      contract_type: String(formData.get("contractType") ?? "").trim() || null,
      notice_period: String(formData.get("noticePeriod") ?? "").trim() || null,
      probation_end_date: String(formData.get("probationEndDate") ?? "").trim() || null,
      payroll_cycle: String(formData.get("payrollCycle") ?? "").trim() || null,
      shift_pattern: String(formData.get("shiftPattern") ?? "").trim() || null,
      updated_at: new Date().toISOString(),
    }).eq("id", employeeId);
    if (error) return { error: error.message };

    await logAudit({ actorEmail: caller.email!, actorName: caller.name, action: "team_member_modules_changed", targetType: "employee", targetId: employeeId, metadata: { field: "employment_extra" } });
    revalidatePath(`/people/${employeeId}`);
    revalidatePath("/profile");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Couldn't save Employment information." };
  }
}

/** Finance, HR, or Super Admin — matches canViewPayroll() in hcm-core.ts exactly. */
export async function updatePayroll(employeeId: string, formData: FormData): Promise<{ error?: string }> {
  try {
    const caller = await getCurrentUserPermissions();
    const allowed = caller.isAdmin || caller.role === "HR/Admin" || caller.role === "Finance";
    if (!allowed) return { error: "Only Finance, HR, or a Super Admin can edit Payroll information." };

    const salaryRaw = String(formData.get("salary") ?? "").trim();
    const salary = salaryRaw === "" ? null : Number(salaryRaw);
    if (salary !== null && (!Number.isFinite(salary) || salary < 0)) return { error: "Salary must be a valid, non-negative number." };

    const supabase = createServiceClient();
    const { error } = await supabase.from("employees").update({
      salary,
      payroll_number: String(formData.get("payrollNumber") ?? "").trim() || null,
      uif: String(formData.get("uif") ?? "").trim() || null,
      paye: String(formData.get("paye") ?? "").trim() || null,
      medical_aid: String(formData.get("medicalAid") ?? "").trim() || null,
      pension: String(formData.get("pension") ?? "").trim() || null,
      bonus_eligibility: formData.get("bonusEligibility") === "on",
      leave_encashment: String(formData.get("leaveEncashment") ?? "").trim() ? Number(formData.get("leaveEncashment")) : null,
      payroll_status: String(formData.get("payrollStatus") ?? "Active"),
      updated_at: new Date().toISOString(),
    }).eq("id", employeeId);
    if (error) return { error: error.message };

    await logAudit({ actorEmail: caller.email!, actorName: caller.name, action: "team_member_modules_changed", targetType: "employee", targetId: employeeId, metadata: { field: "payroll" } });
    revalidatePath(`/people/${employeeId}`);
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Couldn't save Payroll information." };
  }
}
