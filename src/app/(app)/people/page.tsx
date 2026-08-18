import { getEmployeeDirectory } from "@/lib/data";
import { getAllAcknowledgementStatuses } from "@/lib/employee-documents";
import { requireModuleAccess, getCurrentUserPermissions } from "@/lib/permissions";
import { checkPermissionAction } from "@/lib/rbac";
import { PeopleView } from "./people-view";

export default async function PeoplePage() {
  await requireModuleAccess("people");
  const permissions = await getCurrentUserPermissions();
  const isHR = permissions.isAdmin || permissions.role === "HR/Admin";
  const [employees, canAdd, acknowledgements] = await Promise.all([
    getEmployeeDirectory(),
    checkPermissionAction(permissions, "people", "Create"),
    isHR ? getAllAcknowledgementStatuses() : Promise.resolve([]),
  ]);
  return <PeopleView employees={employees} isAdmin={canAdd} isHR={isHR} acknowledgements={acknowledgements} />;
}
