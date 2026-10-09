import { MediaItem, Folder } from "../types";

/**
 * Creates a rich SVG-based image data URL for instant out-of-the-box testing
 */
function createDemoImage(title: string, subtitle: string, bgColor: string, accentColor: string, iconText: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${bgColor}"/>
        <stop offset="100%" stop-color="#090d16"/>
      </linearGradient>
      <linearGradient id="acc" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="${accentColor}"/>
        <stop offset="100%" stop-color="#60a5fa"/>
      </linearGradient>
      <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
        <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.04)" stroke-width="1"/>
      </pattern>
    </defs>
    <rect width="800" height="600" fill="url(#bg)"/>
    <rect width="800" height="600" fill="url(#grid)"/>
    <circle cx="400" cy="240" r="140" fill="${accentColor}" opacity="0.15" filter="blur(40px)"/>
    
    <!-- Graphic Elements -->
    <rect x="250" y="120" width="300" height="200" rx="16" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.15)" stroke-width="2"/>
    <text x="400" y="235" font-family="system-ui, sans-serif" font-size="44" font-weight="700" fill="#ffffff" text-anchor="middle">${iconText}</text>
    
    <!-- OCR Text Area -->
    <rect x="180" y="360" width="440" height="85" rx="10" fill="rgba(0,0,0,0.4)" stroke="rgba(255,255,255,0.1)"/>
    <text x="400" y="395" font-family="monospace" font-size="18" font-weight="600" fill="url(#acc)" text-anchor="middle">METRO COFFEE ROASTERS • EST. 1984</text>
    <text x="400" y="425" font-family="sans-serif" font-size="14" fill="#94a3b8" text-anchor="middle">42 ARTISAN BLVD • INVOICE #89201 • PAID $24.50</text>
    
    <text x="400" y="500" font-family="system-ui, sans-serif" font-size="24" font-weight="700" fill="#ffffff" text-anchor="middle">${title}</text>
    <text x="400" y="530" font-family="system-ui, sans-serif" font-size="14" fill="#64748b" text-anchor="middle">${subtitle}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
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

  // Synthesize:
  // Center Vocal Tone: 220Hz + 440Hz + 660Hz harmonic speech simulation with amplitude modulation
  // Side Stereo Instrumental: 110Hz sub bass + stereo panned arpeggios
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    
    // Vocal envelope (simulating speaking syllables: hello, one, two, test)
    const vocalEnv = Math.max(0, Math.sin(t * 5.0)) * (0.5 + 0.5 * Math.sin(t * 1.5));
    const vocalFundamental = Math.sin(2 * Math.PI * 260 * t);
    const vocalHarmonic1 = 0.5 * Math.sin(2 * Math.PI * 520 * t);
    const vocalHarmonic2 = 0.25 * Math.sin(2 * Math.PI * 780 * t);
    const centerVocal = (vocalFundamental + vocalHarmonic1 + vocalHarmonic2) * vocalEnv * 0.45;

    // Stereo background instrumental (panned wide)
    const bass = 0.25 * Math.sin(2 * Math.PI * 130 * t);
    const synthLeft = 0.15 * Math.sin(2 * Math.PI * 330 * t) + bass;
    const synthRight = 0.15 * Math.sin(2 * Math.PI * 392 * t) + bass;

    // Combine: Vocals centered (identical in left and right), instruments wide
    left[i] = centerVocal + synthLeft;
    right[i] = centerVocal + synthRight;
  }

  return buffer;
}

export const INITIAL_FOLDERS: Folder[] = [
  { id: "folder_camera", name: "Camera Roll", parentId: null, color: "#3b82f6", createdAt: Date.now() - 86400000 * 4 },
  { id: "folder_studio", name: "Studio Sessions", parentId: null, color: "#8b5cf6", createdAt: Date.now() - 86400000 * 3 },
  { id: "folder_documents", name: "Receipts & Scans", parentId: null, color: "#10b981", createdAt: Date.now() - 86400000 * 2 },
  { id: "folder_stems", name: "Isolated Stems", parentId: null, color: "#ec4899", createdAt: Date.now() - 86400000 * 1 },
];

