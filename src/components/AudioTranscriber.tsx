import React, { useState, useRef, useEffect } from "react";
import {
  Mic,
  MicOff,
  Sparkles,
  Copy,
  Check,
  FileText,
  Volume2,
  RefreshCw,
  Upload,
  AlertCircle,
  Download,
  MessageSquare,
} from "lucide-react";
import { MediaItem } from "../types";

interface AudioTranscriberProps {
  media?: MediaItem | null;
  onSendToChat?: (text: string) => void;
  onTranscriptionComplete?: (text: string) => void;
}

export const AudioTranscriber: React.FC<AudioTranscriberProps> = ({
  media,
  onSendToChat,
  onTranscriptionComplete,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcript, setTranscript] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  // Format seconds to mm:ss
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  // Start microphone recording
  const handleStartRecording = async () => {
    setErrorMsg(null);
    setAudioBlob(null);
    setAudioUrl(null);
    setRecordingSeconds(0);
    audioChunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/mp4")
        ? "audio/mp4"
        : "";

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const type = recorder.mimeType || "audio/webm";
        const blob = new Blob(audioChunksRef.current, { type });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
        }
      };

      recorder.start(250);
      setIsRecording(true);

      timerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.error("Microphone access error:", err);
      setErrorMsg(err.message || "Could not access microphone. Please grant browser permissions.");
    }
  };

  // Stop recording
  const handleStopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  // Perform Gemini 3.5 Transcribe
  const handleTranscribeBlob = async (blobToTranscribe: Blob, mimeType: string) => {
    setIsTranscribing(true);
    setErrorMsg(null);

    try {
      // Convert Blob to base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
          const res = reader.result as string;
          resolve(res);
        };
        reader.onerror = reject;
      });
      reader.readAsDataURL(blobToTranscribe);
      const audioBase64 = await base64Promise;

      const res = await fetch("/api/gemini/transcribe-audio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audioBase64,
          mimeType: mimeType || "audio/webm",
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Transcription request failed (${res.status})`);
      }

      const data = await res.json();
      const text = data.transcription || "No transcription generated.";
      setTranscript(text);
      if (onTranscriptionComplete) {
        onTranscriptionComplete(text);
      }
    } catch (err: any) {
      console.error("Transcription failed:", err);
      setErrorMsg(err.message || "Failed to transcribe audio.");
    } finally {
      setIsTranscribing(false);
    }
  };

  // Transcribe recorded microphone audio
  const handleTranscribeRecorded = () => {
    if (!audioBlob) return;
    handleTranscribeBlob(audioBlob, audioBlob.type || "audio/webm");
  };

  // Transcribe selected library media asset if it's audio
  const handleTranscribeSelectedMedia = async () => {
    if (!media) return;
    setIsTranscribing(true);
    setErrorMsg(null);
    try {
      const resp = await fetch(media.url);
      const blob = await resp.blob();
      await handleTranscribeBlob(blob, media.mimeType || "audio/wav");
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to load selected media for transcription.");
      setIsTranscribing(false);
    }
  };

  const handleCopy = () => {
    if (!transcript) return;
    navigator.clipboard.writeText(transcript);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadTxt = () => {
    if (!transcript) return;
    const blob = new Blob([transcript], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Transcription_${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-slate-200 shadow-xl space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
            <Mic className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-white flex items-center gap-2">
              Gemini Audio Transcriber
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-purple-950 text-purple-300 border border-purple-800">
                gemini-3.5-transcribe
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              Speak into your microphone or transcribe audio files with high-precision speech-to-text.
            </p>
          </div>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3 bg-rose-950/60 border border-rose-800 text-rose-300 text-xs rounded-xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Recording & Input Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Mic Recording Card */}
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/90 flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Mic className="w-3.5 h-3.5 text-purple-400" />
              Live Microphone Input
            </span>
            {isRecording && (
              <span className="flex items-center gap-1.5 text-xs font-mono text-rose-400 animate-pulse font-bold">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                REC {formatTime(recordingSeconds)}
              </span>
            )}
          </div>

          <p className="text-[11px] text-slate-400">
            Record voice notes, interviews, audio clips, or podcasts directly from your device microphone.
          </p>

          <div className="flex items-center gap-2 pt-1">
            {!isRecording ? (
              <button
                id="btn-start-transcribe-record"
                onClick={handleStartRecording}
                className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-md shadow-purple-600/20 transition-all"
              >
                <Mic className="w-4 h-4" />
                <span>Start Recording</span>
              </button>
            ) : (
              <button
                id="btn-stop-transcribe-record"
                onClick={handleStopRecording}
                className="flex items-center gap-2 bg-rose-600 hover:bg-rose-500 text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-md shadow-rose-600/30 animate-pulse transition-all"
              >
                <MicOff className="w-4 h-4" />
                <span>Stop & Preview ({formatTime(recordingSeconds)})</span>
              </button>
            )}

            {audioBlob && !isRecording && (
              <button
                onClick={handleTranscribeRecorded}
                disabled={isTranscribing}
                className="flex items-center gap-1.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-40 text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-sm transition-all"
              >
                {isTranscribing ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5" />
                )}
                <span>{isTranscribing ? "Transcribing..." : "Transcribe Mic Audio"}</span>
              </button>
            )}
          </div>

          {audioUrl && !isRecording && (
            <div className="pt-2 border-t border-slate-900">
              <audio controls src={audioUrl} className="w-full h-8" />
            </div>
          )}
        </div>

        {/* Selected Media Audio Card */}
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/90 flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Volume2 className="w-3.5 h-3.5 text-indigo-400" />
              Active Media Asset Audio
            </span>
            {media && (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-indigo-300 truncate max-w-[130px]">
                {media.name}
              </span>
            )}
          </div>

          <p className="text-[11px] text-slate-400">
            {media?.type === "audio" || media?.type === "video"
              ? `Ready to transcribe "${media.name}" using gemini-3.5-transcribe.`
              : "Select an audio track in the library or record with mic on the left."}
          </p>

          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={handleTranscribeSelectedMedia}
              disabled={isTranscribing || !media || (media.type !== "audio" && media.type !== "video")}
              className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-sm transition-all"
            >
              {isTranscribing ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5" />
              )}
              <span>{isTranscribing ? "Transcribing Asset..." : "Transcribe Selected Asset"}</span>
            </button>
          </div>

          {media?.type === "audio" && (
            <div className="pt-2 border-t border-slate-900">
              <audio controls src={media.url} className="w-full h-8" />
            </div>
          )}
        </div>
      </div>

      {/* Transcription Output Area */}
      {transcript && (
        <div className="bg-slate-950 p-4 rounded-xl border border-indigo-900/40 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-white">
              <FileText className="w-4 h-4 text-emerald-400" />
              <span>Full Verbatim Transcription</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs font-mono text-slate-300 hover:text-white transition-colors"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copied ? "Copied" : "Copy"}</span>
              </button>

              <button
                onClick={handleDownloadTxt}
                className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs font-mono text-slate-300 hover:text-white transition-colors"
              >
                <Download className="w-3 h-3" />
                <span>Save .TXT</span>
              </button>

              {onSendToChat && (
                <button
                  onClick={() => onSendToChat(transcript)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition-colors"
                >
                  <MessageSquare className="w-3 h-3" />
                  <span>Send to Chat</span>
                </button>
              )}
            </div>
          </div>

          <div className="bg-slate-900/90 p-3.5 rounded-lg border border-slate-800 text-xs text-slate-200 leading-relaxed font-sans whitespace-pre-wrap max-h-60 overflow-y-auto selection:bg-indigo-500">
            {transcript}
          </div>
        </div>
      )}
    </div>
  );
};
