import { GoogleGenAI } from "@google/genai";

export interface SummaryResult {
  completed: string[];
  inProgress: string[];
  prs: string[];
}

const SYSTEM_PROMPT = `You are a strict task update extractor and summarizer. Your job is to parse raw daily task updates from developer input and extract tasks into structured JSON.

CRITICAL EXTRACTION RULES:
1. VERBATIM EXTRACTION (NO AUTO-REPHRASING):
   - You MUST extract the EXACT task descriptions and sentences as pasted by the user.
   - Do NOT rewrite, rephrase, summarize away, fix grammar, or change words during initial extraction.
   - Strip leading numbers (e.g., "1. ", "2. "), bullet symbols ("• ", "- "), or header labels ("Task Update:"), but PRESERVE the exact sentence text verbatim.

2. ABSOLUTE ZERO HALLUCINATION:
   - Do NOT invent, assume, or add any task, detail, or PR that is not explicitly present in the input text.

3. SECTION CATEGORIZATION RULES:
   - "completed": Extract items listed under "Task Update", "Completed", "Today's Update", "Done", "Updates", or standard un-labeled task items.
   - "inProgress": Extract items explicitly listed under headers like "In Progress", "In-Progress", "Ongoing", "Pending".
   - "prs": Extract items explicitly listed under headers like "PR", "PRs", "Pull Request".
   - STRICT CONSTRAINT: NEVER place "In Progress" tasks into the "prs" array!

4. SPECIAL "PR SAME AS UPDATES" RULE:
   - If the update text contains "PR same as updates", "PR same as above", "PR same as completed", "PR - same as updates", or similar:
     -> Copy ALL completed tasks into the "prs" array.
     -> DO NOT copy any "inProgress" tasks to "prs".

5. OUTPUT STRUCTURE:
Output ONLY a valid JSON object matching this exact format:
{
  "completed": ["exact sentence 1", "exact sentence 2"],
  "inProgress": ["exact sentence 1"],
  "prs": ["exact sentence 1"]
}
Do not include markdown explanations outside the JSON.`;

const ASSISTANT_SYSTEM_PROMPT = `You are an AI assistant helping a user modify, rephrase, and refine their daily task summary result on demand.

Your job is to apply the user's specific instruction to the existing summary JSON.

RULES:
1. Modify ONLY what the user asks for in their instruction (e.g. rephrasing tasks, making them concise, converting to formal tone, moving items between sections, adding a new item, deleting an item, or fixing grammar/typos).
2. If the user asks to rephrase or rewrite, apply high quality developer tone adjustments while preserving the core technical details.
3. Never invent tasks that contradict the context or user request.
4. Maintain logical categories:
   - "completed": finished tasks
   - "inProgress": ongoing tasks
   - "prs": pull requests
5. NEVER place inProgress tasks in the "prs" array.
6. Return ONLY a valid JSON object with the updated structure:
{
  "completed": [...],
  "inProgress": [...],
  "prs": [...]
}
Do not include any explanation or markdown outside the JSON.`;

// List of models to try in sequence if rate-limited or quota-exceeded
const MODELS = [
  "gemini-flash-latest",
  "gemini-flash-lite-latest",
  "gemini-pro-latest",
  "gemini-2.0-flash-lite-001",
  "gemini-2.0-flash-001",
  "gemini-2.0-flash-lite",
  "gemini-2.0-flash",
];

function cleanItem(item: string): string {
  if (typeof item !== "string") return "";
  return item
    .replace(/^[\d+.\-•*\s]+/, "")
    .trim();
}

function parseJsonSafely(text: string): SummaryResult | null {
  try {
    const cleaned = text
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();
    const parsed = JSON.parse(cleaned);
    return {
      completed: Array.isArray(parsed.completed) ? parsed.completed.map(cleanItem).filter(Boolean) : [],
      inProgress: Array.isArray(parsed.inProgress) ? parsed.inProgress.map(cleanItem).filter(Boolean) : [],
      prs: Array.isArray(parsed.prs) ? parsed.prs.map(cleanItem).filter(Boolean) : [],
    };
  } catch {
    return null;
  }
}

/**
 * Intelligent Local Rule-Based Fallback Parser
 * Used when API keys are unconfigured, rate-limited, or AI models are unavailable.
 * Preserves EXACT sentences and strictly enforces no in-progress tasks in PRs.
 */
