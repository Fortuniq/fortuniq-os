import { getAcademyAdminData } from "@/lib/data";
import { requirePermissionAction } from "@/lib/rbac";
import { AcademyAdminView } from "./academy-admin-view";

export default async function AcademyAdminPage() {
  await requirePermissionAction("academy", "Manage");
  const { schools, courses } = await getAcademyAdminData();
  return <AcademyAdminView schools={schools} courses={courses} />;
}
