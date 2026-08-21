import { notFound } from "next/navigation";
import { getTenderDetail } from "@/lib/data";
import { requireModuleAccess, getCurrentUserPermissions } from "@/lib/permissions";
import { checkPermissionAction } from "@/lib/rbac";
import { isSharePointConfigured } from "@/lib/graph";
import { TenderDetailView } from "./tender-detail-view";

export default async function TenderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireModuleAccess("tenders");
  const { id } = await params;
  const permissions = await getCurrentUserPermissions();
  const [tender, canEdit, canApprove] = await Promise.all([
    getTenderDetail(id),
    checkPermissionAction(permissions, "tenders", "Edit"),
    checkPermissionAction(permissions, "tenders", "Approve"),
  ]);

  if (!tender) notFound();

  return <TenderDetailView tender={tender} canEdit={canEdit} canApprove={canApprove} sharePointConfigured={isSharePointConfigured} />;
}
