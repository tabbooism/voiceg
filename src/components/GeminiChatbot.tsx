import React, { useState, useRef, useEffect } from "react";
import {
  Sparkles,
  Send,
  Bot,
  User,
  RotateCcw,
  Search,
  MapPin,
  Mic,
  MicOff,
  Copy,
  Check,
  Paperclip,
  ExternalLink,
  ChevronDown,
  Layers,
  Zap,
  Brain,
  Volume2,
  Film,
  Compass,
  FileCheck,
} from "lucide-react";
import { MediaItem } from "../types";

export interface ChatMessageItem {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  modelUsed?: string;
  searchSources?: Array<{ title: string; url: string }>;
  mapsSources?: Array<{ title: string; uri: string; reviewSnippets?: string[] }>;
  attachedMediaName?: string;
}

export interface ChatbotRole {
  id: string;
  name: string;
  subtitle: string;
  icon: any;
  defaultModel: "gemini-3.1-pro-preview" | "gemini-3.5-flash" | "gemini-3.1-flash-lite";
  systemInstruction: string;
  suggestedPrompts: string[];
}

const ROLES: ChatbotRole[] = [
  {
    id: "director",
    name: "Creative Director & Screenwriter",
    subtitle: "Cinematography, color grading, storyboards & visual concepts",
    icon: Film,
    defaultModel: "gemini-3.5-flash",
    systemInstruction:
      "You are an award-winning Film & Media Creative Director. Provide deep narrative direction, visual scene descriptions, cinematic lighting advice, storyboard planning, and script development. Format scene directions and color recommendations clearly.",
    suggestedPrompts: [
      "Describe cinematic lighting for a dramatic rain scene at night",
      "Suggest a 4-beat storyboard for a futuristic music video",
      "What color grading palette enhances nostalgic 35mm film vibes?",
    ],
  },
  {
    id: "audio_engineer",
    name: "Acoustics & Audio Mastering Engineer",
    subtitle: "Voice isolation, stem separation, spectral cleaning & mastering",
    icon: Volume2,
    defaultModel: "gemini-3.1-pro-preview",
    systemInstruction:
      "You are an expert Audio Engineer specializing in vocal extraction, multi-stem mixing, spectral de-noising, dynamic range mastering, and acoustics. Explain DSP filters, phase cancellation, EQ curves, and audio codecs in detail.",
    suggestedPrompts: [
      "How does center-channel phase cancellation isolate speech from stereo music?",
      "Recommend EQ and compression chain for podcast voice mastering",
      "Explain the trade-offs between 24-bit 96kHz and 16-bit 44.1kHz FLAC",
    ],
  },
  {
    id: "location_scout",
    name: "Location Scout & Geographer",
    subtitle: "Google Maps grounding, filming permits & venue scouting",
    icon: Compass,
    defaultModel: "gemini-3.5-flash",
    systemInstruction:
      "You are a professional Location Scout and Geographic Researcher. Use Google Maps and spatial data to discover film sets, scenic shooting locations, permits, architectural styles, and venue details.",
    suggestedPrompts: [
      "Find iconic brutalist architecture filming locations in London or Berlin",
      "What are scenic coastal cliffs in California suitable for golden hour filming?",
      "Recommend recording studios in Tokyo with acoustic isolation rooms",
    ],
  },
  {
    id: "forensics",
    name: "Media Forensics & Fact-Checker",
    subtitle: "Search grounding, image origin, metadata & license checks",
    icon: FileCheck,
    defaultModel: "gemini-3.5-flash",
    systemInstruction:
      "You are a digital media forensics investigator. Rigorously analyze image metadata, OCR text snippets, origin sources, copyright legality, and visual authenticity using Google Search grounding.",
    suggestedPrompts: [
      "What are the historical origins of the golden hour photo concept?",
      "How to verify if an image is authentic or AI-generated?",
      "Explain the licensing rules for Creative Commons CC-BY-NC vs Public Domain",
    ],
  },
  {
    id: "fast_assistant",
    name: "High-Speed Production Assistant",
    subtitle: "Rapid tag generation, instant summaries & quick answers",
    icon: Zap,
    defaultModel: "gemini-3.1-flash-lite",
    systemInstruction:
      "You are a high-speed production assistant. Provide quick, direct, concise answers, summary bullets, and tag suggestions with minimal fluff.",
    suggestedPrompts: [
      "Generate 10 searchable tags for a neon cyberpunk street photo",
      "Give me 3 snappy headline ideas for an electronic music album",
      "Quick summary of difference between MP3 320kbps and AAC 256kbps",
    ],
  },
];

