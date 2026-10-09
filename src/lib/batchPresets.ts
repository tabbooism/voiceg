import JSZip from "jszip";
import { MediaItem, BatchExportConfig, BatchExportPreset } from "../types";
import { encodeMP3, encodeWAV, audioSourceToBuffer, triggerAudioDownload } from "./audioIsolation";

export const DEFAULT_PRESETS: BatchExportPreset[] = [
  {
    id: "preset_web_optimized",
    name: "Web Optimized",
    badge: "WebP • 1080p • 82%",
    description: "Compact WebP at 82% quality (max 1920px), 192k MP3, metadata scrubbed for blazing fast web loading.",
    category: "web",
    isDefault: true,
    config: {
      imageFormat: "webp",
      imageQuality: 0.82,
      maxDimension: 1920,
      audioFormat: "mp3",
      audioBitDepth: 16,
      audioBitrate: 192,
      pipeline: "auto_color",
      includeMetadataManifest: true,
      stripExifPrivacy: true,
      packageAsZip: true,
    },
  },
  {
    id: "preset_high_fidelity",
    name: "High Fidelity Archive",
    badge: "Lossless PNG • 24-bit WAV",
    description: "Lossless uncompressed PNG & 24-bit Studio WAV with full camera EXIF preservation and JSON manifest sidecars.",
    category: "archive",
    isDefault: true,
    config: {
      imageFormat: "png",
      imageQuality: 1.0,
      maxDimension: 0,
      audioFormat: "wav",
      audioBitDepth: 24,
      audioBitrate: 320,
      pipeline: "ai_inspect",
      includeMetadataManifest: true,
      stripExifPrivacy: false,
      packageAsZip: true,
    },
  },
  {
    id: "preset_social_ready",
    name: "Social Media / UGC Ready",
    badge: "Vibrant JPEG • 1080px Fit",
    description: "High-contrast color-graded JPEG (90% quality, 1080px max fit), 256k HQ MP3, tuned for Instagram, X, and feeds.",
    category: "social",
    isDefault: true,
    config: {
      imageFormat: "jpeg",
      imageQuality: 0.9,
      maxDimension: 1080,
      audioFormat: "mp3",
      audioBitDepth: 16,
      audioBitrate: 256,
      pipeline: "auto_color",
      includeMetadataManifest: false,
      stripExifPrivacy: true,
      packageAsZip: true,
    },
  },
  {
    id: "preset_audio_stems",
    name: "Podcast & Stem Isolation",
    badge: "Vocal/Inst Stems • 24-bit",
    description: "Deconstruct multi-channel audio tracks into separate vocal and instrumental stem files with Studio mastering.",
    category: "audio",
    isDefault: true,
    config: {
      imageFormat: "original",
      imageQuality: 0.95,
      maxDimension: 0,
      audioFormat: "wav",
      audioBitDepth: 24,
      audioBitrate: 320,
      pipeline: "voice_isolate",
      includeMetadataManifest: true,
      stripExifPrivacy: false,
      packageAsZip: true,
    },
  },
  {
    id: "preset_privacy_sanitize",
    name: "Privacy-First Local Sanitize",
    badge: "Zero-Cloud • Scrubbed GPS",
    description: "100% on-device client canvas processing, completely scrubbed GPS and camera metadata, WebP 85%.",
    category: "privacy",
    isDefault: true,
    config: {
      imageFormat: "webp",
      imageQuality: 0.85,
      maxDimension: 1920,
      audioFormat: "mp3",
      audioBitDepth: 16,
      audioBitrate: 192,
      pipeline: "local_scan",
      includeMetadataManifest: false,
      stripExifPrivacy: true,
      packageAsZip: true,
    },
  },
  {
    id: "preset_google_lookup",
    name: "Google Verified & Cataloged",
    badge: "Source Discovery • Sidecar",
    description: "Reverse source-verified attribution stamp, deep OCR, object tags, and rich structured JSON sidecar bundle.",
    category: "archive",
    isDefault: true,
    config: {
      imageFormat: "original",
      imageQuality: 0.92,
      maxDimension: 0,
      audioFormat: "wav",
      audioBitDepth: 24,
      audioBitrate: 256,
      pipeline: "source_lookup",
      includeMetadataManifest: true,
      stripExifPrivacy: false,
      packageAsZip: true,
    },
  },
];

const PRESETS_STORAGE_KEY = "media_vision_batch_presets_v2";

