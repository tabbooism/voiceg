import React, { useState, useRef, useEffect } from "react";
import {
  Sparkles,
  FileText,
  Boxes,
  Users,
  Search,
  MapPin,
  MessageSquare,
  Copy,
  Check,
  Brain,
  Mic,
  MicOff,
  Send,
  Eye,
  EyeOff,
  Palette,
  ShieldCheck,
  Globe,
  HelpCircle,
  ExternalLink,
  Camera,
} from "lucide-react";
import { MediaItem, ChatMessage } from "../types";
import { processImageLocally } from "../lib/localAnalysis";

interface ImageInspectorProps {
  media: MediaItem;
  onUpdateMedia: (updated: MediaItem) => void;
  localMode: boolean;
  onOpenEditor: (id: string) => void;
  onOpenIsolator: (id: string) => void;
}

export const ImageInspector: React.FC<ImageInspectorProps> = ({
  media,
  onUpdateMedia,
  localMode,
  onOpenEditor,
  onOpenIsolator,
}) => {
  // Visual Overlays State
  const [showBoundingBoxes, setShowBoundingBoxes] = useState(true);
  const [showFaceBoxes, setShowFaceBoxes] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Source & Geo Lookup State
  const [isLookingUpSource, setIsLookingUpSource] = useState(false);
  const [isLookingUpGeo, setIsLookingUpGeo] = useState(false);
  const [customSearchQuery, setCustomSearchQuery] = useState("");

  // Multimodal Chat State
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: "msg_init",
      role: "assistant",
      content: `Hello! I am ready to inspect "${media.name}". Ask me about any detected text, objects, composition, color palette, or audio features.`,
      timestamp: Date.now(),
    },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState<"gemini-3.1-pro-preview" | "gemini-3.5-flash" | "gemini-3.1-flash-lite">("gemini-3.1-pro-preview");
  const [useHighThinking, setUseHighThinking] = useState(false);

  // Audio recording for transcription query input
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatScrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, isChatLoading]);

  // Copy helper
  const copyToClipboard = (text: string, fieldKey: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldKey);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Run ML Analysis (Server Gemini or Local Canvas)
  const handleRunAnalysis = async () => {
    setIsAnalyzing(true);
    try {
      if (localMode) {
        // Privacy Local Mode: Canvas on-device inspection
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = media.url;
        await new Promise((res) => {
          img.onload = res;
        });

        const localResult = await processImageLocally(img);
        onUpdateMedia({
          ...media,
          ...localResult,
          updatedAt: Date.now(),
        });
      } else {
        // Server-side Gemini API (gemini-3.1-pro-preview)
        const res = await fetch("/api/gemini/analyze-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imageBase64: media.url,
            mimeType: media.mimeType,
            preferredModel: "gemini-3.1-pro-preview",
          }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `Analysis failed (${res.status})`);
        }

        const data = await res.json();
        onUpdateMedia({
          ...media,
          category: data.category || media.category,
          summary: data.summary || media.summary,
          altText: data.altText || media.altText,
          tags: Array.from(new Set([...media.tags, ...(data.tags || [])])),
          ocrText: data.ocrText !== undefined ? data.ocrText : media.ocrText,
          detectedObjects: data.detectedObjects || media.detectedObjects,
          detectedFaces: data.detectedFaces || media.detectedFaces,
          dominantColors: data.dominantColors || media.dominantColors,
          isLocalProcessed: false,
          updatedAt: Date.now(),
        });
      }
    } catch (err: any) {
      console.error("Analysis error:", err);
      alert(`ML Analysis error: ${err.message}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Advanced Google Image Lookup & Source Verification (Multimodal + Google Search Grounding)
  const handleSourceLookup = async () => {
    if (localMode) {
      alert("Local Privacy Mode is enabled. Disable Local Mode in the top navigation bar to query external Google Search data.");
      return;
    }
    setIsLookingUpSource(true);
    try {
      const res = await fetch("/api/gemini/source-lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: customSearchQuery || undefined,
          ocrText: media.ocrText,
          tags: media.tags,
          imageBase64: media.url,
          mimeType: media.mimeType,
        }),
      });
      if (!res.ok) throw new Error("Google Image lookup request failed.");
      const data = await res.json();

      onUpdateMedia({
        ...media,
        sourceLookup: {
          summary: data.lookupSummary,
          sources: data.sources || [],
          searchQueries: data.searchQueries || [],
          verifiedSource: data.verifiedSource,
          sourceConfidence: data.sourceConfidence,
          licenseType: data.licenseType,
          firstSeen: data.firstSeen,
          locationContext: data.locationContext,
          entityTags: data.entityTags || [],
        },
        updatedAt: Date.now(),
      });
    } catch (err: any) {
      alert(`Source lookup error: ${err.message}`);
    } finally {
      setIsLookingUpSource(false);
    }
  };

  // One-click apply discovered metadata to saved photo
  const handleApplyDiscoveredMetadata = () => {
    if (!media.sourceLookup) return;
    const lookup = media.sourceLookup;
    const newTags = Array.from(
      new Set([
        ...media.tags,
        ...(lookup.entityTags || []),
        ...(lookup.verifiedSource ? [lookup.verifiedSource.toLowerCase().replace(/[^a-z0-9]/g, "-")] : []),
        "verified-origin",
      ])
    ).filter(Boolean);

    onUpdateMedia({
      ...media,
      tags: newTags,
      summary: `${media.summary ? `${media.summary} | ` : ""}Source: ${lookup.verifiedSource || "Web Match"} (${lookup.licenseType || "Standard"}).`,
      updatedAt: Date.now(),
    });

    alert("Discovered Google Image metadata and entity tags applied to this saved photo!");
  };

  // Google Maps Grounding: Landmark & Location Lookup
  const handleGeoLookup = async () => {
    if (localMode) {
      alert("Local Privacy Mode is enabled. Disable Local Mode to query Google Maps data.");
      return;
    }
    const query = prompt("Enter landmark, city, or location name to query Google Maps:", media.name.replace(/[._-]/g, " "));
    if (!query) return;

    setIsLookingUpGeo(true);
    try {
      const res = await fetch("/api/gemini/geo-lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locationQuery: query }),
      });
      if (!res.ok) throw new Error("Maps lookup failed.");
      const data = await res.json();

      onUpdateMedia({
        ...media,
        geoLookup: {
          summary: data.geoSummary,
          mapsSources: data.mapsSources || [],
        },
        updatedAt: Date.now(),
      });
    } catch (err: any) {
      alert(`Maps lookup error: ${err.message}`);
    } finally {
      setIsLookingUpGeo(false);
    }
  };

  // Chat message submit
  const handleSendMessage = async (textToSend?: string) => {
    const text = textToSend || chatInput;
    if (!text.trim() || isChatLoading) return;

    const userMsg: ChatMessage = {
      id: `user_${Date.now()}`,
      role: "user",
      content: text,
      timestamp: Date.now(),
    };

    const newHistory = [...chatMessages, userMsg];
    setChatMessages(newHistory);
    setChatInput("");
    setIsChatLoading(true);

    try {
      const res = await fetch("/api/gemini/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newHistory.map((m) => ({ role: m.role, content: m.content })),
          mediaBase64: media.url,
          mediaMimeType: media.mimeType,
          model: selectedModel,
          useHighThinking,
        }),
      });

      if (!res.ok) throw new Error("Chat request failed.");
      const data = await res.json();

      const assistantMsg: ChatMessage = {
        id: `ast_${Date.now()}`,
        role: "assistant",
        content: data.reply || "No response received.",
        timestamp: Date.now(),
        modelUsed: useHighThinking ? "gemini-3.1-pro-preview (Thinking: HIGH)" : selectedModel,
        thinkingMode: useHighThinking,
      };

      setChatMessages([...newHistory, assistantMsg]);
    } catch (err: any) {
      setChatMessages([
        ...newHistory,
        {
          id: `ast_${Date.now()}`,
          role: "assistant",
          content: `Error: ${err.message || "Failed to reach AI model."}`,
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setIsChatLoading(false);
    }
  };

  // Voice recording & transcription using gemini-3.5-transcribe
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        stream.getTracks().forEach((t) => t.stop());

        // Convert blob to base64
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64Audio = reader.result as string;
          try {
            const res = await fetch("/api/gemini/transcribe-audio", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                audioBase64: base64Audio,
                mimeType: "audio/webm",
              }),
            });
            if (res.ok) {
              const data = await res.json();
              if (data.transcription) {
                setChatInput(data.transcription.trim());
              }
            }
          } catch (e) {
            console.error("Voice transcription failed:", e);
          }
        };
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      alert("Microphone permission denied or unsupported.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-60px)] overflow-hidden bg-slate-950 text-slate-200">
      {/* Left Column: Visual Media Viewport with Overlay Boxes */}
      <div className="flex-1 flex flex-col bg-slate-950 border-r border-slate-800 overflow-hidden relative">
        {/* Viewport Top Bar */}
        <div className="p-3 border-b border-slate-800 bg-slate-900/60 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 truncate">
            <span className="font-semibold text-white truncate max-w-xs">{media.name}</span>
            <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[10px]">
              {media.category || "Uncategorized"}
            </span>
            {media.isLocalProcessed && (
              <span className="flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/30">
                <ShieldCheck className="w-3 h-3" /> Local Mode
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Toggle Overlay Bounding Boxes */}
            {media.detectedObjects && media.detectedObjects.length > 0 && (
              <button
                onClick={() => setShowBoundingBoxes(!showBoundingBoxes)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs transition-colors border ${
                  showBoundingBoxes
                    ? "bg-indigo-600/30 text-indigo-300 border-indigo-500/40"
                    : "bg-slate-800 text-slate-400 border-slate-700"
                }`}
                title="Toggle object bounding boxes"
              >
                <Boxes className="w-3.5 h-3.5" />
                <span>Boxes ({media.detectedObjects.length})</span>
              </button>
            )}

            {/* Toggle Face Boxes */}
            {media.detectedFaces && media.detectedFaces.length > 0 && (
              <button
                onClick={() => setShowFaceBoxes(!showFaceBoxes)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs transition-colors border ${
                  showFaceBoxes
                    ? "bg-purple-600/30 text-purple-300 border-purple-500/40"
                    : "bg-slate-800 text-slate-400 border-slate-700"
                }`}
                title="Toggle face recognition boxes"
              >
                <Users className="w-3.5 h-3.5" />
                <span>Faces ({media.detectedFaces.length})</span>
              </button>
            )}

            {/* Re-Analyze Button */}
            <button
              id="btn-trigger-ai-inspect"
              onClick={handleRunAnalysis}
              disabled={isAnalyzing}
              className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-3 py-1 rounded-lg text-xs font-medium transition-colors shadow-sm"
            >
              <Sparkles className={`w-3.5 h-3.5 ${isAnalyzing ? "animate-spin" : ""}`} />
              <span>{isAnalyzing ? "Analyzing..." : "Re-Inspect"}</span>
            </button>
          </div>
        </div>

        {/* Viewport Canvas / Stage */}
        <div className="flex-1 flex items-center justify-center p-6 overflow-hidden bg-gradient-to-b from-slate-950 to-slate-900/50 relative">
          <div className="relative max-w-full max-h-full flex items-center justify-center">
            {media.type === "image" ? (
              <div className="relative inline-block select-none shadow-2xl rounded-lg overflow-hidden border border-slate-800">
                <img
                  id="inspect-main-image"
                  src={media.url}
                  alt={media.altText || media.name}
                  className="max-h-[68vh] max-w-full object-contain block"
                />

                {/* SVG Overlay for Bounding Boxes */}
                <svg
                  className="absolute inset-0 w-full h-full pointer-events-none"
                  viewBox="0 0 1000 1000"
                  preserveAspectRatio="none"
                >
                  {/* Object Bounding Boxes (Cyan / Indigo) */}
                  {showBoundingBoxes &&
                    media.detectedObjects?.map((obj, i) => {
                      if (!obj.box) return null;
                      const { ymin, xmin, ymax, xmax } = obj.box;
                      const boxW = xmax - xmin;
                      const boxH = ymax - ymin;
                      return (
                        <g key={`obj-${i}`}>
                          <rect
                            x={xmin}
                            y={ymin}
                            width={boxW}
                            height={boxH}
                            fill="rgba(56, 189, 248, 0.12)"
                            stroke="#38bdf8"
                            strokeWidth="3"
                            strokeDasharray="4 2"
                            rx="4"
                          />
                          <rect
                            x={xmin}
                            y={Math.max(0, ymin - 32)}
                            width={Math.min(240, boxW + 40)}
                            height="28"
                            fill="#0284c7"
                            rx="3"
                          />
                          <text
                            x={xmin + 6}
                            y={Math.max(18, ymin - 12)}
                            fill="#ffffff"
                            fontSize="16"
                            fontFamily="monospace"
                            fontWeight="bold"
                          >
                            {obj.name} ({Math.round(obj.confidence * 100)}%)
                          </text>
                        </g>
                      );
                    })}

                  {/* Face Recognition Boxes (Purple / Pink) */}
                  {showFaceBoxes &&
                    media.detectedFaces?.map((face, i) => {
                      if (!face.box) return null;
                      const { ymin, xmin, ymax, xmax } = face.box;
                      const boxW = xmax - xmin;
                      const boxH = ymax - ymin;
                      return (
                        <g key={`face-${i}`}>
                          <rect
                            x={xmin}
                            y={ymin}
                            width={boxW}
                            height={boxH}
                            fill="rgba(192, 132, 252, 0.15)"
                            stroke="#c084fc"
                            strokeWidth="3"
                            rx="8"
                          />
                          <rect
                            x={xmin}
                            y={Math.max(0, ymin - 30)}
                            width={Math.max(160, boxW)}
                            height="26"
                            fill="#7e22ce"
                            rx="3"
                          />
                          <text
                            x={xmin + 6}
                            y={Math.max(16, ymin - 12)}
                            fill="#ffffff"
                            fontSize="15"
                            fontFamily="sans-serif"
                            fontWeight="bold"
                          >
                            {face.faceId.replace(/_/g, " ")} {face.expression ? `• ${face.expression}` : ""}
                          </text>
                        </g>
                      );
                    })}
                </svg>
              </div>
            ) : media.type === "video" ? (
              <video
                src={media.url}
                controls
                className="max-h-[68vh] max-w-full rounded-lg border border-slate-800 shadow-2xl"
              />
            ) : (
              <div className="flex flex-col items-center justify-center p-12 bg-slate-900/80 rounded-2xl border border-slate-800 shadow-2xl text-center">
                <div className="w-16 h-16 rounded-2xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400 mb-4">
                  <Mic className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">{media.name}</h3>
                <p className="text-xs text-slate-400 mb-6 max-w-sm">
                  Audio media asset with multitrack stem isolation capabilities.
                </p>
                <button
                  onClick={() => onOpenIsolator(media.id)}
                  className="bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
                >
                  <Mic className="w-4 h-4" /> Open in Voice Stem Isolator
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Bottom Quick Bar: Edit image or Voice isolate shortcut */}
        <div className="p-3 bg-slate-900/80 border-t border-slate-800 flex items-center justify-between text-xs">
          <div className="flex items-center gap-3">
            <span className="text-slate-400">Dimensions / Format: {media.mimeType}</span>
            <span className="text-slate-500">•</span>
            <span className="text-slate-400">Size: {Math.round(media.size / 1024)} KB</span>
          </div>

          <div className="flex items-center gap-2">
            {media.type === "image" && (
              <button
                onClick={() => onOpenEditor(media.id)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg font-medium border border-slate-700 transition-colors"
              >
                Open in Photo Editor
              </button>
            )}
            <button
              onClick={() => onOpenIsolator(media.id)}
              className="bg-purple-950/80 hover:bg-purple-900 text-purple-300 border border-purple-800 px-3 py-1.5 rounded-lg font-medium transition-colors"
            >
              Open in Voice Isolator
            </button>
          </div>
        </div>
      </div>

      {/* Right Column: Deep Inspection Details & Ask AI Chat */}
      <div className="w-full lg:w-96 flex flex-col bg-slate-900/90 shrink-0 overflow-hidden">
        {/* Tab Headers / Accordion */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {/* 1. OCR Text Card */}
          <div className="bg-slate-950 rounded-xl p-3.5 border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-indigo-400 flex items-center gap-1.5 uppercase tracking-wider">
                <FileText className="w-3.5 h-3.5" /> Text & OCR Extraction
              </span>
              {media.ocrText && (
                <button
                  onClick={() => copyToClipboard(media.ocrText || "", "ocr")}
                  className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white transition-colors"
                >
                  {copiedField === "ocr" ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedField === "ocr" ? "Copied" : "Copy OCR"}</span>
                </button>
              )}
            </div>

            {media.ocrText ? (
              <pre className="text-xs text-slate-300 font-mono bg-slate-900/80 p-2.5 rounded-lg border border-slate-800/80 overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-36">
                {media.ocrText}
              </pre>
            ) : (
              <p className="text-xs text-slate-500 italic">No readable text found in this asset.</p>
            )}
          </div>

          {/* 2. Generative Alt-Text & Descriptive Summary */}
          <div className="bg-slate-950 rounded-xl p-3.5 border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-sky-400 flex items-center gap-1.5 uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5" /> AI Alt-Text & Description
              </span>
              {media.altText && (
                <button
                  onClick={() => copyToClipboard(media.altText || "", "alt")}
                  className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white transition-colors"
                >
                  {copiedField === "alt" ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedField === "alt" ? "Copied" : "Copy Alt-Text"}</span>
                </button>
              )}
            </div>

            <p className="text-xs text-slate-300 leading-relaxed mb-3">
              {media.altText || media.summary || "Click 'Re-Inspect' to generate detailed alt-text."}
            </p>

            {/* Tags Cloud */}
            <div className="flex flex-wrap gap-1">
              {media.tags.map((t) => (
                <span
                  key={t}
                  className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-medium"
                >
                  #{t}
                </span>
              ))}
            </div>
          </div>

          {/* 3. Detected Objects & Dominant Colors */}
          <div className="bg-slate-950 rounded-xl p-3.5 border border-slate-800">
            <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5 uppercase tracking-wider mb-2.5">
              <Boxes className="w-3.5 h-3.5" /> Detected Objects ({media.detectedObjects?.length || 0})
            </span>

            {media.detectedObjects && media.detectedObjects.length > 0 ? (
              <div className="space-y-1.5 mb-3">
                {media.detectedObjects.map((obj, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between text-xs bg-slate-900 px-2.5 py-1.5 rounded-lg border border-slate-800"
                  >
                    <span className="text-white capitalize">{obj.name}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full"
                          style={{ width: `${Math.round(obj.confidence * 100)}%` }}
                        />
                      </div>
                      <span className="text-[11px] font-mono text-slate-400">
                        {Math.round(obj.confidence * 100)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic mb-3">No specific objects classified yet.</p>
            )}

            {/* Dominant Colors Palette */}
            {media.dominantColors && media.dominantColors.length > 0 && (
              <div>
                <span className="text-[11px] font-medium text-slate-400 flex items-center gap-1 mb-1.5">
                  <Palette className="w-3 h-3 text-pink-400" /> Dominant Colors:
                </span>
                <div className="flex items-center gap-1.5">
                  {media.dominantColors.map((hex) => (
                    <button
                      key={hex}
                      onClick={() => copyToClipboard(hex, `hex_${hex}`)}
                      className="group flex items-center gap-1 bg-slate-900 border border-slate-800 px-2 py-1 rounded text-[10px] text-slate-300 hover:border-slate-600 transition-colors"
                      title={`Copy color ${hex}`}
                    >
                      <span className="w-3 h-3 rounded-full border border-white/20" style={{ backgroundColor: hex }} />
                      <span className="font-mono">{hex}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 4. Advanced Google Image Lookup & Source Verification */}
          <div className="bg-slate-950 rounded-xl p-3.5 border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-amber-400 flex items-center gap-1.5 uppercase tracking-wider">
                <Globe className="w-3.5 h-3.5" /> Advanced Google Image Lookup
              </span>
              {media.sourceLookup?.sourceConfidence && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-950/80 text-amber-300 border border-amber-800/80 font-mono">
                  {media.sourceLookup.sourceConfidence}
                </span>
              )}
            </div>

            <p className="text-xs text-slate-400 mb-3">
              Reverse visual search and source verification with Google Search Grounding to verify origin, copyright, and gather authentic metadata.
            </p>

            <div className="flex gap-2 mb-3">
              <button
                id="btn-source-lookup"
                onClick={handleSourceLookup}
                disabled={isLookingUpSource}
                className="flex-1 flex items-center justify-center gap-1.5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 disabled:opacity-50 text-white py-2 rounded-lg text-xs font-semibold shadow-md transition-all"
              >
                <Search className={`w-3.5 h-3.5 ${isLookingUpSource ? "animate-spin" : ""}`} />
                <span>{isLookingUpSource ? "Investigating on Google..." : "Run Google Image Lookup"}</span>
              </button>

              <button
                id="btn-geo-lookup"
                onClick={handleGeoLookup}
                disabled={isLookingUpGeo}
                className="flex items-center justify-center gap-1 bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-2 rounded-lg text-xs font-medium border border-slate-700 transition-colors"
                title="Lookup landmark location with Google Maps"
              >
                <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                <span>Maps</span>
              </button>
            </div>

            {/* Results card */}
            {media.sourceLookup && (
              <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 text-xs text-slate-300 space-y-2.5">
                {/* Structured Metadata Badges */}
                <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase font-semibold">Origin / Source:</span>
                    <span className="text-white font-medium truncate block" title={media.sourceLookup.verifiedSource}>
                      {media.sourceLookup.verifiedSource || "Web Search Verified"}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase font-semibold">License / Rights:</span>
                    <span className="text-slate-200 truncate block">
                      {media.sourceLookup.licenseType || "Standard Copyright"}
                    </span>
                  </div>

                  {media.sourceLookup.firstSeen && (
                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase font-semibold">First Public Appearance:</span>
                      <span className="text-slate-300 font-mono text-[10px]">{media.sourceLookup.firstSeen}</span>
                    </div>
                  )}

                  {media.sourceLookup.locationContext && (
                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase font-semibold">Identified Landmark / Geo:</span>
                      <span className="text-emerald-400 truncate block">{media.sourceLookup.locationContext}</span>
                    </div>
                  )}
                </div>

                {/* Summary narrative */}
                <p className="leading-relaxed text-[11px] text-slate-300">{media.sourceLookup.summary}</p>

                {/* Apply Discovered Metadata Button */}
                <button
                  onClick={handleApplyDiscoveredMetadata}
                  className="w-full flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 hover:text-amber-200 py-1.5 rounded-lg text-xs font-medium border border-amber-900/50 transition-colors"
                >
                  <Sparkles className="w-3 h-3 text-amber-400" />
                  <span>Apply Discovered Metadata & Tags to Photo</span>
                </button>

                {/* Web Citations */}
                {media.sourceLookup.sources?.length > 0 && (
                  <div className="pt-2 border-t border-slate-800/60">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block mb-1.5">
                      Verified Web References:
                    </span>
                    <ul className="space-y-1">
                      {media.sourceLookup.sources.slice(0, 4).map((s: any, idx: number) => {
                        const url = s.web?.uri || s.url || "";
                        const title = s.web?.title || s.title || url;
                        return (
                          <li key={idx}>
                            <a
                              href={url}
                              target="_blank"
                              rel="noreferrer noopener"
                              className="text-[11px] text-sky-400 hover:underline truncate flex items-center gap-1.5 py-0.5"
                            >
                              <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                              <span className="truncate">{title}</span>
                            </a>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Google Photos Camera & EXIF details if attached */}
            {media.imageMediaMetadata && (
              <div className="mt-2.5 bg-slate-900/90 p-2.5 rounded-lg border border-slate-800 text-[11px] text-slate-300">
                <span className="text-[10px] text-sky-400 font-semibold block mb-1.5 flex items-center gap-1">
                  <Camera className="w-3 h-3" /> Google Photos Camera & EXIF Metadata:
                </span>
                <div className="grid grid-cols-2 gap-1.5 font-mono text-[10px] text-slate-400">
                  {media.imageMediaMetadata.cameraModel && (
                    <div>Camera: <strong className="text-white font-sans">{media.imageMediaMetadata.cameraMake || ""} {media.imageMediaMetadata.cameraModel}</strong></div>
                  )}
                  {media.imageMediaMetadata.width && (
                    <div>Resolution: <strong className="text-white">{media.imageMediaMetadata.width}x{media.imageMediaMetadata.height}</strong></div>
                  )}
                  {media.imageMediaMetadata.focalLength && (
                    <div>Focal Length: <strong className="text-white">{media.imageMediaMetadata.focalLength}mm</strong></div>
                  )}
                  {media.imageMediaMetadata.isoSpeed && (
                    <div>ISO: <strong className="text-white">{media.imageMediaMetadata.isoSpeed}</strong></div>
                  )}
                  {media.imageMediaMetadata.time && (
                    <div className="col-span-2">Date Taken: <strong className="text-slate-300">{media.imageMediaMetadata.time}</strong></div>
                  )}
                </div>
              </div>
            )}

            {media.geoLookup && (
              <div className="mt-2 bg-slate-900 p-2.5 rounded-lg border border-slate-800 text-xs text-slate-300">
                <span className="text-[10px] text-emerald-400 font-semibold block mb-1">Maps Grounding:</span>
                <p>{media.geoLookup.summary}</p>
                {media.geoLookup.mapsSources && media.geoLookup.mapsSources.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-slate-800 space-y-1.5">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">Google Maps Verification Sources:</span>
                    {media.geoLookup.mapsSources.map((source, sIdx) => (
                      <div key={sIdx} className="space-y-0.5">
                        <a
                          href={source.uri}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-emerald-400 hover:text-emerald-300 underline font-medium flex items-center gap-1 text-[11px]"
                        >
                          <ExternalLink className="w-3 h-3 shrink-0" />
                          <span>{source.title}</span>
                        </a>
                        {source.reviewSnippets?.map((snip, rIdx) => (
                          <p key={rIdx} className="text-[10px] text-slate-400 italic pl-3 border-l-2 border-emerald-500/30">
                            "{snip}"
                          </p>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Bottom Section: Multimodal Chat ("Ask about this picture/video") */}
        <div className="border-t border-slate-800 bg-slate-950 flex flex-col h-72">
          {/* Chat Settings Bar */}
          <div className="px-3 py-2 border-b border-slate-800/80 bg-slate-900/50 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-3.5 h-3.5 text-indigo-400" />
              <span className="font-semibold text-white">Ask Media AI</span>
            </div>

            <div className="flex items-center gap-2">
              {/* Thinking Mode Toggle (gemini-3.1-pro-preview with ThinkingLevel.HIGH) */}
              <button
                onClick={() => setUseHighThinking(!useHighThinking)}
                className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium border transition-colors ${
                  useHighThinking
                    ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                    : "bg-slate-800/60 text-slate-400 border-slate-700"
                }`}
                title="Enable deep reasoning with Gemini 3.1 Pro Thinking Mode"
              >
                <Brain className="w-3 h-3" />
                <span>Thinking: HIGH</span>
              </button>

              {/* Model Selector */}
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value as any)}
                disabled={useHighThinking}
                className="bg-slate-900 border border-slate-800 rounded px-1.5 py-0.5 text-[10px] text-slate-300 focus:outline-none"
              >
                <option value="gemini-3.1-pro-preview">Pro Preview (Complex)</option>
                <option value="gemini-3.5-flash">Flash (General)</option>
                <option value="gemini-3.1-flash-lite">Flash Lite (Fast)</option>
              </select>
            </div>
          </div>

          {/* Chat Messages Thread */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2.5 text-xs">
            {chatMessages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-xl px-3 py-2 leading-relaxed ${
                    msg.role === "user"
                      ? "bg-indigo-600 text-white rounded-br-none"
                      : "bg-slate-900 text-slate-200 border border-slate-800 rounded-bl-none"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>
                {msg.modelUsed && (
                  <span className="text-[9px] text-slate-500 mt-0.5 font-mono px-1">
                    {msg.modelUsed}
                  </span>
                )}
              </div>
            ))}
            {isChatLoading && (
              <div className="flex items-center gap-2 text-xs text-slate-400 italic">
                <Sparkles className="w-3 h-3 animate-spin text-indigo-400" />
                <span>Gemini is analyzing media and reasoning...</span>
              </div>
            )}
            <div ref={chatScrollRef} />
          </div>

          {/* Chat Input & Mic controls */}
          <div className="p-2.5 bg-slate-900/60 border-t border-slate-800 flex items-center gap-2">
            <button
              onClick={isRecording ? stopRecording : startRecording}
              className={`p-2 rounded-lg transition-colors border ${
                isRecording
                  ? "bg-rose-600 text-white border-rose-500 animate-pulse"
                  : "bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700"
              }`}
              title={isRecording ? "Stop voice input" : "Speak question (Transcribe with Gemini)"}
            >
              {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>

            <input
              type="text"
              placeholder={isRecording ? "Listening... speak now..." : "Ask anything about this media..."}
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />

            <button
              id="btn-send-chat"
              onClick={() => handleSendMessage()}
              disabled={!chatInput.trim() || isChatLoading}
              className="p-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-xl transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
