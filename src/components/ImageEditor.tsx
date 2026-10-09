import React, { useState, useRef, useEffect } from "react";
import {
  Crop,
  RotateCw,
  RotateCcw,
  FlipHorizontal,
  FlipVertical,
  Sliders,
  Sparkles,
  Undo,
  Redo,
  RotateCcw as ResetIcon,
  Download,
  Save,
  Check,
  SplitSquareVertical,
  Sun,
  Contrast,
  Droplet,
  Flame,
} from "lucide-react";
import { MediaItem, ColorCorrectionSettings } from "../types";

interface ImageEditorProps {
  media: MediaItem;
  onUpdateMedia: (updated: MediaItem) => void;
  onBackToLibrary: () => void;
}

const DEFAULT_SETTINGS: ColorCorrectionSettings = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  exposure: 0,
  warmth: 0,
  vignette: 0,
  sharpen: 0,
  sepia: 0,
  grayscale: 0,
  invert: 0,
  blur: 0,
  rotation: 0,
  flipH: false,
  flipV: false,
};

export const ImageEditor: React.FC<ImageEditorProps> = ({
  media,
  onUpdateMedia,
  onBackToLibrary,
}) => {
  const [settings, setSettings] = useState<ColorCorrectionSettings>(
    media.editSettings || DEFAULT_SETTINGS
  );

  // History stack for Undo / Redo
  const [history, setHistory] = useState<ColorCorrectionSettings[]>([
    media.editSettings || DEFAULT_SETTINGS,
  ]);
  const [historyIndex, setHistoryIndex] = useState(0);

  // Before/After comparison slider
  const [showComparison, setShowComparison] = useState(false);
  const [splitPos, setSplitPos] = useState(50); // percentage 0-100
  const [activeTab, setActiveTab] = useState<"adjust" | "crop" | "presets">("adjust");

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [isSaved, setIsSaved] = useState(false);

  // Load image element
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = media.url;
    img.onload = () => {
      imgRef.current = img;
      renderCanvas();
    };
  }, [media.url]);

  // Push new settings to history
  const updateSettings = (newSettings: Partial<ColorCorrectionSettings>) => {
    const updated = { ...settings, ...newSettings };
    setSettings(updated);

    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(updated);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      const prev = history[historyIndex - 1];
      setSettings(prev);
      setHistoryIndex(historyIndex - 1);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const next = history[historyIndex + 1];
      setSettings(next);
      setHistoryIndex(historyIndex + 1);
    }
  };

  const handleReset = () => {
    updateSettings(DEFAULT_SETTINGS);
  };

  // Render to canvas with CSS filters and 2D canvas transforms
  const renderCanvas = () => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = img.naturalWidth || 800;
    const h = img.naturalHeight || 600;

    canvas.width = w;
    canvas.height = h;

    ctx.save();
    ctx.clearRect(0, 0, w, h);

    // Apply rotation and flip
    ctx.translate(w / 2, h / 2);
    ctx.rotate((settings.rotation * Math.PI) / 180);
    ctx.scale(settings.flipH ? -1 : 1, settings.flipV ? -1 : 1);
    ctx.translate(-w / 2, -h / 2);

    // Build CSS filter string
    const brightnessPct = 100 + settings.brightness + settings.exposure;
    const contrastPct = 100 + settings.contrast;
    const saturatePct = 100 + settings.saturation;
    const sepiaPct = settings.sepia;
    const grayPct = settings.grayscale;
    const invertPct = settings.invert;
    const blurPx = settings.blur;

    ctx.filter = `brightness(${brightnessPct}%) contrast(${contrastPct}%) saturate(${saturatePct}%) sepia(${sepiaPct}%) grayscale(${grayPct}%) invert(${invertPct}%) blur(${blurPx}px)`;

    ctx.drawImage(img, 0, 0, w, h);

    // Vignette filter effect
    if (settings.vignette > 0) {
      ctx.restore();
      ctx.save();
      const gradient = ctx.createRadialGradient(
        w / 2,
        h / 2,
        Math.min(w, h) * 0.3,
        w / 2,
        h / 2,
        Math.max(w, h) * 0.7
      );
      const alpha = (settings.vignette / 100) * 0.85;
      gradient.addColorStop(0, "rgba(0,0,0,0)");
      gradient.addColorStop(1, `rgba(0,0,0,${alpha})`);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, w, h);
    }

    // Warmth filter overlay
    if (settings.warmth !== 0) {
      ctx.restore();
      ctx.save();
      if (settings.warmth > 0) {
        // Amber/Golden warmth
        ctx.fillStyle = `rgba(245, 158, 11, ${(settings.warmth / 100) * 0.25})`;
      } else {
        // Cool blue
        ctx.fillStyle = `rgba(59, 130, 246, ${(-settings.warmth / 100) * 0.25})`;
      }
      ctx.globalCompositeOperation = "color";
      ctx.fillRect(0, 0, w, h);
    }

    ctx.restore();
  };

  useEffect(() => {
    renderCanvas();
  }, [settings]);

  // Preset Filters
  const applyPreset = (presetName: string) => {
    switch (presetName) {
      case "vibrant":
        updateSettings({
          brightness: 6,
          contrast: 15,
          saturation: 28,
          warmth: 8,
          vignette: 10,
          sepia: 0,
          grayscale: 0,
        });
        break;
      case "cinema":
        updateSettings({
          brightness: 2,
          contrast: 20,
          saturation: 10,
          warmth: 25,
          vignette: 30,
          sepia: 0,
          grayscale: 0,
        });
        break;
      case "noir":
        updateSettings({
          brightness: -5,
          contrast: 35,
          saturation: -100,
          grayscale: 100,
          vignette: 40,
          sepia: 0,
        });
        break;
      case "golden":
        updateSettings({
          brightness: 8,
          contrast: 10,
          saturation: 18,
          warmth: 40,
          vignette: 15,
          sepia: 12,
        });
        break;
      case "doc_crisp":
        updateSettings({
          brightness: 12,
          contrast: 45,
          saturation: -100,
          grayscale: 100,
          sharpen: 30,
        });
        break;
      default:
        updateSettings(DEFAULT_SETTINGS);
        break;
    }
  };

  // Save changes to library
  const handleSaveChanges = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const updatedUrl = canvas.toDataURL("image/jpeg", 0.95);
    onUpdateMedia({
      ...media,
      url: updatedUrl,
      editSettings: settings,
      updatedAt: Date.now(),
    });

    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  // Export / Download rendered image
  const handleDownload = (format: "jpeg" | "png") => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const mime = format === "png" ? "image/png" : "image/jpeg";
    const dataUrl = canvas.toDataURL(mime, 0.95);
    const link = document.createElement("a");
    link.download = `edited_${media.name.replace(/\.[^/.]+$/, "")}.${format}`;
    link.href = dataUrl;
    link.click();
  };

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-60px)] overflow-hidden bg-slate-950 text-slate-200">
      {/* Main Canvas Viewport */}
      <div className="flex-1 flex flex-col bg-slate-950 border-r border-slate-800 overflow-hidden relative">
        {/* Top Control Bar */}
        <div className="p-3 border-b border-slate-800 bg-slate-900/60 flex items-center justify-between text-xs">
          <div className="flex items-center gap-3">
            <button
              onClick={onBackToLibrary}
              className="text-slate-400 hover:text-white transition-colors"
            >
              ← Back
            </button>
            <span className="font-semibold text-white">{media.name}</span>
          </div>

          <div className="flex items-center gap-2">
            {/* Undo / Redo */}
            <button
              onClick={handleUndo}
              disabled={historyIndex <= 0}
              className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 transition-colors"
              title="Undo (Ctrl+Z)"
            >
              <Undo className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleRedo}
              disabled={historyIndex >= history.length - 1}
              className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 transition-colors"
              title="Redo (Ctrl+Y)"
            >
              <Redo className="w-3.5 h-3.5" />
            </button>

            {/* Reset */}
            <button
              onClick={handleReset}
              className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-slate-300 px-2.5 py-1 rounded transition-colors text-xs"
              title="Reset all adjustments"
            >
              <ResetIcon className="w-3 h-3" />
              <span>Reset</span>
            </button>

            {/* Before / After comparison toggle */}
            <button
              onClick={() => setShowComparison(!showComparison)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs transition-colors border ${
                showComparison
                  ? "bg-indigo-600/30 text-indigo-300 border-indigo-500/40"
                  : "bg-slate-800 text-slate-400 border-slate-700"
              }`}
              title="Toggle Before / After Split View"
            >
              <SplitSquareVertical className="w-3.5 h-3.5" />
              <span>Compare</span>
            </button>

            {/* Export & Save */}
            <button
              onClick={() => handleDownload("jpeg")}
              className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1 rounded-lg text-xs font-medium border border-slate-700 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export</span>
            </button>

            <button
              id="btn-save-image-edits"
              onClick={handleSaveChanges}
              className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white px-3.5 py-1 rounded-lg text-xs font-medium transition-colors shadow-sm"
            >
              {isSaved ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Save className="w-3.5 h-3.5" />}
              <span>{isSaved ? "Saved!" : "Save Changes"}</span>
            </button>
          </div>
        </div>

        {/* Viewport Canvas Stage */}
        <div className="flex-1 flex items-center justify-center p-6 overflow-hidden bg-gradient-to-b from-slate-950 to-slate-900/50 relative select-none">
          <div className="relative max-h-[72vh] max-w-full flex items-center justify-center shadow-2xl rounded-lg overflow-hidden border border-slate-800">
            {/* The live rendering Canvas */}
            <canvas ref={canvasRef} className="max-h-[72vh] max-w-full object-contain block" />

            {/* Split-screen Before / After slider */}
            {showComparison && (
              <div
                className="absolute inset-0 overflow-hidden pointer-events-none border-r-2 border-indigo-400"
                style={{ width: `${splitPos}%` }}
              >
                <img
                  src={media.url}
                  alt="Original"
                  className="max-h-[72vh] max-w-none object-contain h-full"
                />
                <span className="absolute top-3 left-3 bg-slate-950/80 text-white text-[10px] uppercase font-mono px-2 py-0.5 rounded border border-slate-700">
                  Original (Before)
                </span>
              </div>
            )}
          </div>

          {/* Slider control when comparison is active */}
          {showComparison && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-slate-900/90 border border-slate-800 rounded-full px-4 py-2 flex items-center gap-3 text-xs shadow-xl backdrop-blur">
              <span className="text-slate-400 text-[11px]">Before</span>
              <input
                type="range"
                min="0"
                max="100"
                value={splitPos}
                onChange={(e) => setSplitPos(Number(e.target.value))}
                className="w-36 accent-indigo-500 cursor-ew-resize"
              />
              <span className="text-indigo-400 text-[11px]">After</span>
            </div>
          )}
        </div>
      </div>

      {/* Right Sidebar: Adjustments, Crop & Transform, Preset Filters */}
      <div className="w-full lg:w-80 bg-slate-900/90 border-l border-slate-800 flex flex-col shrink-0 overflow-hidden">
        {/* Sidebar Nav */}
        <div className="flex border-b border-slate-800 text-xs bg-slate-950/60 p-1">
          <button
            onClick={() => setActiveTab("adjust")}
            className={`flex-1 py-1.5 rounded-md font-medium transition-colors ${
              activeTab === "adjust" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"
            }`}
          >
            Adjust
          </button>
          <button
            onClick={() => setActiveTab("crop")}
            className={`flex-1 py-1.5 rounded-md font-medium transition-colors ${
              activeTab === "crop" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"
            }`}
          >
            Transform
          </button>
          <button
            onClick={() => setActiveTab("presets")}
            className={`flex-1 py-1.5 rounded-md font-medium transition-colors ${
              activeTab === "presets" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"
            }`}
          >
            Presets
          </button>
        </div>

        {/* Tab Contents */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5 text-xs">
          {activeTab === "adjust" && (
            <div className="space-y-4">
              {/* Brightness */}
              <div>
                <div className="flex justify-between text-slate-300 mb-1">
                  <span className="flex items-center gap-1.5">
                    <Sun className="w-3.5 h-3.5 text-amber-400" /> Brightness
                  </span>
                  <span className="font-mono text-slate-400">{settings.brightness}</span>
                </div>
                <input
                  type="range"
                  min="-100"
                  max="100"
                  value={settings.brightness}
                  onChange={(e) => updateSettings({ brightness: Number(e.target.value) })}
                  className="w-full accent-indigo-500"
                />
              </div>

              {/* Contrast */}
              <div>
                <div className="flex justify-between text-slate-300 mb-1">
                  <span className="flex items-center gap-1.5">
                    <Contrast className="w-3.5 h-3.5 text-indigo-400" /> Contrast
                  </span>
                  <span className="font-mono text-slate-400">{settings.contrast}</span>
                </div>
                <input
                  type="range"
                  min="-100"
                  max="100"
                  value={settings.contrast}
                  onChange={(e) => updateSettings({ contrast: Number(e.target.value) })}
                  className="w-full accent-indigo-500"
                />
              </div>

              {/* Saturation */}
              <div>
                <div className="flex justify-between text-slate-300 mb-1">
                  <span className="flex items-center gap-1.5">
                    <Droplet className="w-3.5 h-3.5 text-sky-400" /> Saturation
                  </span>
                  <span className="font-mono text-slate-400">{settings.saturation}</span>
                </div>
                <input
                  type="range"
                  min="-100"
                  max="100"
                  value={settings.saturation}
                  onChange={(e) => updateSettings({ saturation: Number(e.target.value) })}
                  className="w-full accent-indigo-500"
                />
              </div>

              {/* Exposure */}
              <div>
                <div className="flex justify-between text-slate-300 mb-1">
                  <span>Exposure</span>
                  <span className="font-mono text-slate-400">{settings.exposure}</span>
                </div>
                <input
                  type="range"
                  min="-100"
                  max="100"
                  value={settings.exposure}
                  onChange={(e) => updateSettings({ exposure: Number(e.target.value) })}
                  className="w-full accent-indigo-500"
                />
              </div>

              {/* Warmth / White Balance */}
              <div>
                <div className="flex justify-between text-slate-300 mb-1">
                  <span className="flex items-center gap-1.5">
                    <Flame className="w-3.5 h-3.5 text-amber-500" /> Temperature
                  </span>
                  <span className="font-mono text-slate-400">{settings.warmth}</span>
                </div>
                <input
                  type="range"
                  min="-100"
                  max="100"
                  value={settings.warmth}
                  onChange={(e) => updateSettings({ warmth: Number(e.target.value) })}
                  className="w-full accent-amber-500"
                />
              </div>

              {/* Vignette */}
              <div>
                <div className="flex justify-between text-slate-300 mb-1">
                  <span>Vignette Edge Falloff</span>
                  <span className="font-mono text-slate-400">{settings.vignette}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={settings.vignette}
                  onChange={(e) => updateSettings({ vignette: Number(e.target.value) })}
                  className="w-full accent-indigo-500"
                />
              </div>

              {/* Sepia */}
              <div>
                <div className="flex justify-between text-slate-300 mb-1">
                  <span>Sepia Tone</span>
                  <span className="font-mono text-slate-400">{settings.sepia}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={settings.sepia}
                  onChange={(e) => updateSettings({ sepia: Number(e.target.value) })}
                  className="w-full accent-amber-600"
                />
              </div>

              {/* Grayscale */}
              <div>
                <div className="flex justify-between text-slate-300 mb-1">
                  <span>Grayscale (B&W)</span>
                  <span className="font-mono text-slate-400">{settings.grayscale}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={settings.grayscale}
                  onChange={(e) => updateSettings({ grayscale: Number(e.target.value) })}
                  className="w-full accent-slate-400"
                />
              </div>

              {/* Blur */}
              <div>
                <div className="flex justify-between text-slate-300 mb-1">
                  <span>Soft Focus / Blur</span>
                  <span className="font-mono text-slate-400">{settings.blur}px</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="20"
                  value={settings.blur}
                  onChange={(e) => updateSettings({ blur: Number(e.target.value) })}
                  className="w-full accent-indigo-500"
                />
              </div>
            </div>
          )}

          {activeTab === "crop" && (
            <div className="space-y-4">
              <div>
                <span className="text-slate-400 uppercase tracking-wider font-semibold text-[10px] block mb-2">
                  Rotate & Straighten
                </span>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <button
                    onClick={() => updateSettings({ rotation: (settings.rotation - 90 + 360) % 360 })}
                    className="flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-700 py-2 rounded-lg text-slate-200 transition-colors"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>-90°</span>
                  </button>

                  <button
                    onClick={() => updateSettings({ rotation: (settings.rotation + 90) % 360 })}
                    className="flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-700 py-2 rounded-lg text-slate-200 transition-colors"
                  >
                    <RotateCw className="w-4 h-4" />
                    <span>+90°</span>
                  </button>
                </div>

                <div className="mb-4">
                  <div className="flex justify-between text-slate-300 mb-1">
                    <span>Fine Angle Straighten</span>
                    <span className="font-mono text-slate-400">{settings.rotation}°</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="360"
                    value={settings.rotation}
                    onChange={(e) => updateSettings({ rotation: Number(e.target.value) })}
                    className="w-full accent-indigo-500"
                  />
                </div>
              </div>

              <div>
                <span className="text-slate-400 uppercase tracking-wider font-semibold text-[10px] block mb-2">
                  Flip & Mirror
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => updateSettings({ flipH: !settings.flipH })}
                    className={`flex items-center justify-center gap-1.5 py-2 rounded-lg transition-colors border ${
                      settings.flipH
                        ? "bg-indigo-600 text-white border-indigo-500"
                        : "bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700"
                    }`}
                  >
                    <FlipHorizontal className="w-4 h-4" />
                    <span>Flip H</span>
                  </button>

                  <button
                    onClick={() => updateSettings({ flipV: !settings.flipV })}
                    className={`flex items-center justify-center gap-1.5 py-2 rounded-lg transition-colors border ${
                      settings.flipV
                        ? "bg-indigo-600 text-white border-indigo-500"
                        : "bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700"
                    }`}
                  >
                    <FlipVertical className="w-4 h-4" />
                    <span>Flip V</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === "presets" && (
            <div className="space-y-2">
              <span className="text-slate-400 uppercase tracking-wider font-semibold text-[10px] block mb-2">
                Color Grading Presets
              </span>

              <button
                onClick={() => applyPreset("original")}
                className="w-full text-left p-2.5 rounded-lg bg-slate-800/80 hover:bg-slate-800 text-slate-200 font-medium transition-colors border border-slate-700"
              >
                Natural Original
              </button>

              <button
                onClick={() => applyPreset("vibrant")}
                className="w-full text-left p-2.5 rounded-lg bg-slate-800/80 hover:bg-slate-800 text-slate-200 font-medium transition-colors border border-slate-700 flex items-center justify-between"
              >
                <span>Vibrant Punch</span>
                <span className="text-[10px] text-sky-400 font-mono">+Saturation & Contrast</span>
              </button>

              <button
                onClick={() => applyPreset("cinema")}
                className="w-full text-left p-2.5 rounded-lg bg-slate-800/80 hover:bg-slate-800 text-slate-200 font-medium transition-colors border border-slate-700 flex items-center justify-between"
              >
                <span>Cinematic Teal / Orange</span>
                <span className="text-[10px] text-amber-400 font-mono">Warmth & Vignette</span>
              </button>

              <button
                onClick={() => applyPreset("golden")}
                className="w-full text-left p-2.5 rounded-lg bg-slate-800/80 hover:bg-slate-800 text-slate-200 font-medium transition-colors border border-slate-700 flex items-center justify-between"
              >
                <span>Golden Hour Glow</span>
                <span className="text-[10px] text-amber-500 font-mono">+Amber Warmth</span>
              </button>

              <button
                onClick={() => applyPreset("noir")}
                className="w-full text-left p-2.5 rounded-lg bg-slate-800/80 hover:bg-slate-800 text-slate-200 font-medium transition-colors border border-slate-700 flex items-center justify-between"
              >
                <span>Dramatic Noir</span>
                <span className="text-[10px] text-slate-400 font-mono">Monochrome High-B&W</span>
              </button>

              <button
                onClick={() => applyPreset("doc_crisp")}
                className="w-full text-left p-2.5 rounded-lg bg-slate-800/80 hover:bg-slate-800 text-slate-200 font-medium transition-colors border border-slate-700 flex items-center justify-between"
              >
                <span>High-Contrast Document Scan</span>
                <span className="text-[10px] text-indigo-400 font-mono">Clean OCR</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
