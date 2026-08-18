import { requireModuleAccess } from "@/lib/permissions";
import { getEmployeeByEmail, getEmployeeProfile } from "@/lib/data";
import { getMyEmploymentFile, getMyComplianceStatus } from "@/lib/employee-documents";
import { getMyLeaveRequests } from "@/lib/leave";
import { getMyPublishedReviews } from "@/lib/performance";
import { canViewIdentity } from "@/lib/hcm-core";
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

  const [employmentFile, leaveRequests, performanceReviews] = await Promise.all([
    getMyEmploymentFile(profile.id),
    getMyLeaveRequests(profile.id),
    getMyPublishedReviews(profile.id),
  ]);
  const complianceStatus = await getMyComplianceStatus(profile.id, employmentFile);

  // "masked" here — a person only ever sees their OWN profile on this
  // page, so this always resolves to "masked" (or "none" is
  // unreachable, since match/profile above already confirm it's their
  // own record) — computed via the same canViewIdentity() used
  // everywhere else in the app rather than hard-coding "always mask,"
  // so the one rule lives in one place. See docs/HCM_PHASE3.md.
  const identityAccess = canViewIdentity(permissions, profile.email);

  return (
    <ProfileView
      profile={profile}
      employmentFile={employmentFile}
      complianceStatus={complianceStatus}
      leaveRequests={leaveRequests}
      performanceReviews={performanceReviews}
      showIdentity={identityAccess !== "none"}
    />
  );
}

function NoRecordMessage({ reason }: { reason: string }) {
  return (
    <div className="max-w-lg mx-auto mt-16 text-center">
      <h1 className="font-display text-xl font-black text-navy mb-2">My Profile</h1>
      <p className="text-sm text-grey">{reason}</p>
    </div>
  );
}
