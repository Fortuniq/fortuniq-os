import { notFound } from "next/navigation";
import { getInvoiceDetail, getAuthorizedCustomerOptionsForInvoices } from "@/lib/invoices-data";
import { requireModuleAccess } from "@/lib/permissions";
import { isPreIssueInvoiceStatus, type InvoiceStatus } from "@/lib/finance-core";
import { PageHeader } from "@/components/ui/PageHeader";
import { InvoiceForm } from "../../InvoiceForm";

export default async function EditInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const permissions = await requireModuleAccess("finance");
  const invoice = await getInvoiceDetail(id, permissions);
  if (!invoice) notFound();
  if (!isPreIssueInvoiceStatus(invoice.status as InvoiceStatus)) notFound();

  const customers = await getAuthorizedCustomerOptionsForInvoices(permissions);
  // Make sure the invoice's own current customer is selectable even if
  // it wouldn't otherwise appear (e.g. an admin editing a Sales rep's draft).
  const withCurrent = customers.some((c) => c.id === invoice.customerId)
    ? customers
    : [{ id: invoice.customerId, customerCode: null, name: invoice.customerName, accountOwnerEmail: null }, ...customers];

  return (
    <div>
      <PageHeader title={`Edit ${invoice.invoiceNumber ?? "Draft Invoice"}`} description={invoice.customerName} />
      <InvoiceForm
        customers={withCurrent}
        mode="edit"
        initial={{
          id: invoice.id,
          customerId: invoice.customerId,
          dueDate: invoice.dueDate,
          notes: invoice.notes,
          terms: invoice.terms,
          lineItems: invoice.lineItems,
        }}
      />
    </div>
  );
}
