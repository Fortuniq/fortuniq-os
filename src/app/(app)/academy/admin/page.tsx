import { redirect } from "next/navigation";
import { getAcademyAdminData } from "@/lib/data";
import { requireModuleAccess, getCurrentUserPermissions } from "@/lib/permissions";
import { AcademyAdminView } from "./academy-admin-view";

export default async function AcademyAdminPage() {
  await requireModuleAccess("academy");
  const permissions = await getCurrentUserPermissions();
  if (!permissions.isAdmin) redirect("/access-denied");

  const { schools, courses } = await getAcademyAdminData();
  return <AcademyAdminView schools={schools} courses={courses} />;
}
