import React from "react";
import {
  Layers,
  Sparkles,
  Sliders,
  Mic,
  Cpu,
  Puzzle,
  ShieldCheck,
  ShieldAlert,
  Cloud,
  CloudOff,
  Keyboard,
  HardDrive,
  LogOut,
  FolderOpen,
  Film,
  MessageSquare,
} from "lucide-react";
import { User } from "firebase/auth";

interface NavbarProps {
  currentTab: "library" | "inspector" | "editor" | "isolator" | "video" | "chat" | "batch" | "plugins";
  setCurrentTab: (tab: "library" | "inspector" | "editor" | "isolator" | "video" | "chat" | "batch" | "plugins") => void;
  localMode: boolean;
  setLocalMode: (val: boolean) => void;
  user: User | null;
  onSignIn: () => void;
  onSignOut: () => void;
  onOpenShortcuts: () => void;
  syncedCount: number;
  onOpenGooglePhotos?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  setCurrentTab,
  localMode,
  setLocalMode,
  user,
  onSignIn,
  onSignOut,
  onOpenShortcuts,
  syncedCount,
  onOpenGooglePhotos,
}) => {
  return (
    <header className="bg-slate-900/95 backdrop-blur border-b border-slate-800 text-slate-100 sticky top-0 z-40 px-4 py-2.5">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
        {/* Brand & Identity */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-indigo-500/20 text-white font-bold text-lg">
            MV
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold tracking-tight text-white text-base">MediaVision</span>
              <span className="text-xs px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-mono border border-indigo-500/30">
                PRO STUDIO
              </span>
            </div>
            <p className="text-[11px] text-slate-400">AI Media Forensics & Voice Stem Laboratory</p>
          </div>
        </div>

        {/* Studio Navigation Tabs */}
        <nav className="flex items-center gap-1 bg-slate-950/60 p-1 rounded-xl border border-slate-800/80">
          <button
            id="tab-library"
            onClick={() => setCurrentTab("library")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              currentTab === "library"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
            }`}
          >
            <FolderOpen className="w-3.5 h-3.5" />
            <span>Library</span>
          </button>

          <button
            id="tab-inspector"
            onClick={() => setCurrentTab("inspector")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              currentTab === "inspector"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI Inspector</span>
          </button>

          <button
            id="tab-editor"
            onClick={() => setCurrentTab("editor")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              currentTab === "editor"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Photo Editor</span>
          </button>

          <button
            id="tab-isolator"
            onClick={() => setCurrentTab("isolator")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              currentTab === "isolator"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
            }`}
          >
            <Mic className="w-3.5 h-3.5" />
            <span>Voice & Audio</span>
          </button>

          <button
            id="tab-video"
            onClick={() => setCurrentTab("video")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              currentTab === "video"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
            }`}
          >
            <Film className="w-3.5 h-3.5 text-purple-400" />
            <span>Veo 3 Video</span>
          </button>

          <button
            id="tab-chat"
            onClick={() => setCurrentTab("chat")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              currentTab === "chat"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5 text-indigo-400" />
            <span>Gemini Chat</span>
          </button>

          <button
            id="tab-batch"
            onClick={() => setCurrentTab("batch")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              currentTab === "batch"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>Batch Lab</span>
          </button>

          <button
            id="tab-plugins"
            onClick={() => setCurrentTab("plugins")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              currentTab === "plugins"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
            }`}
          >
            <Puzzle className="w-3.5 h-3.5" />
            <span>Plugins & Macros</span>
          </button>
        </nav>

        {/* Controls: Privacy Local Mode & Cloud Sync */}
        <div className="flex items-center gap-2">
          {/* Privacy Local Mode Switch */}
          <button
            id="btn-toggle-local-mode"
            onClick={() => setLocalMode(!localMode)}
            title={
              localMode
                ? "Local Privacy Mode Active: Processing runs 100% on-device inside your browser. No data leaves your machine."
                : "Cloud Mode Active: High-performance server Gemini models enabled."
            }
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all border ${
              localMode
                ? "bg-emerald-950/70 border-emerald-500/40 text-emerald-300 shadow-sm shadow-emerald-900/30"
                : "bg-slate-800/80 border-slate-700 text-slate-300 hover:border-slate-600"
            }`}
          >
            {localMode ? (
              <>
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Local Privacy: ON</span>
              </>
            ) : (
              <>
                <ShieldAlert className="w-3.5 h-3.5 text-slate-400" />
                <span>Local Privacy: OFF</span>
              </>
            )}
          </button>

          {/* Google Photos Cloud Sync Trigger */}
          {onOpenGooglePhotos && (
            <button
              id="btn-nav-google-photos"
              onClick={onOpenGooglePhotos}
              className="flex items-center gap-1.5 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all"
              title="Google Photos Cloud Manager & Device Sync"
            >
              <Cloud className="w-3.5 h-3.5 text-rose-400" />
              <span>Google Photos</span>
              {syncedCount > 0 && (
                <span className="bg-rose-500/30 text-rose-200 text-[10px] px-1 rounded-full font-mono">
                  {syncedCount}
                </span>
              )}
            </button>
          )}

          {/* Google Account / Drive Status */}
          {user ? (
            <div className="flex items-center gap-2 bg-slate-950/80 px-2.5 py-1 rounded-lg border border-slate-800 text-xs text-slate-300">
              <HardDrive className="w-3.5 h-3.5 text-sky-400" />
              <span className="truncate max-w-[110px]" title={user.email || ""}>
                {user.displayName || user.email?.split("@")[0] || "Drive Connected"}
              </span>
              <button
                id="btn-signout"
                onClick={onSignOut}
                title="Disconnect Google Account"
                className="text-slate-500 hover:text-rose-400 transition-colors ml-1"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              id="btn-google-signin"
              onClick={onSignIn}
              className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all"
            >
              <Cloud className="w-3.5 h-3.5 text-sky-400" />
              <span>Connect Drive</span>
            </button>
          )}

          {/* Keyboard Shortcuts Trigger */}
          <button
            id="btn-open-shortcuts"
            onClick={onOpenShortcuts}
            title="Keyboard Shortcuts Cheatsheet (Press ?)"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors border border-transparent hover:border-slate-700"
          >
            <Keyboard className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
