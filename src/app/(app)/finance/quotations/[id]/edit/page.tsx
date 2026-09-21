import { notFound } from "next/navigation";
import { getQuotationDetail, getAuthorizedCustomerOptions } from "@/lib/quotations-data";
import { requireModuleAccess } from "@/lib/permissions";
import { isPreIssueQuotationStatus, type QuotationStatus } from "@/lib/finance-core";
import { PageHeader } from "@/components/ui/PageHeader";
import { QuotationForm } from "../../QuotationForm";

export default async function EditQuotationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const permissions = await requireModuleAccess("finance");
  const quotation = await getQuotationDetail(id, permissions);
  if (!quotation) notFound();
  if (!isPreIssueQuotationStatus(quotation.status as QuotationStatus)) notFound();

  const customers = await getAuthorizedCustomerOptions(permissions);
  // Make sure the quotation's own current customer is selectable even if
  // it wouldn't otherwise appear (e.g. an admin editing a Sales rep's draft).
  const withCurrent = customers.some((c) => c.id === quotation.customerId)
    ? customers
    : [{ id: quotation.customerId, customerCode: null, name: quotation.customerName, accountOwnerEmail: null }, ...customers];

  return (
    <div>
      <PageHeader title={`Edit ${quotation.quotationNumber ?? "Draft Quotation"}`} description={quotation.customerName} />
      <QuotationForm
        customers={withCurrent}
        mode="edit"
        initial={{
          id: quotation.id,
          customerId: quotation.customerId,
          validUntil: quotation.validUntil,
          notes: quotation.notes,
          terms: quotation.terms,
          lineItems: quotation.lineItems,
        }}
      />
    </div>
  );
}
