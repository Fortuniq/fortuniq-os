import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isSharePointConfigured, ensureDocumentLibraryStructure, getCategoryFolder, listFolderContents } from "@/lib/graph";

/**
 * Lists the files inside a specific document category's live SharePoint
 * folder — used by "Browse SharePoint" in the Attach/Replace Document
 * flow. Deliberately scoped to one category folder rather than the
 * whole library, and never reaches into Archive/{category} — Archive is
 * a sibling folder, not nested under the live category folder, so this
 * naturally can't surface archived files. See docs/DOCUMENT_CONTROL.md.
 */
export async function POST(req: Request) {
  if (!isSharePointConfigured) {
    return NextResponse.json({ error: "SharePoint isn't connected yet." }, { status: 503 });
  }
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  const { category } = await req.json();
  if (!category) return NextResponse.json({ error: "No category specified." }, { status: 400 });

  try {
    const accessToken = session.accessToken as string;
    await ensureDocumentLibraryStructure(accessToken);
    const folder = await getCategoryFolder(accessToken, category);
    const files = await listFolderContents(accessToken, folder.id);
    return NextResponse.json({ files: files.filter((f) => !f.isFolder) });
  } catch (err) {
    console.error("SharePoint category browse error:", err);
    return NextResponse.json({ error: "Couldn't load that category's SharePoint folder." }, { status: 500 });
  }
}
