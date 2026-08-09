import Anthropic from "@anthropic-ai/sdk";
import { getCurrentUserPermissions, hasModuleAccess } from "@/lib/permissions";
import { NextResponse } from "next/server";

const SYSTEM_PROMPT = `You are the FortunIQ AI Assistant, built into FortunIQ OS — the internal
operating system for FortunIQ Fuels, a South African B-BBEE Level 1 petroleum supply and
logistics company. Help employees with tasks like drafting quotations, summarising tenders,
writing emails, preparing onboarding materials, meeting minutes, supplier reviews, SOPs, and
training content. Be concise, professional, and specific to the fuel/logistics/tender context
where relevant. If asked to produce a document, format it clearly with headings.`;

export async function POST(req: Request) {
  const permissions = await getCurrentUserPermissions();
  if (permissions.status === "signed-out") {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  if (!hasModuleAccess(permissions, "ai")) {
    return NextResponse.json({ error: "You don't have access to the AI Assistant." }, { status: 403 });
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
    const anthropic = new Anthropic({ apiKey });
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: message }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    return NextResponse.json({ reply: textBlock?.type === "text" ? textBlock.text : "" });
  } catch (err) {
    console.error("AI Assistant error:", err);
    return NextResponse.json({ error: "Something went wrong reaching the AI service." }, { status: 500 });
  }
}
