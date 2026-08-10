import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { listSharePointFiles, isSharePointConfigured } from "@/lib/graph";

export async function GET() {
  if (!isSharePointConfigured) {
    return NextResponse.json({ error: "SharePoint isn't connected yet. See docs/SHAREPOINT_SETUP.md." }, { status: 503 });
  }
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Not signed in, or your Microsoft session needs refreshing — try signing out and back in." }, { status: 401 });
  }
  try {
    const files = await listSharePointFiles(session.accessToken as string);
    return NextResponse.json({ files });
  } catch (err) {
    console.error("SharePoint list error:", err);
    return NextResponse.json({ error: "Couldn't reach SharePoint. Check your permissions and SHAREPOINT_SITE_URL." }, { status: 500 });
  }
}
