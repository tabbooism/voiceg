import React, { useState, useRef, useEffect } from "react";
import {
  Mic,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Download,
  Upload,
  RefreshCw,
  Sliders,
  Sparkles,
  Layers,
  FileAudio,
  HardDrive,
  Activity,
  Radio,
} from "lucide-react";
import { MediaItem, VoiceIsolationResult } from "../types";
import {
  getAudioContext,
  decodeAudioBuffer,
  isolateVocalStems,
  renderMasterMix,
  renderAudioVisualization,
  createSyntheticAudioBuffer,
  encodeWAV,
  encodeMP3,
  exportAudioTrack,
  exportSeparateStems,
} from "../lib/audioIsolation";
import { uploadMediaToDrive, getAccessToken } from "../lib/firebase";
import { AudioTranscriber } from "./AudioTranscriber";

interface VoiceIsolatorProps {
  media: MediaItem | null;
  onUpdateMedia: (updated: MediaItem) => void;
  onSelectMedia: (id: string) => void;
  allMedia: MediaItem[];
}

export const VoiceIsolator: React.FC<VoiceIsolatorProps> = ({
  media,
  onUpdateMedia,
  onSelectMedia,
  allMedia,
}) => {
  // Processing state
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState("");

  // Export settings & state
  const [exportFormat, setExportFormat] = useState<"wav" | "mp3">("wav");
  const [targetBitDepth, setTargetBitDepth] = useState<16 | 24 | 32>(24);
  const [targetBitrate, setTargetBitrate] = useState<128 | 192 | 256 | 320>(256);
  const [isExporting, setIsExporting] = useState<string | null>(null);

  // Stems & Audio Playback State
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Multitrack Mixer controls
  const [vocalGain, setVocalGain] = useState(1.0); // 0 to 2.0 (0% - 200%)
  const [instGain, setInstGain] = useState(1.0);
  const [vocalMute, setVocalMute] = useState(false);
  const [instMute, setInstMute] = useState(false);
  const [vocalPan, setVocalPan] = useState(0.0); // -1.0 to +1.0
  const [masterVolume, setMasterVolume] = useState(1.0);

  // Visualization mode
  const [visualizerMode, setVisualizerMode] = useState<"hybrid" | "oscilloscope" | "spectrum">("hybrid");

  // Sub-view: Stem mixer vs Speech Transcriber
  const [audioSubView, setAudioSubView] = useState<"stems" | "transcribe">("stems");

  // Web Audio Nodes & References
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const vocalAudioRef = useRef<HTMLAudioElement | null>(null);
  const instAudioRef = useRef<HTMLAudioElement | null>(null);

  const vocalSourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const instSourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);

  const vocalGainNodeRef = useRef<GainNode | null>(null);
  const instGainNodeRef = useRef<GainNode | null>(null);
  const vocalPanNodeRef = useRef<StereoPannerNode | null>(null);
  const masterGainNodeRef = useRef<GainNode | null>(null);
  const analyserNodeRef = useRef<AnalyserNode | null>(null);

  // Transcription state
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcription, setTranscription] = useState<string | null>(
    media?.voiceIsolation?.transcription || null
  );

  // Drive export status
  const [isExportingToDrive, setIsExportingToDrive] = useState(false);

  // Initialize Web Audio graph
  useEffect(() => {
    if (!vocalAudioRef.current || !instAudioRef.current) return;

    try {
      const ctx = getAudioContext();

      if (!analyserNodeRef.current) {
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        analyserNodeRef.current = analyser;

        const masterGain = ctx.createGain();
        masterGain.gain.value = masterVolume;
        masterGain.connect(analyser);
        analyser.connect(ctx.destination);
        masterGainNodeRef.current = masterGain;
      }

      if (!vocalGainNodeRef.current && vocalAudioRef.current) {
        const vSource = ctx.createMediaElementSource(vocalAudioRef.current);
        const vGain = ctx.createGain();
        const vPan = ctx.createStereoPanner();
        vSource.connect(vGain);
        vGain.connect(vPan);
        if (masterGainNodeRef.current) vPan.connect(masterGainNodeRef.current);

        vocalSourceNodeRef.current = vSource;
        vocalGainNodeRef.current = vGain;
        vocalPanNodeRef.current = vPan;
      }

      if (!instGainNodeRef.current && instAudioRef.current) {
        const iSource = ctx.createMediaElementSource(instAudioRef.current);
        const iGain = ctx.createGain();
        iSource.connect(iGain);
        if (masterGainNodeRef.current) iGain.connect(masterGainNodeRef.current);

        instSourceNodeRef.current = iSource;
        instGainNodeRef.current = iGain;
      }
    } catch (e) {
      console.warn("Audio node setup notice:", e);
    }
  }, [media?.voiceIsolation]);

  // Update gains & panners
  useEffect(() => {
    if (vocalGainNodeRef.current) {
      vocalGainNodeRef.current.gain.value = vocalMute ? 0 : vocalGain;
    }
    if (instGainNodeRef.current) {
      instGainNodeRef.current.gain.value = instMute ? 0 : instGain;
    }
    if (vocalPanNodeRef.current) {
      vocalPanNodeRef.current.pan.value = vocalPan;
    }
    if (masterGainNodeRef.current) {
      masterGainNodeRef.current.gain.value = masterVolume;
    }
  }, [vocalGain, instGain, vocalMute, instMute, vocalPan, masterVolume]);

  // Animation frame loop for canvas visualization
  useEffect(() => {
    const loop = () => {
      if (canvasRef.current && analyserNodeRef.current) {
        renderAudioVisualization(canvasRef.current, analyserNodeRef.current, visualizerMode);
      }
      animFrameRef.current = requestAnimationFrame(loop);
    };

    loop();

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [visualizerMode]);

  // Handle Play/Pause synchronization
  const togglePlayPause = () => {
    const vAudio = vocalAudioRef.current;
    const iAudio = instAudioRef.current;
    const ctx = getAudioContext();

    if (ctx.state === "suspended") {
      ctx.resume();
    }

    if (isPlaying) {
      vAudio?.pause();
      iAudio?.pause();
      setIsPlaying(false);
    } else {
      if (vAudio && iAudio) {
        // Sync playhead
        iAudio.currentTime = vAudio.currentTime;
        vAudio.play();
        iAudio.play();
        setIsPlaying(true);
      }
    }
  };

  // Perform Voice Isolation DSP
  const handlePerformIsolation = async () => {
    if (!media) return;

    setIsProcessing(true);
    setProgress(5);
    setCurrentStep("Initializing audio buffer...");

    try {
      let audioBuffer: AudioBuffer;

      if (media.url.startsWith("data:image/svg+xml")) {
        // Generate high fidelity synthesized multichannel audio buffer with centered vocals & stereo accompaniment
        const ctx = getAudioContext();
        audioBuffer = createSyntheticAudioBuffer(ctx, 8);
      } else {
        const res = await fetch(media.url);
        const arrayBuf = await res.arrayBuffer();
        audioBuffer = await decodeAudioBuffer(arrayBuf);
      }

      setDuration(audioBuffer.duration);

      const result: VoiceIsolationResult = await isolateVocalStems(
        audioBuffer,
        (pct, step) => {
          setProgress(pct);
          setCurrentStep(step);
        },
        targetBitDepth
      );

      onUpdateMedia({
        ...media,
        voiceIsolation: result,
        updatedAt: Date.now(),
      });

      setProgress(100);
      setCurrentStep("Isolation complete!");
    } catch (err: any) {
      console.error("Voice isolation error:", err);
      alert(`Voice isolation DSP failed: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Transcribe isolated voice with gemini-3.5-transcribe
  const handleTranscribeVoice = async () => {
    if (!media?.voiceIsolation?.vocalStemUrl) return;

    setIsTranscribing(true);
    try {
      const res = await fetch(media.voiceIsolation.vocalStemUrl);
      const blob = await res.blob();

      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = async () => {
        const base64Audio = reader.result as string;
        const apiRes = await fetch("/api/gemini/transcribe-audio", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            audioBase64: base64Audio,
            mimeType: "audio/wav",
          }),
        });

        if (!apiRes.ok) throw new Error("Transcription request failed.");
        const data = await apiRes.json();
        const text = data.transcription || "No clear speech detected.";
        setTranscription(text);

        onUpdateMedia({
          ...media,
          voiceIsolation: {
            ...media.voiceIsolation!,
            transcription: text,
          },
          updatedAt: Date.now(),
        });
      };
    } catch (err: any) {
      alert(`Transcription error: ${err.message}`);
    } finally {
      setIsTranscribing(false);
    }
  };

  // Export isolated stem, separate tracks, or master mix using helper functions
  const handleExportStem = async (type: "vocal" | "instrumental" | "master" | "both") => {
    if (!media?.voiceIsolation) return;

    try {
      setIsExporting(type);

      if (type === "both") {
        await exportSeparateStems(
          media.voiceIsolation.vocalStemUrl,
          media.voiceIsolation.instrumentalStemUrl,
          media.name,
          exportFormat,
          {
            bitDepth: targetBitDepth,
            mp3Bitrate: targetBitrate,
          }
        );
      } else if (type === "master") {
        const mixBlob = await renderMasterMix(
          media.voiceIsolation.vocalStemUrl,
          media.voiceIsolation.instrumentalStemUrl,
          vocalMute ? 0 : vocalGain,
          instMute ? 0 : instGain,
          vocalPan,
          targetBitDepth
        );
        await exportAudioTrack({
          source: mixBlob,
          trackType: "master",
          baseFilename: media.name,
          format: exportFormat,
          bitDepth: targetBitDepth,
          mp3Bitrate: targetBitrate,
          autoDownload: true,
        });
      } else {
        const sourceUrl =
          type === "vocal"
            ? media.voiceIsolation.vocalStemUrl
            : media.voiceIsolation.instrumentalStemUrl;

        await exportAudioTrack({
          source: sourceUrl,
          trackType: type,
          baseFilename: media.name,
          format: exportFormat,
          bitDepth: targetBitDepth,
          mp3Bitrate: targetBitrate,
          autoDownload: true,
        });
      }
    } catch (err: any) {
      console.error("Audio track export error:", err);
      alert(`Audio track export error: ${err.message}`);
    } finally {
      setIsExporting(null);
    }
  };

  // Export stems directly to Google Drive
  const handleExportToGoogleDrive = async () => {
    if (!media?.voiceIsolation) return;

    const token = await getAccessToken();
    if (!token) {
      alert("Please connect Google Drive in the top navigation bar to enable cloud sync.");
      return;
    }

    setIsExportingToDrive(true);
    try {
      const vocalRes = await fetch(media.voiceIsolation.vocalStemUrl);
      const vocalBlob = await vocalRes.blob();

      await uploadMediaToDrive(
        token,
        vocalBlob,
        `${media.name.replace(/\.[^/.]+$/, "")}_VOCAL_STEM_${targetBitDepth}bit.wav`,
        "audio/wav"
      );

      alert("Vocal stem uploaded to Google Drive successfully!");
    } catch (err: any) {
      alert(`Google Drive upload error: ${err.message}`);
    } finally {
      setIsExportingToDrive(false);
    }
  };

  // Selectable audio items in library
  const audioAssets = allMedia.filter((m) => m.type === "audio" || m.type === "video");

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-60px)] overflow-hidden bg-slate-950 text-slate-200">
      {/* Hidden audio elements for vocal & instrumental stems */}
      {media?.voiceIsolation && (
        <>
          <audio
            ref={vocalAudioRef}
            src={media.voiceIsolation.vocalStemUrl}
            onTimeUpdate={(e) => setCurrentTime((e.target as HTMLAudioElement).currentTime)}
            onEnded={() => setIsPlaying(false)}
            crossOrigin="anonymous"
          />
          <audio
            ref={instAudioRef}
            src={media.voiceIsolation.instrumentalStemUrl}
            crossOrigin="anonymous"
          />
        </>
      )}

      {/* Main Studio Console: Waveform Visualizer & Multitrack Mixer */}
      <div className="flex-1 flex flex-col bg-slate-950 border-r border-slate-800 overflow-hidden relative">
        {/* Console Header Bar */}
        <div className="p-3.5 border-b border-slate-800 bg-slate-900/60 flex items-center justify-between text-xs">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-semibold text-white">Voice & Audio Studio</span>
            </div>

            {/* Sub-view switcher */}
            <div className="flex bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-[11px]">
              <button
                id="btn-subview-stems"
                onClick={() => setAudioSubView("stems")}
                className={`px-2.5 py-1 rounded font-medium transition-all ${
                  audioSubView === "stems"
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Stem Separator & Mixer
              </button>
              <button
                id="btn-subview-transcribe"
                onClick={() => setAudioSubView("transcribe")}
                className={`px-2.5 py-1 rounded font-medium transition-all flex items-center gap-1 ${
                  audioSubView === "transcribe"
                    ? "bg-purple-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Mic className="w-3 h-3 text-purple-300" />
                <span>Microphone & Audio Transcriber</span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Asset Selector */}
            <select
              value={media?.id || ""}
              onChange={(e) => onSelectMedia(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded px-2.5 py-1 text-xs text-slate-300 focus:outline-none"
            >
              {allMedia.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.type})
                </option>
              ))}
            </select>

            {/* Visualizer Mode selector */}
            {audioSubView === "stems" && (
              <div className="flex bg-slate-900 p-0.5 rounded-lg border border-slate-800">
                <button
                  onClick={() => setVisualizerMode("hybrid")}
                  className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                    visualizerMode === "hybrid" ? "bg-slate-800 text-white" : "text-slate-400"
                  }`}
                >
                  Hybrid
                </button>
                <button
                  onClick={() => setVisualizerMode("oscilloscope")}
                  className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                    visualizerMode === "oscilloscope" ? "bg-slate-800 text-white" : "text-slate-400"
                  }`}
                >
                  Oscilloscope
                </button>
                <button
                  onClick={() => setVisualizerMode("spectrum")}
                  className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                    visualizerMode === "spectrum" ? "bg-slate-800 text-white" : "text-slate-400"
                  }`}
                >
                  Spectrum
                </button>
              </div>
            )}
          </div>
        </div>

        {audioSubView === "transcribe" ? (
          <div className="flex-1 p-6 overflow-y-auto bg-slate-950">
            <AudioTranscriber media={media} />
          </div>
        ) : (
          <>
            <div className="flex-1 flex flex-col p-6 items-center justify-center bg-gradient-to-b from-slate-950 via-slate-900/40 to-slate-950 relative overflow-hidden">
          <div className="w-full max-w-4xl bg-slate-950/80 border border-slate-800 rounded-2xl shadow-2xl p-4 flex flex-col items-center">
            {/* Visualization Stage Canvas */}
            <div className="w-full h-56 bg-slate-950 rounded-xl overflow-hidden relative border border-slate-800/80 mb-4">
              <canvas
                ref={canvasRef}
                width={800}
                height={224}
                className="w-full h-full block"
              />

              {/* Peak dB indicator labels */}
              <div className="absolute top-2 left-3 flex items-center gap-2 text-[10px] font-mono text-emerald-400">
                <Radio className="w-3 h-3 text-emerald-400" />
                <span>REAL-TIME SPECTROGRAM & STEM METERS</span>
              </div>
              <div className="absolute top-2 right-3 text-[10px] font-mono text-slate-500">
                0 dBFS PEAK
              </div>
            </div>

            {/* Transport & Playback Bar */}
            <div className="w-full flex items-center justify-between gap-4 px-2">
              <div className="flex items-center gap-3">
                <button
                  id="btn-play-pause-audio"
                  onClick={togglePlayPause}
                  disabled={!media?.voiceIsolation}
                  className="w-11 h-11 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white flex items-center justify-center shadow-lg shadow-indigo-600/20 transition-transform active:scale-95"
                >
                  {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
                </button>

                <div>
                  <span className="text-xs font-mono text-white block">
                    {Math.floor(currentTime / 60)}:
                    {Math.floor(currentTime % 60).toString().padStart(2, "0")} /{" "}
                    {Math.floor(duration / 60)}:
                    {Math.floor(duration % 60).toString().padStart(2, "0")}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {media?.voiceIsolation ? "Stems Synced & Active" : "Stems Not Isolated"}
                  </span>
                </div>
              </div>

              {/* Voice Isolation Action Button */}
              <div className="flex items-center gap-2">
                <button
                  id="btn-isolate-voice"
                  onClick={handlePerformIsolation}
                  disabled={isProcessing}
                  className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-lg shadow-purple-600/20 transition-all"
                >
                  <Mic className={`w-4 h-4 ${isProcessing ? "animate-bounce text-amber-300" : ""}`} />
                  <span>{isProcessing ? "Extracting Voice Stems..." : "Isolate Vocals & Stems"}</span>
                </button>
              </div>
            </div>

            {/* Progress Bar (during processing) */}
            {isProcessing && (
              <div className="w-full mt-4 bg-slate-900 border border-slate-800 rounded-xl p-3">
                <div className="flex items-center justify-between text-xs text-purple-300 mb-1.5 font-medium">
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 animate-spin text-purple-400" />
                    {currentStep}
                  </span>
                  <span className="font-mono">{progress}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full transition-all duration-200"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Multitrack Stems Mixer Console */}
        <div className="p-4 bg-slate-900/80 border-t border-slate-800">
          <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Track 1: Isolated Vocals */}
            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-purple-500 shadow-sm shadow-purple-500/50" />
                  <span className="text-xs font-bold text-white uppercase tracking-wider">
                    Track 1: Isolated Vocals
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    id="btn-quick-export-vocal"
                    onClick={() => handleExportStem("vocal")}
                    disabled={!media?.voiceIsolation || isExporting !== null}
                    title={`Export isolated vocal track as .${exportFormat}`}
                    className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-950/80 hover:bg-purple-900 border border-purple-800/80 text-purple-300 flex items-center gap-1 transition-colors disabled:opacity-40"
                  >
                    <Download className="w-3 h-3" />
                    <span>{isExporting === "vocal" ? "Exporting..." : `.${exportFormat.toUpperCase()}`}</span>
                  </button>
                  <button
                    onClick={() => setVocalMute(!vocalMute)}
                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold transition-colors ${
                      vocalMute
                        ? "bg-rose-600 text-white"
                        : "bg-slate-800 text-slate-400 hover:text-white"
                    }`}
                  >
                    MUTE
                  </button>
                  <button
                    onClick={() => {
                      setVocalMute(false);
                      setInstMute(true);
                    }}
                    className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-800 text-slate-400 hover:bg-amber-600 hover:text-white transition-colors"
                  >
                    SOLO
                  </button>
                </div>
              </div>

              {/* Vocal Volume slider */}
              <div className="space-y-2 text-xs">
                <div>
                  <div className="flex justify-between text-slate-300 text-[11px] mb-1">
                    <span>Vocal Stem Gain</span>
                    <span className="font-mono text-purple-400">{Math.round(vocalGain * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="2"
                    step="0.01"
                    value={vocalGain}
                    onChange={(e) => setVocalGain(Number(e.target.value))}
                    className="w-full accent-purple-500"
                  />
                </div>

                {/* Vocal Stereo Pan */}
                <div>
                  <div className="flex justify-between text-slate-300 text-[11px] mb-1">
                    <span>Stereo Pan</span>
                    <span className="font-mono text-slate-400">
                      {vocalPan === 0 ? "Center" : vocalPan < 0 ? `L ${Math.abs(Math.round(vocalPan * 100))}%` : `R ${Math.round(vocalPan * 100)}%`}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="-1"
                    max="1"
                    step="0.05"
                    value={vocalPan}
                    onChange={(e) => setVocalPan(Number(e.target.value))}
                    className="w-full accent-indigo-500"
                  />
                </div>
              </div>
            </div>

            {/* Track 2: Instrumental & Backing Stem */}
            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-sky-500 shadow-sm shadow-sky-500/50" />
                  <span className="text-xs font-bold text-white uppercase tracking-wider">
                    Track 2: Instrumental / Music
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    id="btn-quick-export-inst"
                    onClick={() => handleExportStem("instrumental")}
                    disabled={!media?.voiceIsolation || isExporting !== null}
                    title={`Export isolated instrumental track as .${exportFormat}`}
                    className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-sky-950/80 hover:bg-sky-900 border border-sky-800/80 text-sky-300 flex items-center gap-1 transition-colors disabled:opacity-40"
                  >
                    <Download className="w-3 h-3" />
                    <span>{isExporting === "instrumental" ? "Exporting..." : `.${exportFormat.toUpperCase()}`}</span>
                  </button>
                  <button
                    onClick={() => setInstMute(!instMute)}
                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold transition-colors ${
                      instMute
                        ? "bg-rose-600 text-white"
                        : "bg-slate-800 text-slate-400 hover:text-white"
                    }`}
                  >
                    MUTE
                  </button>
                  <button
                    onClick={() => {
                      setInstMute(false);
                      setVocalMute(true);
                    }}
                    className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-800 text-slate-400 hover:bg-amber-600 hover:text-white transition-colors"
                  >
                    SOLO
                  </button>
                </div>
              </div>

              {/* Instrumental Volume slider */}
              <div className="space-y-2 text-xs">
                <div>
                  <div className="flex justify-between text-slate-300 text-[11px] mb-1">
                    <span>Instrumental Gain</span>
                    <span className="font-mono text-sky-400">{Math.round(instGain * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="2"
                    step="0.01"
                    value={instGain}
                    onChange={(e) => setInstGain(Number(e.target.value))}
                    className="w-full accent-sky-500"
                  />
                </div>

                {/* Master Volume */}
                <div>
                  <div className="flex justify-between text-slate-300 text-[11px] mb-1">
                    <span>Master Output Volume</span>
                    <span className="font-mono text-slate-400">{Math.round(masterVolume * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1.5"
                    step="0.05"
                    value={masterVolume}
                    onChange={(e) => setMasterVolume(Number(e.target.value))}
                    className="w-full accent-slate-400"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
          </>
        )}
      </div>

      {/* Right Sidebar: Professional Export & Gemini Speech-to-Text */}
      <div className="w-full lg:w-84 bg-slate-900/90 border-l border-slate-800 flex flex-col shrink-0 overflow-y-auto p-4 gap-5 text-xs">
        {/* Format & Fidelity Settings */}
        <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-400 uppercase tracking-wider font-semibold text-[10px]">
              Export Audio Format
            </span>
            <span className="text-[10px] font-mono text-purple-400 font-semibold uppercase">
              {exportFormat === "wav" ? `${targetBitDepth}-bit PCM` : `${targetBitrate} kbps`}
            </span>
          </div>

          {/* Format Toggle: WAV vs MP3 */}
          <div className="grid grid-cols-2 gap-1.5 mb-3 bg-slate-900 p-1 rounded-lg border border-slate-800">
            <button
              id="format-select-wav"
              onClick={() => setExportFormat("wav")}
              className={`py-1.5 rounded text-xs font-semibold transition-all ${
                exportFormat === "wav"
                  ? "bg-purple-600 text-white shadow-sm shadow-purple-600/50"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              WAV (Lossless)
            </button>
            <button
              id="format-select-mp3"
              onClick={() => setExportFormat("mp3")}
              className={`py-1.5 rounded text-xs font-semibold transition-all ${
                exportFormat === "mp3"
                  ? "bg-purple-600 text-white shadow-sm shadow-purple-600/50"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              MP3 (Universal)
            </button>
          </div>

          {/* Quality Selectors */}
          <span className="text-slate-400 uppercase tracking-wider font-semibold text-[10px] block mb-1.5">
            {exportFormat === "wav" ? "Bit Depth Resolution" : "MP3 Bitrate (LAME Encoding)"}
          </span>

          {exportFormat === "wav" ? (
            <div className="grid grid-cols-3 gap-1.5 mb-2">
              <button
                onClick={() => setTargetBitDepth(16)}
                className={`py-1.5 rounded text-xs font-mono font-medium border transition-colors ${
                  targetBitDepth === 16
                    ? "bg-purple-600 text-white border-purple-500"
                    : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white"
                }`}
              >
                16-bit
              </button>
              <button
                onClick={() => setTargetBitDepth(24)}
                className={`py-1.5 rounded text-xs font-mono font-medium border transition-colors ${
                  targetBitDepth === 24
                    ? "bg-purple-600 text-white border-purple-500"
                    : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white"
                }`}
              >
                24-bit Studio
              </button>
              <button
                onClick={() => setTargetBitDepth(32)}
                className={`py-1.5 rounded text-xs font-mono font-medium border transition-colors ${
                  targetBitDepth === 32
                    ? "bg-purple-600 text-white border-purple-500"
                    : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white"
                }`}
              >
                32-bit Float
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-1.5 mb-2">
              <button
                onClick={() => setTargetBitrate(192)}
                className={`py-1.5 rounded text-xs font-mono font-medium border transition-colors ${
                  targetBitrate === 192
                    ? "bg-purple-600 text-white border-purple-500"
                    : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white"
                }`}
              >
                192k
              </button>
              <button
                onClick={() => setTargetBitrate(256)}
                className={`py-1.5 rounded text-xs font-mono font-medium border transition-colors ${
                  targetBitrate === 256
                    ? "bg-purple-600 text-white border-purple-500"
                    : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white"
                }`}
              >
                256k HQ
              </button>
              <button
                onClick={() => setTargetBitrate(320)}
                className={`py-1.5 rounded text-xs font-mono font-medium border transition-colors ${
                  targetBitrate === 320
                    ? "bg-purple-600 text-white border-purple-500"
                    : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white"
                }`}
              >
                320k Max
              </button>
            </div>
          )}

          <p className="text-[11px] text-slate-400 leading-relaxed">
            {exportFormat === "wav"
              ? "Lossless linear PCM encoding for direct DAW import in Pro Tools, Logic Pro, Ableton, and Premiere."
              : "High-grade LAME MP3 encoding for immediate sharing, podcasts, portable devices, and web audio playback."}
          </p>
        </div>

        {/* Stem Export Actions */}
        <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-slate-400 uppercase tracking-wider font-semibold text-[10px]">
              Download Audio Tracks
            </span>
            <span className="text-[10px] text-slate-500 font-mono uppercase">
              Separate Files
            </span>
          </div>

          {/* Export Isolated Vocals */}
          <button
            id="btn-download-vocal-stem"
            onClick={() => handleExportStem("vocal")}
            disabled={!media?.voiceIsolation || isExporting !== null}
            className="w-full flex items-center justify-between p-2.5 rounded-lg bg-purple-950/60 hover:bg-purple-900/60 disabled:opacity-40 border border-purple-800/80 text-purple-200 transition-colors"
          >
            <span className="flex items-center gap-2">
              <Download className="w-4 h-4 text-purple-400" />
              <span className="font-semibold">
                {isExporting === "vocal" ? "Exporting Vocal Track..." : "Export Isolated Vocals"}
              </span>
            </span>
            <span className="text-[10px] font-mono text-purple-400 font-bold uppercase">
              .{exportFormat}
            </span>
          </button>

          {/* Export Instrumental Track */}
          <button
            id="btn-download-inst-stem"
            onClick={() => handleExportStem("instrumental")}
            disabled={!media?.voiceIsolation || isExporting !== null}
            className="w-full flex items-center justify-between p-2.5 rounded-lg bg-sky-950/60 hover:bg-sky-900/60 disabled:opacity-40 border border-sky-800/80 text-sky-200 transition-colors"
          >
            <span className="flex items-center gap-2">
              <Download className="w-4 h-4 text-sky-400" />
              <span className="font-semibold">
                {isExporting === "instrumental" ? "Exporting Instrumental Track..." : "Export Instrumental Track"}
              </span>
            </span>
            <span className="text-[10px] font-mono text-sky-400 font-bold uppercase">
              .{exportFormat}
            </span>
          </button>

          {/* Export Both Tracks Separately */}
          <button
            id="btn-download-both-stems"
            onClick={() => handleExportStem("both")}
            disabled={!media?.voiceIsolation || isExporting !== null}
            className="w-full flex items-center justify-between p-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-40 border border-slate-700/80 text-slate-200 transition-colors"
          >
            <span className="flex items-center gap-2">
              <RefreshCw className={`w-4 h-4 text-emerald-400 ${isExporting === "both" ? "animate-spin" : ""}`} />
              <span className="font-semibold">
                {isExporting === "both" ? "Downloading Both Files..." : "Export Both Stems (Separate Files)"}
              </span>
            </span>
            <span className="text-[10px] font-mono text-emerald-400 font-bold uppercase">
              2x .{exportFormat}
            </span>
          </button>

          {/* Export Custom Master Mix */}
          <button
            id="btn-download-master-mix"
            onClick={() => handleExportStem("master")}
            disabled={!media?.voiceIsolation || isExporting !== null}
            className="w-full flex items-center justify-between p-2.5 rounded-lg bg-indigo-950/60 hover:bg-indigo-900/60 disabled:opacity-40 border border-indigo-800/80 text-indigo-200 transition-colors"
          >
            <span className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-400" />
              <span className="font-semibold">
                {isExporting === "master" ? "Rendering Master Mix..." : "Export Custom Master Mix"}
              </span>
            </span>
            <span className="text-[10px] font-mono text-indigo-400 font-bold uppercase">
              .{exportFormat}
            </span>
          </button>

          {/* Sync to Google Drive */}
          <button
            id="btn-export-drive"
            onClick={handleExportToGoogleDrive}
            disabled={!media?.voiceIsolation || isExportingToDrive}
            className="w-full flex items-center justify-center gap-1.5 p-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-40 border border-slate-800 text-slate-300 transition-colors mt-2"
          >
            <HardDrive className="w-4 h-4 text-sky-400" />
            <span>{isExportingToDrive ? "Uploading to Drive..." : "Upload Stems to Google Drive"}</span>
          </button>
        </div>

        {/* Gemini Speech Transcription */}
        <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-400 uppercase tracking-wider font-semibold text-[10px]">
              Vocal Transcription (gemini-3.5-transcribe)
            </span>
            <button
              onClick={handleTranscribeVoice}
              disabled={!media?.voiceIsolation || isTranscribing}
              className="text-[11px] text-purple-400 hover:text-purple-300 disabled:opacity-40"
            >
              {isTranscribing ? "Transcribing..." : "Transcribe"}
            </button>
          </div>

          {transcription ? (
            <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800 text-slate-200 text-xs leading-relaxed">
              {transcription}
            </div>
          ) : (
            <p className="text-[11px] text-slate-500 italic">
              Extract vocals first, then click Transcribe to generate searchable spoken lyrics & dialogue.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
