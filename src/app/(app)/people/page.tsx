import { getEmployeeDirectory } from "@/lib/data";
import { requireModuleAccess } from "@/lib/permissions";
import { PeopleView } from "./people-view";

export default async function PeoplePage() {
  const permissions = await requireModuleAccess("people");
  const employees = await getEmployeeDirectory();
  return <PeopleView employees={employees} isAdmin={permissions.isAdmin} />;
}
