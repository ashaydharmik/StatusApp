"use client";

import { Settings, Zap } from "lucide-react";

interface HeaderProps {
  recipientName: string;
  onOpenSettings: () => void;
}

export default function Header({ recipientName, onOpenSettings }: HeaderProps) {
  return (
    <header className="relative z-10 w-full">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-5 flex items-center justify-between">
        {/* Logo + Title */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg glow-brand">
              <Zap className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="currentColor" />
            </div>
            <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-surface-950 animate-pulse" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-bold text-white leading-tight">
              Task<span className="gradient-text">Summarizer</span>
            </h1>
            <p className="text-xs text-slate-500 hidden sm:block">AI-powered daily updates</p>
          </div>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Current recipient */}
          {recipientName && (
            <div className="hidden sm:flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-3 py-1.5">
              <div className="w-5 h-5 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white text-xs font-bold">
                {recipientName.charAt(0).toUpperCase()}
              </div>
              <span className="text-xs text-slate-300 max-w-[120px] truncate">{recipientName}</span>
            </div>
          )}

          {/* Settings button */}
          <button
            onClick={onOpenSettings}
            title="Settings"
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 border border-white/10 hover:border-white/20 transition-all duration-200"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
