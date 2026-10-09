import { VoiceIsolationResult } from "../types";
import { Mp3Encoder } from "@breezystack/lamejs";

/**
 * High-Performance Web Audio DSP Engine for Voice Isolation & Multitrack Stems
 */

// Shared AudioContext for playback and analysis
let sharedAudioCtx: AudioContext | null = null;

export function getAudioContext(): AudioContext {
  if (!sharedAudioCtx || sharedAudioCtx.state === "closed") {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    sharedAudioCtx = new AudioCtx();
  }
  if (sharedAudioCtx.state === "suspended") {
    sharedAudioCtx.resume();
  }
  return sharedAudioCtx;
}

/**
 * Decodes audio from an ArrayBuffer, File, or Blob
 */
export async function decodeAudioBuffer(data: ArrayBuffer): Promise<AudioBuffer> {
  const ctx = getAudioContext();
  // slice buffer to prevent detach issues in safari/chrome
  return await ctx.decodeAudioData(data.slice(0));
}

/**
 * Synthesizes a dual-frequency audio buffer with speech-like vocal tones + background stereo chords
 */
export function createSyntheticAudioBuffer(audioCtx: AudioContext, durationSeconds = 6): AudioBuffer {
  const sampleRate = audioCtx.sampleRate;
  const numSamples = Math.floor(sampleRate * durationSeconds);
  const buffer = audioCtx.createBuffer(2, numSamples, sampleRate);
  const left = buffer.getChannelData(0);
  const right = buffer.getChannelData(1);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const vocalEnv = Math.max(0, Math.sin(t * 5.0)) * (0.5 + 0.5 * Math.sin(t * 1.5));
    const vocalFundamental = Math.sin(2 * Math.PI * 260 * t);
    const vocalHarmonic1 = 0.5 * Math.sin(2 * Math.PI * 520 * t);
    const vocalHarmonic2 = 0.25 * Math.sin(2 * Math.PI * 780 * t);
    const centerVocal = (vocalFundamental + vocalHarmonic1 + vocalHarmonic2) * vocalEnv * 0.45;

    const bass = 0.25 * Math.sin(2 * Math.PI * 130 * t);
    const synthLeft = 0.15 * Math.sin(2 * Math.PI * 330 * t) + bass;
    const synthRight = 0.15 * Math.sin(2 * Math.PI * 392 * t) + bass;

    left[i] = centerVocal + synthLeft;
    right[i] = centerVocal + synthRight;
  }

  return buffer;
}

/**
 * Center-Channel & Vocal Formant Extraction DSP
 * Deconstructs audio into:
 * 1. Isolated Vocal Stem (panned center + vocal formant pass + harmonic enhancement)
 * 2. Background / Instrumental Stem (ambient sides + out-of-phase cancellation)
 */
