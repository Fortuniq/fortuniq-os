import { requireModuleAccess } from "@/lib/permissions";
import { getEmployeeByEmail, getEmployeeProfile } from "@/lib/data";
import { getMyEmploymentFile, getMyComplianceStatus } from "@/lib/employee-documents";
import { ProfileView } from "./profile-view";

export default async function MyProfilePage() {
  // Available to anyone who can reach the Dashboard — this is a
  // personal page, not an HR privilege. The actual security boundary is
  // below: we only ever look up the SIGNED-IN person's own employee
  // record by their session email, never anything supplied by the
  // client (a URL, a query param, etc). There is no [id] segment on
  // this route at all — see docs/EMPLOYEE_SELF_SERVICE.md, "Security."
  const permissions = await requireModuleAccess("dashboard");

  if (!permissions.email) {
    return <NoRecordMessage reason="Your session doesn't have an email on record." />;
  }

  const match = await getEmployeeByEmail(permissions.email);
  if (!match) {
    return <NoRecordMessage reason="No employee record in FortunIQ OS is linked to your account yet. Contact HR to have your profile set up." />;
  }

  const profile = await getEmployeeProfile(match.id);
  if (!profile) {
    return <NoRecordMessage reason="Something went wrong loading your profile. Please try again shortly." />;
  }

  const employmentFile = await getMyEmploymentFile(profile.id);
  const complianceStatus = await getMyComplianceStatus(profile.id, employmentFile);

  return <ProfileView profile={profile} employmentFile={employmentFile} complianceStatus={complianceStatus} />;
}

function NoRecordMessage({ reason }: { reason: string }) {
  return (
    <div className="max-w-lg mx-auto mt-16 text-center">
      <h1 className="font-display text-xl font-black text-navy mb-2">My Profile</h1>
      <p className="text-sm text-grey">{reason}</p>
    </div>
  );
}
