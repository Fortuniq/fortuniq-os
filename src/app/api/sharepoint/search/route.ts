import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { searchSharePointFiles, isSharePointConfigured } from "@/lib/graph";

export async function POST(req: Request) {
  if (!isSharePointConfigured) {
    return NextResponse.json({ error: "SharePoint isn't connected yet." }, { status: 503 });
  }
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  const { query } = await req.json();
  if (!query || typeof query !== "string") {
    return NextResponse.json({ error: "No search query provided." }, { status: 400 });
  }

  try {
    const files = await searchSharePointFiles(session.accessToken as string, query);
    return NextResponse.json({ files });
  } catch (err) {
    console.error("SharePoint search error:", err);
    return NextResponse.json({ error: "Search failed. Check your SharePoint connection." }, { status: 500 });
  }
}
