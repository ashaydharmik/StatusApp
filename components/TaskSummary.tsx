"use client";

import { useState, useEffect, useRef } from "react";
import {
  FileText,
  Copy,
  Check,
  RefreshCw,
  CheckCircle2,
  Clock,
  GitPullRequest,
  AlertCircle,
  Sparkles,
  Trash2,
  Edit3,
  Plus,
  RotateCcw,
  RotateCw,
  Send,
  Wand2,
  X,
  Bot,
  Users,
  Layers,
  User,
} from "lucide-react";
import { SummaryResult, DeveloperSummary } from "@/lib/gemini";

interface TaskSummaryProps {
  recipientName: string;
  summary: SummaryResult | null;
  isLoading: boolean;
  error: string | null;
  onRegenerate: () => void;
  rawInputText?: string;
  onUpdateSummary?: (newSummary: SummaryResult) => void;
}

function formatDate(date: Date): string {
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function SkeletonLine({ width = "w-full" }: { width?: string }) {
  return <div className={`h-3.5 ${width} rounded-full shimmer`} />;
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="space-y-2">
        <SkeletonLine width="w-3/4" />
        <SkeletonLine width="w-1/2" />
      </div>
      <div className="space-y-3">
        <SkeletonLine width="w-1/3" />
        <div className="space-y-2 pl-3">
          <SkeletonLine />
          <SkeletonLine width="w-11/12" />
          <SkeletonLine width="w-10/12" />
        </div>
      </div>
      <p className="text-xs text-slate-500 text-center pt-2 animate-pulse">
        🤖 AI is segregating multi-developer updates...
      </p>
    </div>
  );
}

interface EditableSectionProps {
  sectionKey: "completed" | "inProgress" | "prs";
  icon: React.ReactNode;
  title: string;
  items: string[];
  badgeClass: string;
  iconBg: string;
  numberClass: string;
  onDeleteItem: (section: "completed" | "inProgress" | "prs", index: number) => void;
  onEditItem: (section: "completed" | "inProgress" | "prs", index: number, newText: string) => void;
  onAddItem: (section: "completed" | "inProgress" | "prs", text: string) => void;
}

