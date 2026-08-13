import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { requirePermissionAction } from "@/lib/rbac";
import { listFolderContents, isSharePointConfigured } from "@/lib/graph";

export async function POST(req: Request) {
  if (!isSharePointConfigured) {
    return NextResponse.json({ error: "SharePoint isn't connected yet. See docs/SHAREPOINT_SETUP.md." }, { status: 503 });
  }
  // Real, granular RBAC — same as every other tender action. Someone
  // without at least View on Tenders can't browse a tender's documents,
  // even if they somehow had the folder ID.
  await requirePermissionAction("tenders", "View");

  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Not signed in, or your Microsoft session needs refreshing — try signing out and back in." }, { status: 401 });
  }

  const { folderId } = await req.json();
  if (!folderId) return NextResponse.json({ error: "No folder specified." }, { status: 400 });

  try {
    // Uses the SIGNED-IN PERSON'S OWN token — if they don't actually have
    // permission to this specific SharePoint folder, Microsoft itself
    // will refuse the request here, regardless of what FortunIQ OS's own
    // records say. See docs/AI_SECURITY.md for the same principle applied
    // elsewhere in this app.
    const files = await listFolderContents(session.accessToken as string, folderId);
    return NextResponse.json({ files });
  } catch (err) {
    console.error("Tender folder list error:", err);
    return NextResponse.json({ error: "Couldn't reach this tender's SharePoint folder. You may not have permission to it." }, { status: 500 });
  }
}
