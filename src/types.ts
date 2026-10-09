export type MediaType = "image" | "video" | "audio";

export interface BoundingBox {
  ymin: number;
  xmin: number;
  ymax: number;
  xmax: number;
}

export interface DetectedObject {
  name: string;
  confidence: number;
  box?: BoundingBox;
}

export interface DetectedFace {
  faceId: string;
  expression?: string;
  estimatedAgeGroup?: string;
  box?: BoundingBox;
}

export interface ColorCorrectionSettings {
  brightness: number; // -100 to 100
  contrast: number; // -100 to 100
  saturation: number; // -100 to 100
  exposure: number; // -100 to 100
  warmth: number; // -100 to 100
  vignette: number; // 0 to 100
  sharpen: number; // 0 to 100
  sepia: number; // 0 to 100
  grayscale: number; // 0 to 100
  invert: number; // 0 to 100
  blur: number; // 0 to 20
  rotation: number; // 0, 90, 180, 270, or arbitrary
  flipH: boolean;
  flipV: boolean;
  crop?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface VoiceIsolationResult {
  vocalStemUrl: string;
  instrumentalStemUrl: string;
  duration: number;
  sampleRate: number;
  bitDepth: number; // 16, 24, 32
  channels: number;
  transcription?: string;
  vocalGain: number; // 0 to 2
  instrumentalGain: number; // 0 to 2
  pan: number; // -1 to 1
  waveformPeaks?: number[];
}

export interface MediaItem {
  id: string;
  name: string;
  type: MediaType;
  size: number;
  mimeType: string;
  url: string; // Blob URL or base64
  thumbnailUrl?: string;
  folderId?: string | null;
  createdAt: number;
  updatedAt: number;
  isFavorite?: boolean;
  
  // ML / Vision Insights
  category?: string;
  summary?: string;
  altText?: string;
  tags: string[];
  ocrText?: string;
  detectedObjects?: DetectedObject[];
  detectedFaces?: DetectedFace[];
  dominantColors?: string[];
  
  // Source & Geo Verification
  sourceLookup?: {
    summary: string;
    sources: any[];
    searchQueries: string[];
    verifiedSource?: string;
    sourceConfidence?: string;
    licenseType?: string;
    firstSeen?: string;
    locationContext?: string;
    entityTags?: string[];
  };
  geoLookup?: {
    summary: string;
    mapsSources?: Array<{ title: string; uri: string; reviewSnippets?: string[] }>;
  };

  // Google Photos & Camera Metadata
  isGooglePhoto?: boolean;
  photoAlbum?: string;
  imageMediaMetadata?: {
    width?: number;
    height?: number;
    rotation?: number;
    time?: string;
    cameraMake?: string;
    cameraModel?: string;
    exposureTime?: number;
    aperture?: number;
    focalLength?: number;
    isoSpeed?: number;
  };

  // Editing & Audio
  editSettings?: ColorCorrectionSettings;
  voiceIsolation?: VoiceIsolationResult;
  videoScenes?: Array<{ timestamp: string; description: string }>;

  // Privacy & Sync
  isLocalProcessed?: boolean;
  driveFileId?: string;
  syncedAt?: string;
}

export interface Folder {
  id: string;
  name: string;
  parentId: string | null;
  color?: string;
  createdAt: number;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  modelUsed?: string;
  thinkingMode?: boolean;
}

export interface MacroAction {
  id: string;
  name: string;
  description: string;
  iconName: string;
  steps: Array<"ocr" | "objects" | "faces" | "altText" | "sourceLookup" | "autoEnhance" | "voiceIsolate">;
}

export interface PluginDefinition {
  id: string;
  name: string;
  version: string;
  author: string;
  description: string;
  enabled: boolean;
  type: "filter" | "analysis" | "export";
  actionName: string;
}

export interface BatchJob {
  id: string;
  mediaId: string;
  mediaName: string;
  status: "queued" | "processing" | "completed" | "failed";
  progress: number;
  currentStep?: string;
  error?: string;
}

export type ImageExportFormat = "original" | "webp" | "jpeg" | "png";
export type AudioExportFormat = "wav" | "mp3";

export interface BatchExportConfig {
  imageFormat: ImageExportFormat;
  imageQuality: number; // 0.1 to 1.0 (e.g. 0.82)
  maxDimension: number; // 0 = original, 800, 1280, 1920, 3840
  audioFormat: AudioExportFormat;
  audioBitDepth: 16 | 24 | 32;
  audioBitrate: 128 | 192 | 256 | 320;
  pipeline: "ai_inspect" | "source_lookup" | "voice_isolate" | "local_scan" | "auto_color" | "none";
  includeMetadataManifest: boolean;
  stripExifPrivacy: boolean;
  packageAsZip: boolean;
}

export interface BatchExportPreset {
  id: string;
  name: string;
  description: string;
  badge: string;
  category: "web" | "archive" | "social" | "audio" | "privacy" | "custom";
  isDefault?: boolean;
  config: BatchExportConfig;
  createdAt?: number;
}
