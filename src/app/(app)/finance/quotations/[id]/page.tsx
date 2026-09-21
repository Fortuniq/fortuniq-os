import { notFound } from "next/navigation";
import { getQuotationDetail } from "@/lib/quotations-data";
import { requireModuleAccess } from "@/lib/permissions";
import { checkPermissionAction } from "@/lib/rbac";
import { QuotationDetailView } from "./quotation-detail-view";

export default async function QuotationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const permissions = await requireModuleAccess("finance");
  const quotation = await getQuotationDetail(id, permissions);
  if (!quotation) notFound();

  const [canEdit, canApprove] = await Promise.all([
    checkPermissionAction(permissions, "finance", "Edit"),
    checkPermissionAction(permissions, "finance", "Approve"),
  ]);

  return <QuotationDetailView quotation={quotation} canEdit={canEdit} canApprove={canApprove} />;
}
