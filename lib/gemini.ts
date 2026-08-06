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
   - If a developer header line includes words like "today's task updates", "daily status", "task updates", etc. (e.g., "Jonathan Pereira P today's task updates"), extract ONLY the developer's name ("Jonathan Pereira P") as developerName, and DO NOT treat the header line itself as a task item.
   - If an update block has NO person name provided, treat it as an un-named developer block ("General Update").

2. INDEPENDENT PER-DEVELOPER PROCESSING:
   - Process each developer's update block INDEPENDENTLY.
   - If a developer specifies "PR Changes same as above", "PR as same as updates", or similar:
     -> Copy ONLY that developer's completed tasks into that developer's PRs array.
     -> DO NOT copy any other developer's tasks into their PRs.
     -> STRICT CONSTRAINT: NEVER copy any "inProgress" tasks into "prs"!

3. UNLABELED TASKS DEFAULT TO COMPLETED:
   - If a developer's list has no explicit section header (like "In-progress:" or "PR:"), ALWAYS classify them under "completed".

4. VERBATIM EXTRACTION (NO AUTO-REPHRASING IN INITIAL SUMMARY):
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
Do not include markdown explanations outside the JSON.

7. COMBINED SECTION LABELS (Completed + PR dual placement):
   - If a developer uses a combined label that contains BOTH a status word AND the word "PR" in any order (examples: "PR / Task Update:", "PR / Task Updates:", "PR & Task Update:", "Completed and PR:", "Completed/PR:", "Task Updates and PR:", "Done/PR:", "Updates and PR:", "Completed & PR:"), treat it as a dual-section label.
   - Place ALL tasks listed under that combined label into BOTH the "completed" array AND the "prs" array for that developer (and in the top-level arrays as well).
   - STRICT CONSTRAINT: NEVER apply this rule to "inProgress" tasks — only tasks that would normally go to "completed".`;

const ASSISTANT_SYSTEM_PROMPT = `You are an AI assistant helping a user modify, rephrase, and refine their daily task summary result on demand.

Your job is to READ the CURRENT SUMMARY GENERATED RESULT JSON provided and apply the user's specific instruction to modify it.

CRITICAL INSTRUCTION EXECUTION RULES:
1. READ & MODIFY ACTIVE GENERATED RESULT:
   - You are given the exact current state of the generated summary JSON ("completed", "inProgress", "prs", "developers").
   - You MUST perform the requested modification on THAT exact JSON data and return the updated JSON.

2. SUPPORT ALL MODIFICATION COMMANDS:
   - INDEX-BASED MOVEMENTS: "move 2nd pr to in progress", "move 1st item to in progress", "move task 3 to prs".
   - TEXT-BASED MOVEMENTS / DELETIONS: "move Rating display changes to in progress", "delete KPI bugfixes".
   - EDITING & REPHRASING: "change item 1 to XYZ", "make completed concise", "rephrase professionally".
   - ADDING ITEMS: "add item XYZ to completed", "add PR for auth module".

3. KEEP ALL ARRAYS IN SYNC:
   - Always keep top-level arrays ("completed", "inProgress", "prs") AND per-developer arrays ("developers") updated and in sync!
   - NEVER place inProgress tasks in the "prs" array.

