"use client";

import { useState } from "react";
import {
  FileText,
  Copy,
  Check,
  RefreshCw,
  CheckCircle2,
  Clock,
  GitPullRequest,
  AlertCircle,
} from "lucide-react";

interface SummaryData {
  completed: string[];
  inProgress: string[];
  prs: string[];
}

interface TaskSummaryProps {
  recipientName: string;
  summary: SummaryData | null;
  isLoading: boolean;
  error: string | null;
  onRegenerate: () => void;
}

function formatDate(date: Date): string {
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function SkeletonLine({ width = "w-full" }: { width?: string }) {
  return (
    <div className={`h-3.5 ${width} rounded-full shimmer`} />
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Heading skeleton */}
      <div className="space-y-2">
        <SkeletonLine width="w-3/4" />
        <SkeletonLine width="w-1/2" />
      </div>

      {/* Section 1 */}
      <div className="space-y-3">
        <SkeletonLine width="w-1/3" />
        <div className="space-y-2 pl-3">
          <SkeletonLine />
          <SkeletonLine width="w-11/12" />
          <SkeletonLine width="w-10/12" />
          <SkeletonLine />
          <SkeletonLine width="w-9/12" />
        </div>
      </div>

      {/* Section 2 */}
      <div className="space-y-3">
        <SkeletonLine width="w-1/4" />
        <div className="space-y-2 pl-3">
          <SkeletonLine width="w-11/12" />
          <SkeletonLine width="w-8/12" />
        </div>
      </div>

      {/* Section 3 */}
      <div className="space-y-3">
        <SkeletonLine width="w-1/5" />
        <div className="space-y-2 pl-3">
          <SkeletonLine />
          <SkeletonLine width="w-10/12" />
        </div>
      </div>

      <p className="text-xs text-slate-500 text-center pt-2 animate-pulse">
        🤖 AI is analyzing your updates...
      </p>
    </div>
  );
}

interface SectionProps {
  icon: React.ReactNode;
  title: string;
  items: string[];
  badgeClass: string;
  iconBg: string;
  numberClass: string;
}

