import React, { useState, useEffect, useRef } from "react";
import {
  Video,
  Film,
  Sparkles,
  Upload,
  Play,
  Pause,
  Download,
  PlusCircle,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Sliders,
  Image as ImageIcon,
  Layers,
  Clock,
  Maximize2,
} from "lucide-react";
import { MediaItem } from "../types";

interface VeoVideoStudioProps {
  onAddMediaItem: (item: MediaItem) => void;
  availableMedia?: MediaItem[];
}

export const VeoVideoStudio: React.FC<VeoVideoStudioProps> = ({
  onAddMediaItem,
  availableMedia = [],
}) => {
  // Mode: Text-to-Video or Image-to-Video (Animate Photo)
  const [mode, setMode] = useState<"text" | "image">("text");

  // Prompts & Settings
  const [prompt, setPrompt] = useState<string>(
    "A cinematic aerial drone shot gliding over misty pine forests at sunrise, golden sunlight filtering through towering trees, 4K documentary style"
  );
  const [aspectRatio, setAspectRatio] = useState<"16:9" | "9:16">("16:9");
  const [resolution, setResolution] = useState<"720p" | "1080p">("720p");

  // Image input for Image-to-Video Animation
  const [selectedImageBase64, setSelectedImageBase64] = useState<string | null>(null);
  const [selectedImageMime, setSelectedImageMime] = useState<string>("image/jpeg");
  const [imageSourceTitle, setImageSourceTitle] = useState<string | null>(null);

  // Generation state
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [operationName, setOperationName] = useState<string | null>(null);
  const [generationStage, setGenerationStage] = useState<string>("");
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Result Video
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);
  const [generatedVideoBlob, setGeneratedVideoBlob] = useState<Blob | null>(null);
  const [recentVideos, setRecentVideos] = useState<
    Array<{
      id: string;
      url: string;
      prompt: string;
      aspectRatio: string;
      createdAt: number;
    }>
  >([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollTimerRef = useRef<any>(null);
  const elapsedTimerRef = useRef<any>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
    };
  }, []);

  // Handle uploading photo for Image-to-Video
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImageSourceTitle(file.name);
    setSelectedImageMime(file.type || "image/jpeg");

    const reader = new FileReader();
    reader.onload = () => {
      setSelectedImageBase64(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Select an existing image from Library
  const handleSelectLibraryImage = (item: MediaItem) => {
    setImageSourceTitle(item.name);
    setSelectedImageMime(item.mimeType || "image/jpeg");
    setSelectedImageBase64(item.url);
  };

  // Preset style helpers
  const handleApplyPreset = (presetText: string) => {
    setPrompt(presetText);
  };

  // Start Generation
  const handleStartGeneration = async () => {
    if (mode === "text" && !prompt.trim()) {
      setErrorMsg("Please enter a descriptive video prompt.");
      return;
    }
    if (mode === "image" && !selectedImageBase64) {
      setErrorMsg("Please upload or select an image to animate.");
      return;
    }

    setErrorMsg(null);
    setIsGenerating(true);
    setGeneratedVideoUrl(null);
    setElapsedSeconds(0);
    setGenerationStage("Initializing Veo 3 engine (veo-3.1-fast-generate-preview)...");

    // Start elapsed counter
    elapsedTimerRef.current = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);

    try {
      let imageBase64Payload = selectedImageBase64;
      // If image is a blob URL from library, convert to base64
      if (mode === "image" && selectedImageBase64 && selectedImageBase64.startsWith("blob:")) {
        const resp = await fetch(selectedImageBase64);
        const blob = await resp.blob();
        const reader = new FileReader();
        const b64Promise = new Promise<string>((resolve) => {
          reader.onloadend = () => resolve(reader.result as string);
        });
        reader.readAsDataURL(blob);
        imageBase64Payload = await b64Promise;
      }

      const res = await fetch("/api/gemini/generate-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: prompt.trim() || (mode === "image" ? "Cinematic continuous motion with natural perspective and fluid lighting" : "Cinematic scene"),
          imageBase64: mode === "image" ? imageBase64Payload : undefined,
          mimeType: selectedImageMime,
          aspectRatio,
          resolution,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Failed to initiate video generation (${res.status})`);
      }

      const data = await res.json();
      const opName = data.operationName;
      setOperationName(opName);
      setGenerationStage("Rendering temporal diffusion frames...");

      // Start Polling Loop
      pollForVideoCompletion(opName);
    } catch (err: any) {
      console.error("Video start error:", err);
      setErrorMsg(err.message || "Could not start video generation.");
      setIsGenerating(false);
      if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
    }
  };

  // Poll video status
  const pollForVideoCompletion = (opName: string) => {
    let attempts = 0;
    const maxAttempts = 60; // Up to ~5-8 minutes

    const stages = [
      "Synthesizing motion dynamics & optical flow vectors...",
      "Simulating volumetric cinematic illumination...",
      "Refining temporal coherence & multi-frame consistency...",
      "Applying depth map transformations...",
      "Finalizing high-fidelity video stream...",
    ];

    pollTimerRef.current = setInterval(async () => {
      attempts++;
      setGenerationStage(stages[attempts % stages.length]);

      try {
        const statusRes = await fetch("/api/gemini/video-status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ operationName: opName }),
        });

        if (!statusRes.ok) {
          throw new Error("Polling status error");
        }

        const statusData = await statusRes.json();

        if (statusData.error) {
          throw new Error(statusData.error.message || "Video generation failed in Veo pipeline.");
        }

        if (statusData.done) {
          // Finished! Fetch generated video stream
          clearInterval(pollTimerRef.current);
          setGenerationStage("Downloading finalized MP4 video stream...");
          await downloadAndDisplayVideo(opName);
        } else if (attempts >= maxAttempts) {
          throw new Error("Video generation timed out. Please try again.");
        }
      } catch (pollErr: any) {
        console.error("Polling error:", pollErr);
        clearInterval(pollTimerRef.current);
        if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
        setErrorMsg(pollErr.message || "Error while waiting for video generation.");
        setIsGenerating(false);
      }
    }, 8000);
  };

  // Download & Display Video
  const downloadAndDisplayVideo = async (opName: string) => {
    try {
      const downloadRes = await fetch("/api/gemini/video-download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operationName: opName }),
      });

      if (!downloadRes.ok) {
        const err = await downloadRes.json().catch(() => ({}));
        throw new Error(err.error || "Failed to download generated MP4 file.");
      }

      const videoBlob = await downloadRes.blob();
      const videoObjectUrl = URL.createObjectURL(videoBlob);

      setGeneratedVideoBlob(videoBlob);
      setGeneratedVideoUrl(videoObjectUrl);
      setIsGenerating(false);
      if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);

      // Add to recent list
      const newRec = {
        id: `veo_${Date.now()}`,
        url: videoObjectUrl,
        prompt: prompt.slice(0, 60),
        aspectRatio,
        createdAt: Date.now(),
      };
      setRecentVideos((prev) => [newRec, ...prev]);
    } catch (err: any) {
      console.error("Download video error:", err);
      setErrorMsg(err.message || "Failed to retrieve generated video file.");
      setIsGenerating(false);
      if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
    }
  };

  // Add generated video to Media Library
  const handleSaveToLibrary = () => {
    if (!generatedVideoUrl || !generatedVideoBlob) return;

    const newMedia: MediaItem = {
      id: `media_veo_${Date.now()}`,
      name: `Veo_${aspectRatio === "9:16" ? "Portrait" : "Landscape"}_${Date.now().toString().slice(-6)}.mp4`,
      type: "video",
      size: generatedVideoBlob.size,
      mimeType: "video/mp4",
      url: generatedVideoUrl,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      tags: ["veo-3", "ai-video", aspectRatio, resolution],
      category: "Artwork & Design",
      summary: prompt || "AI Generated Video with Veo 3",
      isFavorite: true,
    };

    onAddMediaItem(newMedia);
    alert(`Added "${newMedia.name}" to your Media Library!`);
  };

  // Download MP4 to disk
  const handleDownloadFile = () => {
    if (!generatedVideoUrl) return;
    const a = document.createElement("a");
    a.href = generatedVideoUrl;
    a.download = `Veo_Video_${Date.now()}.mp4`;
    a.click();
  };

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-64px)] bg-slate-950 text-slate-100 overflow-y-auto">
      {/* Studio Header */}
      <div className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-500 flex items-center justify-center text-white shadow-lg shadow-purple-600/20">
            <Film className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white tracking-tight">Veo 3 Video Studio</h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-950 text-purple-300 border border-purple-800">
                veo-3.1-fast-generate-preview
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Create cinematic videos from text prompts or animate uploaded photos into moving scenes.
            </p>
          </div>
        </div>

        {/* Mode Selector */}
        <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setMode("text")}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              mode === "text"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Film className="w-3.5 h-3.5" />
            <span>Text to Video</span>
          </button>
          <button
            onClick={() => setMode("image")}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              mode === "image"
                ? "bg-purple-600 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span>Animate Photo</span>
          </button>
        </div>
      </div>

      {/* Main Studio Body */}
      <div className="max-w-7xl mx-auto w-full p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Generation Controls */}
        <div className="lg:col-span-6 space-y-5">
          {errorMsg && (
            <div className="p-3 bg-rose-950/60 border border-rose-800 text-rose-300 text-xs rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Mode 2: Photo Upload & Selection Card */}
          {mode === "image" && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white flex items-center gap-2">
                  <Upload className="w-4 h-4 text-purple-400" />
                  Select Source Photo to Animate
                </span>
                {imageSourceTitle && (
                  <span className="text-[10px] font-mono text-purple-300 bg-purple-950 px-2 py-0.5 rounded border border-purple-800 truncate max-w-[150px]">
                    {imageSourceTitle}
                  </span>
                )}
              </div>

              {selectedImageBase64 ? (
                <div className="relative group rounded-xl overflow-hidden border border-slate-700 max-h-56 bg-slate-950 flex items-center justify-center">
                  <img
                    src={selectedImageBase64}
                    alt="Source to animate"
                    className="max-h-56 object-contain w-full"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute inset-0 bg-slate-950/70 opacity-0 group-hover:opacity-100 flex items-center justify-center text-xs font-semibold text-white transition-opacity gap-1.5"
                  >
                    <Upload className="w-4 h-4" />
                    <span>Change Photo</span>
                  </button>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-700 hover:border-purple-500 rounded-xl p-6 text-center cursor-pointer bg-slate-950/50 hover:bg-purple-950/20 transition-all space-y-2"
                >
                  <ImageIcon className="w-8 h-8 text-purple-400 mx-auto" />
                  <p className="text-xs font-semibold text-slate-200">
                    Click to upload a photo to animate
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Supports JPG, PNG, WEBP. Veo 3 will breathe cinematic life and motion into this picture.
                  </p>
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                className="hidden"
              />

              {/* Or Select from Library */}
              {availableMedia.filter((m) => m.type === "image").length > 0 && (
                <div className="pt-2 border-t border-slate-800">
                  <span className="text-[11px] text-slate-400 block mb-2">Or pick from library:</span>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {availableMedia
                      .filter((m) => m.type === "image")
                      .slice(0, 6)
                      .map((img) => (
                        <button
                          key={img.id}
                          onClick={() => handleSelectLibraryImage(img)}
                          className="w-14 h-14 rounded-lg overflow-hidden border border-slate-800 hover:border-purple-500 shrink-0 transition-all focus:ring-2 focus:ring-purple-500"
                        >
                          <img
                            src={img.url}
                            alt={img.name}
                            className="w-full h-full object-cover"
                          />
                        </button>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Prompt Input */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-white flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                <span>{mode === "text" ? "Cinematic Video Prompt" : "Animation & Motion Prompt"}</span>
              </label>
              <span className="text-[11px] text-slate-500">
                {prompt.length} chars
              </span>
            </div>

            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={
                mode === "text"
                  ? "Describe the visual atmosphere, camera angles, lighting, motion, and aesthetic..."
                  : "Describe how this photo should move (e.g., slow drone zoom, gentle sea waves, flowing hair)..."
              }
              rows={3}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs sm:text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors resize-none"
            />

            {/* Quick Inspiration Presets */}
            <div className="space-y-1.5">
              <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                Style Presets:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {[
                  "Cinematic slow-motion push-in, golden hour lighting, 35mm film grain",
                  "Futuristic cyberpunk city at night with neon lights reflecting in rain puddles",
                  "Drone hyperlapse soaring through mountain clouds at twilight",
                  "Underwater coral reef with gentle sunbeams breaking through crystal waves",
                ].map((preset, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleApplyPreset(preset)}
                    className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition-colors text-left"
                  >
                    {preset.slice(0, 36)}...
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Video Aspect Ratio & Format Controls */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-4">
            <span className="text-xs font-bold text-white block">
              Format & Aspect Ratio Specifications
            </span>

            <div className="grid grid-cols-2 gap-3">
              {/* Aspect Ratio 16:9 */}
              <button
                type="button"
                onClick={() => setAspectRatio("16:9")}
                className={`p-3 rounded-xl border text-left flex items-start gap-3 transition-all ${
                  aspectRatio === "16:9"
                    ? "bg-indigo-950/60 border-indigo-500 text-white shadow-md shadow-indigo-500/10"
                    : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                }`}
              >
                <div className="w-8 h-5 border-2 border-current rounded-sm shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-bold">16:9 Landscape</div>
                  <div className="text-[10px] text-slate-400">Cinematic, YouTube, Desktop</div>
                </div>
              </button>

              {/* Aspect Ratio 9:16 */}
              <button
                type="button"
                onClick={() => setAspectRatio("9:16")}
                className={`p-3 rounded-xl border text-left flex items-start gap-3 transition-all ${
                  aspectRatio === "9:16"
                    ? "bg-indigo-950/60 border-indigo-500 text-white shadow-md shadow-indigo-500/10"
                    : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                }`}
              >
                <div className="w-5 h-8 border-2 border-current rounded-sm shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-bold">9:16 Portrait</div>
                  <div className="text-[10px] text-slate-400">Shorts, Reels, Stories, Mobile</div>
                </div>
              </button>
            </div>

            {/* Resolution Selector */}
            <div className="flex items-center justify-between pt-1">
              <span className="text-xs text-slate-400">Target Resolution:</span>
              <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
                <button
                  onClick={() => setResolution("720p")}
                  className={`px-3 py-1 rounded-md transition-all ${
                    resolution === "720p"
                      ? "bg-indigo-600 text-white font-semibold"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  720p HD (Fast)
                </button>
                <button
                  onClick={() => setResolution("1080p")}
                  className={`px-3 py-1 rounded-md transition-all ${
                    resolution === "1080p"
                      ? "bg-indigo-600 text-white font-semibold"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  1080p FHD
                </button>
              </div>
            </div>
          </div>

          {/* Generate Button */}
          <button
            onClick={handleStartGeneration}
            disabled={isGenerating}
            className={`w-full py-3.5 px-6 rounded-2xl font-bold text-sm text-white shadow-xl transition-all flex items-center justify-center gap-2 ${
              isGenerating
                ? "bg-slate-800 text-slate-400 cursor-not-allowed"
                : "bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:via-purple-500 hover:to-pink-500 shadow-purple-600/30 active:scale-[0.99]"
            }`}
          >
            {isGenerating ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-purple-400" />
                <span>Generating Video with Veo 3 ({elapsedSeconds}s)...</span>
              </>
            ) : (
              <>
                <Video className="w-4 h-4" />
                <span>
                  {mode === "text" ? "Generate Veo 3 Video" : "Animate Photo into Video"}
                </span>
              </>
            )}
          </button>
        </div>

        {/* Right Column: Video Preview & Player */}
        <div className="lg:col-span-6 space-y-5">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between min-h-[460px]">
            <div>
              <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <Film className="w-4 h-4 text-indigo-400" />
                  <span className="text-xs font-bold text-white">Veo Video Canvas</span>
                </div>
                {aspectRatio && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-indigo-300">
                    {aspectRatio} • {resolution}
                  </span>
                )}
              </div>

              {/* Generation Progress Indicator */}
              {isGenerating && (
                <div className="bg-slate-950 rounded-2xl p-8 border border-purple-900/40 text-center space-y-4 my-8">
                  <div className="relative w-16 h-16 mx-auto">
                    <div className="absolute inset-0 rounded-full border-4 border-purple-500/20 animate-ping" />
                    <div className="w-16 h-16 rounded-full border-4 border-t-purple-500 border-r-indigo-500 border-b-transparent border-l-transparent animate-spin flex items-center justify-center">
                      <Film className="w-6 h-6 text-purple-400 animate-pulse" />
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-bold text-white mb-1">
                      Generating with Veo 3
                    </h4>
                    <p className="text-xs text-purple-300 font-mono">{generationStage}</p>
                    <p className="text-[11px] text-slate-500 mt-2">
                      Elapsed: {elapsedSeconds}s • Neural frame synthesis in progress
                    </p>
                  </div>
                </div>
              )}

              {/* Rendered Video Player */}
              {generatedVideoUrl && !isGenerating && (
                <div className="space-y-4">
                  <div
                    className={`relative rounded-xl overflow-hidden bg-black border border-slate-800 mx-auto shadow-2xl ${
                      aspectRatio === "9:16" ? "max-w-[280px] aspect-[9/16]" : "w-full aspect-[16/9]"
                    }`}
                  >
                    <video
                      ref={videoRef}
                      src={generatedVideoUrl}
                      controls
                      autoPlay
                      loop
                      playsInline
                      className="w-full h-full object-contain"
                    />
                  </div>

                  {/* Actions for Video */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                    <button
                      onClick={handleSaveToLibrary}
                      className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-md transition-all"
                    >
                      <PlusCircle className="w-4 h-4" />
                      <span>Add to Media Library</span>
                    </button>

                    <button
                      onClick={handleDownloadFile}
                      className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white px-4 py-2 rounded-xl text-xs font-semibold transition-colors"
                    >
                      <Download className="w-4 h-4" />
                      <span>Download .MP4</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Idle Placeholder */}
              {!generatedVideoUrl && !isGenerating && (
                <div className="flex flex-col items-center justify-center py-20 text-center space-y-3">
                  <div className="w-14 h-14 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-center text-slate-600">
                    <Video className="w-7 h-7" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-400">
                      No video generated yet
                    </p>
                    <p className="text-[11px] text-slate-600 max-w-xs mt-1">
                      Choose Text to Video or Animate Photo, configure aspect ratio (16:9 or 9:16), and click Generate.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Veo Model Specifications Note */}
            <div className="border-t border-slate-800/80 pt-3 mt-4 text-[11px] text-slate-500 flex items-center justify-between">
              <span>Engine: <span className="text-purple-400 font-mono">veo-3.1-fast-generate-preview</span></span>
              <span>Supported Ratios: 16:9 & 9:16</span>
            </div>
          </div>

          {/* Recent Generations Shelf */}
          {recentVideos.length > 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-indigo-400" />
                Recent Veo 3 Generations ({recentVideos.length})
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {recentVideos.map((rec) => (
                  <div
                    key={rec.id}
                    onClick={() => setGeneratedVideoUrl(rec.url)}
                    className="cursor-pointer group relative rounded-xl overflow-hidden border border-slate-800 hover:border-indigo-500 bg-black aspect-video flex items-center justify-center transition-all"
                  >
                    <video src={rec.url} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                      <Play className="w-5 h-5 text-white" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