export async function isolateVocalStems(
  audioBuffer: AudioBuffer,
  onProgress?: (progress: number, step: string) => void,
  bitDepth: 16 | 24 | 32 = 24
): Promise<VoiceIsolationResult> {
  const sampleRate = audioBuffer.sampleRate;
  const numChannels = audioBuffer.numberOfChannels;
  const length = audioBuffer.length;
  const duration = audioBuffer.duration;

  onProgress?.(15, "Decoding audio channels and preparing DSP pipeline...");

  // Channel buffers
  const left = audioBuffer.getChannelData(0);
  const right = numChannels > 1 ? audioBuffer.getChannelData(1) : left;

  // Offline rendering context for fast processing
  const offlineCtx = new OfflineAudioContext(2, length, sampleRate);

  // Allocate destination Float32Arrays for isolated vocals and background
  const vocalLeft = new Float32Array(length);
  const vocalRight = new Float32Array(length);
  const instLeft = new Float32Array(length);
  const instRight = new Float32Array(length);

  onProgress?.(35, "Applying Mid-Side decomposition and spectral center extraction...");

  // Formant bandpass coefficients simulation for vocal clarity (85Hz - 3800Hz)
  // Simple yet clean IIR state filters for center isolation
  let hpStateL = 0;
  let hpStateR = 0;
  let lpStateL = 0;
  let lpStateR = 0;
  const hpAlpha = 0.985; // ~100Hz rumble high-pass
  const lpAlpha = 0.35;  // ~4kHz low-pass smoothing for harsh cymbals

  // Peak analysis for visualizer
  const peakSamples = 128;
  const step = Math.floor(length / peakSamples);
  const waveformPeaks: number[] = [];

  for (let i = 0; i < length; i++) {
    const l = left[i];
    const r = right[i];

    // Mid signal = (L + R) / 2 (Vocals predominantly reside here)
    // Side signal = (L - R) / 2 (Wide stereo instruments, synths, reverb)
    const mid = (l + r) * 0.5;
    const side = (l - r) * 0.5;

    // High-pass filter mid to remove sub-bass rumble
    hpStateL = hpAlpha * (hpStateL + mid - (i > 0 ? (left[i - 1] + right[i - 1]) * 0.5 : 0));
    // Low-pass smooth to focus on vocal fundamentals & formants
    lpStateL = lpStateL + lpAlpha * (hpStateL - lpStateL);

    // Dynamic gate / center weighting
    const correlation = Math.abs(mid) / (Math.abs(mid) + Math.abs(side) + 0.0001);
    const centerWeight = Math.min(1.0, Math.max(0.0, (correlation - 0.3) * 1.8));

    // Isolated vocal sample with harmonic body
    const vocalSample = (mid * 0.75 + lpStateL * 0.45) * centerWeight;

    // Vocal stem (centered stereo)
    vocalLeft[i] = vocalSample;
    vocalRight[i] = vocalSample;

    // Instrumental stem (subtract isolated vocals from original mix, retaining stereo width)
    instLeft[i] = l - vocalSample * 0.92;
    instRight[i] = r - vocalSample * 0.92;

    // Waveform peak sampling
    if (i % step === 0 && waveformPeaks.length < peakSamples) {
      waveformPeaks.push(Math.max(Math.abs(vocalSample), Math.abs(instLeft[i])));
    }
  }

  onProgress?.(70, "Encoding high-fidelity 24-bit PCM lossless WAV stems...");

  // Build AudioBuffers for exporting
  const vocalBuffer = offlineCtx.createBuffer(2, length, sampleRate);
  vocalBuffer.copyToChannel(vocalLeft, 0);
  vocalBuffer.copyToChannel(vocalRight, 1);

  const instBuffer = offlineCtx.createBuffer(2, length, sampleRate);
  instBuffer.copyToChannel(instLeft, 0);
  instBuffer.copyToChannel(instRight, 1);

  // Encode both stems to WAV Blobs
  const vocalBlob = encodeWAV(vocalBuffer, bitDepth);
  const instBlob = encodeWAV(instBuffer, bitDepth);

  const vocalStemUrl = URL.createObjectURL(vocalBlob);
  const instrumentalStemUrl = URL.createObjectURL(instBlob);

  onProgress?.(100, "Stems isolated and ready for post-production export!");

  return {
    vocalStemUrl,
    instrumentalStemUrl,
    duration,
    sampleRate,
    bitDepth,
    channels: 2,
    vocalGain: 1.0,
    instrumentalGain: 1.0,
    pan: 0.0,
    waveformPeaks,
  };
}

/**
 * Lossless WAV (RIFF) PCM Encoder supporting 16-bit, 24-bit, and 32-bit Float
 */
