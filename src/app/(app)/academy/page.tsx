import { getSchools } from "@/lib/data";
import { requireModuleAccess } from "@/lib/permissions";
import { AcademyView } from "./academy-view";

export default async function AcademyPage() {
  const permissions = await requireModuleAccess("academy");
  const schools = await getSchools(permissions.email);
  return <AcademyView schools={schools} />;
}
