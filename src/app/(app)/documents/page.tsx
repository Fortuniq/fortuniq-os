import { getDocuments } from "@/lib/data";
import { DocumentsView } from "./documents-view";

export default async function DocumentsPage() {
  const documents = await getDocuments();
  return <DocumentsView documents={documents} />;
}
