import { GoogleGenAI } from "@google/genai";

export interface DeveloperSummary {
  developerName: string;
  completed: string[];
  inProgress: string[];
  prs: string[];
}

export interface SummaryResult {
  completed: string[];
  inProgress: string[];
  prs: string[];
  developers?: DeveloperSummary[];
}

const SYSTEM_PROMPT = `You are a strict task update extractor and summarizer. Your job is to parse raw daily task updates from developer input, smartly segregate updates per developer (if multiple exist), and extract tasks into structured JSON.

CRITICAL MULTI-DEVELOPER EXTRACTION RULES:
1. DETECT MULTIPLE DEVELOPERS SMARTLY:
   - Input may contain task updates from multiple developers.
   - If a developer states their name at the top of an update block (e.g., "Sravan Kumar", "Ashay Dharmik"), capture that developer's name for their section.
   - If an update block has NO person name provided, treat it as an un-named developer block ("General Update").

2. INDEPENDENT PER-DEVELOPER PROCESSING:
   - Process each developer's update block INDEPENDENTLY.
   - If a developer specifies "PR Changes same as above", "PR as same as updates", or similar:
     -> Copy ONLY that developer's completed tasks into that developer's PRs array.
     -> DO NOT copy any other developer's tasks into their PRs.
     -> STRICT CONSTRAINT: NEVER copy any "inProgress" tasks into "prs"!

3. UNLABELED TASKS DEFAULT TO COMPLETED:
   - If a developer's list has no explicit section header (like "In-progress:" or "PR:"), ALWAYS classify them under "completed".

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
  "prs": ["exact sentence 1"],
  "developers": [
    {
      "developerName": "Sravan Kumar",
      "completed": ["exact sentence 1"],
      "inProgress": ["exact sentence 1"],
      "prs": ["exact sentence 1"]
    }
  ]
}
Do not include markdown explanations outside the JSON.`;

