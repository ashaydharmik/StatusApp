import { GoogleGenAI } from "@google/genai";

export interface SummaryResult {
  completed: string[];
  inProgress: string[];
  prs: string[];
}

const SYSTEM_PROMPT = `You are a strict task update extractor and summarizer. Your job is to parse raw daily task updates from developer input and extract tasks into structured JSON.

CRITICAL EXTRACTION RULES:
1. REMOVE PERSON/DEVELOPER NAMES:
   - Developers often paste updates with their full name at the top of each block (e.g., "Sravan Kumar Reddy Kummita", "John Doe", "@Ashay").
   - You MUST IGNORE AND REMOVE all developer/person names. NEVER include a person's name as a task description in the output JSON.

2. UNLABELED TASKS DEFAULT TO COMPLETED:
   - If a list of tasks has no explicit section header (like "In-progress:" or "PR:"), ALWAYS classify them under "completed".
   - In-progress tasks and PRs will always have explicit section labels.

3. SPECIAL "PR SAME AS UPDATES / ABOVE" RULE:
   - If a line says "PR Changes same as above", "PR as same as updates", "PR same as completed", "PR - same as updates", or similar:
     -> Copy ALL completed tasks into the "prs" array.
     -> STRICT CONSTRAINT: NEVER copy any "inProgress" tasks into the "prs" array!

4. VERBATIM EXTRACTION (NO AUTO-REPHRASING):
   - Extract the EXACT task descriptions and sentences as pasted by the user.
   - Do NOT rewrite, rephrase, summarize away, fix grammar, or change words during initial extraction.
   - Strip leading numbers (e.g., "1. ", "2. "), bullet symbols ("• ", "- "), or section headers ("Task update:"), but PRESERVE the exact sentence text verbatim.

5. ABSOLUTE ZERO HALLUCINATION:
   - Do NOT invent, assume, or add any task, detail, or PR that is not explicitly present in the input text.

6. OUTPUT STRUCTURE:
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
3. Never include developer/person names in summary outputs.
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

function isPersonNameLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;

  // Not a name if it starts with numbers or bullet points
  if (/^[\d+.\-•*]/.test(trimmed)) return false;

  // Not a name if it matches known section headers
  if (/^(task update|completed|today's update|done|tasks|updates|in progress|in-progress|ongoing|pending|pr|prs|pull request|pull requests):?/i.test(trimmed)) {
    return false;
  }

  // Not a name if it matches PR same as updates phrases
  if (/pr\s+(as\s+)?(same|changes)/i.test(trimmed)) return false;

  // Common technical / task verbs and keywords indicating task description
  const taskKeywords = [
    "worked", "updated", "integrated", "fixed", "implemented", "added", "testing",
    "created", "mapping", "alignment", "changes", "flow", "bug", "fixes", "workflow",
    "excel", "api", "apis", "ui", "kpi", "form", "dropdown", "modal", "appraisal",
    "recommendation", "details", "page", "button", "service", "table", "grid", "issue"
  ];
  const lower = trimmed.toLowerCase();
  if (taskKeywords.some((kw) => lower.includes(kw))) return false;

  // Name pattern: 1 to 5 words starting with capital letters (e.g., Sravan Kumar Reddy Kummita)
  const words = trimmed.split(/\s+/);
  if (words.length >= 1 && words.length <= 5) {
    const looksLikeName = words.every((w) => /^[A-Z][a-zA-Z'.-]*$/.test(w));
    if (looksLikeName) return true;
  }

  return false;
}

function parseJsonSafely(text: string): SummaryResult | null {
  try {
    const cleaned = text
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();
    const parsed = JSON.parse(cleaned);

    const filterNames = (list: any[]) =>
      Array.isArray(list)
        ? list
            .map(cleanItem)
            .filter(Boolean)
            .filter((item) => !isPersonNameLine(item))
        : [];

    return {
      completed: filterNames(parsed.completed),
      inProgress: filterNames(parsed.inProgress),
      prs: filterNames(parsed.prs),
    };
  } catch {
    return null;
  }
}

/**
 * Intelligent Local Rule-Based Fallback Parser
 * Used when API keys are unconfigured, rate-limited, or AI models are unavailable.
 * Removes developer names, defaults unlabeled blocks to Completed, and excludes in-progress from PRs.
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

    // Check for developer/person name line -> skip and reset section to completed
    if (isPersonNameLine(line)) {
      currentSection = "completed";
      continue;
    }

    // Check for section headers
    if (/^(in progress|in-progress|ongoing|pending):?/i.test(line)) {
      currentSection = "inProgress";
      const rest = line.replace(/^(in progress|in-progress|ongoing|pending):?/i, "").trim();
      if (rest) {
        const cleaned = cleanItem(rest);
        if (cleaned && !isPersonNameLine(cleaned)) inProgress.push(cleaned);
      }
      continue;
    }

    if (/^(pr|prs|pull request|pull requests):?/i.test(line)) {
      currentSection = "prs";
      const rest = line.replace(/^(pr|prs|pull request|pull requests):?/i, "").replace(/^[-:\s]+/, "").trim();

      if (/same as (updates|above|completed)/i.test(rest) || /same as/i.test(rest) || /as same as/i.test(rest)) {
        prSameAsUpdatesDetected = true;
      } else if (rest) {
        const cleaned = cleanItem(rest);
        if (cleaned && !isPersonNameLine(cleaned)) prs.push(cleaned);
      }
      continue;
    }

    if (/^(task update|completed|today's update|done|tasks|updates):?/i.test(line)) {
      currentSection = "completed";
      const rest = line.replace(/^(task update|completed|today's update|done|tasks|updates):?/i, "").trim();
      if (rest) {
        const cleaned = cleanItem(rest);
        if (cleaned && !isPersonNameLine(cleaned)) completed.push(cleaned);
      }
      continue;
    }

    // Check standalone line "pr same as updates" or "pr changes same as above" or similar
    if (/pr\s+.*same\s+as/i.test(line) || /^pr\s*-\s*same/i.test(line)) {
      prSameAsUpdatesDetected = true;
      continue;
    }

    // Regular line item - preserve exact text minus leading bullet/numbering
    const cleaned = cleanItem(line);
    if (!cleaned || isPersonNameLine(cleaned)) continue;

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