export function encodeWAV(audioBuffer: AudioBuffer, bitDepth: 16 | 24 | 32 = 24): Blob {
  const numChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const length = audioBuffer.length;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = length * blockAlign;

  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  // Helper to write ASCII strings
  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  /* RIFF identifier */
  writeString(0, "RIFF");
  /* RIFF chunk length */
  view.setUint32(4, 36 + dataSize, true);
  /* RIFF type */
  writeString(8, "WAVE");
  /* format chunk identifier */
  writeString(12, "fmt ");
  /* format chunk length */
  view.setUint32(16, 16, true);
  /* sample format (1 = PCM, 3 = IEEE Float) */
  view.setUint16(20, bitDepth === 32 ? 3 : 1, true);
  /* channel count */
  view.setUint16(22, numChannels, true);
  /* sample rate */
  view.setUint32(24, sampleRate, true);
  /* byte rate (sample rate * block align) */
  view.setUint32(28, byteRate, true);
  /* block align (channels * bytes/sample) */
  view.setUint16(32, blockAlign, true);
  /* bits per sample */
  view.setUint16(34, bitDepth, true);
  /* data chunk identifier */
  writeString(36, "data");
  /* data chunk length */
  view.setUint32(40, dataSize, true);

  // Write channel interleaved audio samples
  const channels: Float32Array[] = [];
  for (let c = 0; c < numChannels; c++) {
    channels.push(audioBuffer.getChannelData(c));
  }

  let offset = 44;
  if (bitDepth === 16) {
    for (let i = 0; i < length; i++) {
      for (let c = 0; c < numChannels; c++) {
        let sample = Math.max(-1, Math.min(1, channels[c][i]));
        const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
        view.setInt16(offset, intSample, true);
        offset += 2;
      }
    }
  } else if (bitDepth === 24) {
    for (let i = 0; i < length; i++) {
      for (let c = 0; c < numChannels; c++) {
        let sample = Math.max(-1, Math.min(1, channels[c][i]));
        const intSample = sample < 0 ? sample * 0x800000 : sample * 0x7fffff;
        const val = Math.floor(intSample);
        view.setUint8(offset, val & 0xff);
        view.setUint8(offset + 1, (val >> 8) & 0xff);
        view.setUint8(offset + 2, (val >> 16) & 0xff);
        offset += 3;
      }
    }
  } else if (bitDepth === 32) {
    for (let i = 0; i < length; i++) {
      for (let c = 0; c < numChannels; c++) {
        view.setFloat32(offset, channels[c][i], true);
        offset += 4;
      }
    }
  }

  return new Blob([buffer], { type: "audio/wav" });
}

/**
 * Renders a multitrack custom master mix of vocals and instrumental stems
 */
export async function renderMasterMix(
  vocalBlobUrl: string,
  instBlobUrl: string,
  vocalGain: number = 1.0,
  instGain: number = 1.0,
  vocalPan: number = 0.0,
  bitDepth: 16 | 24 | 32 = 24
): Promise<Blob> {
  const [vocalRes, instRes] = await Promise.all([
    fetch(vocalBlobUrl).then((r) => r.arrayBuffer()),
    fetch(instBlobUrl).then((r) => r.arrayBuffer()),
  ]);

  const ctx = getAudioContext();
  const [vocalBuf, instBuf] = await Promise.all([
    ctx.decodeAudioData(vocalRes.slice(0)),
    ctx.decodeAudioData(instRes.slice(0)),
  ]);

  const length = Math.max(vocalBuf.length, instBuf.length);
  const sampleRate = vocalBuf.sampleRate;

  const offlineCtx = new OfflineAudioContext(2, length, sampleRate);

  // Vocal Track Source & Nodes
  const vocalSource = offlineCtx.createBufferSource();
  vocalSource.buffer = vocalBuf;
  const vocalGainNode = offlineCtx.createGain();
  vocalGainNode.gain.value = vocalGain;

  // Vocal Panner
  const vocalPanner = offlineCtx.createStereoPanner();
  vocalPanner.pan.value = Math.max(-1, Math.min(1, vocalPan));

  vocalSource.connect(vocalGainNode);
  vocalGainNode.connect(vocalPanner);
  vocalPanner.connect(offlineCtx.destination);

  // Instrumental Track Source & Nodes
  const instSource = offlineCtx.createBufferSource();
  instSource.buffer = instBuf;
  const instGainNode = offlineCtx.createGain();
  instGainNode.gain.value = instGain;

  instSource.connect(instGainNode);
  instGainNode.connect(offlineCtx.destination);

  // Start both simultaneously
  vocalSource.start(0);
  instSource.start(0);

  const mixedBuffer = await offlineCtx.startRendering();
  return encodeWAV(mixedBuffer, bitDepth);
}

