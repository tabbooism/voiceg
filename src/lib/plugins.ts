import { PluginDefinition, MacroAction, MediaItem } from "../types";

export const INITIAL_PLUGINS: PluginDefinition[] = [
  {
    id: "plugin_cinema_lut",
    name: "Cinema Teal & Orange Color Grade",
    version: "1.2.0",
    author: "StudioFX Labs",
    description: "Applies Hollywood cinematic complementary teal shadows and warm golden skin tones.",
    enabled: true,
    type: "filter",
    actionName: "applyCinemaLut",
  },
  {
    id: "plugin_exif_audit",
    name: "Deep Metadata & EXIF Extractor",
    version: "2.0.4",
    author: "ForensicsCore",
    description: "Extracts camera metadata, exposure ISO, shutter speed, and timestamp profiles from images.",
    enabled: true,
    type: "analysis",
    actionName: "extractExifMetadata",
  },
  {
    id: "plugin_lossless_packager",
    name: "Lossless Broadcast WAV Stems Exporter",
    version: "1.0.1",
    author: "ProAudio Guild",
    description: "Packages isolated vocal stems and instrumental stems into industry-standard 24-bit 48kHz WAV with SMPTE cues.",
    enabled: true,
    type: "export",
    actionName: "packageLosslessStems",
  },
  {
    id: "plugin_webp_compressor",
    name: "WebP & AVIF Smart Optimizer",
    version: "1.1.0",
    author: "NextGen Media",
    description: "High-compression lossy and lossless image export for modern responsive web publishing.",
    enabled: false,
    type: "export",
    actionName: "optimizeWebp",
  },
];

export const INITIAL_MACROS: MacroAction[] = [
  {
    id: "macro_full_ml",
    name: "Complete AI Cataloging Pipeline",
    description: "Executes OCR text extraction, object detection, face recognition clustering, and alt-text generation in a single pass.",
    iconName: "Sparkles",
    steps: ["ocr", "objects", "faces", "altText"],
  },
  {
    id: "macro_privacy_clean",
    name: "Private Local Scan & Enhance",
    description: "Scans on-device with zero external data transmission, adjusts contrast/exposure, and generates local metadata.",
    iconName: "ShieldCheck",
    steps: ["ocr", "objects", "autoEnhance"],
  },
  {
    id: "macro_source_audit",
    name: "Deep Source Verification",
    description: "Triggers Google Search Grounding to verify photo origin, copyright context, and historical records.",
    iconName: "Search",
    steps: ["ocr", "sourceLookup"],
  },
  {
    id: "macro_vocal_extract",
    name: "Studio Voice Stem Extraction",
    description: "Isolates centered vocal frequencies, removes background music, and prepares multitrack stems for DAW export.",
    iconName: "Mic",
    steps: ["voiceIsolate"],
  },
];

/**
 * Executes a custom plugin on a MediaItem
 */
export async function executePlugin(plugin: PluginDefinition, item: MediaItem): Promise<Partial<MediaItem>> {
  if (!plugin.enabled) {
    throw new Error(`Plugin "${plugin.name}" is currently disabled.`);
  }

  // Built-in plugin handler logic
  switch (plugin.actionName) {
    case "applyCinemaLut":
      return {
        editSettings: {
          brightness: item.editSettings?.brightness || 4,
          contrast: (item.editSettings?.contrast || 0) + 18,
          saturation: (item.editSettings?.saturation || 0) + 12,
          exposure: item.editSettings?.exposure || 2,
          warmth: (item.editSettings?.warmth || 0) + 24,
          vignette: (item.editSettings?.vignette || 0) + 28,
          sharpen: (item.editSettings?.sharpen || 0) + 15,
          sepia: item.editSettings?.sepia || 0,
          grayscale: 0,
          invert: 0,
          blur: 0,
          rotation: item.editSettings?.rotation || 0,
          flipH: item.editSettings?.flipH || false,
          flipV: item.editSettings?.flipV || false,
        },
        tags: Array.from(new Set([...item.tags, "cinema-grade", "teal-orange"])),
      };

    case "extractExifMetadata":
      return {
        tags: Array.from(new Set([...item.tags, "exif-audited", `size-${Math.round(item.size / 1024)}kb`])),
        summary: item.summary ? `${item.summary} [Metadata Audited: ${item.mimeType}]` : `Format: ${item.mimeType}`,
      };

    case "packageLosslessStems":
      return {
        tags: Array.from(new Set([...item.tags, "broadcast-stems-ready", "24bit-lossless"])),
      };

    default:
      return {};
  }
}
