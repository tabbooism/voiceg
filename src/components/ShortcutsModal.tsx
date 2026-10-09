import React from "react";
import { Keyboard } from "lucide-react";

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ShortcutsModal: React.FC<ShortcutsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const shortcuts = [
    { key: "1", desc: "Navigate to Media Library" },
    { key: "2", desc: "Navigate to AI Vision Inspector" },
    { key: "3", desc: "Navigate to Photo Editor" },
    { key: "4", desc: "Navigate to Voice & Audio Isolator" },
    { key: "5", desc: "Navigate to Veo 3 Video Studio" },
    { key: "6", desc: "Navigate to Gemini AI Chatbot" },
    { key: "7", desc: "Navigate to Batch Processing Lab" },
    { key: "8", desc: "Navigate to Plugins & Macros" },
    { key: "L", desc: "Toggle Privacy Local Mode (On/Off)" },
    { key: "Space", desc: "Play / Pause Stems in Voice Isolator" },
    { key: "Ctrl / ⌘ + O", desc: "Import Media Files" },
    { key: "Ctrl / ⌘ + S", desc: "Sync with Google Drive" },
    { key: "Ctrl / ⌘ + Z", desc: "Undo photo adjustment" },
    { key: "Ctrl / ⌘ + Y", desc: "Redo photo adjustment" },
    { key: "?", desc: "Show / hide keyboard shortcuts cheatsheet" },
    { key: "Esc", desc: "Close active modal or viewer" },
  ];

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <Keyboard className="w-5 h-5 text-indigo-400" />
            <h3 className="text-base font-bold text-white">Studio Keyboard Shortcuts</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-sm p-1 rounded hover:bg-slate-800"
          >
            ✕
          </button>
        </div>

        <div className="space-y-2.5 max-h-[60vh] overflow-y-auto pr-1">
          {shortcuts.map((sc, i) => (
            <div
              key={i}
              className="flex items-center justify-between text-xs py-1.5 px-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80"
            >
              <span className="text-slate-300">{sc.desc}</span>
              <kbd className="px-2 py-0.5 rounded bg-slate-800 text-indigo-300 font-mono text-[11px] border border-slate-700 shadow-sm">
                {sc.key}
              </kbd>
            </div>
          ))}
        </div>

        <div className="mt-5 pt-3 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-4 py-1.5 rounded-lg transition-colors"
          >
            Got It
          </button>
        </div>
      </div>
    </div>
  );
};