/**
 * Draws real-time oscilloscope and frequency spectrum onto an HTML canvas
 */
export function renderAudioVisualization(
  canvas: HTMLCanvasElement,
  analyser: AnalyserNode,
  mode: "oscilloscope" | "spectrum" | "hybrid" = "hybrid"
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const width = canvas.width;
  const height = canvas.height;
  const bufferLength = analyser.frequencyBinCount;
  const timeData = new Uint8Array(bufferLength);
  const freqData = new Uint8Array(bufferLength);

  analyser.getByteTimeDomainData(timeData);
  analyser.getByteFrequencyData(freqData);

  ctx.clearRect(0, 0, width, height);

  // Background subtle grid
  ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
  ctx.lineWidth = 1;
  for (let x = 0; x < width; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 0; y < height; y += 20) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  // Draw Frequency Spectrum Bars (Teal to Blue)
  if (mode === "spectrum" || mode === "hybrid") {
    const barWidth = (width / bufferLength) * 2.5;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
      const barHeight = (freqData[i] / 255) * height * 0.75;

      const gradient = ctx.createLinearGradient(0, height, 0, height - barHeight);
      gradient.addColorStop(0, "rgba(59, 130, 246, 0.2)");
      gradient.addColorStop(0.5, "rgba(14, 165, 233, 0.6)");
      gradient.addColorStop(1, "rgba(99, 102, 241, 0.85)");

      ctx.fillStyle = gradient;
      ctx.fillRect(x, height - barHeight, barWidth - 1, barHeight);

      x += barWidth;
      if (x > width) break;
    }
  }

  // Draw Oscilloscope Waveform Line (Emerald Cyan Glow)
  if (mode === "oscilloscope" || mode === "hybrid") {
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#10b981";
    ctx.shadowBlur = 8;
    ctx.shadowColor = "rgba(16, 185, 129, 0.5)";

    ctx.beginPath();
    const sliceWidth = width / bufferLength;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
      const v = timeData[i] / 128.0;
      const y = (v * height) / 2;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
      x += sliceWidth;
    }

    ctx.lineTo(width, height / 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }
}

/**
 * Normalizes an audio source (AudioBuffer, Blob, or URL string) to an AudioBuffer
 */
export async function audioSourceToBuffer(source: AudioBuffer | Blob | string): Promise<AudioBuffer> {
  if (source instanceof AudioBuffer) {
    return source;
  }
  let arrayBuf: ArrayBuffer;
  if (typeof source === "string") {
    const res = await fetch(source);
    arrayBuf = await res.arrayBuffer();
  } else if (source instanceof Blob) {
    arrayBuf = await source.arrayBuffer();
  } else {
    throw new Error("Unsupported audio source type for conversion.");
  }
  return await decodeAudioBuffer(arrayBuf);
}

/**
 * Encodes an AudioBuffer to high-fidelity MP3 using LAME Pure JS Encoder
 */
export function encodeMP3(
  audioBuffer: AudioBuffer,
  kbps: 128 | 192 | 256 | 320 = 256
): Blob {
  const numChannels = Math.min(2, audioBuffer.numberOfChannels);
  const sampleRate = audioBuffer.sampleRate;
  const mp3encoder = new Mp3Encoder(numChannels, sampleRate, kbps);
  const mp3Data: Uint8Array[] = [];

  const leftFloat = audioBuffer.getChannelData(0);
  const rightFloat = numChannels > 1 ? audioBuffer.getChannelData(1) : leftFloat;
  const length = audioBuffer.length;

  // Convert Float32Array [-1.0, 1.0] to Int16Array for LAME encoder
  const leftInt16 = new Int16Array(length);
  const rightInt16 = numChannels > 1 ? new Int16Array(length) : undefined;

  for (let i = 0; i < length; i++) {
    const sL = Math.max(-1, Math.min(1, leftFloat[i]));
    leftInt16[i] = sL < 0 ? sL * 0x8000 : sL * 0x7fff;

    if (rightInt16) {
      const sR = Math.max(-1, Math.min(1, rightFloat[i]));
      rightInt16[i] = sR < 0 ? sR * 0x8000 : sR * 0x7fff;
    }
  }

  const sampleBlockSize = 1152;
  for (let i = 0; i < length; i += sampleBlockSize) {
    const leftChunk = leftInt16.subarray(i, i + sampleBlockSize);
    let mp3buf: Uint8Array;
    if (numChannels === 1 || !rightInt16) {
      mp3buf = mp3encoder.encodeBuffer(leftChunk);
    } else {
      const rightChunk = rightInt16.subarray(i, i + sampleBlockSize);
      mp3buf = mp3encoder.encodeBuffer(leftChunk, rightChunk);
    }
    if (mp3buf && mp3buf.length > 0) {
      mp3Data.push(mp3buf);
    }
  }

  const end = mp3encoder.flush();
  if (end && end.length > 0) {
    mp3Data.push(end);
  }

  return new Blob(mp3Data as unknown as BlobPart[], { type: "audio/mp3" });
}

