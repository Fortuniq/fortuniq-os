import { notFound } from "next/navigation";
import { getTenderDetail } from "@/lib/data";
import { requireModuleAccess, getCurrentUserPermissions } from "@/lib/permissions";
import { checkPermissionAction } from "@/lib/rbac";
import { isSharePointConfigured } from "@/lib/graph";
import { getTenderStageAssignments, getTenderStageAssignmentHistory } from "@/lib/tender-assignments";
import { normalizeTenderStage } from "@/lib/tender-core";
import { applyMissedStatusIfNeeded } from "@/lib/tender-deadlines";
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

  // Fire-and-forget — see docs/TENDER_DEADLINES.md. Uses the raw
  // fetched status/stage; the view itself computes the effective
  // (possibly Missed) status live regardless of whether this write
  // has landed yet.
  void applyMissedStatusIfNeeded({ id: tender.id, closingDate: tender.closing, status: tender.status, stage: tender.stage, ref: tender.ref });

  const assignments = await getTenderStageAssignments(tender.id);
  const history = await getTenderStageAssignmentHistory(tender.id);
  const currentStage = normalizeTenderStage(tender.stage);
  const currentAssignment = assignments.find((a) => a.stage === currentStage && a.status === "Active") ?? null;

  return <TenderDetailView tender={tender} canEdit={canEdit} canApprove={canApprove} sharePointConfigured={isSharePointConfigured} currentAssignment={currentAssignment} history={history} />;
}
