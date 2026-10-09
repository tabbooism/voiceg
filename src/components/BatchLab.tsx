import React, { useState } from "react";
import {
  Cpu,
  Play,
  CheckCircle,
  AlertCircle,
  Sparkles,
  Mic,
  ShieldCheck,
  Sliders,
  CheckSquare,
  Square,
  RefreshCw,
  FolderOpen,
  Globe,
  Bookmark,
} from "lucide-react";
import { MediaItem, BatchJob } from "../types";
import { processImageLocally } from "../lib/localAnalysis";
import { isolateVocalStems, createSyntheticAudioBuffer, decodeAudioBuffer, getAudioContext } from "../lib/audioIsolation";
import { BatchPresetsPanel } from "./BatchPresetsPanel";

interface BatchLabProps {
  media: MediaItem[];
  onUpdateMediaItem: (item: MediaItem) => void;
  localMode: boolean;
}

export const BatchLab: React.FC<BatchLabProps> = ({
  media,
  onUpdateMediaItem,
  localMode,
}) => {
  const [selectedIds, setSelectedIds] = useState<string[]>(media.map((m) => m.id));
  const [selectedPipeline, setSelectedPipeline] = useState<
    "ai_inspect" | "source_lookup" | "voice_isolate" | "local_scan" | "auto_color"
  >("ai_inspect");
  const [jobs, setJobs] = useState<BatchJob[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const toggleSelectAll = () => {
    if (selectedIds.length === media.length) setSelectedIds([]);
    else setSelectedIds(media.map((m) => m.id));
  };

  const toggleItem = (id: string) => {
    if (selectedIds.includes(id)) setSelectedIds(selectedIds.filter((x) => x !== id));
    else setSelectedIds([...selectedIds, id]);
  };

  // Run the batch pipeline with optional override from presets
  const handleStartBatch = async (
    pipelineOverride?: "ai_inspect" | "source_lookup" | "voice_isolate" | "local_scan" | "auto_color"
  ) => {
    const pipelineToRun = pipelineOverride || selectedPipeline;
    if (selectedIds.length === 0 || isRunning) return;

    setIsRunning(true);
    const initialJobs: BatchJob[] = selectedIds.map((id) => {
      const item = media.find((m) => m.id === id);
      return {
        id: `job_${id}`,
        mediaId: id,
        mediaName: item?.name || "Asset",
        status: "queued",
        progress: 0,
      };
    });

    setJobs(initialJobs);

    for (let i = 0; i < initialJobs.length; i++) {
      const job = initialJobs[i];
      const item = media.find((m) => m.id === job.mediaId);
      if (!item) continue;

      // Update job to processing
      setJobs((prev) =>
        prev.map((j) =>
          j.id === job.id
            ? { ...j, status: "processing", progress: 20, currentStep: `Executing ${pipelineToRun}...` }
            : j
        )
      );

      try {
        if (pipelineToRun === "ai_inspect") {
          // Cloud Gemini or Local
          if (localMode || item.type !== "image") {
            // Local mode fallback
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.src = item.url;
            await new Promise((r) => (img.onload = r));
            const localResult = await processImageLocally(img);
            onUpdateMediaItem({ ...item, ...localResult, updatedAt: Date.now() });
          } else {
            const res = await fetch("/api/gemini/analyze-image", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ imageBase64: item.url, mimeType: item.mimeType }),
            });
            if (res.ok) {
              const data = await res.json();
              onUpdateMediaItem({
                ...item,
                category: data.category || item.category,
                summary: data.summary || item.summary,
                altText: data.altText || item.altText,
                tags: Array.from(new Set([...item.tags, ...(data.tags || [])])),
                ocrText: data.ocrText,
                detectedObjects: data.detectedObjects,
                detectedFaces: data.detectedFaces,
                dominantColors: data.dominantColors,
                updatedAt: Date.now(),
              });
            }
          }
        } else if (pipelineToRun === "source_lookup") {
          // Multimodal Google Image Lookup & Verification
          if (item.type === "image" && !localMode) {
            const res = await fetch("/api/gemini/source-lookup", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                imageBase64: item.url,
                mimeType: item.mimeType,
                fileName: item.name,
                ocrSnippet: item.ocrText,
                currentTags: item.tags,
              }),
            });
            if (res.ok) {
              const data = await res.json();
              const newTags = Array.from(
                new Set([...item.tags, ...(data.suggestedTags || []), "verified-source"])
              );
              onUpdateMediaItem({
                ...item,
                sourceLookup: data,
                tags: newTags,
                updatedAt: Date.now(),
              });
            }
          }
        } else if (pipelineToRun === "voice_isolate") {
          const ctx = getAudioContext();
          let buf: AudioBuffer;
          if (item.url.startsWith("data:image/svg+xml")) {
            buf = createSyntheticAudioBuffer(ctx, 6);
          } else {
            const r = await fetch(item.url);
            const ab = await r.arrayBuffer();
            buf = await decodeAudioBuffer(ab);
          }
          const result = await isolateVocalStems(buf);
          onUpdateMediaItem({ ...item, voiceIsolation: result, updatedAt: Date.now() });
        } else if (pipelineToRun === "local_scan") {
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.src = item.url;
          await new Promise((r) => (img.onload = r));
          const localResult = await processImageLocally(img);
          onUpdateMediaItem({ ...item, ...localResult, updatedAt: Date.now() });
        } else if (pipelineToRun === "auto_color") {
          onUpdateMediaItem({
            ...item,
            editSettings: {
              brightness: 4,
              contrast: 15,
              saturation: 18,
              exposure: 0,
              warmth: 10,
              vignette: 15,
              sharpen: 12,
              sepia: 0,
              grayscale: 0,
              invert: 0,
              blur: 0,
              rotation: 0,
              flipH: false,
              flipV: false,
            },
            tags: Array.from(new Set([...item.tags, "batch-auto-color"])),
            updatedAt: Date.now(),
          });
        }

        // Mark completed
        setJobs((prev) =>
          prev.map((j) =>
            j.id === job.id ? { ...j, status: "completed", progress: 100 } : j
          )
        );
      } catch (err: any) {
        setJobs((prev) =>
          prev.map((j) =>
            j.id === job.id
              ? { ...j, status: "failed", error: err.message || "Failed" }
              : j
          )
        );
      }
    }

    setIsRunning(false);
  };

  const completedCount = jobs.filter((j) => j.status === "completed").length;

  return (
    <div className="h-[calc(100vh-60px)] overflow-y-auto bg-slate-950 p-6 text-slate-200">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Cpu className="w-6 h-6 text-indigo-400" />
              <h2 className="text-xl font-bold text-white">Batch Processing Laboratory</h2>
            </div>
            <p className="text-xs text-slate-400">
              Execute high-throughput ML pipelines, voice stem extractions, and color gradings across entire media collections.
            </p>
          </div>

          <button
            id="btn-start-batch-run"
            onClick={() => handleStartBatch()}
            disabled={selectedIds.length === 0 || isRunning}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white px-5 py-2.5 rounded-xl text-xs font-semibold shadow-lg shadow-indigo-600/20 transition-all self-start md:self-auto"
          >
            <Play className="w-4 h-4 fill-white" />
            <span>{isRunning ? "Running Batch Pipeline..." : `Run Pipeline (${selectedIds.length} Assets)`}</span>
          </button>
        </div>

        {/* Presets & Bulk Export Configuration Panel */}
        <BatchPresetsPanel
          selectedItems={media.filter((m) => selectedIds.includes(m.id))}
          onSelectPipeline={setSelectedPipeline}
          activePipeline={selectedPipeline}
          onExecutePipeline={handleStartBatch}
          isProcessingBatch={isRunning}
        />

        {/* Pipeline Selection Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          <button
            onClick={() => setSelectedPipeline("ai_inspect")}
            className={`p-3.5 rounded-xl border text-left transition-all ${
              selectedPipeline === "ai_inspect"
                ? "bg-indigo-950/60 border-indigo-500 text-white"
                : "bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700"
            }`}
          >
            <Sparkles className="w-5 h-5 text-indigo-400 mb-2" />
            <h4 className="text-xs font-bold text-white mb-1">Deep AI Cataloging</h4>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Full OCR text extraction, object detection, and alt-text tags.
            </p>
          </button>

          <button
            onClick={() => setSelectedPipeline("source_lookup")}
            className={`p-3.5 rounded-xl border text-left transition-all ${
              selectedPipeline === "source_lookup"
                ? "bg-amber-950/60 border-amber-500 text-white"
                : "bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700"
            }`}
          >
            <Globe className="w-5 h-5 text-amber-400 mb-2" />
            <h4 className="text-xs font-bold text-white mb-1">Google Source Lookup</h4>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Multimodal reverse verification to discover origin and licenses.
            </p>
          </button>

          <button
            onClick={() => setSelectedPipeline("voice_isolate")}
            className={`p-3.5 rounded-xl border text-left transition-all ${
              selectedPipeline === "voice_isolate"
                ? "bg-purple-950/60 border-purple-500 text-white"
                : "bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700"
            }`}
          >
            <Mic className="w-5 h-5 text-purple-400 mb-2" />
            <h4 className="text-xs font-bold text-white mb-1">Batch Voice Isolation</h4>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Deconstruct multi-channel audio and extract 24-bit vocal stems.
            </p>
          </button>

          <button
            onClick={() => setSelectedPipeline("local_scan")}
            className={`p-3.5 rounded-xl border text-left transition-all ${
              selectedPipeline === "local_scan"
                ? "bg-emerald-950/60 border-emerald-500 text-white"
                : "bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700"
            }`}
          >
            <ShieldCheck className="w-5 h-5 text-emerald-400 mb-2" />
            <h4 className="text-xs font-bold text-white mb-1">Private Local Mode</h4>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              100% on-device browser canvas inspection with zero cloud transfers.
            </p>
          </button>

          <button
            onClick={() => setSelectedPipeline("auto_color")}
            className={`p-3.5 rounded-xl border text-left transition-all ${
              selectedPipeline === "auto_color"
                ? "bg-pink-950/60 border-pink-500 text-white"
                : "bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700"
            }`}
          >
            <Sliders className="w-5 h-5 text-pink-400 mb-2" />
            <h4 className="text-xs font-bold text-white mb-1">Studio Color Grade</h4>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Apply balanced exposure, contrast enhancement, and warm tint.
            </p>
          </button>
        </div>

        {/* Progress Overview Bar if batch running or completed */}
        {jobs.length > 0 && (
          <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="font-semibold text-white">
                Queue Progress: {completedCount} / {jobs.length} Completed
              </span>
              <span className="font-mono text-indigo-400">
                {Math.round((completedCount / jobs.length) * 100)}%
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-slate-950 overflow-hidden">
              <div
                className="h-full bg-indigo-500 rounded-full transition-all duration-300"
                style={{ width: `${(completedCount / jobs.length) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Item Selection Table */}
        <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
          <div className="p-3.5 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between text-xs">
            <div className="flex items-center gap-3">
              <button
                onClick={toggleSelectAll}
                className="flex items-center gap-1.5 font-medium text-slate-300 hover:text-white"
              >
                {selectedIds.length === media.length ? (
                  <CheckSquare className="w-4 h-4 text-indigo-400" />
                ) : (
                  <Square className="w-4 h-4" />
                )}
                <span>Select All ({media.length} items)</span>
              </button>
            </div>

            <span className="text-slate-400">
              {selectedIds.length} assets targeted for processing
            </span>
          </div>

          <div className="divide-y divide-slate-800/80 max-h-96 overflow-y-auto">
            {media.map((item) => {
              const isSelected = selectedIds.includes(item.id);
              const job = jobs.find((j) => j.mediaId === item.id);

              return (
                <div
                  key={item.id}
                  onClick={() => toggleItem(item.id)}
                  className={`p-3 flex items-center justify-between gap-3 text-xs cursor-pointer hover:bg-slate-800/50 transition-colors ${
                    isSelected ? "bg-indigo-950/20" : ""
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleItem(item.id);
                      }}
                      className="text-slate-400"
                    >
                      {isSelected ? (
                        <CheckSquare className="w-4 h-4 text-indigo-400" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>

                    <div className="w-9 h-9 rounded bg-slate-950 overflow-hidden shrink-0 flex items-center justify-center border border-slate-800">
                      {item.type === "image" ? (
                        <img src={item.url} alt="" className="w-full h-full object-cover" />
                      ) : item.type === "video" ? (
                        <FolderOpen className="w-4 h-4 text-indigo-400" />
                      ) : (
                        <Mic className="w-4 h-4 text-purple-400" />
                      )}
                    </div>

                    <div className="min-w-0">
                      <span className="font-semibold text-white block truncate">{item.name}</span>
                      <span className="text-[11px] text-slate-400 font-mono">
                        {item.category || item.type} • {Math.round(item.size / 1024)} KB
                      </span>
                    </div>
                  </div>

                  {/* Job Status Indicator */}
                  <div>
                    {job ? (
                      job.status === "completed" ? (
                        <span className="flex items-center gap-1 text-emerald-400 font-medium text-[11px]">
                          <CheckCircle className="w-3.5 h-3.5" /> Done
                        </span>
                      ) : job.status === "processing" ? (
                        <span className="flex items-center gap-1 text-indigo-400 font-medium text-[11px]">
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Processing...
                        </span>
                      ) : job.status === "failed" ? (
                        <span className="flex items-center gap-1 text-rose-400 font-medium text-[11px]">
                          <AlertCircle className="w-3.5 h-3.5" /> Failed
                        </span>
                      ) : (
                        <span className="text-slate-500 text-[11px]">Queued</span>
                      )
                    ) : (
                      <span className="text-slate-500 text-[11px]">Ready</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
