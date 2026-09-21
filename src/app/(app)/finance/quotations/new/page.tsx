import { getAuthorizedCustomerOptions } from "@/lib/quotations-data";
import { requirePermissionAction } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/PageHeader";
import { QuotationForm } from "../QuotationForm";

export default async function NewQuotationPage() {
  const permissions = await requirePermissionAction("finance", "Create");
  const customers = await getAuthorizedCustomerOptions(permissions);
  return (
    <div>
      <PageHeader title="New Quotation" description="Draft a quotation — nothing is numbered or sent until it's approved." />
      <QuotationForm customers={customers} mode="create" />
    </div>
  );
}
