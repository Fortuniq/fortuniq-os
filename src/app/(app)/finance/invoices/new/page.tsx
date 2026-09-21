import { getAuthorizedCustomerOptionsForInvoices } from "@/lib/invoices-data";
import { requirePermissionAction } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/PageHeader";
import { InvoiceForm } from "../InvoiceForm";

export default async function NewInvoicePage() {
  const permissions = await requirePermissionAction("finance", "Create");
  const customers = await getAuthorizedCustomerOptionsForInvoices(permissions);
  return (
    <div>
      <PageHeader title="New Invoice" description="Draft an invoice — nothing is numbered or sent until it's issued." />
      <InvoiceForm customers={customers} mode="create" />
    </div>
  );
}
