import { NextRequest, NextResponse } from "next/server";
import { modifySummaryWithAI, SummaryResult } from "@/lib/gemini";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { currentSummary, instruction, rawText } = body as {
      currentSummary: SummaryResult;
      instruction: string;
      rawText?: string;
    };

    if (!currentSummary || typeof currentSummary !== "object") {
      return NextResponse.json(
        { error: "Invalid request. Current summary object is required." },
        { status: 400 }
      );
    }

    if (!instruction || typeof instruction !== "string" || instruction.trim().length === 0) {
      return NextResponse.json(
        { error: "Please enter an instruction for the AI assistant." },
        { status: 400 }
      );
    }

    const result = await modifySummaryWithAI(currentSummary, instruction, rawText);

    return NextResponse.json({ success: true, data: result });
  } catch (err: unknown) {
    console.error("[assistant API error]", err);
    const message = err instanceof Error ? err.message : "An unexpected error occurred.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