4. OUTPUT FORMAT:
Return ONLY a valid JSON object matching the exact structure:
{
  "completed": [...],
  "inProgress": [...],
  "prs": [...],
  "developers": [...]
}
Do not include any explanation or markdown outside the JSON.`;

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

const DEV_HEADER_SUFFIX_REGEX =
  /^(.*?)\s*(?:[-:|(\[\s]*\b(?:today'?s?\s*(?:task\s*)?updates?|daily\s*(?:task\s*)?updates?|task\s*updates?|status\s*updates?|updates?|tasks?)\b[ -:|)\]]*)$/i;

function extractDeveloperNameHeader(line: string): string | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  if (/^[\d+.\-•*]/.test(trimmed)) return null;

  if (
    /^(task update|completed|today's update|done|tasks|updates|in progress|in-progress|ongoing|pending|pr|prs|pull request|pull requests):?/i.test(
      trimmed
    )
  ) {
    return null;
  }

  if (/pr\s+(as\s+)?(same|changes)/i.test(trimmed)) return null;

  const taskKeywords = [
    "worked", "updated", "integrated", "fixed", "implemented", "added", "testing",
    "created", "mapping", "alignment", "changes", "flow", "bug", "fixes", "workflow",
    "excel", "api", "apis", "ui", "kpi", "form", "dropdown", "modal", "appraisal",
    "recommendation", "details", "page", "button", "service", "table", "grid", "issue"
  ];

  let candidate = trimmed;
  const suffixMatch = trimmed.match(DEV_HEADER_SUFFIX_REGEX);
  if (suffixMatch && suffixMatch[1]) {
    candidate = suffixMatch[1].trim();
  }

  if (!candidate) return null;
  const lowerCand = candidate.toLowerCase();
  if (taskKeywords.some((kw) => lowerCand.includes(kw))) return null;

  const words = candidate.split(/\s+/);
  if (words.length >= 2 && words.length <= 5) {
    const looksLikeName = words.every((w) => /^[A-Z][a-zA-Z'.-]*$/.test(w));
    if (looksLikeName) return candidate;
  }

  return null;
}

function isPersonNameLine(line: string): boolean {
  return extractDeveloperNameHeader(line) !== null;
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
      Array.isArray(list) ? list.map(cleanItem).filter(Boolean) : [];

    const developers: DeveloperSummary[] | undefined = Array.isArray(parsed.developers)
      ? parsed.developers.map((dev: any) => ({
          developerName: typeof dev.developerName === "string" ? dev.developerName : "Developer",
          completed: filterItems(dev.completed),
          inProgress: filterItems(dev.inProgress),
          prs: filterItems(dev.prs),
        }))
      : undefined;

    return {
      completed: filterItems(parsed.completed),
      inProgress: filterItems(parsed.inProgress),
      prs: filterItems(parsed.prs),
      developers: developers && developers.length > 0 ? developers : undefined,
    };
  } catch {
    return null;
  }
}

const COMBINED_COMPLETED_PR_REGEX =
  /^(?:(?:completed|task\s*updates?|done|updates?)\s*(?:and|[\/&+])\s*pr|pr\s*(?:and|[\/&+])\s*(?:task\s*updates?|completed|done|updates?|tasks?)):?/i;

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

  let currentSection: "completed" | "inProgress" | "prs" | "completedAndPr" = "completed";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) {
      let nextLine = "";
      for (let j = i + 1; j < lines.length; j++) {
        if (lines[j].trim()) {
          nextLine = lines[j].trim();
          break;
        }
      }
      if (nextLine && !/^[\d+.\-•*]/.test(nextLine)) {
        if (currentSection === "prs" || currentSection === "completedAndPr") {
          currentSection = "completed";
        }
      }
      continue;
    }

    const devName = extractDeveloperNameHeader(line);
    if (devName) {
      if (
        currentBlock.completed.length > 0 ||
        currentBlock.inProgress.length > 0 ||
        currentBlock.prs.length > 0
      ) {
        devBlocks.push(currentBlock);
      }
      currentBlock = {
        developerName: devName,
        completed: [],
        inProgress: [],
        prs: [],
        prSameAsUpdatesDetected: false,
      };
      currentSection = "completed";
      continue;
    }

    if (COMBINED_COMPLETED_PR_REGEX.test(line)) {
      currentSection = "completedAndPr";
      const rest = line.replace(COMBINED_COMPLETED_PR_REGEX, "").trim();
      if (rest) {
        const cleaned = cleanItem(rest);
        if (cleaned && !isPersonNameLine(cleaned)) {
          if (!currentBlock.completed.includes(cleaned)) currentBlock.completed.push(cleaned);
          if (!currentBlock.prs.includes(cleaned)) currentBlock.prs.push(cleaned);
        }
      }
      continue;
    }

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

    if (/pr\s+.*same\s+as/i.test(line) || /^pr\s*-\s*same/i.test(line)) {
      currentBlock.prSameAsUpdatesDetected = true;
      continue;
    }

    const cleaned = cleanItem(line);
    if (!cleaned || isPersonNameLine(cleaned)) continue;

    if (currentSection === "completed") {
      currentBlock.completed.push(cleaned);
    } else if (currentSection === "inProgress") {
      currentBlock.inProgress.push(cleaned);
    } else if (currentSection === "prs") {
      currentBlock.prs.push(cleaned);
    } else if (currentSection === "completedAndPr") {
      if (!currentBlock.completed.includes(cleaned)) currentBlock.completed.push(cleaned);
      if (!currentBlock.prs.includes(cleaned)) currentBlock.prs.push(cleaned);
    }
  }

  if (
    currentBlock.completed.length > 0 ||
    currentBlock.inProgress.length > 0 ||
    currentBlock.prs.length > 0
  ) {
    devBlocks.push(currentBlock);
  }

  const mergedMap = new Map<string, DevBlock>();
  for (const block of devBlocks) {
    const key = block.developerName.trim().toLowerCase();
    if (!mergedMap.has(key)) {
      mergedMap.set(key, {
        developerName: block.developerName,
        completed: [...block.completed],
        inProgress: [...block.inProgress],
        prs: [...block.prs],
        prSameAsUpdatesDetected: block.prSameAsUpdatesDetected,
      });
    } else {
      const existing = mergedMap.get(key)!;
      existing.completed.push(...block.completed);
      existing.inProgress.push(...block.inProgress);
      existing.prs.push(...block.prs);
      if (block.prSameAsUpdatesDetected) existing.prSameAsUpdatesDetected = true;
    }
  }

  const mergedDevBlocks = Array.from(mergedMap.values());

  const allCompleted: string[] = [];
  const allInProgress: string[] = [];
  const allPrs: string[] = [];

  const developerSummaries: DeveloperSummary[] = mergedDevBlocks.map((block, idx) => {
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
        : mergedDevBlocks.length > 1
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

CURRENT SUMMARY GENERATED RESULT JSON TO MODIFY:
${JSON.stringify(currentSummary, null, 2)}

${rawInputText ? `ORIGINAL RAW DEVELOPER INPUT CONTEXT:\n${rawInputText}\n` : ""}
USER INSTRUCTION FOR AI ASSISTANT:
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

  // Fallback local modification for simple instructions if offline/no key/rate-limited
  return applyLocalAssistantInstruction(currentSummary, instruction);
}

function parseOrdinalOrNumber(str: string): number | null {
  const match = str.match(/(\d+)(?:st|nd|rd|th)?/i);
  if (match) {
    return parseInt(match[1], 10);
  }
  const wordMap: Record<string, number> = {
    first: 1, "1st": 1,
    second: 2, "2nd": 2,
    third: 3, "3rd": 3,
    fourth: 4, "4th": 4,
    fifth: 5, "5th": 5,
  };
  const lower = str.toLowerCase();
  for (const [key, val] of Object.entries(wordMap)) {
    if (lower.includes(key)) return val;
  }
  return null;
}

function applyLocalAssistantInstruction(
  current: SummaryResult,
  instruction: string
): SummaryResult {
  const lower = instruction.toLowerCase().trim();
  const updatedCompleted = [...current.completed];
  const updatedInProgress = [...current.inProgress];
  const updatedPrs = [...current.prs];

  // 1. Movement commands: e.g. "move 2nd pr to in progress", "move item 1 to in-progress"
  if (lower.includes("move")) {
    const targetIsInProgress = lower.includes("in progress") || lower.includes("in-progress");
    const targetIsPr = lower.includes("to pr") || lower.includes("to prs");
    const targetIsCompleted = lower.includes("to completed");

    const targetSection = targetIsInProgress ? "inProgress" : targetIsPr ? "prs" : "completed";

    const isSourcePr = lower.includes("pr");
    const isSourceInProgress = lower.includes("in progress") || lower.includes("in-progress");

    let sourceArray = isSourcePr ? updatedPrs : isSourceInProgress ? updatedInProgress : updatedCompleted;
    if (sourceArray.length === 0) sourceArray = updatedCompleted;

    let movedItem = "";
    const num = parseOrdinalOrNumber(lower);

    if (num && num >= 1 && num <= sourceArray.length) {
      movedItem = sourceArray.splice(num - 1, 1)[0];
    } else {
      // Try text matching if no index number specified
      const matchIdx = sourceArray.findIndex(item => lower.includes(item.toLowerCase().slice(0, 15)));
      if (matchIdx !== -1) {
        movedItem = sourceArray.splice(matchIdx, 1)[0];
      }
    }

    if (movedItem) {
      if (targetSection === "inProgress") updatedInProgress.push(movedItem);
      else if (targetSection === "prs") updatedPrs.push(movedItem);
      else updatedCompleted.push(movedItem);
    }

    const devs = current.developers?.map((d) => ({
      ...d,
      completed: [...d.completed],
      inProgress: [...d.inProgress],
      prs: [...d.prs],
    }));

    return { completed: updatedCompleted, inProgress: updatedInProgress, prs: updatedPrs, developers: devs };
  }

  // 2. Delete / Remove commands: e.g. "delete 2nd pr", "remove item 1"
  if (lower.includes("delete") || lower.includes("remove")) {
    const isSourcePr = lower.includes("pr");
    const isSourceInProgress = lower.includes("in progress") || lower.includes("in-progress");

    let sourceArray = isSourcePr ? updatedPrs : isSourceInProgress ? updatedInProgress : updatedCompleted;
    const num = parseOrdinalOrNumber(lower);
    if (num && num >= 1 && num <= sourceArray.length) {
      sourceArray.splice(num - 1, 1);
    } else {
      const matchIdx = sourceArray.findIndex(item => lower.includes(item.toLowerCase().slice(0, 15)));
      if (matchIdx !== -1) sourceArray.splice(matchIdx, 1);
    }
    return { completed: updatedCompleted, inProgress: updatedInProgress, prs: updatedPrs };
  }

  // 3. Edit / Rephrase specific item: e.g. "change 2nd pr to XYZ"
  if (lower.includes("rephrase") || lower.includes("change") || lower.includes("edit") || lower.includes("update")) {
    const editMatch = lower.match(/(?:rephrase|change|edit|update)\s+(?:item|task|pr)?\s*(\d+(?:st|nd|rd|th)?)\s+(?:to|as)\s+(.+)/i);
    if (editMatch) {
      const num = parseOrdinalOrNumber(editMatch[1]);
      const newText = editMatch[2].trim();
      const isSourcePr = lower.includes("pr");
      let sourceArray = isSourcePr ? updatedPrs : updatedCompleted;
      if (num && num >= 1 && num <= sourceArray.length) {
        sourceArray[num - 1] = newText.charAt(0).toUpperCase() + newText.slice(1);
      }
    }
    return { completed: updatedCompleted, inProgress: updatedInProgress, prs: updatedPrs };
  }

  // 4. Concise / Short
  if (lower.includes("concise") || lower.includes("short")) {
    const shorten = (s: string) => (s.length > 55 ? s.slice(0, 52) + "..." : s);
    const c = updatedCompleted.map(shorten);
    const p = updatedInProgress.map(shorten);
    const pr = updatedPrs.map(shorten);

    const devs = current.developers?.map((d) => ({
      ...d,
      completed: d.completed.map(shorten),
      inProgress: d.inProgress.map(shorten),
      prs: d.prs.map(shorten),
    }));

    return { completed: c, inProgress: p, prs: pr, developers: devs };
  }

  // 5. Professional / Formal
  if (lower.includes("professional") || lower.includes("formal") || lower.includes("rephrase")) {
    const formalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
    const c = updatedCompleted.map(formalize);
    const p = updatedInProgress.map(formalize);
    const pr = updatedPrs.map(formalize);

    const devs = current.developers?.map((d) => ({
      ...d,
      completed: d.completed.map(formalize),
      inProgress: d.inProgress.map(formalize),
      prs: d.prs.map(formalize),
    }));

    return { completed: c, inProgress: p, prs: pr, developers: devs };
  }

  // 6. Copy completed to PRs
  if (
    lower.includes("sync pr") ||
    lower.includes("pr same as completed") ||
    /copy.*completed.*pr/i.test(lower) ||
    /add.*completed.*pr/i.test(lower)
  ) {
    const pr = Array.from(new Set([...updatedPrs, ...updatedCompleted]));
    const devs = current.developers?.map((d) => ({
      ...d,
      prs: Array.from(new Set([...d.prs, ...d.completed])),
    }));

    return { completed: updatedCompleted, inProgress: updatedInProgress, prs: pr, developers: devs };
  }

  return {
    completed: updatedCompleted,
    inProgress: updatedInProgress,
    prs: updatedPrs,
    developers: current.developers ? [...current.developers] : undefined,
  };
}
