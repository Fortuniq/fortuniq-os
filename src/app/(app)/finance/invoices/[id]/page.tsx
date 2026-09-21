import { notFound } from "next/navigation";
import { getInvoiceDetail } from "@/lib/invoices-data";
import { requireModuleAccess } from "@/lib/permissions";
import { checkPermissionAction } from "@/lib/rbac";
import { InvoiceDetailView } from "./invoice-detail-view";

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const permissions = await requireModuleAccess("finance");
  const invoice = await getInvoiceDetail(id, permissions);
  if (!invoice) notFound();

  const [canEdit, canIssue] = await Promise.all([
    checkPermissionAction(permissions, "finance", "Edit"),
    checkPermissionAction(permissions, "finance", "Approve"),
  ]);

  return <InvoiceDetailView invoice={invoice} canEdit={canEdit} canIssue={canIssue} />;
}
