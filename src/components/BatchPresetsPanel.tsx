import React, { useState, useEffect } from "react";
import {
  Sliders,
  Bookmark,
  Plus,
  Trash2,
  Check,
  Download,
  Zap,
  Shield,
  Layers,
  FileArchive,
  Sparkles,
  Info,
  CheckCircle2,
  RefreshCw,
  FolderDown,
  Settings2,
  Globe,
  Mic,
  Eye,
  FileText,
} from "lucide-react";
import { BatchExportConfig, BatchExportPreset, MediaItem } from "../types";
import {
  getSavedPresets,
  saveCustomPreset,
  deleteCustomPreset,
  resetCustomPresets,
  DEFAULT_PRESETS,
  executeBulkExport,
} from "../lib/batchPresets";

interface BatchPresetsPanelProps {
  selectedItems: MediaItem[];
  onSelectPipeline: (pipeline: "ai_inspect" | "source_lookup" | "voice_isolate" | "local_scan" | "auto_color") => void;
  activePipeline: string;
  onExecutePipeline: (pipelineOverride?: "ai_inspect" | "source_lookup" | "voice_isolate" | "local_scan" | "auto_color") => Promise<void>;
  isProcessingBatch: boolean;
}

export const BatchPresetsPanel: React.FC<BatchPresetsPanelProps> = ({
  selectedItems,
  onSelectPipeline,
  activePipeline,
  onExecutePipeline,
  isProcessingBatch,
}) => {
  const [presets, setPresets] = useState<BatchExportPreset[]>([]);
  const [activePresetId, setActivePresetId] = useState<string>("preset_web_optimized");
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<{ current: number; total: number; message: string } | null>(null);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [exportSuccessMessage, setExportSuccessMessage] = useState<string | null>(null);

  // New Custom Preset Form State
  const [customName, setCustomName] = useState("");
  const [customDesc, setCustomDesc] = useState("");
  const [customBadge, setCustomBadge] = useState("");
  const [customConfig, setCustomConfig] = useState<BatchExportConfig>({
    imageFormat: "webp",
    imageQuality: 0.85,
    maxDimension: 1920,
    audioFormat: "mp3",
    audioBitDepth: 24,
    audioBitrate: 256,
    pipeline: "auto_color",
    includeMetadataManifest: true,
    stripExifPrivacy: true,
    packageAsZip: true,
  });

  // Load presets on mount
  useEffect(() => {
    refreshPresets();
  }, []);

  const refreshPresets = () => {
    const list = getSavedPresets();
    setPresets(list);
  };

  const activePreset = presets.find((p) => p.id === activePresetId) || presets[0] || DEFAULT_PRESETS[0];

  // Select and apply preset
  const handleSelectPreset = (preset: BatchExportPreset) => {
    setActivePresetId(preset.id);
    if (preset.config.pipeline !== "none") {
      onSelectPipeline(preset.config.pipeline as any);
    }
  };

  // Delete custom preset
  const handleDeletePreset = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    deleteCustomPreset(id);
    if (activePresetId === id) {
      setActivePresetId("preset_web_optimized");
    }
    refreshPresets();
  };

  // Reset to default
  const handleResetPresets = () => {
    if (confirm("Reset all presets to default studio configurations?")) {
      resetCustomPresets();
      refreshPresets();
      setActivePresetId("preset_web_optimized");
    }
  };

  // Save new custom preset
  const handleSaveCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customName.trim()) return;

    const saved = saveCustomPreset({
      name: customName.trim(),
      description: customDesc.trim() || "User defined custom export configuration",
      badge: customBadge.trim() || `${customConfig.imageFormat.toUpperCase()} • ${Math.round(customConfig.imageQuality * 100)}%`,
      category: "custom",
      config: customConfig,
    });

    refreshPresets();
    setActivePresetId(saved.id);
    setIsSaveModalOpen(false);
    setCustomName("");
    setCustomDesc("");
    setCustomBadge("");
  };

  // One-Click Bulk Process & Export
  const handleOneClickBulkProcess = async () => {
    if (selectedItems.length === 0 || isExporting || isProcessingBatch) return;

    setIsExporting(true);
    setExportSuccessMessage(null);

    try {
      // Step 1: Run ML or audio pipeline if requested by preset
      if (activePreset.config.pipeline !== "none") {
        setExportProgress({
          current: 0,
          total: selectedItems.length,
          message: `Applying '${activePreset.name}' ML pipeline (${activePreset.config.pipeline})...`,
        });
        await onExecutePipeline(activePreset.config.pipeline as any);
      }

      // Step 2: Bulk Export and download ZIP/stems
      setExportProgress({
        current: 0,
        total: selectedItems.length,
        message: `Packaging media according to ${activePreset.name}...`,
      });

      const result = await executeBulkExport(
        selectedItems,
        activePreset,
        (current, total, message) => {
          setExportProgress({ current, total, message });
        }
      );

      setExportSuccessMessage(
        result.filename
          ? `Successfully generated ${result.filename} (${result.filesCount} assets bundled)!`
          : `Bulk export completed (${result.filesCount} files downloaded)!`
      );
    } catch (err: any) {
      console.error("Bulk export failed:", err);
      alert(`Export error: ${err.message}`);
    } finally {
      setIsExporting(false);
      setTimeout(() => {
        setExportProgress(null);
      }, 3000);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-slate-200 shadow-xl">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4 mb-5">
        <div>
          <div className="flex items-center gap-2">
            <Bookmark className="w-5 h-5 text-indigo-400" />
            <h3 className="text-base font-bold text-white tracking-wide">
              Export Presets & Configurations
            </h3>
            <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-800/80">
              One-Click Bulk Lab
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Save and execute standardized compression, format conversions, stem isolations, and metadata packaging.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            id="btn-open-new-preset-modal"
            onClick={() => {
              setCustomConfig({ ...activePreset.config });
              setIsSaveModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Save New Preset</span>
          </button>

          <button
            onClick={handleResetPresets}
            title="Reset to default built-ins"
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Presets Selection Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-5">
        {presets.map((preset) => {
          const isSelected = preset.id === activePresetId;
          return (
            <div
              key={preset.id}
              onClick={() => handleSelectPreset(preset)}
              className={`p-3.5 rounded-xl border text-left cursor-pointer transition-all relative flex flex-col justify-between ${
                isSelected
                  ? "bg-indigo-950/40 border-indigo-500 shadow-md shadow-indigo-950/50"
                  : "bg-slate-950/80 border-slate-800 hover:border-slate-700 hover:bg-slate-950"
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <span className="font-bold text-xs text-white flex items-center gap-1.5">
                    {isSelected && <Check className="w-3.5 h-3.5 text-indigo-400 shrink-0" />}
                    {preset.name}
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-700/80 text-slate-300 shrink-0 whitespace-nowrap">
                    {preset.badge}
                  </span>
                </div>

                <p className="text-[11px] text-slate-400 leading-relaxed mb-3">
                  {preset.description}
                </p>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-800/60 text-[10px] font-mono text-slate-500">
                <span className="capitalize text-indigo-300/80">
                  Format: {preset.config.imageFormat.toUpperCase()} • {preset.config.audioFormat.toUpperCase()}
                </span>

                {!preset.isDefault && (
                  <button
                    onClick={(e) => handleDeletePreset(e, preset.id)}
                    title="Delete custom preset"
                    className="text-rose-400/80 hover:text-rose-300 p-0.5 rounded hover:bg-rose-950/50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Active Preset Configuration Inspector & One-Click Bulk Runner */}
      {activePreset && (
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/90 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Settings2 className="w-4 h-4 text-purple-400" />
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                  Active Configuration: <span className="text-indigo-400 font-sans normal-case">{activePreset.name}</span>
                </h4>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {activePreset.description}
              </p>
            </div>

            {/* One Click Bulk Process & Export Button */}
            <button
              id="btn-bulk-preset-execute"
              onClick={handleOneClickBulkProcess}
              disabled={selectedItems.length === 0 || isExporting || isProcessingBatch}
              className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-40 text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow-lg shadow-indigo-900/40 transition-all self-start md:self-auto shrink-0"
            >
              {isExporting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Processing & Packaging...</span>
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 fill-white" />
                  <span>Bulk Process & Export ({selectedItems.length} Assets)</span>
                </>
              )}
            </button>
          </div>

          {/* Configuration Specs Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 text-[11px] font-mono bg-slate-900/90 p-3 rounded-lg border border-slate-800/70">
            <div>
              <span className="text-slate-500 block text-[9px] uppercase">Image Format</span>
              <span className="text-white font-bold uppercase">{activePreset.config.imageFormat}</span>
            </div>

            <div>
              <span className="text-slate-500 block text-[9px] uppercase">Quality</span>
              <span className="text-white font-bold">{Math.round(activePreset.config.imageQuality * 100)}%</span>
            </div>

            <div>
              <span className="text-slate-500 block text-[9px] uppercase">Max Dimension</span>
              <span className="text-white font-bold">
                {activePreset.config.maxDimension === 0 ? "Original Size" : `${activePreset.config.maxDimension}px`}
              </span>
            </div>

            <div>
              <span className="text-slate-500 block text-[9px] uppercase">Audio Output</span>
              <span className="text-white font-bold uppercase">
                {activePreset.config.audioFormat === "wav"
                  ? `${activePreset.config.audioBitDepth}-bit WAV`
                  : `${activePreset.config.audioBitrate}k MP3`}
              </span>
            </div>

            <div>
              <span className="text-slate-500 block text-[9px] uppercase">Pipeline</span>
              <span className="text-indigo-400 font-bold capitalize">
                {activePreset.config.pipeline.replace("_", " ")}
              </span>
            </div>

            <div>
              <span className="text-slate-500 block text-[9px] uppercase">Packaging</span>
              <span className="text-emerald-400 font-bold">
                {activePreset.config.packageAsZip ? "Consolidated .ZIP" : "Direct Downloads"}
              </span>
            </div>
          </div>

          {/* Export Progress Bar */}
          {exportProgress && (
            <div className="bg-slate-900 p-3 rounded-lg border border-indigo-900/60 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-indigo-300 font-medium flex items-center gap-1.5">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                  {exportProgress.message}
                </span>
                <span className="font-mono text-indigo-400 font-semibold">
                  {exportProgress.total > 0
                    ? `${Math.round((exportProgress.current / exportProgress.total) * 100)}%`
                    : "0%"}
                </span>
              </div>
              <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-500 rounded-full transition-all duration-300"
                  style={{
                    width: `${exportProgress.total > 0 ? (exportProgress.current / exportProgress.total) * 100 : 50}%`,
                  }}
                />
              </div>
            </div>
          )}

          {/* Export Success Banner */}
          {exportSuccessMessage && (
            <div className="p-3 bg-emerald-950/70 border border-emerald-800 text-emerald-300 text-xs rounded-lg flex items-center justify-between">
              <span className="flex items-center gap-2 font-medium">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                {exportSuccessMessage}
              </span>
              <button
                onClick={() => setExportSuccessMessage(null)}
                className="text-emerald-400 hover:text-white font-mono text-[10px]"
              >
                Dismiss
              </button>
            </div>
          )}
        </div>
      )}

      {/* Save Custom Preset Modal */}
      {isSaveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Bookmark className="w-5 h-5 text-indigo-400" />
                <h3 className="font-bold text-white text-sm">Save Custom Export Preset</h3>
              </div>
              <button
                onClick={() => setIsSaveModalOpen(false)}
                className="text-slate-400 hover:text-white text-xs font-mono"
              >
                Cancel
              </button>
            </div>

            <form onSubmit={handleSaveCustom} className="space-y-4 text-xs">
              <div>
                <label className="text-slate-400 block mb-1 font-medium">Preset Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Client Final 4K WebP"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1 font-medium">Description</label>
                <input
                  type="text"
                  placeholder="e.g., Ultra high-res WebP conversion with EXIF preservation"
                  value={customDesc}
                  onChange={(e) => setCustomDesc(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1 font-medium">Badge / Tag</label>
                <input
                  type="text"
                  placeholder="e.g., WebP • 4K • 95%"
                  value={customBadge}
                  onChange={(e) => setCustomBadge(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Formats and Quality */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1 font-medium">Image Format</label>
                  <select
                    value={customConfig.imageFormat}
                    onChange={(e) =>
                      setCustomConfig({ ...customConfig, imageFormat: e.target.value as any })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="webp">WebP (Optimized)</option>
                    <option value="jpeg">JPEG (Standard)</option>
                    <option value="png">PNG (Lossless)</option>
                    <option value="original">Original Format</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-400 block mb-1 font-medium">
                    Quality ({Math.round(customConfig.imageQuality * 100)}%)
                  </label>
                  <input
                    type="range"
                    min="0.5"
                    max="1.0"
                    step="0.05"
                    value={customConfig.imageQuality}
                    onChange={(e) =>
                      setCustomConfig({
                        ...customConfig,
                        imageQuality: parseFloat(e.target.value),
                      })
                    }
                    className="w-full accent-indigo-500 mt-2"
                  />
                </div>
              </div>

              {/* Dimension and Audio */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1 font-medium">Max Dimension</label>
                  <select
                    value={customConfig.maxDimension}
                    onChange={(e) =>
                      setCustomConfig({
                        ...customConfig,
                        maxDimension: parseInt(e.target.value, 10),
                      })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="0">Original (No limit)</option>
                    <option value="3840">4K Ultra (3840px)</option>
                    <option value="1920">Full HD (1920px)</option>
                    <option value="1080">Social Square/Fit (1080px)</option>
                    <option value="800">Web Thumbnail (800px)</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-400 block mb-1 font-medium">Audio Stem Format</label>
                  <select
                    value={customConfig.audioFormat}
                    onChange={(e) =>
                      setCustomConfig({ ...customConfig, audioFormat: e.target.value as any })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="wav">WAV (Lossless PCM)</option>
                    <option value="mp3">MP3 (Universal 256k)</option>
                  </select>
                </div>
              </div>

              {/* Pipeline Selection */}
              <div>
                <label className="text-slate-400 block mb-1 font-medium">Automated Pipeline</label>
                <select
                  value={customConfig.pipeline}
                  onChange={(e) =>
                    setCustomConfig({ ...customConfig, pipeline: e.target.value as any })
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="none">None (Direct Export)</option>
                  <option value="auto_color">Studio Color Grade & Enhance</option>
                  <option value="ai_inspect">Deep AI Cataloging & OCR</option>
                  <option value="source_lookup">Google Source Lookup & Verification</option>
                  <option value="voice_isolate">Voice Stem Isolation</option>
                  <option value="local_scan">Private Local Mode</option>
                </select>
              </div>

              {/* Checkboxes */}
              <div className="space-y-2 pt-1 border-t border-slate-800">
                <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={customConfig.includeMetadataManifest}
                    onChange={(e) =>
                      setCustomConfig({
                        ...customConfig,
                        includeMetadataManifest: e.target.checked,
                      })
                    }
                    className="accent-indigo-500 rounded"
                  />
                  <span>Generate structured JSON metadata manifest</span>
                </label>

                <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={customConfig.stripExifPrivacy}
                    onChange={(e) =>
                      setCustomConfig({
                        ...customConfig,
                        stripExifPrivacy: e.target.checked,
                      })
                    }
                    className="accent-indigo-500 rounded"
                  />
                  <span>Sanitize & strip EXIF GPS location for privacy</span>
                </label>

                <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={customConfig.packageAsZip}
                    onChange={(e) =>
                      setCustomConfig({
                        ...customConfig,
                        packageAsZip: e.target.checked,
                      })
                    }
                    className="accent-indigo-500 rounded"
                  />
                  <span>Bundle everything into a single downloadable .ZIP archive</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsSaveModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>Save Preset</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
