import Anthropic from "@anthropic-ai/sdk";
import { getCurrentUserPermissions, hasModuleAccess } from "@/lib/permissions";
import { auth } from "@/auth";
import { getDocuments } from "@/lib/data";
import { getDocumentTextContent, isSharePointConfigured } from "@/lib/graph";
import { checkRateLimit } from "@/lib/rate-limit";
import { NextResponse } from "next/server";

const SYSTEM_PROMPT = `You are the FortunIQ AI Assistant, built into FortunIQ OS — the internal
operating system for FortunIQ Fuels, a South African B-BBEE Level 1 petroleum supply and
logistics company. Help employees with tasks like drafting quotations, summarising tenders,
writing emails, preparing onboarding materials, meeting minutes, supplier reviews, SOPs, and
training content. Be concise, professional, and specific to the fuel/logistics/tender context
where relevant. If asked to produce a document, format it clearly with headings.`;

// Builds context about the company's Approved documents for the AI to draw
// on. Only ever includes documents marked "Approved" — Draft and Archived
// documents are never shown to the AI. Uses the CURRENT SIGNED-IN USER'S
// own SharePoint access to fetch content, so — same as everywhere else in
// the Documents module — the AI can only ever read what that specific
// person could themselves open in SharePoint.
async function buildApprovedDocumentsContext(accessToken?: string): Promise<string> {
  const documents = await getDocuments();
  const approved = documents.filter((d) => d.status === "Approved");
  if (approved.length === 0) return "";

  const listing = approved.map((d) => `- ${d.name} (${d.category}, version ${d.version})`).join("\n");
  let context = `\n\nThe following company documents are Approved and available for reference:\n${listing}`;

  // Best-effort: pull actual text content for a small number of approved,
  // SharePoint-linked, text-extractable documents, so the AI can quote or
  // summarise them directly rather than just knowing they exist.
  if (isSharePointConfigured && accessToken) {
    const withFiles = approved.filter((d) => d.sharepointItemId).slice(0, 3);
    for (const doc of withFiles) {
      try {
        const text = await getDocumentTextContent(accessToken, doc.sharepointItemId as string);
        if (text) {
          context += `\n\n--- Content of "${doc.name}" ---\n${text.slice(0, 6000)}`;
        }
      } catch {
        // Skip silently — e.g. the file is a binary format (Word/PDF) not
        // yet supported for text extraction, or the user lost access.
      }
    }
  }

  return context;
}

export async function POST(req: Request) {
  const permissions = await getCurrentUserPermissions();
  if (permissions.status === "signed-out") {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  if (!hasModuleAccess(permissions, "ai")) {
    return NextResponse.json({ error: "You don't have access to the AI Assistant." }, { status: 403 });
  }

  // Rate limit: 30 messages per person per hour. Protects against runaway
  // cost from a bug, an accidental loop, or genuine misuse — while being
  // generous enough that normal, heavy use of the assistant never hits it.
  const rateLimit = await checkRateLimit(permissions.email!, "ai-chat", 30, 60 * 60);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "You've reached the AI Assistant's hourly limit (30 messages/hour). Try again shortly." },
      { status: 429 }
    );
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "AI Assistant isn't connected yet. Add ANTHROPIC_API_KEY to enable it — see docs/AI_ASSISTANT_SETUP.md." },
      { status: 503 }
    );
  }

  const { message } = await req.json();
  if (!message || typeof message !== "string") {
    return NextResponse.json({ error: "No message provided." }, { status: 400 });
  }

  try {
    const session = await auth();
    const documentContext = await buildApprovedDocumentsContext(session?.accessToken as string | undefined);

    const anthropic = new Anthropic({ apiKey });
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1024,
      system: SYSTEM_PROMPT + documentContext,
      messages: [{ role: "user", content: message }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    return NextResponse.json({ reply: textBlock?.type === "text" ? textBlock.text : "" });
  } catch (err) {
    console.error("AI Assistant error:", err);
    return NextResponse.json({ error: "Something went wrong reaching the AI service." }, { status: 500 });
  }
}
