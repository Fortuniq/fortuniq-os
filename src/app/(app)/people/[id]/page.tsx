import { notFound } from "next/navigation";
import { getEmployeeProfile, getEmployeeDirectory } from "@/lib/data";
import { requireModuleAccess } from "@/lib/permissions";
import { canViewRestrictedEmployeeField } from "@/lib/employee-hub-core";
import { EmployeeProfileView } from "./employee-profile-view";

export default async function EmployeeProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const permissions = await requireModuleAccess("people");
  const { id } = await params;
  const [profile, directory] = await Promise.all([getEmployeeProfile(id), getEmployeeDirectory()]);

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
      isAdmin={permissions.isAdmin}
      managers={directory.map((e) => ({ id: e.id, name: e.name }))}
    />
  );
}