function EditableSection({
  sectionKey,
  icon,
  title,
  items,
  badgeClass,
  iconBg,
  numberClass,
  onDeleteItem,
  onEditItem,
  onAddItem,
}: EditableSectionProps) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [newItemText, setNewItemText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingIndex !== null) {
      inputRef.current?.focus();
    }
  }, [editingIndex]);

  const handleStartEdit = (index: number, currentText: string) => {
    setEditingIndex(index);
    setEditText(currentText);
  };

  const handleSaveEdit = (index: number) => {
    if (editText.trim()) {
      onEditItem(sectionKey, index, editText.trim());
    }
    setEditingIndex(null);
  };

  const handleSaveNew = () => {
    if (newItemText.trim()) {
      onAddItem(sectionKey, newItemText.trim());
      setNewItemText("");
      setIsAdding(false);
    }
  };

  return (
    <div className="animate-fade-in space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${iconBg}`}>
            {icon}
          </div>
          <span className={`section-badge ${badgeClass}`}>{title}</span>
          <span className="text-xs text-slate-500 font-medium ml-1">
            {items.length} {items.length === 1 ? "item" : "items"}
          </span>
        </div>

        <button
          onClick={() => setIsAdding(true)}
          className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 transition-colors px-2 py-1 rounded-lg hover:bg-white/5 font-medium"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Item
        </button>
      </div>

      <ol className="space-y-2 pl-1">
        {items.map((item, i) => (
          <li
            key={i}
            className="group relative flex items-start gap-2.5 p-2 rounded-xl hover:bg-white/[0.04] transition-all border border-transparent hover:border-white/10"
          >
            {/* Automatic Serial Index Badge */}
            <span
              className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold mt-0.5 ${numberClass}`}
            >
              {i + 1}
            </span>

            {editingIndex === i ? (
              <div className="flex-1 flex items-center gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveEdit(i);
                    if (e.key === "Escape") setEditingIndex(null);
                  }}
                  className="flex-1 bg-black/40 border border-indigo-500/50 rounded-lg px-2.5 py-1 text-xs text-slate-100 outline-none"
                />
                <button
                  onClick={() => handleSaveEdit(i)}
                  className="p-1 rounded bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30"
                  title="Save"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setEditingIndex(null)}
                  className="p-1 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30"
                  title="Cancel"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="flex-1 flex items-start justify-between gap-2">
                <span
                  onClick={() => handleStartEdit(i, item)}
                  className="text-sm text-slate-300 leading-relaxed cursor-pointer hover:text-slate-100 transition-colors"
                  title="Click to edit item"
                >
                  {item}
                </span>

                {/* Inline item action controls */}
                <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                  <button
                    onClick={() => handleStartEdit(i, item)}
                    className="p-1 rounded text-slate-400 hover:text-indigo-300 hover:bg-white/10"
                    title="Edit item"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => onDeleteItem(sectionKey, i)}
                    className="p-1 rounded text-slate-400 hover:text-red-400 hover:bg-red-500/10"
                    title="Delete item (auto serial re-numbers list)"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ol>

      {/* Add new item input */}
      {isAdding && (
        <div className="flex items-center gap-2 pt-1 pl-7 animate-fade-in">
          <input
            type="text"
            value={newItemText}
            onChange={(e) => setNewItemText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSaveNew();
              if (e.key === "Escape") setIsAdding(false);
            }}
            placeholder={`Enter new ${title.toLowerCase()} item...`}
            autoFocus
            className="flex-1 bg-black/40 border border-indigo-500/50 rounded-lg px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 outline-none"
          />
          <button onClick={handleSaveNew} className="btn btn-primary rounded-lg text-xs px-3 py-1.5">
            Add
          </button>
          <button onClick={() => setIsAdding(false)} className="p-1.5 rounded text-slate-400 hover:text-slate-200">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}

export default function TaskSummary({
  recipientName,
  summary: externalSummary,
  isLoading,
  error,
  onRegenerate,
  rawInputText = "",
  onUpdateSummary,
}: TaskSummaryProps) {
  const [currentSummary, setCurrentSummary] = useState<SummaryResult | null>(externalSummary);
  const [history, setHistory] = useState<SummaryResult[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [viewMode, setViewMode] = useState<"combined" | "byDeveloper">("combined");

  // AI Assistant state
  const [assistantPrompt, setAssistantPrompt] = useState("");
  const [isAssistantWorking, setIsAssistantWorking] = useState(false);
  const [assistantMsg, setAssistantMsg] = useState<string | null>(null);

  const [copied, setCopied] = useState(false);
  const isInternalUpdate = useRef(false);

  useEffect(() => {
    if (isInternalUpdate.current) {
      isInternalUpdate.current = false;
      return;
    }
    if (externalSummary) {
      setCurrentSummary(externalSummary);
      setHistory([externalSummary]);
      setHistoryIndex(0);
    } else {
      setCurrentSummary(null);
      setHistory([]);
      setHistoryIndex(-1);
    }
  }, [externalSummary]);

  const updateSummaryState = (newSummary: SummaryResult) => {
    isInternalUpdate.current = true;
    setCurrentSummary(newSummary);

    setHistory((prevHistory) => {
      const nextHistory = prevHistory.slice(0, historyIndex + 1);
      nextHistory.push(newSummary);
      setHistoryIndex(nextHistory.length - 1);
      return nextHistory;
    });

    if (onUpdateSummary) onUpdateSummary(newSummary);
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      isInternalUpdate.current = true;
      const prevIndex = historyIndex - 1;
      const prev = history[prevIndex];
      setHistoryIndex(prevIndex);
      setCurrentSummary(prev);
      if (onUpdateSummary) onUpdateSummary(prev);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      isInternalUpdate.current = true;
      const nextIndex = historyIndex + 1;
      const next = history[nextIndex];
      setHistoryIndex(nextIndex);
      setCurrentSummary(next);
      if (onUpdateSummary) onUpdateSummary(next);
    }
  };

  // Delete item with automatic serial re-numbering
  const handleDeleteItem = (section: "completed" | "inProgress" | "prs", index: number) => {
    if (!currentSummary) return;
    const newSummary: SummaryResult = {
      ...currentSummary,
      completed: [...currentSummary.completed],
      inProgress: [...currentSummary.inProgress],
      prs: [...currentSummary.prs],
    };
    newSummary[section].splice(index, 1);
    updateSummaryState(newSummary);
  };

  const handleEditItem = (section: "completed" | "inProgress" | "prs", index: number, newText: string) => {
    if (!currentSummary) return;
    const newSummary: SummaryResult = {
      ...currentSummary,
      completed: [...currentSummary.completed],
      inProgress: [...currentSummary.inProgress],
      prs: [...currentSummary.prs],
    };
    newSummary[section][index] = newText;
    updateSummaryState(newSummary);
  };

  const handleAddItem = (section: "completed" | "inProgress" | "prs", text: string) => {
    if (!currentSummary) return;
    const newSummary: SummaryResult = {
      ...currentSummary,
      completed: [...currentSummary.completed],
      inProgress: [...currentSummary.inProgress],
      prs: [...currentSummary.prs],
    };
    newSummary[section].push(text);
    updateSummaryState(newSummary);
  };

  const handleRunAssistant = async (instructionText?: string) => {
    const textToRun = instructionText || assistantPrompt;
    if (!textToRun.trim() || !currentSummary || isAssistantWorking) return;

    setIsAssistantWorking(true);
    setAssistantMsg(null);

    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentSummary,
          instruction: textToRun,
          rawText: rawInputText,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to apply AI assistant instruction.");
      }

      updateSummaryState(data.data);
      setAssistantPrompt("");
      setAssistantMsg(`✨ Applied: "${textToRun}"`);
      setTimeout(() => setAssistantMsg(null), 4000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error contacting AI assistant.";
      setAssistantMsg(`⚠️ ${msg}`);
    } finally {
      setIsAssistantWorking(false);
    }
  };

  const today = formatDate(new Date());

  const getPlainText = (): string => {
    if (!currentSummary) return "";

    const lines: string[] = [
      `Hi ${recipientName},`,
      ``,
      `Kindly find the task updates and PR's for **${today}**`,
    ];

    if (viewMode === "byDeveloper" && currentSummary.developers && currentSummary.developers.length > 0) {
      currentSummary.developers.forEach((dev) => {
        lines.push("", `👤 **${dev.developerName}**`);
        if (dev.completed.length > 0) {
          lines.push("", "### Completed");
          dev.completed.forEach((item, i) => lines.push(`${i + 1}. ${item}`));
        }
        if (dev.inProgress.length > 0) {
          lines.push("", "### In-Progress");
          dev.inProgress.forEach((item, i) => lines.push(`${i + 1}. ${item}`));
        }
        if (dev.prs.length > 0) {
          lines.push("", "### PR's");
          dev.prs.forEach((item, i) => lines.push(`${i + 1}. ${item}`));
        }
      });
    } else {
      if (currentSummary.completed.length > 0) {
        lines.push("", "### Completed", "");
        currentSummary.completed.forEach((item, i) => lines.push(`${i + 1}. ${item}`));
      }

      if (currentSummary.inProgress.length > 0) {
        lines.push("", "### In-Progress", "");
        currentSummary.inProgress.forEach((item, i) => lines.push(`${i + 1}. ${item}`));
      }

      if (currentSummary.prs.length > 0) {
        lines.push("", "### PR's", "");
        currentSummary.prs.forEach((item, i) => lines.push(`${i + 1}. ${item}`));
      }
    }

    return lines.join("\n");
  };

  const handleCopy = async () => {
    const text = getPlainText();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      const el = document.createElement("textarea");
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const isEmpty =
    !currentSummary ||
    (currentSummary.completed.length === 0 &&
      currentSummary.inProgress.length === 0 &&
      currentSummary.prs.length === 0);

  const hasDevelopers = currentSummary?.developers && currentSummary.developers.length > 0;

  return (
    <div className="flex flex-col h-full">
      {/* Card header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-purple-600/20 flex items-center justify-center border border-purple-500/30">
            <FileText className="w-4 h-4 text-purple-400" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              Task Summary
              {hasDevelopers && (
                <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full border border-indigo-500/30 flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  {currentSummary.developers?.length} Devs
                </span>
              )}
            </h2>
            <p className="text-xs text-slate-500">Smart multi-developer summary</p>
          </div>
        </div>

        {/* View Mode Toggle & Top Actions */}
        {currentSummary && !isEmpty && (
          <div className="flex items-center gap-1.5">
            {hasDevelopers && (
              <div className="flex items-center bg-white/5 border border-white/10 rounded-lg p-0.5 mr-1">
                <button
                  onClick={() => setViewMode("combined")}
                  className={`flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-md transition-all ${
                    viewMode === "combined"
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                  title="Combined summary view"
                >
                  <Layers className="w-3 h-3" />
                  Combined
                </button>
                <button
                  onClick={() => setViewMode("byDeveloper")}
                  className={`flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-md transition-all ${
                    viewMode === "byDeveloper"
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                  title="Grouped by developer view"
                >
                  <Users className="w-3 h-3" />
                  By Dev
                </button>
              </div>
            )}

            <button
              onClick={handleUndo}
              disabled={historyIndex <= 0}
              title={historyIndex > 0 ? `Undo (Step ${historyIndex} of ${history.length - 1})` : "Undo (no previous steps)"}
              className={`p-1.5 rounded-lg border border-white/10 transition-all ${
                historyIndex > 0
                  ? "text-indigo-300 hover:text-white hover:bg-indigo-600/30 border-indigo-500/40 shadow-sm"
                  : "text-slate-600 opacity-40 cursor-not-allowed"
              }`}
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleRedo}
              disabled={historyIndex >= history.length - 1}
              title={historyIndex < history.length - 1 ? "Redo" : "Redo (no next steps)"}
              className={`p-1.5 rounded-lg border border-white/10 transition-all ${
                historyIndex < history.length - 1
                  ? "text-indigo-300 hover:text-white hover:bg-indigo-600/30 border-indigo-500/40 shadow-sm"
                  : "text-slate-600 opacity-40 cursor-not-allowed"
              }`}
            >
              <RotateCw className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={onRegenerate}
              title="Regenerate verbatim summary"
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 border border-white/10 transition-all"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={handleCopy}
              className={`btn rounded-xl text-xs px-3 py-1.5 transition-all ${
                copied
                  ? "bg-emerald-600/20 text-emerald-400 border border-emerald-500/30"
                  : "btn-primary"
              }`}
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  Copy
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 min-h-0 overflow-y-auto rounded-xl bg-white/[0.03] border border-white/10 p-4 sm:p-5 flex flex-col justify-between gap-6">
        {/* Loading state */}
        {isLoading && <LoadingSkeleton />}

        {/* Error state */}
        {!isLoading && error && (
          <div className="flex flex-col items-center justify-center h-full min-h-[200px] text-center animate-fade-in gap-3">
            <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
              <AlertCircle className="w-6 h-6 text-red-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-red-400 mb-1">Error</p>
              <p className="text-xs text-slate-500 max-w-xs">{error}</p>
            </div>
            <button onClick={onRegenerate} className="btn btn-secondary rounded-xl text-xs mt-1">
              <RefreshCw className="w-3.5 h-3.5" />
              Try again
            </button>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !error && isEmpty && (
          <div className="flex flex-col items-center justify-center h-full min-h-[220px] text-center animate-fade-in gap-3">
            <div className="relative">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-600/20 to-purple-600/20 border border-indigo-500/20 flex items-center justify-center">
                <FileText className="w-7 h-7 text-indigo-400/60" />
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-400 mb-1">Your summary will appear here</p>
              <p className="text-xs text-slate-600 max-w-xs leading-relaxed">
                Paste your daily task updates on the left and click{" "}
                <span className="text-indigo-400 font-medium">Summarize</span>
              </p>
            </div>
          </div>
        )}

        {/* Formatted summary results */}
        {!isLoading && !error && currentSummary && !isEmpty && (
          <div className="space-y-6 animate-slide-up">
            {/* Header greeting */}
            <div className="pb-3 border-b border-white/10">
              <p className="text-sm text-slate-200 leading-relaxed">
                Hi <span className="font-bold text-white">{recipientName}</span>,
              </p>
              <p className="text-sm text-slate-400 mt-1 leading-relaxed">
                Kindly find the task updates and PR&apos;s for{" "}
                <span className="font-bold text-indigo-300">{today}</span>
              </p>
            </div>

            {/* View Mode: Grouped By Developer */}
            {viewMode === "byDeveloper" && currentSummary.developers && currentSummary.developers.length > 0 ? (
              <div className="space-y-6">
                {currentSummary.developers.map((dev, dIdx) => (
                  <div
                    key={dIdx}
                    className="p-4 rounded-xl bg-white/[0.02] border border-white/10 space-y-4"
                  >
                    <div className="flex items-center gap-2 pb-2 border-b border-white/5">
                      <div className="w-6 h-6 rounded-md bg-indigo-500/20 flex items-center justify-center text-indigo-400">
                        <User className="w-3.5 h-3.5" />
                      </div>
                      <h3 className="text-sm font-bold text-slate-100">{dev.developerName}</h3>
                    </div>

                    {/* Developer Completed */}
                    {dev.completed.length > 0 && (
                      <div className="space-y-1.5 pl-2">
                        <div className="flex items-center gap-2 mb-2">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-xs font-semibold text-emerald-400">Completed ({dev.completed.length})</span>
                        </div>
                        <ol className="space-y-1 pl-4 list-decimal text-xs text-slate-300">
                          {dev.completed.map((item, i) => (
                            <li key={i} className="leading-relaxed">{item}</li>
                          ))}
                        </ol>
                      </div>
                    )}

                    {/* Developer In Progress */}
                    {dev.inProgress.length > 0 && (
                      <div className="space-y-1.5 pl-2">
                        <div className="flex items-center gap-2 mb-2">
                          <Clock className="w-3.5 h-3.5 text-amber-400" />
                          <span className="text-xs font-semibold text-amber-400">In Progress ({dev.inProgress.length})</span>
                        </div>
                        <ol className="space-y-1 pl-4 list-decimal text-xs text-slate-300">
                          {dev.inProgress.map((item, i) => (
                            <li key={i} className="leading-relaxed">{item}</li>
                          ))}
                        </ol>
                      </div>
                    )}

                    {/* Developer PRs */}
                    {dev.prs.length > 0 && (
                      <div className="space-y-1.5 pl-2">
                        <div className="flex items-center gap-2 mb-2">
                          <GitPullRequest className="w-3.5 h-3.5 text-blue-400" />
                          <span className="text-xs font-semibold text-blue-400">PR's ({dev.prs.length})</span>
                        </div>
                        <ol className="space-y-1 pl-4 list-decimal text-xs text-slate-300">
                          {dev.prs.map((item, i) => (
                            <li key={i} className="leading-relaxed">{item}</li>
                          ))}
                        </ol>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              /* View Mode: Combined List (Default) */
              <div className="space-y-6">
                {/* Completed */}
                <EditableSection
                  sectionKey="completed"
                  icon={<CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                  title="Completed"
                  items={currentSummary.completed}
                  badgeClass="bg-emerald-500/15 text-emerald-400 border border-emerald-500/25"
                  iconBg="bg-emerald-600/15 border border-emerald-500/25"
                  numberClass="bg-emerald-500/20 text-emerald-300 text-[10px]"
                  onDeleteItem={handleDeleteItem}
                  onEditItem={handleEditItem}
                  onAddItem={handleAddItem}
                />

                {/* In Progress */}
                <EditableSection
                  sectionKey="inProgress"
                  icon={<Clock className="w-3.5 h-3.5 text-amber-400" />}
                  title="In Progress"
                  items={currentSummary.inProgress}
                  badgeClass="bg-amber-500/15 text-amber-400 border border-amber-500/25"
                  iconBg="bg-amber-600/15 border border-amber-500/25"
                  numberClass="bg-amber-500/20 text-amber-300 text-[10px]"
                  onDeleteItem={handleDeleteItem}
                  onEditItem={handleEditItem}
                  onAddItem={handleAddItem}
                />

                {/* PR's */}
                <EditableSection
                  sectionKey="prs"
                  icon={<GitPullRequest className="w-3.5 h-3.5 text-blue-400" />}
                  title="PR's"
                  items={currentSummary.prs}
                  badgeClass="bg-blue-500/15 text-blue-400 border border-blue-500/25"
                  iconBg="bg-blue-600/15 border border-blue-500/25"
                  numberClass="bg-blue-500/20 text-blue-300 text-[10px]"
                  onDeleteItem={handleDeleteItem}
                  onEditItem={handleEditItem}
                  onAddItem={handleAddItem}
                />
              </div>
            )}
          </div>
        )}

        {/* AI Summary Assistant Bar */}
        {!isLoading && !error && currentSummary && (
          <div className="mt-4 pt-4 border-t border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white">
                  <Bot className="w-3.5 h-3.5" />
                </div>
                <span className="text-xs font-bold text-slate-200">AI Summary Assistant</span>
              </div>
              <span className="text-[10px] text-slate-500">On-Demand Modifications</span>
            </div>

            {/* Quick Action Chips */}
            <div className="flex flex-wrap gap-1.5">
              {[
                { label: "✏️ Rephrase Professionally", prompt: "Rephrase task updates to sound more technical and professional" },
                { label: "⚡ Make Concise", prompt: "Make task descriptions shorter and more concise" },
                { label: "🔧 Fix Typos & Grammar", prompt: "Fix capitalization, grammar, and typos" },
                { label: "🔀 Copy Completed to PRs", prompt: "Copy all completed items to PR block" },
              ].map((chip) => (
                <button
                  key={chip.label}
                  disabled={isAssistantWorking}
                  onClick={() => handleRunAssistant(chip.prompt)}
                  className="text-xs text-slate-300 bg-white/5 hover:bg-indigo-600/20 hover:text-indigo-200 border border-white/10 hover:border-indigo-500/30 rounded-lg px-2.5 py-1 transition-all flex items-center gap-1 disabled:opacity-50"
                >
                  {chip.label}
                </button>
              ))}
            </div>

            {/* Input Form */}
            <div className="relative flex items-center">
              <input
                type="text"
                value={assistantPrompt}
                onChange={(e) => setAssistantPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleRunAssistant();
                }}
                placeholder="Ask AI Assistant to modify or rephrase (e.g., 'Move 2nd pr to in progress', 'Rephrase item 1')..."
                className="w-full bg-black/40 border border-white/10 focus:border-indigo-500/60 rounded-xl pl-3 py-2 pr-10 text-xs text-slate-200 placeholder-slate-500 outline-none transition-all"
                disabled={isAssistantWorking}
              />
              <button
                onClick={() => handleRunAssistant()}
                disabled={!assistantPrompt.trim() || isAssistantWorking}
                className="absolute right-1.5 p-1.5 text-indigo-400 hover:text-indigo-200 disabled:opacity-30 disabled:hover:text-indigo-400 transition-colors"
              >
                {isAssistantWorking ? (
                  <span className="w-3.5 h-3.5 border-2 border-indigo-400/30 border-t-indigo-400 rounded-full animate-spin block" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
              </button>
            </div>

            {assistantMsg && (
              <p className="text-[11px] text-indigo-300 font-medium animate-fade-in">
                {assistantMsg}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