export const INITIAL_MEDIA: MediaItem[] = [
  {
    id: "media_demo_1",
    name: "Metro_Coffee_Receipt_Scan.jpg",
    type: "image",
    size: 428000,
    mimeType: "image/jpeg",
    url: createDemoImage(
      "Artisan Coffee Roasters Receipt",
      "Auto-categorized as Documents & Receipts • High-confidence OCR",
      "#1e293b",
      "#3b82f6",
      "☕️ RECEIPT"
    ),
    folderId: "folder_documents",
    createdAt: Date.now() - 1000 * 60 * 120,
    updatedAt: Date.now() - 1000 * 60 * 120,
    isFavorite: true,
    category: "Documents & Receipts",
    summary: "Commercial storefront receipt and menu board from Metro Coffee Roasters.",
    altText: "A high contrast document scan of a receipt from Metro Coffee Roasters dated 1984, displaying invoice number 89201 and a total of $24.50.",
    tags: ["receipt", "invoice", "coffee", "commercial", "document", "financial", "storefront"],
    ocrText: `METRO COFFEE ROASTERS • EST. 1984
42 ARTISAN BLVD • INVOICE #89201
DATE: 2026-09-20
-----------------------------------
1X COLOMBIAN SUPREMO ROAST   $18.00
1X OAT MILK CORTADO           $6.50
TOTAL PAID:                  $24.50
STATUS: COMPLETED & VERIFIED`,
    detectedObjects: [
      { name: "receipt_slip", confidence: 0.96, box: { ymin: 360, xmin: 180, ymax: 445, xmax: 620 } },
      { name: "printed_header", confidence: 0.92, box: { ymin: 120, xmin: 250, ymax: 320, xmax: 550 } },
    ],
    detectedFaces: [],
    dominantColors: ["#1e293b", "#3b82f6", "#090d16", "#ffffff"],
    sourceLookup: {
      summary: "Verified independent specialty coffee shop located in the arts district. Associated with historic roasting registers.",
      sources: [{ title: "Artisan Coffee Guild Registry", uri: "https://example.com/roasters" }],
      searchQueries: ["Metro Coffee Roasters Artisan Blvd history"],
    },
    editSettings: {
      brightness: 0,
      contrast: 5,
      saturation: 0,
      exposure: 0,
      warmth: 0,
      vignette: 0,
      sharpen: 10,
      sepia: 0,
      grayscale: 0,
      invert: 0,
      blur: 0,
      rotation: 0,
      flipH: false,
      flipV: false,
    },
  },
  {
    id: "media_demo_2",
    name: "Studio_Portrait_Producer.png",
    type: "image",
    size: 890000,
    mimeType: "image/png",
    url: createDemoImage(
      "Music Producer Portrait Session",
      "Face clustering active • Expression: Focused & Smiling",
      "#172554",
      "#8b5cf6",
      "🎧 PORTRAIT"
    ),
    folderId: "folder_studio",
    createdAt: Date.now() - 1000 * 60 * 90,
    updatedAt: Date.now() - 1000 * 60 * 90,
    isFavorite: true,
    category: "People & Portraits",
    summary: "Professional headshot portrait of an audio producer in a studio monitoring environment.",
    altText: "A close-up portrait of a sound engineer wearing professional monitoring headphones with studio lighting.",
    tags: ["portrait", "person", "audio-engineer", "studio", "headphones", "lighting", "face-cluster-1"],
    ocrText: "AUDIO LAB MONITOR • PEAK 0dB",
    detectedObjects: [
      { name: "person", confidence: 0.98, box: { ymin: 120, xmin: 250, ymax: 480, xmax: 550 } },
      { name: "headphones", confidence: 0.91, box: { ymin: 180, xmin: 280, ymax: 310, xmax: 520 } },
    ],
    detectedFaces: [
      {
        faceId: "person_1_alex",
        expression: "calm / smiling",
        estimatedAgeGroup: "young adult (25-34)",
        box: { ymin: 160, xmin: 300, ymax: 340, xmax: 500 },
      },
    ],
    dominantColors: ["#172554", "#8b5cf6", "#60a5fa", "#ffffff"],
    editSettings: {
      brightness: 2,
      contrast: 8,
      saturation: 4,
      exposure: 0,
      warmth: 8,
      vignette: 15,
      sharpen: 5,
      sepia: 0,
      grayscale: 0,
      invert: 0,
      blur: 0,
      rotation: 0,
      flipH: false,
      flipV: false,
    },
  },
  {
    id: "media_demo_3",
    name: "Alpine_Summit_Golden_Hour.jpg",
    type: "image",
    size: 1240000,
    mimeType: "image/jpeg",
    url: createDemoImage(
      "Alpine Summit Panorama",
      "Nature & Landscapes • Golden Hour Lighting • Sky Grounding",
      "#0f172a",
      "#10b981",
      "🏔 LANDSCAPE"
    ),
    folderId: "folder_camera",
    createdAt: Date.now() - 1000 * 60 * 45,
    updatedAt: Date.now() - 1000 * 60 * 45,
    isFavorite: false,
    category: "Nature & Landscapes",
    summary: "Spectacular alpine mountain peak with emerald lake reflection during golden hour.",
    altText: "Majestic snow-dusted mountain summit overlooking a still alpine lake reflecting vibrant green and amber skies.",
    tags: ["mountain", "lake", "sunset", "alpine", "reflection", "nature", "landscape", "golden-hour"],
    ocrText: "",
    detectedObjects: [
      { name: "mountain_summit", confidence: 0.95, box: { ymin: 100, xmin: 100, ymax: 380, xmax: 700 } },
      { name: "lake_water", confidence: 0.90, box: { ymin: 380, xmin: 50, ymax: 550, xmax: 750 } },
    ],
    detectedFaces: [],
    dominantColors: ["#0f172a", "#10b981", "#34d399", "#38bdf8"],
    editSettings: {
      brightness: 4,
      contrast: 14,
      saturation: 16,
      exposure: 0,
      warmth: 12,
      vignette: 18,
      sharpen: 12,
      sepia: 0,
      grayscale: 0,
      invert: 0,
      blur: 0,
      rotation: 0,
      flipH: false,
      flipV: false,
    },
  },
];
