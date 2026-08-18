import { notFound } from "next/navigation";
import { getEmployeeProfile, getEmployeeDirectory, getEmployeeByEmail } from "@/lib/data";
import { getEmployeeDocuments } from "@/lib/employee-documents";
import { requireModuleAccess, getCurrentUserPermissions } from "@/lib/permissions";
import { checkPermissionAction } from "@/lib/rbac";
import { canViewRestrictedEmployeeField } from "@/lib/employee-hub-core";
import { canViewIdentity, canViewPayroll, canManagerAccessTeamMember } from "@/lib/hcm-core";
import { getMyLeaveRequests } from "@/lib/leave";
import { getAllReviewsForEmployee } from "@/lib/performance";
import { EmployeeProfileView } from "./employee-profile-view";

export default async function EmployeeProfilePage({ params }: { params: Promise<{ id: string }> }) {
  await requireModuleAccess("people");
  const permissions = await getCurrentUserPermissions();
  const { id } = await params;
  const [profile, directory, canEdit, documents, leaveRequests, performanceReviews, viewerEmployee] = await Promise.all([
    getEmployeeProfile(id),
    getEmployeeDirectory(),
    checkPermissionAction(permissions, "people", "Edit"),
    getEmployeeDocuments(id),
    getMyLeaveRequests(id),
    getAllReviewsForEmployee(id),
    permissions.email ? getEmployeeByEmail(permissions.email) : Promise.resolve(null),
  ]);

  if (!profile) notFound();

  // Security-critical: restricted fields are stripped out HERE, on the
  // server, before anything is sent to the browser — not just hidden by
  // the UI. An unauthorised person's browser never receives this data in
  // the first place. See docs/EMPLOYEE_HUB.md and
  // src/lib/employee-hub-core.ts.
  const canViewBanking = canViewRestrictedEmployeeField(permissions, profile.email, "banking");
  const canViewTax = canViewRestrictedEmployeeField(permissions, profile.email, "tax");
  const identityAccess = canViewIdentity(permissions, profile.email);
  const canSeePayroll = canViewPayroll(permissions);
  const isManagerOfThisEmployee = canManagerAccessTeamMember(permissions, viewerEmployee?.id ?? null, profile.managerId);

  const safeProfile = {
    ...profile,
    bankingDetails: canViewBanking ? profile.bankingDetails : null,
    taxNumber: canViewTax ? profile.taxNumber : null,
    identity: identityAccess === "full" ? profile.identity : {
      idNumber: null, passportNumber: null, dateOfBirth: null, nationality: null, gender: null, homeAddress: null, driversLicence: null, workPermit: null,
    },
    payroll: canSeePayroll ? profile.payroll : {
      salary: null, payrollNumber: null, uif: null, paye: null, medicalAid: null, pension: null, bonusEligibility: false, leaveEncashment: null, payrollStatus: null,
    },
  };

  return (
    <EmployeeProfileView
      profile={safeProfile}
      canViewRestricted={canViewBanking || canViewTax}
      isOwnProfile={!!permissions.email && permissions.email.toLowerCase() === (profile.email ?? "").toLowerCase()}
      isAdmin={canEdit}
      // System Access & Permissions manages OTHER people's access to the
      // whole system — deliberately kept Super-Admin-only, the same
      // reasoning as Team Management staying Super-Admin-only, regardless
      // of what granular "Edit" rights someone might separately hold on
      // the People module itself. Letting RBAC-editing rights be granted
      // via the RBAC system it controls would be a real privilege-
      // escalation risk. See docs/RBAC.md.
      isSuperAdmin={permissions.isAdmin}
      isHR={permissions.isAdmin || permissions.role === "HR/Admin"}
      canEditIdentity={identityAccess === "full"}
      canEditPayroll={canSeePayroll}
      canManageThisEmployee={isManagerOfThisEmployee}
      documents={documents}
      leaveRequests={leaveRequests}
      performanceReviews={performanceReviews}
      managers={directory.map((e) => ({ id: e.id, name: e.name }))}
    />
  );
}
