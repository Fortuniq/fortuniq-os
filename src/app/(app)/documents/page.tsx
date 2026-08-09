import { getDocuments } from "@/lib/data";
import { requireModuleAccess } from "@/lib/permissions";
import { DocumentsView } from "./documents-view";

export default async function DocumentsPage() {
  await requireModuleAccess("documents");
  const documents = await getDocuments();
  return <DocumentsView documents={documents} />;
}