function Section({ icon, title, items, badgeClass, iconBg, numberClass }: SectionProps) {
  if (!items.length) return null;
  return (
    <div className="animate-fade-in">
      <div className="flex items-center gap-2 mb-3">
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${iconBg}`}>
          {icon}
        </div>
        <span className={`section-badge ${badgeClass}`}>
          {title}
        </span>
        <span className="text-xs text-slate-500 font-medium ml-1">{items.length} items</span>
      </div>
      <ol className="space-y-1.5 pl-1">
        {items.map((item, i) => (
          <li key={i} className="flex gap-3 group animate-fade-in" style={{ animationDelay: `${i * 40}ms` }}>
            <span className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold mt-0.5 ${numberClass}`}>
              {i + 1}
            </span>
            <span className="text-sm text-slate-300 leading-relaxed group-hover:text-slate-100 transition-colors">
              {item}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export default function TaskSummary({
  recipientName,
  summary,
  isLoading,
  error,
  onRegenerate,
}: TaskSummaryProps) {
  const [copied, setCopied] = useState(false);

  const today = formatDate(new Date());

  const getPlainText = (): string => {
    if (!summary) return "";

    const lines: string[] = [
      `Hi ${recipientName},`,
      ``,
      `Kindly find the task updates and PR's for **${today}**`,
    ];

    if (summary.completed.length > 0) {
      lines.push("", "### Completed", "");
      summary.completed.forEach((item, i) => lines.push(`${i + 1}. ${item}`));
    }

    if (summary.inProgress.length > 0) {
      lines.push("", "### In-Progress", "");
      summary.inProgress.forEach((item, i) => lines.push(`${i + 1}. ${item}`));
    }

    if (summary.prs.length > 0) {
      lines.push("", "### PR's", "");
      summary.prs.forEach((item, i) => lines.push(`${i + 1}. ${item}`));
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
      // fallback
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

  const isEmpty = !summary || (
    summary.completed.length === 0 &&
    summary.inProgress.length === 0 &&
    summary.prs.length === 0
  );

  return (
    <div className="flex flex-col h-full">
      {/* Card header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-purple-600/20 flex items-center justify-center border border-purple-500/30">
            <FileText className="w-4 h-4 text-purple-400" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white">Task Summary</h2>
            <p className="text-xs text-slate-500">AI-generated formatted output</p>
          </div>
        </div>

        {/* Actions */}
        {summary && !isEmpty && (
          <div className="flex items-center gap-2">
            <button
              onClick={onRegenerate}
              title="Regenerate"
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 border border-white/10 transition-all"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleCopy}
              className={`btn rounded-xl text-xs px-3 py-2 transition-all ${
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

      {/* Content area */}
      <div className="flex-1 min-h-0 overflow-y-auto rounded-xl bg-white/[0.03] border border-white/10 p-4 sm:p-5">
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
            <button
              onClick={onRegenerate}
              className="btn btn-secondary rounded-xl text-xs mt-1"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Try again
            </button>
          </div>
        )}

        {/* Empty / placeholder state */}
        {!isLoading && !error && isEmpty && (
          <div className="flex flex-col items-center justify-center h-full min-h-[220px] text-center animate-fade-in gap-3">
            <div className="relative">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-600/20 to-purple-600/20 border border-indigo-500/20 flex items-center justify-center">
                <FileText className="w-7 h-7 text-indigo-400/60" />
              </div>
              <div className="orb orb-delay-1 absolute -top-3 -right-3 w-6 h-6 rounded-full bg-purple-500/20 border border-purple-500/30" />
              <div className="orb orb-delay-2 absolute -bottom-2 -left-3 w-4 h-4 rounded-full bg-indigo-500/20 border border-indigo-500/30" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-400 mb-1">
                Your summary will appear here
              </p>
              <p className="text-xs text-slate-600 max-w-xs leading-relaxed">
                Paste your daily task updates on the left and click{" "}
                <span className="text-indigo-400 font-medium">Summarize</span>
              </p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center mt-1">
              {["✅ Completed", "🔄 In Progress", "🔀 PR's"].map((tag) => (
                <span
                  key={tag}
                  className="text-xs text-slate-600 bg-white/5 border border-white/10 rounded-full px-2.5 py-1"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Summary content */}
        {!isLoading && !error && summary && !isEmpty && (
          <div className="space-y-6 animate-slide-up">
            {/* Heading */}
            <div className="pb-4 border-b border-white/10">
              <p className="text-sm text-slate-200 leading-relaxed">
                Hi{" "}
                <span className="font-bold text-white">{recipientName}</span>,
              </p>
              <p className="text-sm text-slate-400 mt-1 leading-relaxed">
                Kindly find the task updates and PR&apos;s for{" "}
                <span className="font-bold text-indigo-300">{today}</span>
              </p>
            </div>

            {/* Completed */}
            <Section
              icon={<CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
              title="Completed"
              items={summary.completed}
              badgeClass="bg-emerald-500/15 text-emerald-400 border border-emerald-500/25"
              iconBg="bg-emerald-600/15 border border-emerald-500/25"
              numberClass="bg-emerald-500/20 text-emerald-300 text-[10px]"
            />

            {/* In Progress */}
            <Section
              icon={<Clock className="w-3.5 h-3.5 text-amber-400" />}
              title="In Progress"
              items={summary.inProgress}
              badgeClass="bg-amber-500/15 text-amber-400 border border-amber-500/25"
              iconBg="bg-amber-600/15 border border-amber-500/25"
              numberClass="bg-amber-500/20 text-amber-300 text-[10px]"
            />

            {/* PR's */}
            <Section
              icon={<GitPullRequest className="w-3.5 h-3.5 text-blue-400" />}
              title="PR's"
              items={summary.prs}
              badgeClass="bg-blue-500/15 text-blue-400 border border-blue-500/25"
              iconBg="bg-blue-600/15 border border-blue-500/25"
              numberClass="bg-blue-500/20 text-blue-300 text-[10px]"
            />

            {/* Copy button at bottom on mobile */}
            <div className="pt-4 border-t border-white/10">
              <button
                onClick={handleCopy}
                className={`w-full btn rounded-xl text-sm py-3 transition-all ${
                  copied
                    ? "bg-emerald-600/20 text-emerald-400 border border-emerald-500/30"
                    : "btn-primary"
                }`}
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4" />
                    Copied to clipboard!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Copy Summary
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
