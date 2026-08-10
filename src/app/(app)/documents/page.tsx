import { getDocuments } from "@/lib/data";
import { requireModuleAccess } from "@/lib/permissions";
import { isSharePointConfigured } from "@/lib/graph";
import { canAccessDocumentByClassification } from "@/lib/ai-security-core";
import { DocumentsView } from "./documents-view";

export default async function DocumentsPage() {
  const permissions = await requireModuleAccess("documents");
  const allDocuments = await getDocuments();

  // Classification filter: a Confidential/Highly Confidential document
  // isn't even listed to someone not explicitly authorised for it, same
  // rule the AI Assistant follows — see docs/AI_SECURITY.md.
  const visibleDocuments = allDocuments.filter((d) => canAccessDocumentByClassification(permissions, d));

  return (
    <DocumentsView
      documents={visibleDocuments}
      sharePointConfigured={isSharePointConfigured}
      isAdmin={permissions.isAdmin}
    />
  );
}
