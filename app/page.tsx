"use client";

import { useState, useEffect, useCallback } from "react";
import Header from "@/components/Header";
import TaskInput from "@/components/TaskInput";
import TaskSummary from "@/components/TaskSummary";
import SettingsModal from "@/components/SettingsModal";

interface SummaryData {
  completed: string[];
  inProgress: string[];
  prs: string[];
}

const DEFAULT_RECIPIENT = "Sanjeev Kumar";
const STORAGE_KEY = "task-summarizer-recipient";

export default function HomePage() {
  const [recipientName, setRecipientName] = useState(DEFAULT_RECIPIENT);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [inputText, setInputText] = useState("");
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load recipient name from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) setRecipientName(saved);
  }, []);

  const handleSaveName = (name: string) => {
    setRecipientName(name);
    localStorage.setItem(STORAGE_KEY, name);
  };

  const handleSummarize = useCallback(async (text: string) => {
    setInputText(text);
    setIsLoading(true);
    setError(null);
    setSummary(null);

    // On mobile: scroll to summary section after a short delay
    if (window.innerWidth < 1024) {
      setTimeout(() => {
        document.getElementById("summary-block")?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 200);
    }

    try {
      const res = await fetch("/api/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to summarize. Please try again.");
      }

      setSummary(data.data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "An unexpected error occurred.";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleRegenerate = () => {
    if (inputText) handleSummarize(inputText);
  };

  return (
    <div className="relative min-h-screen flex flex-col">
      {/* Background orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="orb absolute top-[10%] left-[5%] w-64 h-64 sm:w-96 sm:h-96 rounded-full bg-indigo-600/5 blur-3xl" />
        <div className="orb orb-delay-1 absolute top-[40%] right-[5%] w-48 h-48 sm:w-72 sm:h-72 rounded-full bg-purple-600/5 blur-3xl" />
        <div className="orb orb-delay-2 absolute bottom-[10%] left-[30%] w-56 h-56 sm:w-80 sm:h-80 rounded-full bg-pink-600/4 blur-3xl" />
      </div>

      {/* Header */}
      <Header
        recipientName={recipientName}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      {/* Hero text */}
      <div className="relative z-10 text-center px-4 pt-2 pb-6 sm:pt-4 sm:pb-8">
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white mb-2 leading-tight">
          Turn raw updates into{" "}
          <span className="gradient-text">clean summaries</span>
        </h2>
        <p className="text-sm sm:text-base text-slate-500 max-w-xl mx-auto">
          Paste messy developer updates · AI extracts Completed, In-Progress & PRs · Copy & share instantly
        </p>
      </div>

      {/* Main content: two blocks */}
      <main className="relative z-10 flex-1 w-full max-w-7xl mx-auto px-3 sm:px-6 pb-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {/* Input block */}
          <div className="glass-card rounded-2xl p-4 sm:p-5 min-h-[420px] flex flex-col">
            <TaskInput onSummarize={handleSummarize} isLoading={isLoading} />
          </div>

          {/* Summary block */}
          <div
            id="summary-block"
            className="glass-card rounded-2xl p-4 sm:p-5 min-h-[420px] flex flex-col"
          >
            <TaskSummary
              recipientName={recipientName}
              summary={summary}
              isLoading={isLoading}
              error={error}
              onRegenerate={handleRegenerate}
              rawInputText={inputText}
              onUpdateSummary={setSummary}
            />
          </div>
        </div>

        {/* How it works - tips row */}
        <div className="mt-6 sm:mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            {
              emoji: "📋",
              title: "Any Format",
              desc: "Numbered lists, bullet points, plain text — AI handles all formats",
            },
            {
              emoji: "🤝",
              title: "Multi-Developer",
              desc: "Paste multiple developers' updates together, AI merges & deduplicates",
            },
            {
              emoji: "✨",
              title: "Smart PRs",
              desc: '"PR same as updates" or "PR - description" — auto-detected and sorted',
            },
          ].map((tip) => (
            <div
              key={tip.title}
              className="flex items-start gap-3 bg-white/[0.02] border border-white/8 rounded-xl p-3.5"
            >
              <span className="text-xl flex-shrink-0">{tip.emoji}</span>
              <div>
                <p className="text-xs font-semibold text-slate-300 mb-0.5">{tip.title}</p>
                <p className="text-xs text-slate-600 leading-relaxed">{tip.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 text-center py-4 text-xs text-slate-700">
        TaskSummarizer · Powered by Gemini AI
      </footer>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        recipientName={recipientName}
        onSave={handleSaveName}
      />
    </div>
  );
}
