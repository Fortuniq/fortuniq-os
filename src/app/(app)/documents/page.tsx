import { getDocuments } from "@/lib/data";
import { requireModuleAccess } from "@/lib/permissions";
import { isSharePointConfigured } from "@/lib/graph";
import { DocumentsView } from "./documents-view";

export default async function DocumentsPage() {
  await requireModuleAccess("documents");
  const documents = await getDocuments();
  return <DocumentsView documents={documents} sharePointConfigured={isSharePointConfigured} />;
}
