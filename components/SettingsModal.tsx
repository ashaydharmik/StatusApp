"use client";

import { useState, useEffect } from "react";
import { Settings, X, Save, User } from "lucide-react";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipientName: string;
  onSave: (name: string) => void;
}

export default function SettingsModal({
  isOpen,
  onClose,
  recipientName,
  onSave,
}: SettingsModalProps) {
  const [name, setName] = useState(recipientName);

  useEffect(() => {
    setName(recipientName);
  }, [recipientName]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    onSave(name.trim() || "Team");
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSave();
    if (e.key === "Escape") onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* Modal */}
      <div className="relative w-full max-w-md glass-card rounded-2xl p-6 shadow-2xl animate-slide-up border border-white/15">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600/20 flex items-center justify-center border border-indigo-500/30">
              <Settings className="w-4 h-4 text-indigo-400" />
            </div>
            <h2 className="text-lg font-bold text-white">Settings</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              <User className="inline w-3.5 h-3.5 mr-1.5 text-indigo-400" />
              Recipient Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="e.g. Sanjeev Kumar"
              className="input-field"
              autoFocus
              maxLength={60}
            />
            <p className="text-xs text-slate-500 mt-1.5">
              This appears in the summary heading: &ldquo;Hi {name || "..."}, Kindly find...&rdquo;
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="btn btn-secondary flex-1 rounded-xl"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="btn btn-primary flex-1 rounded-xl"
          >
            <Save className="w-4 h-4" />
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
