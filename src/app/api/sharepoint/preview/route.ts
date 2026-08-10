import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDocumentPreviewUrl, isSharePointConfigured } from "@/lib/graph";

export async function POST(req: Request) {
  if (!isSharePointConfigured) {
    return NextResponse.json({ error: "SharePoint isn't connected yet." }, { status: 503 });
  }
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  const { itemId } = await req.json();
  if (!itemId) return NextResponse.json({ error: "No document specified." }, { status: 400 });

  try {
    const previewUrl = await getDocumentPreviewUrl(session.accessToken as string, itemId);
    return NextResponse.json({ previewUrl });
  } catch (err) {
    console.error("SharePoint preview error:", err);
    return NextResponse.json({ error: "Couldn't load a preview for this document. You may not have permission to view it." }, { status: 500 });
  }
}
