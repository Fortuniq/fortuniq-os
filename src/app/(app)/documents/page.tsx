import { getDocuments, getExpiringDocuments } from "@/lib/data";
import { requireModuleAccess, getCurrentUserPermissions } from "@/lib/permissions";
import { checkPermissionAction } from "@/lib/rbac";
import { isSharePointConfigured, DOCUMENT_CATEGORIES } from "@/lib/graph";
import { canAccessDocumentByClassification } from "@/lib/ai-security-core";
import { DocumentsView } from "./documents-view";

export default async function DocumentsPage() {
  const permissions = await requireModuleAccess("documents");
  const [allDocuments, expiringDocuments, canCreate, canEdit, canApprove, canDelete] = await Promise.all([
    getDocuments(),
    getExpiringDocuments(),
    checkPermissionAction(permissions, "documents", "Create"),
    checkPermissionAction(permissions, "documents", "Edit"),
    checkPermissionAction(permissions, "documents", "Approve"),
    checkPermissionAction(permissions, "documents", "Delete"),
  ]);

  const visibleDocuments = allDocuments.filter((d) => canAccessDocumentByClassification(permissions, d));

  // Archive visibility: Super Admin, HR/Admin by default, or anyone
  // explicitly granted the broadest "Manage" RBAC action on Documents —
  // the mechanism for adding Compliance/Legal without inventing new
  // top-level roles. See docs/DOCUMENT_CONTROL.md, "Archive
  // permissions."
  const canViewArchive = permissions.isAdmin || permissions.role === "HR/Admin" || (await checkPermissionAction(permissions, "documents", "Manage"));

  return (
    <DocumentsView
      documents={visibleDocuments}
      expiringDocuments={expiringDocuments}
      sharePointConfigured={isSharePointConfigured}
      isAdmin={permissions.isAdmin}
      canCreate={canCreate}
      canEdit={canEdit}
      canApprove={canApprove}
      canDelete={canDelete}
      canViewArchive={canViewArchive}
      categories={DOCUMENT_CATEGORIES}
    />
  );
}
