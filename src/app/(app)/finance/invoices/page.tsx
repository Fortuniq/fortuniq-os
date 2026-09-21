import { getInvoicesList, getAuthorizedCustomerOptionsForInvoices } from "@/lib/invoices-data";
import { requireModuleAccess } from "@/lib/permissions";
import { checkPermissionAction } from "@/lib/rbac";
import { InvoicesView } from "./invoices-view";

export default async function InvoicesPage() {
  const permissions = await requireModuleAccess("finance");
  const [invoices, customers, canCreate] = await Promise.all([
    getInvoicesList(permissions),
    getAuthorizedCustomerOptionsForInvoices(permissions),
    checkPermissionAction(permissions, "finance", "Create"),
  ]);
  return <InvoicesView invoices={invoices} customers={customers} canCreate={canCreate} />;
}
