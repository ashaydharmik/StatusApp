import { GoogleGenAI } from "@google/genai";

export interface SummaryResult {
  completed: string[];
  inProgress: string[];
  prs: string[];
}

const SYSTEM_PROMPT = `You are an expert developer task update summarizer. Your job is to parse raw, free-form daily task updates from one or more developers and produce a clean, structured JSON summary.

RULES:
1. Analyze all pasted content and extract tasks into three categories:
   - "completed": Things that are done/integrated/fixed/implemented/worked on
   - "inProgress": Things currently being worked on, ongoing, or in testing
   - "prs": Pull requests or PR references

2. Handle these special cases:
   - If the update says "PR same as updates", "PR same as above", "PR same as completed", or similar → copy ALL completed tasks into the prs array as well
   - If update says "PR - [description]" or "PR: [description]" → add that description to prs
   - If multiple developers' updates are pasted together, merge all their completed/inProgress/prs into one combined list
   - Deduplicate similar tasks that appear multiple times
   - Normalize all tasks into clean, concise sentences (remove numbering, bullets, hyphens)

3. Output ONLY a valid JSON object with this exact structure:
{
  "completed": ["task 1", "task 2", ...],
  "inProgress": ["task 1", "task 2", ...],
  "prs": ["pr 1", "pr 2", ...]
}

4. Do not include any explanation, markdown, or text outside the JSON.
5. If a section has no items, return an empty array [].
6. Keep task descriptions concise but complete.`;

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

function cleanItem(item: string): string {
  if (typeof item !== "string") return "";
  return item
    .replace(/^[\d+.\-•*\s]+/, "")
    .trim();
}

/**
 * Intelligent Local Rule-Based Fallback Parser
 * Used when API keys are unconfigured, rate-limited, or AI models are unavailable.
 */
export function parseLocalFallback(rawText: string): SummaryResult {
  const completed: string[] = [];
  const inProgress: string[] = [];
  const prs: string[] = [];

  const lines = rawText.split(/\r?\n/);
  let currentSection: "completed" | "inProgress" | "prs" = "completed";

  let prSameAsUpdatesDetected = false;
  const currentBlockCompleted: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const lower = line.toLowerCase();

    // Check for section headers
    if (/^(in progress|in-progress|ongoing|pending):?/i.test(line)) {
      currentSection = "inProgress";
      const rest = line.replace(/^(in progress|in-progress|ongoing|pending):?/i, "").trim();
      if (rest) {
        inProgress.push(cleanItem(rest));
      }
      continue;
    }

    if (/^(pr|prs|pull request|pull requests):?/i.test(line)) {
      currentSection = "prs";
      const rest = line.replace(/^(pr|prs|pull request|pull requests):?/i, "").replace(/^[-:\s]+/, "").trim();
      
      if (/same as (updates|above|completed)/i.test(rest) || /same as/i.test(line)) {
        prSameAsUpdatesDetected = true;
      } else if (rest) {
        prs.push(cleanItem(rest));
      }
      continue;
    }

    if (/^(task update|completed|done|tasks|updates):?/i.test(line)) {
      currentSection = "completed";
      const rest = line.replace(/^(task update|completed|done|tasks|updates):?/i, "").trim();
      if (rest) {
        const item = cleanItem(rest);
        completed.push(item);
        currentBlockCompleted.push(item);
      }
      continue;
    }

    // Check if standalone line says "pr same as updates" or similar
    if (/pr\s+same\s+as\s+(updates|above|completed)/i.test(line) || /^pr\s*-\s*same/i.test(line)) {
      prSameAsUpdatesDetected = true;
      continue;
    }

    // Regular line item
    const cleaned = cleanItem(line);
    if (!cleaned) continue;

    if (currentSection === "completed") {
      completed.push(cleaned);
      currentBlockCompleted.push(cleaned);
    } else if (currentSection === "inProgress") {
      inProgress.push(cleaned);
    } else if (currentSection === "prs") {
      prs.push(cleaned);
    }
  }

  // Handle "PR same as updates"
  if (prSameAsUpdatesDetected) {
    completed.forEach((c) => {
      if (!prs.includes(c)) {
        prs.push(c);
      }
    });
  }

  // Deduplicate
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
          console.log(`[summarize] Successfully summarized using model: ${model}`);
          return result;
        }
      } catch (err: unknown) {
        const error = err as Error & { status?: number };
        const msg = error?.message ?? "";
        console.warn(`[summarize] Model ${model} failed (${error?.status || "error"}): ${msg.substring(0, 100)}`);
        // Continue to next model on 429, 404, quota or network errors
      }
    }
  }

  // Fallback to local rule-based engine if all AI models are rate-limited or API key is unconfigured
  console.log("[summarize] AI models rate-limited or key missing. Using intelligent local parser fallback.");
  return parseLocalFallback(rawText);
}
