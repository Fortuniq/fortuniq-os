import { getDocuments } from "@/lib/data";
import { requireModuleAccess, getCurrentUserPermissions } from "@/lib/permissions";
import { checkPermissionAction } from "@/lib/rbac";
import { isSharePointConfigured } from "@/lib/graph";
import { canAccessDocumentByClassification } from "@/lib/ai-security-core";
import { DocumentsView } from "./documents-view";

export default async function DocumentsPage() {
  const permissions = await requireModuleAccess("documents");
  const [allDocuments, canCreate, canEdit] = await Promise.all([
    getDocuments(),
    checkPermissionAction(permissions, "documents", "Create"),
    checkPermissionAction(permissions, "documents", "Edit"),
  ]);

  const visibleDocuments = allDocuments.filter((d) => canAccessDocumentByClassification(permissions, d));

  return (
    <DocumentsView
      documents={visibleDocuments}
      sharePointConfigured={isSharePointConfigured}
      isAdmin={permissions.isAdmin}
      canCreate={canCreate}
      canEdit={canEdit}
    />
  );
}
