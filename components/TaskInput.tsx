"use client";

import { useState, useRef } from "react";
import { ClipboardPaste, Trash2, Sparkles, ChevronDown, Info } from "lucide-react";

interface TaskInputProps {
  onSummarize: (text: string) => void;
  isLoading: boolean;
}

const EXAMPLE_TEXT = `Sravan Kumar Reddy Kummita
Task update:
1. Worked on Succession plan IDP
2. Updated mapping in Print approved letters API

In-progress:
Appraisal recommendation confirm flow implementation

PR Changes same as above

Ashay Dharmik
	1.	KPI excel changes
	2.	Added new filed in KPI form and excel
	3.	Fixed mapping issues in job type and org type in dropdown selection
Pr: KPI bugfixes`;

export default function TaskInput({ onSummarize, isLoading }: TaskInputProps) {
  const [text, setText] = useState("");
  const [showExample, setShowExample] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const charCount = text.length;
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
  const isOverLimit = charCount > 15000;

  const handleClear = () => {
    setText("");
    textareaRef.current?.focus();
  };

  const handleLoadExample = () => {
    setText(EXAMPLE_TEXT);
    setShowExample(false);
    textareaRef.current?.focus();
  };

  const handlePaste = async () => {
    try {
      const clipText = await navigator.clipboard.readText();
      setText((prev) => (prev ? prev + "\n\n" + clipText : clipText));
      textareaRef.current?.focus();
    } catch {
      textareaRef.current?.focus();
    }
  };

  const handleSubmit = () => {
    if (!text.trim() || isLoading || isOverLimit) return;
    onSummarize(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Card header */}
      <div className="flex items-center justify-between mb-3 sm:mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-600/20 flex items-center justify-center border border-indigo-500/30 flex-shrink-0">
            <ClipboardPaste className="w-4 h-4 text-indigo-400" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white">Task Update</h2>
            <p className="text-xs text-slate-500">Paste your raw daily updates</p>
          </div>
        </div>

        {/* Top actions */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowExample(!showExample)}
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-indigo-300 transition-colors px-2 py-1.5 rounded-lg hover:bg-white/5 active:bg-white/10"
          >
            <Info className="w-3.5 h-3.5" />
            <span className="text-xs">Example</span>
            <ChevronDown
              className={`w-3 h-3 transition-transform ${showExample ? "rotate-180" : ""}`}
            />
          </button>
          {text && (
            <button
              onClick={handleClear}
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-red-400 transition-colors px-2 py-1.5 rounded-lg hover:bg-red-500/10 active:bg-red-500/20"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="text-xs">Clear</span>
            </button>
          )}
        </div>
      </div>

      {/* Example dropdown */}
      {showExample && (
        <div className="mb-3 p-3 rounded-xl bg-indigo-950/40 border border-indigo-500/20 animate-fade-in">
          <p className="text-xs text-slate-400 mb-2 font-medium">Example input format:</p>
          <pre className="text-xs text-slate-400 whitespace-pre-wrap font-mono leading-relaxed max-h-40 overflow-y-auto">
            {EXAMPLE_TEXT}
          </pre>
          <button
            onClick={handleLoadExample}
            className="mt-2 text-xs text-indigo-400 hover:text-indigo-300 font-semibold transition-colors"
          >
            → Load this example
          </button>
        </div>
      )}

      {/* Textarea */}
      <div className="relative flex-1 min-h-0">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`Paste developer task updates here...\n\nSupports multiple developers, any format:\n• Developer Name at top\n• "Task Update: 1. Did X 2. Did Y"\n• "In Progress: Working on Z"\n• "PR Changes same as above"`}
          className={`w-full h-full min-h-[200px] sm:min-h-[280px] bg-white/[0.03] border rounded-xl px-3.5 py-3 text-base sm:text-sm text-slate-200 placeholder-slate-600 outline-none resize-none transition-all duration-200 font-mono leading-relaxed
            ${
              isOverLimit
                ? "border-red-500/50 focus:border-red-500"
                : "border-white/10 focus:border-indigo-500/60 focus:bg-white/[0.05]"
            }`}
          style={{ boxShadow: text ? "0 0 0 1px rgba(99,102,241,0.1) inset" : undefined }}
          maxLength={16000}
          spellCheck={false}
        />

        {/* Paste from clipboard button (shown when empty) */}
        {!text && (
          <button
            onClick={handlePaste}
            className="absolute bottom-3 right-3 flex items-center gap-1.5 text-xs text-slate-400 bg-white/5 border border-white/10 px-3 py-1.5 rounded-lg hover:text-indigo-300 hover:bg-white/10 transition-colors"
          >
            <ClipboardPaste className="w-3.5 h-3.5" />
            Paste Clipboard
          </button>
        )}
      </div>

      {/* Footer: char count + submit */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between mt-3 gap-2.5">
        {/* Stats */}
        <div className="flex items-center justify-between sm:justify-start gap-2 text-xs text-slate-500">
          <span className={isOverLimit ? "text-red-400 font-medium" : ""}>
            {charCount.toLocaleString()}{isOverLimit ? " (limit 15k)" : ""} chars
          </span>
          <span className="text-slate-700">·</span>
          <span>{wordCount} words</span>
          <span className="text-slate-700 hidden md:inline">·</span>
          <span className="hidden md:inline text-slate-600">Ctrl+Enter to summarize</span>
        </div>

        {/* Submit button */}
        <button
          onClick={handleSubmit}
          disabled={!text.trim() || isLoading || isOverLimit}
          className={`btn btn-primary rounded-xl whitespace-nowrap text-sm w-full sm:w-auto px-5 py-3 
            ${
              !text.trim() || isLoading || isOverLimit
                ? "opacity-50 cursor-not-allowed transform-none shadow-none"
                : "glow-brand active:scale-[0.99]"
            }`}
        >
          {isLoading ? (
            <>
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Summarizing...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              <span>Summarize Tasks</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
