import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDocumentVersions, isSharePointConfigured } from "@/lib/graph";

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
    const versions = await getDocumentVersions(session.accessToken as string, itemId);
    return NextResponse.json({ versions });
  } catch (err) {
    console.error("SharePoint versions error:", err);
    return NextResponse.json({ error: "Couldn't load version history for this document." }, { status: 500 });
  }
}
