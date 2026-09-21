import { getQuotations, getAuthorizedCustomerOptions } from "@/lib/quotations-data";
import { requireModuleAccess } from "@/lib/permissions";
import { checkPermissionAction } from "@/lib/rbac";
import { QuotationsView } from "./quotations-view";

export default async function QuotationsPage() {
  const permissions = await requireModuleAccess("finance");
  const [quotations, customers, canCreate] = await Promise.all([
    getQuotations(permissions),
    getAuthorizedCustomerOptions(permissions),
    checkPermissionAction(permissions, "finance", "Create"),
  ]);
  return <QuotationsView quotations={quotations} customers={customers} canCreate={canCreate} />;
}