interface GeminiChatbotProps {
  media?: MediaItem | null;
  onSelectMedia?: (id: string) => void;
  availableMedia?: MediaItem[];
}

export const GeminiChatbot: React.FC<GeminiChatbotProps> = ({
  media,
  onSelectMedia,
  availableMedia = [],
}) => {
  // Selected Persona Role
  const [currentRoleId, setCurrentRoleId] = useState<string>("director");
  const activeRole = ROLES.find((r) => r.id === currentRoleId) || ROLES[0];

  // Model Selection: gemini-3.1-pro-preview (complex), gemini-3.5-flash (general), gemini-3.1-flash-lite (fast)
  const [selectedModel, setSelectedModel] = useState<
    "gemini-3.1-pro-preview" | "gemini-3.5-flash" | "gemini-3.1-flash-lite"
  >(activeRole.defaultModel);

  // Grounding Toggles
  const [enableGoogleSearch, setEnableGoogleSearch] = useState<boolean>(false);
  const [enableGoogleMaps, setEnableGoogleMaps] = useState<boolean>(false);

  // Attached media state
  const [attachedMedia, setAttachedMedia] = useState<MediaItem | null>(media || null);
  const [includeMediaInPrompt, setIncludeMediaInPrompt] = useState<boolean>(true);

  // Conversation history
  const [messages, setMessages] = useState<ChatMessageItem[]>([
    {
      id: "init_msg",
      role: "assistant",
      content: `Hello! I'm your **${activeRole.name}**. How can I help you today with your media productions, creative direction, or audio engineering?`,
      timestamp: Date.now(),
      modelUsed: selectedModel,
    },
  ]);

  const [input, setInput] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Microphone audio recording state
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const chatEndRef = useRef<HTMLDivElement>(null);

  // When role changes, set default model and clear or notify
  const handleSelectRole = (role: ChatbotRole) => {
    setCurrentRoleId(role.id);
    setSelectedModel(role.defaultModel);
    if (role.id === "location_scout") {
      setEnableGoogleMaps(true);
      setEnableGoogleSearch(false);
    } else if (role.id === "forensics") {
      setEnableGoogleSearch(true);
      setEnableGoogleMaps(false);
    }
  };

  // Scroll to bottom on new message
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Keep attached media updated if prop changes
  useEffect(() => {
    if (media) {
      setAttachedMedia(media);
    }
  }, [media]);

  const handleCopyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleClearHistory = () => {
    if (confirm("Clear conversation thread?")) {
      setMessages([
        {
          id: `init_${Date.now()}`,
          role: "assistant",
          content: `Thread cleared. I am ready as your **${activeRole.name}**. Ask me anything!`,
          timestamp: Date.now(),
          modelUsed: selectedModel,
        },
      ]);
    }
  };

  // Send message
  const handleSendMessage = async (textToSend?: string) => {
    const messageContent = (textToSend || input).trim();
    if (!messageContent || isLoading) return;

    const userMsgId = `msg_user_${Date.now()}`;
    const newUserMsg: ChatMessageItem = {
      id: userMsgId,
      role: "user",
      content: messageContent,
      timestamp: Date.now(),
      attachedMediaName: attachedMedia && includeMediaInPrompt ? attachedMedia.name : undefined,
    };

    setMessages((prev) => [...prev, newUserMsg]);
    setInput("");
    setIsLoading(true);

    try {
      // Build conversation payload
      const historyPayload = [...messages, newUserMsg].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      // If media is attached, prepare base64
      let mediaBase64: string | undefined = undefined;
      let mediaMimeType: string | undefined = undefined;

      if (attachedMedia && includeMediaInPrompt && attachedMedia.url) {
        try {
          const resp = await fetch(attachedMedia.url);
          const blob = await resp.blob();
          const reader = new FileReader();
          const base64Promise = new Promise<string>((resolve, reject) => {
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
          });
          reader.readAsDataURL(blob);
          mediaBase64 = await base64Promise;
          mediaMimeType = attachedMedia.mimeType || blob.type;
        } catch (e) {
          console.warn("Could not encode attached media, sending text only:", e);
        }
      }

      // Geolocation if maps is enabled
      let userLocation: { latitude: number; longitude: number } | undefined = undefined;
      if (enableGoogleMaps && navigator.geolocation) {
        try {
          const pos = await new Promise<GeolocationPosition>((res, rej) =>
            navigator.geolocation.getCurrentPosition(res, rej, { timeout: 3000 })
          );
          userLocation = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          };
        } catch (e) {
          // ignore geolocation error and proceed without userLocation
        }
      }

      const res = await fetch("/api/gemini/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: historyPayload,
          model: selectedModel,
          roleSystemInstruction: activeRole.systemInstruction,
          enableGoogleSearch,
          enableGoogleMaps,
          userLocation,
          mediaBase64,
          mediaMimeType,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Chat error (${res.status})`);
      }

      const data = await res.json();

      const assistantMsg: ChatMessageItem = {
        id: `msg_asst_${Date.now()}`,
        role: "assistant",
        content: data.reply || "No response received.",
        timestamp: Date.now(),
        modelUsed: data.modelUsed || selectedModel,
        searchSources: data.searchSources || [],
        mapsSources: data.mapsSources || [],
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      console.error("Chat failure:", err);
      const errorMsg: ChatMessageItem = {
        id: `msg_err_${Date.now()}`,
        role: "assistant",
        content: `⚠️ **Error encountered**: ${err.message || "Could not connect to Gemini service."}`,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  // Mic dictation to chat using gemini-3.5-transcribe
  const handleToggleMic = async () => {
    if (isRecording) {
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
        setIsRecording(false);
      }
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];

      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });

        // Transcribe blob with gemini-3.5-transcribe
        try {
          const reader = new FileReader();
          const base64Promise = new Promise<string>((resolve, reject) => {
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
          });
          reader.readAsDataURL(blob);
          const audioBase64 = await base64Promise;

          const res = await fetch("/api/gemini/transcribe-audio", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ audioBase64, mimeType: "audio/webm" }),
          });

          if (res.ok) {
            const data = await res.json();
            if (data.transcription) {
              setInput((prev) => (prev ? `${prev} ${data.transcription}` : data.transcription));
            }
          }
        } catch (e) {
          console.error("Transcribe mic failed:", e);
        }
      };

      recorder.start();
      setIsRecording(true);
    } catch (err: any) {
      alert(`Microphone access error: ${err.message}`);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-64px)] bg-slate-950 text-slate-100 overflow-hidden">
      {/* Top Bar: Persona / Role Switcher & Model Controls */}
      <div className="bg-slate-900 border-b border-slate-800 px-4 py-3 shrink-0 flex flex-wrap items-center justify-between gap-3">
        {/* Left: Role Dropdown / Selector */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <activeRole.icon className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-white">{activeRole.name}</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono border border-slate-700">
                Persona
              </span>
            </div>
            <p className="text-[11px] text-slate-400">{activeRole.subtitle}</p>
          </div>
        </div>

        {/* Middle: Role Selector Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto py-1">
          {ROLES.map((role) => {
            const Icon = role.icon;
            const isSelected = role.id === currentRoleId;
            return (
              <button
                key={role.id}
                onClick={() => handleSelectRole(role)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  isSelected
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span className="whitespace-nowrap">{role.name.split(" ")[0]}</span>
              </button>
            );
          })}
        </div>

        {/* Right: Model Selector & Grounding Options */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Model Selector */}
          <div className="flex items-center bg-slate-950 rounded-lg p-0.5 border border-slate-800 text-xs">
            <button
              onClick={() => setSelectedModel("gemini-3.5-flash")}
              className={`px-2.5 py-1 rounded-md transition-all ${
                selectedModel === "gemini-3.5-flash"
                  ? "bg-indigo-600 text-white font-semibold"
                  : "text-slate-400 hover:text-slate-200"
              }`}
              title="gemini-3.5-flash: General tasks & Grounding"
            >
              3.5 Flash
            </button>
            <button
              onClick={() => setSelectedModel("gemini-3.1-pro-preview")}
              className={`px-2.5 py-1 rounded-md transition-all ${
                selectedModel === "gemini-3.1-pro-preview"
                  ? "bg-purple-600 text-white font-semibold"
                  : "text-slate-400 hover:text-slate-200"
              }`}
              title="gemini-3.1-pro-preview: Complex tasks & Deep analysis"
            >
              3.1 Pro
            </button>
            <button
              onClick={() => setSelectedModel("gemini-3.1-flash-lite")}
              className={`px-2.5 py-1 rounded-md transition-all ${
                selectedModel === "gemini-3.1-flash-lite"
                  ? "bg-amber-600 text-white font-semibold"
                  : "text-slate-400 hover:text-slate-200"
              }`}
              title="gemini-3.1-flash-lite: Fast tasks & Low latency"
            >
              Flash Lite
            </button>
          </div>

          {/* Search Grounding Toggle */}
          <button
            onClick={() => {
              setEnableGoogleSearch(!enableGoogleSearch);
              if (!enableGoogleSearch) {
                setEnableGoogleMaps(false);
                setSelectedModel("gemini-3.5-flash");
              }
            }}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
              enableGoogleSearch
                ? "bg-blue-600/20 text-blue-300 border-blue-500/50 shadow-sm"
                : "bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200"
            }`}
            title="Google Search Grounding: Live web sources and citations"
          >
            <Search className="w-3.5 h-3.5" />
            <span>Search</span>
          </button>

          {/* Maps Grounding Toggle */}
          <button
            onClick={() => {
              setEnableGoogleMaps(!enableGoogleMaps);
              if (!enableGoogleMaps) {
                setEnableGoogleSearch(false);
                setSelectedModel("gemini-3.5-flash");
              }
            }}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
              enableGoogleMaps
                ? "bg-emerald-600/20 text-emerald-300 border-emerald-500/50 shadow-sm"
                : "bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200"
            }`}
            title="Google Maps Grounding: Real-world places, coordinates, and location links"
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>Maps</span>
          </button>

          {/* Clear history */}
          <button
            onClick={handleClearHistory}
            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors"
            title="Clear Chat Thread"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Conversation Thread */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => {
          const isUser = msg.role === "user";
          return (
            <div
              key={msg.id}
              className={`flex items-start gap-3 max-w-3xl ${
                isUser ? "ml-auto flex-row-reverse" : "mr-auto"
              }`}
            >
              {/* Avatar */}
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-xs shadow-md ${
                  isUser
                    ? "bg-indigo-600 text-white"
                    : "bg-purple-900/60 border border-purple-500/40 text-purple-200"
                }`}
              >
                {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>

              {/* Message Bubble */}
              <div className="space-y-2 max-w-[85%]">
                <div
                  className={`p-4 rounded-2xl text-xs sm:text-sm leading-relaxed shadow-md ${
                    isUser
                      ? "bg-indigo-600 text-white rounded-tr-none"
                      : "bg-slate-900 border border-slate-800 text-slate-200 rounded-tl-none"
                  }`}
                >
                  {/* Attached Media Pill */}
                  {msg.attachedMediaName && (
                    <div className="mb-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-indigo-700/50 text-[11px] font-mono text-indigo-200 border border-indigo-500/40">
                      <Paperclip className="w-3 h-3" />
                      <span>Context: {msg.attachedMediaName}</span>
                    </div>
                  )}

                  {/* Text Body */}
                  <div className="whitespace-pre-wrap selection:bg-indigo-500">
                    {msg.content}
                  </div>

                  {/* Search Sources Grounding Section */}
                  {msg.searchSources && msg.searchSources.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-slate-800 space-y-1.5">
                      <div className="text-[11px] font-semibold text-blue-400 flex items-center gap-1.5">
                        <Search className="w-3 h-3" />
                        <span>Google Search Grounding Sources</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {msg.searchSources.map((src, i) => (
                          <a
                            key={i}
                            href={src.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-blue-500/50 text-[11px] text-blue-300 hover:text-blue-200 transition-colors"
                          >
                            <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                            <span className="truncate max-w-[200px]">{src.title}</span>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Maps Grounding Section with direct links */}
                  {msg.mapsSources && msg.mapsSources.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-slate-800 space-y-1.5">
                      <div className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1.5">
                        <MapPin className="w-3 h-3" />
                        <span>Google Maps Grounding Locations</span>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        {msg.mapsSources.map((mapLoc, i) => (
                          <div
                            key={i}
                            className="p-2 rounded bg-slate-950 border border-slate-800 text-xs space-y-1"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-white">{mapLoc.title}</span>
                              <a
                                href={mapLoc.uri}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[11px] text-emerald-400 hover:text-emerald-300 underline font-medium"
                              >
                                View on Google Maps
                                <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                            </div>
                            {mapLoc.reviewSnippets && mapLoc.reviewSnippets.length > 0 && (
                              <p className="text-[11px] text-slate-400 italic">
                                "{mapLoc.reviewSnippets[0]}"
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Bubble Footer */}
                <div
                  className={`flex items-center gap-2 text-[10px] text-slate-500 ${
                    isUser ? "justify-end" : "justify-start"
                  }`}
                >
                  <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                  {msg.modelUsed && (
                    <span className="font-mono text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                      {msg.modelUsed}
                    </span>
                  )}
                  <button
                    onClick={() => handleCopyText(msg.content, msg.id)}
                    className="hover:text-slate-300 p-0.5 transition-colors"
                    title="Copy message"
                  >
                    {copiedId === msg.id ? (
                      <Check className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {isLoading && (
          <div className="flex items-start gap-3 max-w-xl">
            <div className="w-8 h-8 rounded-xl bg-purple-900/60 border border-purple-500/40 text-purple-200 flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4 animate-pulse" />
            </div>
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 text-xs text-slate-400 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-400 animate-spin" />
              <span>{activeRole.name} is thinking with {selectedModel}...</span>
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Suggested Quick Prompts */}
      <div className="px-4 py-2 bg-slate-900/60 border-t border-slate-800/80 flex items-center gap-2 overflow-x-auto shrink-0">
        <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider shrink-0 flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-indigo-400" />
          Suggestions:
        </span>
        {activeRole.suggestedPrompts.map((promptText, i) => (
          <button
            key={i}
            onClick={() => handleSendMessage(promptText)}
            className="px-2.5 py-1 rounded-full bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs whitespace-nowrap transition-colors hover:border-slate-700"
          >
            {promptText}
          </button>
        ))}
      </div>

      {/* Attached Media Bar */}
      {attachedMedia && (
        <div className="px-4 py-1.5 bg-slate-900 border-t border-slate-800 flex items-center justify-between text-xs text-slate-300">
          <div className="flex items-center gap-2">
            <Paperclip className="w-3.5 h-3.5 text-indigo-400" />
            <span>Active Asset: <strong className="text-white">{attachedMedia.name}</strong> ({attachedMedia.type})</span>
            <label className="flex items-center gap-1 ml-2 text-[11px] text-slate-400 cursor-pointer">
              <input
                type="checkbox"
                checked={includeMediaInPrompt}
                onChange={(e) => setIncludeMediaInPrompt(e.target.checked)}
                className="rounded border-slate-700 text-indigo-600 focus:ring-indigo-500"
              />
              <span>Send image/audio context</span>
            </label>
          </div>
          <button
            onClick={() => setAttachedMedia(null)}
            className="text-[11px] text-slate-500 hover:text-slate-300"
          >
            Detach
          </button>
        </div>
      )}

      {/* Bottom Message Input Box */}
      <div className="p-4 bg-slate-900 border-t border-slate-800 shrink-0">
        <div className="max-w-4xl mx-auto flex items-end gap-2 bg-slate-950 p-2 rounded-2xl border border-slate-800 focus-within:border-indigo-500 transition-colors shadow-xl">
          {/* Media Attachment Selector */}
          {availableMedia.length > 0 && (
            <div className="relative group">
              <button
                className="p-2 text-slate-400 hover:text-indigo-400 hover:bg-slate-900 rounded-xl transition-colors"
                title="Attach media asset from library"
              >
                <Paperclip className="w-4 h-4" />
              </button>
              <div className="hidden group-hover:block absolute bottom-full left-0 mb-2 w-64 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-2 z-50 max-h-60 overflow-y-auto">
                <div className="text-[11px] font-semibold text-slate-400 px-2 py-1">Attach Media:</div>
                {availableMedia.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => {
                      setAttachedMedia(m);
                      setIncludeMediaInPrompt(true);
                    }}
                    className="w-full text-left px-2 py-1.5 rounded-lg text-xs text-slate-200 hover:bg-slate-800 flex items-center justify-between"
                  >
                    <span className="truncate">{m.name}</span>
                    <span className="text-[10px] font-mono text-slate-400">{m.type}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Microphone Voice Dictation */}
          <button
            type="button"
            onClick={handleToggleMic}
            className={`p-2 rounded-xl transition-all ${
              isRecording
                ? "bg-rose-600 text-white animate-pulse"
                : "text-slate-400 hover:text-purple-400 hover:bg-slate-900"
            }`}
            title={isRecording ? "Stop dictation" : "Dictate prompt via gemini-3.5-transcribe"}
          >
            {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>

          {/* Text Area */}
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            placeholder={`Message ${activeRole.name}... (Press Enter to send, Shift+Enter for newline)`}
            rows={1}
            className="flex-1 bg-transparent border-0 text-slate-100 placeholder-slate-500 text-xs sm:text-sm focus:outline-none focus:ring-0 resize-none max-h-32 py-2"
          />

          {/* Send Button */}
          <button
            type="button"
            onClick={() => handleSendMessage()}
            disabled={!input.trim() || isLoading}
            className="p-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-xl shadow-md transition-all shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>

        {/* Footer info */}
        <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2 px-2">
          <span>Active Role: <strong className="text-slate-300">{activeRole.name}</strong></span>
          <div className="flex items-center gap-3">
            {enableGoogleSearch && <span className="text-blue-400">● Search Grounding On</span>}
            {enableGoogleMaps && <span className="text-emerald-400">● Maps Grounding On</span>}
            <span>Model: <span className="font-mono text-slate-300">{selectedModel}</span></span>
          </div>
        </div>
      </div>
    </div>
  );
};
