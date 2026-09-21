import { getCustomers } from "@/lib/data";
import { requireModuleAccess } from "@/lib/permissions";
import { checkPermissionAction } from "@/lib/rbac";
import { CustomersView } from "./customers-view";

export default async function CustomersPage() {
  const permissions = await requireModuleAccess("customers");
  const [customers, canEdit] = await Promise.all([
    getCustomers(),
    checkPermissionAction(permissions, "customers", "Edit"),
  ]);
  return <CustomersView customers={customers} canEdit={canEdit} />;
}