const ASSISTANT_SYSTEM_PROMPT = `You are an AI assistant helping a user modify, rephrase, and refine their daily task summary result on demand.

Your job is to apply the user's specific instruction to the existing summary JSON.

RULES:
1. Modify ONLY what the user asks for in their instruction (e.g. rephrasing tasks, making them concise, converting to formal tone, moving items between sections, adding a new item, deleting an item, or fixing grammar/typos).
2. If the user asks to rephrase or rewrite, apply high quality developer tone adjustments while preserving the core technical details.
3. Maintain logical categories:
   - "completed": finished tasks
   - "inProgress": ongoing tasks
   - "prs": pull requests
4. NEVER place inProgress tasks in the "prs" array.
5. Return ONLY a valid JSON object with the updated structure:
{
  "completed": [...],
  "inProgress": [...],
  "prs": [...],
  "developers": [...]
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
  if (
    /^(task update|completed|today's update|done|tasks|updates|in progress|in-progress|ongoing|pending|pr|prs|pull request|pull requests):?/i.test(
      trimmed
    )
  ) {
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

    const filterItems = (list: any[]) =>
      Array.isArray(list)
        ? list
            .map(cleanItem)
            .filter(Boolean)
            .filter((item) => !isPersonNameLine(item))
        : [];

    const developers: DeveloperSummary[] = Array.isArray(parsed.developers)
      ? parsed.developers.map((dev: any) => ({
          developerName: typeof dev.developerName === "string" ? dev.developerName : "Developer",
          completed: filterItems(dev.completed),
          inProgress: filterItems(dev.inProgress),
          prs: filterItems(dev.prs),
        }))
      : [];

    return {
      completed: filterItems(parsed.completed),
      inProgress: filterItems(parsed.inProgress),
      prs: filterItems(parsed.prs),
      developers: developers.length > 0 ? developers : undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Intelligent Local Rule-Based Fallback Parser
 * Smartly segregates tasks by developer when names are provided or unlabeled blocks appear.
 * Preserves EXACT sentences and strictly enforces independent PR rules per developer.
 */
export function parseLocalFallback(rawText: string): SummaryResult {
  const lines = rawText.split(/\r?\n/);

  interface DevBlock {
    developerName: string;
    completed: string[];
    inProgress: string[];
    prs: string[];
    prSameAsUpdatesDetected: boolean;
  }

  const devBlocks: DevBlock[] = [];
  let currentBlock: DevBlock = {
    developerName: "General Update",
    completed: [],
    inProgress: [],
    prs: [],
    prSameAsUpdatesDetected: false,
  };

  let currentSection: "completed" | "inProgress" | "prs" = "completed";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Check for developer/person name line -> start a new developer block
    if (isPersonNameLine(line)) {
      if (
        currentBlock.completed.length > 0 ||
        currentBlock.inProgress.length > 0 ||
        currentBlock.prs.length > 0
      ) {
        devBlocks.push(currentBlock);
      }
      currentBlock = {
        developerName: cleanItem(line),
        completed: [],
        inProgress: [],
        prs: [],
        prSameAsUpdatesDetected: false,
      };
      currentSection = "completed";
      continue;
    }

    // Check for section headers
    if (/^(in progress|in-progress|ongoing|pending):?/i.test(line)) {
      currentSection = "inProgress";
      const rest = line.replace(/^(in progress|in-progress|ongoing|pending):?/i, "").trim();
      if (rest) {
        const cleaned = cleanItem(rest);
        if (cleaned && !isPersonNameLine(cleaned)) currentBlock.inProgress.push(cleaned);
      }
      continue;
    }

    if (/^(pr|prs|pull request|pull requests):?/i.test(line)) {
      currentSection = "prs";
      const rest = line.replace(/^(pr|prs|pull request|pull requests):?/i, "").replace(/^[-:\s]+/, "").trim();

      if (/same as (updates|above|completed)/i.test(rest) || /same as/i.test(rest) || /as same as/i.test(rest)) {
        currentBlock.prSameAsUpdatesDetected = true;
      } else if (rest) {
        const cleaned = cleanItem(rest);
        if (cleaned && !isPersonNameLine(cleaned)) currentBlock.prs.push(cleaned);
      }
      continue;
    }

    if (/^(task update|completed|today's update|done|tasks|updates):?/i.test(line)) {
      currentSection = "completed";
      const rest = line.replace(/^(task update|completed|today's update|done|tasks|updates):?/i, "").trim();
      if (rest) {
        const cleaned = cleanItem(rest);
        if (cleaned && !isPersonNameLine(cleaned)) currentBlock.completed.push(cleaned);
      }
      continue;
    }

    // Check standalone line "pr same as updates" or "pr changes same as above" or similar
    if (/pr\s+.*same\s+as/i.test(line) || /^pr\s*-\s*same/i.test(line)) {
      currentBlock.prSameAsUpdatesDetected = true;
      continue;
    }

    // Regular line item - preserve exact text minus leading bullet/numbering
    const cleaned = cleanItem(line);
    if (!cleaned || isPersonNameLine(cleaned)) continue;

    if (currentSection === "completed") {
      currentBlock.completed.push(cleaned);
    } else if (currentSection === "inProgress") {
      currentBlock.inProgress.push(cleaned);
    } else if (currentSection === "prs") {
      currentBlock.prs.push(cleaned);
    }
  }

  // Push final block
  if (
    currentBlock.completed.length > 0 ||
    currentBlock.inProgress.length > 0 ||
    currentBlock.prs.length > 0
  ) {
    devBlocks.push(currentBlock);
  }

  // Process per-developer PR rules & aggregate
  const allCompleted: string[] = [];
  const allInProgress: string[] = [];
  const allPrs: string[] = [];

  const developerSummaries: DeveloperSummary[] = devBlocks.map((block, idx) => {
    const devCompleted = Array.from(new Set(block.completed));
    const devInProgress = Array.from(new Set(block.inProgress));
    const devPrs = Array.from(new Set(block.prs));

    if (block.prSameAsUpdatesDetected) {
      devCompleted.forEach((c) => {
        if (!devPrs.includes(c)) devPrs.push(c);
      });
    }

    allCompleted.push(...devCompleted);
    allInProgress.push(...devInProgress);
    allPrs.push(...devPrs);

    const displayName =
      block.developerName !== "General Update"
        ? block.developerName
        : devBlocks.length > 1
        ? `Developer ${idx + 1}`
        : "General Update";

    return {
      developerName: displayName,
      completed: devCompleted,
      inProgress: devInProgress,
      prs: devPrs,
    };
  });

  return {
    completed: Array.from(new Set(allCompleted)),
    inProgress: Array.from(new Set(allInProgress)),
    prs: Array.from(new Set(allPrs)),
    developers: developerSummaries.length > 0 ? developerSummaries : undefined,
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
    developers: current.developers ? [...current.developers] : undefined,
  };

  if (lower.includes("concise") || lower.includes("short")) {
    updated.completed = updated.completed.map((s) => (s.length > 60 ? s.slice(0, 57) + "..." : s));
    updated.inProgress = updated.inProgress.map((s) => (s.length > 60 ? s.slice(0, 57) + "..." : s));
    updated.prs = updated.prs.map((s) => (s.length > 60 ? s.slice(0, 57) + "..." : s));
  } else if (lower.includes("professional") || lower.includes("formal")) {
    updated.completed = updated.completed.map((s) => s.charAt(0).toUpperCase() + s.slice(1));
    updated.inProgress = updated.inProgress.map((s) => s.charAt(0).toUpperCase() + s.slice(1));
    updated.prs = updated.prs.map((s) => s.charAt(0).toUpperCase() + s.slice(1));
  } else if (lower.includes("sync pr") || lower.includes("pr same as completed")) {
    updated.prs = Array.from(new Set([...updated.prs, ...updated.completed]));
  }

  return updated;
}
