import { notFound } from "next/navigation";
import { getEmployeeProfile, getEmployeeDirectory } from "@/lib/data";
import { requireModuleAccess, getCurrentUserPermissions } from "@/lib/permissions";
import { checkPermissionAction } from "@/lib/rbac";
import { canViewRestrictedEmployeeField } from "@/lib/employee-hub-core";
import { EmployeeProfileView } from "./employee-profile-view";

export default async function EmployeeProfilePage({ params }: { params: Promise<{ id: string }> }) {
  await requireModuleAccess("people");
  const permissions = await getCurrentUserPermissions();
  const { id } = await params;
  const [profile, directory, canEdit] = await Promise.all([
    getEmployeeProfile(id),
    getEmployeeDirectory(),
    checkPermissionAction(permissions, "people", "Edit"),
  ]);

  if (!profile) notFound();

  // Security-critical: restricted fields are stripped out HERE, on the
  // server, before anything is sent to the browser — not just hidden by
  // the UI. An unauthorised person's browser never receives this data in
  // the first place. See docs/EMPLOYEE_HUB.md and
  // src/lib/employee-hub-core.ts.
  const canViewBanking = canViewRestrictedEmployeeField(permissions, profile.email, "banking");
  const canViewTax = canViewRestrictedEmployeeField(permissions, profile.email, "tax");

  const safeProfile = {
    ...profile,
    bankingDetails: canViewBanking ? profile.bankingDetails : null,
    taxNumber: canViewTax ? profile.taxNumber : null,
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
      managers={directory.map((e) => ({ id: e.id, name: e.name }))}
    />
  );
}
