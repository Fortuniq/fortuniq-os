import { getEmployees } from "@/lib/data";
import { requireModuleAccess } from "@/lib/permissions";
import { PeopleView } from "./people-view";

export default async function PeoplePage() {
  await requireModuleAccess("people");
  const employees = await getEmployees();
  return <PeopleView employees={employees} />;
}
