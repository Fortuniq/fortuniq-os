import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDocumentPreviewUrl, isSharePointConfigured } from "@/lib/graph";
import { logAudit } from "@/lib/audit";

export async function POST(req: Request) {
  if (!isSharePointConfigured) {
    return NextResponse.json({ error: "SharePoint isn't connected yet." }, { status: 503 });
  }
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  const { itemId, name } = await req.json();
  if (!itemId) return NextResponse.json({ error: "No document specified." }, { status: 400 });

  try {
    const previewUrl = await getDocumentPreviewUrl(session.accessToken as string, itemId);

    // "Document downloaded" from the audit trail's point of view — opening
    // a preview is the closest equivalent to viewing/downloading a file
    // that this app can observe.
    if (session.user?.email) {
      logAudit({
        actorEmail: session.user.email,
        actorName: session.user.name,
        action: "document_previewed",
        targetType: "document",
        targetId: itemId,
        targetLabel: name ?? itemId,
      });
    }

    return NextResponse.json({ previewUrl });
  } catch (err) {
    console.error("SharePoint preview error:", err);
    return NextResponse.json({ error: "Couldn't load a preview for this document. You may not have permission to view it." }, { status: 500 });
  }
}