/**
 * Load all presets: built-in defaults combined with user-saved custom presets
 */
export function getSavedPresets(): BatchExportPreset[] {
  try {
    const raw = localStorage.getItem(PRESETS_STORAGE_KEY);
    if (!raw) return DEFAULT_PRESETS;
    const customList: BatchExportPreset[] = JSON.parse(raw);
    return [...DEFAULT_PRESETS, ...customList];
  } catch (err) {
    console.error("Failed to parse saved presets from localStorage:", err);
    return DEFAULT_PRESETS;
  }
}

/**
 * Save a custom user preset to localStorage
 */
export function saveCustomPreset(preset: Omit<BatchExportPreset, "id" | "isDefault">): BatchExportPreset {
  const newPreset: BatchExportPreset = {
    ...preset,
    id: `custom_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    isDefault: false,
    category: "custom",
    createdAt: Date.now(),
  };

  try {
    const raw = localStorage.getItem(PRESETS_STORAGE_KEY);
    const existing: BatchExportPreset[] = raw ? JSON.parse(raw) : [];
    existing.push(newPreset);
    localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(existing));
  } catch (err) {
    console.error("Failed to save custom preset to localStorage:", err);
  }

  return newPreset;
}

/**
 * Delete a custom preset from localStorage
 */
export function deleteCustomPreset(id: string): void {
  try {
    const raw = localStorage.getItem(PRESETS_STORAGE_KEY);
    if (!raw) return;
    const existing: BatchExportPreset[] = JSON.parse(raw);
    const filtered = existing.filter((p) => p.id !== id);
    localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(filtered));
  } catch (err) {
    console.error("Failed to delete custom preset:", err);
  }
}

/**
 * Reset custom presets back to pure defaults
 */
export function resetCustomPresets(): void {
  localStorage.removeItem(PRESETS_STORAGE_KEY);
}

/**
 * Process and convert a single image asset according to export configuration
 */
export async function processImageToBlob(
  item: MediaItem,
  config: BatchExportConfig
): Promise<{ blob: Blob; filename: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      let width = img.naturalWidth || img.width;
      let height = img.naturalHeight || img.height;

      // Calculate resized dimensions if maxDimension is set
      if (config.maxDimension > 0 && (width > config.maxDimension || height > config.maxDimension)) {
        if (width >= height) {
          height = Math.round((height * config.maxDimension) / width);
          width = config.maxDimension;
        } else {
          width = Math.round((width * config.maxDimension) / height);
          height = config.maxDimension;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        return reject(new Error("Could not create canvas 2D context"));
      }

      // Apply CSS-like filter effects if item has color settings
      if (item.editSettings) {
        const { brightness, contrast, saturation, sepia, grayscale, invert, blur } = item.editSettings;
        ctx.filter = `brightness(${100 + brightness}%) contrast(${100 + contrast}%) saturate(${100 + saturation}%) sepia(${sepia}%) grayscale(${grayscale}%) invert(${invert}%) blur(${blur}px)`;
      }

      ctx.drawImage(img, 0, 0, width, height);

      let mimeType = "image/jpeg";
      let ext = "jpg";

      if (config.imageFormat === "webp") {
        mimeType = "image/webp";
        ext = "webp";
      } else if (config.imageFormat === "png") {
        mimeType = "image/png";
        ext = "png";
      } else if (config.imageFormat === "original") {
        mimeType = item.mimeType?.startsWith("image/") ? item.mimeType : "image/jpeg";
        ext = mimeType.split("/")[1]?.replace("jpeg", "jpg") || "jpg";
      }

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            return reject(new Error("Canvas blob conversion failed"));
          }
          const baseName = item.name.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9_-]/g, "_");
          const filename = `${baseName}_exported.${ext}`;
          resolve({ blob, filename });
        },
        mimeType,
        config.imageQuality
      );
    };

    img.onerror = () => {
      reject(new Error(`Failed to load image asset: ${item.name}`));
    };

    img.src = item.url;
  });
}

/**
 * Execute bulk export for multiple media items according to a chosen preset configuration
 */
export async function executeBulkExport(
  items: MediaItem[],
  preset: BatchExportPreset,
  onProgress?: (current: number, total: number, message: string) => void
): Promise<{ zipBlob?: Blob; filename?: string; filesCount: number }> {
  const config = preset.config;
  const zip = config.packageAsZip ? new JSZip() : null;
  const manifestItems: any[] = [];
  let exportedCount = 0;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const stepMsg = `Exporting ${item.name} (${i + 1}/${items.length})...`;
    if (onProgress) onProgress(i, items.length, stepMsg);

    try {
      if (item.type === "image") {
        const { blob, filename } = await processImageToBlob(item, config);
        if (zip) {
          zip.file(`images/${filename}`, blob);
        } else {
          triggerAudioDownload(blob, filename);
        }
        exportedCount++;
      } else if (item.type === "audio") {
        // If voice isolation stems exist, export them
        if (item.voiceIsolation) {
          const vBuffer = await audioSourceToBuffer(item.voiceIsolation.vocalStemUrl);
          const iBuffer = await audioSourceToBuffer(item.voiceIsolation.instrumentalStemUrl);

          let vBlob: Blob;
          let iBlob: Blob;
          let ext = "wav";

          if (config.audioFormat === "mp3") {
            vBlob = encodeMP3(vBuffer, config.audioBitrate);
            iBlob = encodeMP3(iBuffer, config.audioBitrate);
            ext = "mp3";
          } else {
            vBlob = encodeWAV(vBuffer, config.audioBitDepth);
            iBlob = encodeWAV(iBuffer, config.audioBitDepth);
            ext = "wav";
          }

          const base = item.name.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9_-]/g, "_");
          const vName = `${base}_VOCAL_STEM.${ext}`;
          const iName = `${base}_INSTRUMENTAL_STEM.${ext}`;

          if (zip) {
            zip.file(`audio_stems/${vName}`, vBlob);
            zip.file(`audio_stems/${iName}`, iBlob);
          } else {
            triggerAudioDownload(vBlob, vName);
            await new Promise((r) => setTimeout(r, 200));
            triggerAudioDownload(iBlob, iName);
          }
          exportedCount += 2;
        } else {
          // Standard audio file export
          const buf = await audioSourceToBuffer(item.url);
          let aBlob: Blob;
          let ext = "wav";
          if (config.audioFormat === "mp3") {
            aBlob = encodeMP3(buf, config.audioBitrate);
            ext = "mp3";
          } else {
            aBlob = encodeWAV(buf, config.audioBitDepth);
            ext = "wav";
          }
          const aName = `${item.name.replace(/\.[^/.]+$/, "")}.${ext}`;
          if (zip) {
            zip.file(`audio/${aName}`, aBlob);
          } else {
            triggerAudioDownload(aBlob, aName);
          }
          exportedCount++;
        }
      }

      // Record metadata in manifest
      if (config.includeMetadataManifest) {
        manifestItems.push({
          id: item.id,
          name: item.name,
          type: item.type,
          category: item.category,
          tags: item.tags,
          summary: item.summary,
          altText: item.altText,
          ocrSnippet: item.ocrText ? item.ocrText.substring(0, 300) : undefined,
          sourceLookup: item.sourceLookup ? {
            verifiedSource: item.sourceLookup.verifiedSource,
            licenseType: item.sourceLookup.licenseType,
            firstSeen: item.sourceLookup.firstSeen,
          } : undefined,
          cameraMetadata: config.stripExifPrivacy ? undefined : item.imageMediaMetadata,
        });
      }
    } catch (err) {
      console.warn(`Failed to export asset ${item.name}:`, err);
    }
  }

  // Include Manifest JSON in Zip if configured
  if (zip && config.includeMetadataManifest && manifestItems.length > 0) {
    const manifestContent = JSON.stringify(
      {
        presetApplied: preset.name,
        presetDescription: preset.description,
        configUsed: config,
        exportedAt: new Date().toISOString(),
        totalAssets: manifestItems.length,
        items: manifestItems,
      },
      null,
      2
    );
    zip.file("manifest.json", manifestContent);
  }

  if (zip) {
    if (onProgress) onProgress(items.length, items.length, "Compressing ZIP archive package...");
    const zipBlob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
    const cleanPresetName = preset.name.replace(/[^a-zA-Z0-9_-]/g, "_");
    const dateStr = new Date().toISOString().split("T")[0];
    const zipFilename = `Batch_${cleanPresetName}_${dateStr}.zip`;

    triggerAudioDownload(zipBlob, zipFilename);
    return { zipBlob, filename: zipFilename, filesCount: exportedCount };
  }

  return { filesCount: exportedCount };
}