/**
 * Triggers a native browser file download for an audio Blob
 */
export function triggerAudioDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export interface ExportTrackOptions {
  source: AudioBuffer | Blob | string;
  trackType: "vocal" | "instrumental" | "master";
  baseFilename: string;
  format: "wav" | "mp3";
  bitDepth?: 16 | 24 | 32;
  mp3Bitrate?: 128 | 192 | 256 | 320;
  autoDownload?: boolean;
}

/**
 * Primary helper function to export and download an isolated vocal, instrumental, or master track
 */
export async function exportAudioTrack(
  options: ExportTrackOptions
): Promise<{ blob: Blob; filename: string; url: string }> {
  const {
    source,
    trackType,
    baseFilename,
    format,
    bitDepth = 24,
    mp3Bitrate = 256,
    autoDownload = true,
  } = options;

  const audioBuffer = await audioSourceToBuffer(source);
  let blob: Blob;

  const cleanName = baseFilename.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9_-]/g, "_");
  const trackSuffix = trackType.toUpperCase();
  let qualitySuffix = "";

  if (format === "mp3") {
    blob = encodeMP3(audioBuffer, mp3Bitrate);
    qualitySuffix = `${mp3Bitrate}kbps`;
  } else {
    blob = encodeWAV(audioBuffer, bitDepth);
    qualitySuffix = `${bitDepth}bit`;
  }

  const filename = `${cleanName}_${trackSuffix}_STEM_${qualitySuffix}.${format}`;
  const url = URL.createObjectURL(blob);

  if (autoDownload) {
    triggerAudioDownload(blob, filename);
  }

  return { blob, filename, url };
}

/**
 * Helper function to export both vocal and instrumental tracks as separate files in a single flow
 */
export async function exportSeparateStems(
  vocalSource: AudioBuffer | Blob | string,
  instrumentalSource: AudioBuffer | Blob | string,
  baseFilename: string,
  format: "wav" | "mp3" = "wav",
  options?: {
    bitDepth?: 16 | 24 | 32;
    mp3Bitrate?: 128 | 192 | 256 | 320;
  }
): Promise<{
  vocal: { blob: Blob; filename: string };
  instrumental: { blob: Blob; filename: string };
}> {
  const vocal = await exportAudioTrack({
    source: vocalSource,
    trackType: "vocal",
    baseFilename,
    format,
    bitDepth: options?.bitDepth,
    mp3Bitrate: options?.mp3Bitrate,
    autoDownload: true,
  });

  // Short delay to avoid browser blocking multiple simultaneous downloads
  await new Promise((resolve) => setTimeout(resolve, 400));

  const instrumental = await exportAudioTrack({
    source: instrumentalSource,
    trackType: "instrumental",
    baseFilename,
    format,
    bitDepth: options?.bitDepth,
    mp3Bitrate: options?.mp3Bitrate,
    autoDownload: true,
  });

  return {
    vocal: { blob: vocal.blob, filename: vocal.filename },
    instrumental: { blob: instrumental.blob, filename: instrumental.filename },
  };
}