export function parseLocalFallback(rawText: string): SummaryResult {
  const completed: string[] = [];
  const inProgress: string[] = [];
  const prs: string[] = [];

  const lines = rawText.split(/\r?\n/);
  let currentSection: "completed" | "inProgress" | "prs" = "completed";
  let prSameAsUpdatesDetected = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Check for section headers
    if (/^(in progress|in-progress|ongoing|pending):?/i.test(line)) {
      currentSection = "inProgress";
      const rest = line.replace(/^(in progress|in-progress|ongoing|pending):?/i, "").trim();
      if (rest) {
        const cleaned = cleanItem(rest);
        if (cleaned) inProgress.push(cleaned);
      }
      continue;
    }

    if (/^(pr|prs|pull request|pull requests):?/i.test(line)) {
      currentSection = "prs";
      const rest = line.replace(/^(pr|prs|pull request|pull requests):?/i, "").replace(/^[-:\s]+/, "").trim();

      if (/same as (updates|above|completed)/i.test(rest) || /same as/i.test(rest)) {
        prSameAsUpdatesDetected = true;
      } else if (rest) {
        const cleaned = cleanItem(rest);
        if (cleaned) prs.push(cleaned);
      }
      continue;
    }

    if (/^(task update|completed|today's update|done|tasks|updates):?/i.test(line)) {
      currentSection = "completed";
      const rest = line.replace(/^(task update|completed|today's update|done|tasks|updates):?/i, "").trim();
      if (rest) {
        const cleaned = cleanItem(rest);
        if (cleaned) completed.push(cleaned);
      }
      continue;
    }

    // Check standalone line "pr same as updates" or similar
    if (/pr\s+same\s+as\s+(updates|above|completed)/i.test(line) || /^pr\s*-\s*same/i.test(line)) {
      prSameAsUpdatesDetected = true;
      continue;
    }

    // Regular line item - preserve exact text minus leading bullet/numbering
    const cleaned = cleanItem(line);
    if (!cleaned) continue;

    if (currentSection === "completed") {
      completed.push(cleaned);
    } else if (currentSection === "inProgress") {
      inProgress.push(cleaned);
    } else if (currentSection === "prs") {
      prs.push(cleaned);
    }
  }

  // Handle "PR same as updates": Copy ONLY completed tasks into prs, NEVER inProgress
  if (prSameAsUpdatesDetected) {
    completed.forEach((c) => {
      if (!prs.includes(c)) {
        prs.push(c);
      }
    });
  }

  // Deduplicate preserving exact sentences
  return {
    completed: Array.from(new Set(completed)),
    inProgress: Array.from(new Set(inProgress)),
    prs: Array.from(new Set(prs)),
  };
}

export async function summarizeTasks(rawText: string): Promise<SummaryResult> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (apiKey && apiKey !== "paste_your_api_key_here") {
    const ai = new GoogleGenAI({ apiKey });
    const prompt = `${SYSTEM_PROMPT}\n\nHere are the raw task updates to parse:\n\n${rawText}`;

    for (const model of MODELS) {
      try {
        console.log(`[summarize] Attempting model: ${model}`);
        const response = await ai.models.generateContent({
          model,
          contents: prompt,
        });
        const text = response.text?.trim() ?? "";
        const result = parseJsonSafely(text);
        if (result) {
          console.log(`[summarize] Successfully extracted summary with model: ${model}`);
          return result;
        }
      } catch (err: unknown) {
        const error = err as Error & { status?: number };
        const msg = error?.message ?? "";
        console.warn(`[summarize] Model ${model} failed (${error?.status || "error"}): ${msg.substring(0, 100)}`);
      }
    }
  }

  console.log("[summarize] Using intelligent local verbatim parser fallback.");
  return parseLocalFallback(rawText);
}

/**
 * AI Assistant endpoint logic to modify generated summary results on demand.
 */
export async function modifySummaryWithAI(
  currentSummary: SummaryResult,
  instruction: string,
  rawInputText?: string
): Promise<SummaryResult> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (apiKey && apiKey !== "paste_your_api_key_here") {
    const ai = new GoogleGenAI({ apiKey });
    const prompt = `${ASSISTANT_SYSTEM_PROMPT}

CURRENT SUMMARY JSON:
${JSON.stringify(currentSummary, null, 2)}

${rawInputText ? `ORIGINAL RAW DEVELOPER INPUT:\n${rawInputText}\n` : ""}
USER INSTRUCTION FOR ASSISTANT:
"${instruction}"`;

    for (const model of MODELS) {
      try {
        console.log(`[assistant] Modifying summary using model: ${model}`);
        const response = await ai.models.generateContent({
          model,
          contents: prompt,
        });
        const text = response.text?.trim() ?? "";
        const result = parseJsonSafely(text);
        if (result) {
          return result;
        }
      } catch (err: unknown) {
        const error = err as Error & { status?: number };
        console.warn(`[assistant] Model ${model} failed: ${error?.message}`);
      }
    }
  }

  // Fallback local modification for simple instructions if offline/no key
  return applyLocalAssistantInstruction(currentSummary, instruction);
}

function applyLocalAssistantInstruction(
  current: SummaryResult,
  instruction: string
): SummaryResult {
  const lower = instruction.toLowerCase();
  const updated: SummaryResult = {
    completed: [...current.completed],
    inProgress: [...current.inProgress],
    prs: [...current.prs],
  };

  if (lower.includes("concise") || lower.includes("short")) {
    updated.completed = updated.completed.map((s) => s.length > 60 ? s.slice(0, 57) + "..." : s);
    updated.inProgress = updated.inProgress.map((s) => s.length > 60 ? s.slice(0, 57) + "..." : s);
    updated.prs = updated.prs.map((s) => s.length > 60 ? s.slice(0, 57) + "..." : s);
  } else if (lower.includes("professional") || lower.includes("formal")) {
    updated.completed = updated.completed.map((s) => s.charAt(0).toUpperCase() + s.slice(1));
    updated.inProgress = updated.inProgress.map((s) => s.charAt(0).toUpperCase() + s.slice(1));
    updated.prs = updated.prs.map((s) => s.charAt(0).toUpperCase() + s.slice(1));
  } else if (lower.includes("sync pr") || lower.includes("pr same as completed")) {
    updated.prs = Array.from(new Set([...updated.prs, ...updated.completed]));
  }

  return updated;
}
