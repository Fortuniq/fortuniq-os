import { getTenders, getTenderChecklist, getTenderWorkflowCounts, getEmployeeByEmail, getFirstOutstandingChecklistItemByTender } from "@/lib/data";
import { requireModuleAccess, getCurrentUserPermissions } from "@/lib/permissions";
import { checkPermissionAction } from "@/lib/rbac";
import { getAllActiveTenderAssignments } from "@/lib/tender-assignments";
import { canManagerAccessTeamMember } from "@/lib/hcm-core";
import { applyMissedStatusToAllOpenTenders, getClosingSoonWarningDays } from "@/lib/tender-deadlines";
import { TendersView } from "./tenders-view";

export default async function TendersPage() {
  await requireModuleAccess("tenders");
  const permissions = await getCurrentUserPermissions();
  const [tenders, checklist, canCreate, workflowCounts, viewerEmployee, allAssignments, closingSoonWarningDays, outstandingChecklist] = await Promise.all([
    getTenders(),
    getTenderChecklist(),
    checkPermissionAction(permissions, "tenders", "Create"),
    getTenderWorkflowCounts(),
    permissions.email ? getEmployeeByEmail(permissions.email) : Promise.resolve(null),
    getAllActiveTenderAssignments(),
    getClosingSoonWarningDays(),
    getFirstOutstandingChecklistItemByTender(),
  ]);

  // "Tender deadlines should never rely on manual monitoring" — see
  // docs/TENDER_DEADLINES.md, "How the automatic transition actually
  // happens," for why this check runs here (on every Register load)
  // rather than via a live background job, which this app doesn't have.
  // Uses the RAW fetched status/stage, not any display-computed value —
  // fire-and-forget, never blocks rendering the page.
  void applyMissedStatusToAllOpenTenders(
    tenders.map((t) => ({ id: String(t.id), closingDate: t.closing, status: t.status, stage: t.stage, ref: t.ref }))
  );

  // "CEO / Manager Dashboard" — see docs/TENDER_ASSIGNMENT.md. Super
  // Admin and Management see every active assignment org-wide. A
  // Manager (identified by the manager_id relationship, same mechanism
  // as the rest of HCM Phase 3 — see hcm-core.ts) sees only their own
  // direct reports' assignments — never the whole company's, since
  // "Manager" isn't a broad organisational role here. Filtered
  // server-side, not just hidden in the UI.
  const isBroadVisibility = permissions.isAdmin || permissions.role === "Management" || permissions.role === "HR/Admin";
  let teamAssignments = allAssignments;
  if (!isBroadVisibility) {
    // A manager only sees assignments for people whose manager_id
    // points at their own employee record.
    const { createServiceClient } = await import("@/lib/supabase/service");
    const supabase = createServiceClient();
    const ownerEmails = new Set(allAssignments.map((a) => a.ownerEmail));
    const { data: reports } = await supabase.from("employees").select("email, manager_id").in("email", Array.from(ownerEmails));
    const myReportEmails = new Set(
      (reports ?? []).filter((r) => canManagerAccessTeamMember(permissions, viewerEmployee?.id ?? null, r.manager_id)).map((r) => r.email?.toLowerCase())
    );
    teamAssignments = allAssignments.filter((a) => myReportEmails.has(a.ownerEmail.toLowerCase()));
  }

  // Real, granular check — someone with Tenders View-only access (e.g.
  // a Sales Representative under RBAC) genuinely doesn't see the
  // Add/Edit/Delete controls, not just a cosmetic hide. See docs/RBAC.md.
  return (
    <TendersView
      tenders={tenders} checklist={checklist} canManage={canCreate} workflowCounts={workflowCounts}
      teamAssignments={teamAssignments} showTeamAssignments={isBroadVisibility || teamAssignments.length > 0}
      closingSoonWarningDays={closingSoonWarningDays} canManageSettings={permissions.isAdmin}
      outstandingChecklist={outstandingChecklist}
    />
  );
}
