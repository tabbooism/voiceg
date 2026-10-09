import React, { useState } from "react";
import {
  Puzzle,
  Plus,
  Play,
  CheckCircle,
  ToggleLeft,
  ToggleRight,
  Sparkles,
  Sliders,
  ShieldCheck,
  Search,
  Mic,
  Code,
  Layers,
  Zap,
} from "lucide-react";
import { PluginDefinition, MacroAction, MediaItem } from "../types";
import { executePlugin } from "../lib/plugins";

interface PluginManagerProps {
  plugins: PluginDefinition[];
  macros: MacroAction[];
  onTogglePlugin: (id: string) => void;
  onAddPlugin: (plugin: PluginDefinition) => void;
  onCreateMacro: (macro: MacroAction) => void;
  onRunMacro: (macro: MacroAction) => void;
}

export const PluginManager: React.FC<PluginManagerProps> = ({
  plugins,
  macros,
  onTogglePlugin,
  onAddPlugin,
  onCreateMacro,
  onRunMacro,
}) => {
  const [activeTab, setActiveTab] = useState<"plugins" | "macros">("plugins");

  // New Plugin modal state
  const [isAddingPlugin, setIsAddingPlugin] = useState(false);
  const [newPluginName, setNewPluginName] = useState("");
  const [newPluginAuthor, setNewPluginAuthor] = useState("");
  const [newPluginType, setNewPluginType] = useState<"filter" | "analysis" | "export">("filter");
  const [newPluginDesc, setNewPluginDesc] = useState("");

  // New Macro modal state
  const [isAddingMacro, setIsAddingMacro] = useState(false);
  const [newMacroName, setNewMacroName] = useState("");
  const [newMacroDesc, setNewMacroDesc] = useState("");
  const [newMacroSteps, setNewMacroSteps] = useState<Array<"ocr" | "objects" | "faces" | "altText" | "sourceLookup" | "autoEnhance" | "voiceIsolate">>(["ocr", "altText"]);

  const handleCreatePluginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPluginName.trim()) return;

    const newPlugin: PluginDefinition = {
      id: `plugin_custom_${Date.now()}`,
      name: newPluginName.trim(),
      version: "1.0.0",
      author: newPluginAuthor.trim() || "Independent Developer",
      description: newPluginDesc.trim() || "Third-party extension plugin.",
      enabled: true,
      type: newPluginType,
      actionName: "applyCinemaLut",
    };

    onAddPlugin(newPlugin);
    setIsAddingPlugin(false);
    setNewPluginName("");
    setNewPluginDesc("");
    setNewPluginAuthor("");
  };

  const handleCreateMacroSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMacroName.trim()) return;

    const newMacro: MacroAction = {
      id: `macro_custom_${Date.now()}`,
      name: newMacroName.trim(),
      description: newMacroDesc.trim() || "Custom automated macro pipeline.",
      iconName: "Zap",
      steps: newMacroSteps,
    };

    onCreateMacro(newMacro);
    setIsAddingMacro(false);
    setNewMacroName("");
    setNewMacroDesc("");
  };

  const toggleMacroStep = (step: "ocr" | "objects" | "faces" | "altText" | "sourceLookup" | "autoEnhance" | "voiceIsolate") => {
    if (newMacroSteps.includes(step)) {
      setNewMacroSteps(newMacroSteps.filter((s) => s !== step));
    } else {
      setNewMacroSteps([...newMacroSteps, step]);
    }
  };

  return (
    <div className="h-[calc(100vh-60px)] overflow-y-auto bg-slate-950 p-6 text-slate-200">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header & Tabs */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Puzzle className="w-6 h-6 text-indigo-400" />
              <h2 className="text-xl font-bold text-white">Extensibility & Macro Automations</h2>
            </div>
            <p className="text-xs text-slate-400">
              Integrate custom third-party plugins, DSP audio filters, and create customizable macro chains for power-user workflows.
            </p>
          </div>

          <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs self-start md:self-auto">
            <button
              onClick={() => setActiveTab("plugins")}
              className={`px-4 py-1.5 rounded-lg font-medium transition-colors ${
                activeTab === "plugins" ? "bg-indigo-600 text-white shadow-sm" : "text-slate-400 hover:text-white"
              }`}
            >
              Plugins Registry
            </button>
            <button
              onClick={() => setActiveTab("macros")}
              className={`px-4 py-1.5 rounded-lg font-medium transition-colors ${
                activeTab === "macros" ? "bg-indigo-600 text-white shadow-sm" : "text-slate-400 hover:text-white"
              }`}
            >
              Custom Macros
            </button>
          </div>
        </div>

        {/* Plugins View */}
        {activeTab === "plugins" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Installed Third-Party Plugins</h3>
              <button
                id="btn-register-plugin"
                onClick={() => setIsAddingPlugin(true)}
                className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-3 py-1.5 rounded-lg font-medium transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Install Custom Plugin</span>
              </button>
            </div>

            {/* Plugin Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {plugins.map((plugin) => (
                <div
                  key={plugin.id}
                  className={`bg-slate-900 rounded-xl p-4 border transition-all flex flex-col justify-between ${
                    plugin.enabled ? "border-slate-800" : "border-slate-800/40 opacity-60"
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-bold text-white">{plugin.name}</h4>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
                            v{plugin.version}
                          </span>
                        </div>
                        <span className="text-[11px] text-indigo-400 font-medium">By {plugin.author}</span>
                      </div>

                      <button
                        onClick={() => onTogglePlugin(plugin.id)}
                        className="text-slate-400 hover:text-white transition-colors"
                        title={plugin.enabled ? "Disable plugin" : "Enable plugin"}
                      >
                        {plugin.enabled ? (
                          <ToggleRight className="w-7 h-7 text-indigo-400" />
                        ) : (
                          <ToggleLeft className="w-7 h-7 text-slate-600" />
                        )}
                      </button>
                    </div>

                    <p className="text-xs text-slate-300 leading-relaxed mb-3">
                      {plugin.description}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                    <span className="capitalize px-2 py-0.5 rounded bg-slate-950 text-slate-400 font-mono border border-slate-800">
                      Category: {plugin.type}
                    </span>
                    <span className="text-slate-500 font-mono">Hook: {plugin.actionName}()</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Install Plugin Modal */}
            {isAddingPlugin && (
              <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <form
                  onSubmit={handleCreatePluginSubmit}
                  className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl"
                >
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Code className="w-4 h-4 text-indigo-400" />
                      Register Third-Party Plugin
                    </h3>
                    <button
                      type="button"
                      onClick={() => setIsAddingPlugin(false)}
                      className="text-slate-400 hover:text-white text-sm"
                    >
                      ✕
                    </button>
                  </div>

                  <div>
                    <label className="text-xs text-slate-300 block mb-1 font-medium">Plugin Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Spectral Audio De-Esser"
                      value={newPluginName}
                      onChange={(e) => setNewPluginName(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-slate-300 block mb-1 font-medium">Author / Studio</label>
                    <input
                      type="text"
                      placeholder="e.g. SoundCraft Labs"
                      value={newPluginAuthor}
                      onChange={(e) => setNewPluginAuthor(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-slate-300 block mb-1 font-medium">Plugin Category</label>
                    <select
                      value={newPluginType}
                      onChange={(e) => setNewPluginType(e.target.value as any)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                    >
                      <option value="filter">DSP / Color Filter Hook</option>
                      <option value="analysis">Deep ML Analysis Hook</option>
                      <option value="export">Custom File Exporter Hook</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs text-slate-300 block mb-1 font-medium">Description</label>
                    <textarea
                      rows={3}
                      placeholder="Describe the capabilities of this plugin..."
                      value={newPluginDesc}
                      onChange={(e) => setNewPluginDesc(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={() => setIsAddingPlugin(false)}
                      className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-1.5 rounded-lg text-xs font-semibold"
                    >
                      Install Plugin
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        )}

        {/* Macros View */}
        {activeTab === "macros" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Custom Macro Automations</h3>
              <button
                id="btn-create-macro"
                onClick={() => setIsAddingMacro(true)}
                className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-3 py-1.5 rounded-lg font-medium transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create New Macro</span>
              </button>
            </div>

            {/* Macro Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {macros.map((macro) => (
                <div
                  key={macro.id}
                  className="bg-slate-900 rounded-xl p-4 border border-slate-800 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Zap className="w-4 h-4 text-amber-400" />
                        <h4 className="text-xs font-bold text-white">{macro.name}</h4>
                      </div>

                      <button
                        onClick={() => onRunMacro(macro)}
                        className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-semibold px-3 py-1 rounded-lg transition-colors shadow-sm"
                      >
                        <Play className="w-3 h-3 fill-white" />
                        <span>Run Macro</span>
                      </button>
                    </div>

                    <p className="text-xs text-slate-300 leading-relaxed mb-3">
                      {macro.description}
                    </p>
                  </div>

                  <div className="pt-2.5 border-t border-slate-800/80">
                    <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block mb-1.5">
                      Execution Steps ({macro.steps.length}):
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {macro.steps.map((step, idx) => (
                        <span
                          key={idx}
                          className="text-[10px] px-2 py-0.5 rounded-full bg-slate-950 border border-slate-800 text-indigo-300 font-mono"
                        >
                          {idx + 1}. {step}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Create Macro Modal */}
            {isAddingMacro && (
              <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <form
                  onSubmit={handleCreateMacroSubmit}
                  className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl"
                >
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Zap className="w-4 h-4 text-amber-400" />
                      Configure Custom Macro Chain
                    </h3>
                    <button
                      type="button"
                      onClick={() => setIsAddingMacro(false)}
                      className="text-slate-400 hover:text-white text-sm"
                    >
                      ✕
                    </button>
                  </div>

                  <div>
                    <label className="text-xs text-slate-300 block mb-1 font-medium">Macro Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Audit Document & Extract Vocals"
                      value={newMacroName}
                      onChange={(e) => setNewMacroName(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-slate-300 block mb-1 font-medium">Description</label>
                    <textarea
                      rows={2}
                      placeholder="Workflow description..."
                      value={newMacroDesc}
                      onChange={(e) => setNewMacroDesc(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-slate-300 block mb-2 font-medium">
                      Select Pipeline Steps to Sequence:
                    </label>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {[
                        { key: "ocr", label: "OCR Text Extraction" },
                        { key: "objects", label: "Object Detection" },
                        { key: "faces", label: "Face Clustering" },
                        { key: "altText", label: "Alt-Text Generation" },
                        { key: "sourceLookup", label: "Google Source Grounding" },
                        { key: "autoEnhance", label: "Auto-Color Enhance" },
                        { key: "voiceIsolate", label: "Voice Stem Isolation" },
                      ].map((step) => {
                        const isSelected = newMacroSteps.includes(step.key as any);
                        return (
                          <button
                            key={step.key}
                            type="button"
                            onClick={() => toggleMacroStep(step.key as any)}
                            className={`p-2 rounded-lg border text-left transition-colors ${
                              isSelected
                                ? "bg-indigo-600/30 border-indigo-500 text-indigo-300"
                                : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
                            }`}
                          >
                            {step.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={() => setIsAddingMacro(false)}
                      className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={newMacroSteps.length === 0}
                      className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white px-4 py-1.5 rounded-lg text-xs font-semibold"
                    >
                      Save Macro
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
