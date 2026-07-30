import { NextRequest, NextResponse } from "next/server";
import { summarizeTasks } from "@/lib/gemini";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { text } = body as { text: string };

    if (!text || typeof text !== "string" || text.trim().length < 5) {
      return NextResponse.json(
        { error: "Please provide task update text to summarize." },
        { status: 400 }
      );
    }

    if (text.trim().length > 15000) {
      return NextResponse.json(
        { error: "Input is too long. Please limit to 15,000 characters." },
        { status: 400 }
      );
    }

    const result = await summarizeTasks(text);

    return NextResponse.json({ success: true, data: result });
  } catch (err: unknown) {
    console.error("[summarize API error]", err);

    if (err instanceof SyntaxError) {
      return NextResponse.json(
        { error: "Failed to parse AI response. Please try again." },
        { status: 500 }
      );
    }

    const message =
      err instanceof Error ? err.message : "An unexpected error occurred.";

    if (message.includes("GEMINI_API_KEY")) {
      return NextResponse.json(
        {
          error:
            "API key not configured. Please add GEMINI_API_KEY to your .env.local file.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
