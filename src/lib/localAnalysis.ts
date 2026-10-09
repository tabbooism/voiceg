import { DetectedObject, DetectedFace } from "../types";

/**
 * Privacy-Focused Local Mode Engine
 * Runs 100% on-device inside the browser's HTML5 Canvas.
 * Zero bytes transmitted to servers or cloud when active.
 */

export interface LocalAnalysisResult {
  category: string;
  summary: string;
  altText: string;
  tags: string[];
  ocrText: string;
  detectedObjects: DetectedObject[];
  detectedFaces: DetectedFace[];
  dominantColors: string[];
  isLocalProcessed: true;
}

export async function processImageLocally(imgElement: HTMLImageElement): Promise<LocalAnalysisResult> {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Unable to create canvas context for local image processing.");
  }

  // Work on standard normalized resolution for fast local processing
  const maxDim = 600;
  let w = imgElement.naturalWidth || imgElement.width || 600;
  let h = imgElement.naturalHeight || imgElement.height || 400;

  if (w > maxDim || h > maxDim) {
    if (w > h) {
      h = Math.round((h * maxDim) / w);
      w = maxDim;
    } else {
      w = Math.round((w * maxDim) / h);
      h = maxDim;
    }
  }

  canvas.width = w;
  canvas.height = h;
  ctx.drawImage(imgElement, 0, 0, w, h);

  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;

  // 1. Calculate color statistics & brightness
  let totalR = 0, totalG = 0, totalB = 0;
  let highContrastEdgeCount = 0;
  let skinPixelCount = 0;
  const colorBuckets: Record<string, number> = {};

  const skinCandidates: Array<{ x: number; y: number }> = [];

  for (let i = 0; i < data.length; i += 16) { // Sample every 4th pixel for speed
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    totalR += r;
    totalG += g;
    totalB += b;

    // Quantize color to 16-step palette for dominant colors
    const qr = Math.floor(r / 48) * 48;
    const qg = Math.floor(g / 48) * 48;
    const qb = Math.floor(b / 48) * 48;
    const hex = `#${qr.toString(16).padStart(2, "0")}${qg.toString(16).padStart(2, "0")}${qb.toString(16).padStart(2, "0")}`;
    colorBuckets[hex] = (colorBuckets[hex] || 0) + 1;

    // Skin tone color space heuristic (YCrCb approximation)
    // Normalized RGB skin tone detector
    const sum = r + g + b + 0.001;
    const normR = r / sum;
    const normG = g / sum;
    if (normR > 0.36 && normR < 0.52 && normG > 0.28 && normG < 0.38 && r > 95 && g > 40 && b > 20) {
      skinPixelCount++;
      const pixelIdx = i / 4;
      const x = pixelIdx % w;
      const y = Math.floor(pixelIdx / w);
      skinCandidates.push({ x, y });
    }

    // High frequency edge detector
    if (i + 16 < data.length) {
      const diff = Math.abs(r - data[i + 16]) + Math.abs(g - data[i + 17]) + Math.abs(b - data[i + 18]);
      if (diff > 80) highContrastEdgeCount++;
    }
  }

  const sampleCount = data.length / 16;
  const avgR = Math.round(totalR / sampleCount);
  const avgG = Math.round(totalG / sampleCount);
  const avgB = Math.round(totalB / sampleCount);
  const brightness = (avgR * 299 + avgG * 587 + avgB * 114) / 1000;

  // Top 4 dominant colors
  const dominantColors = Object.entries(colorBuckets)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([hex]) => hex);

  // 2. Classify image & detect objects locally
  const detectedObjects: DetectedObject[] = [];
  const detectedFaces: DetectedFace[] = [];
  const tags: string[] = ["local-mode", "privacy-preserved"];

  // Aspect ratio
  const ratio = w / h;
  if (ratio > 1.4) tags.push("landscape-orientation");
  else if (ratio < 0.8) tags.push("portrait-orientation");
  else tags.push("square-format");

  // Brightness tags
  if (brightness > 180) tags.push("high-key", "bright-light");
  else if (brightness < 70) tags.push("low-key", "night-shadows");
  else tags.push("balanced-exposure");

  // Determine category
  let category = "Other";
  let ocrText = "";

  const edgeDensity = highContrastEdgeCount / sampleCount;
  const skinRatio = skinPixelCount / sampleCount;

  if (skinRatio > 0.12 && skinCandidates.length > 50) {
    category = "People & Portraits";
    tags.push("portrait", "people", "person");
    
    // Approximate face bounding box
    let minX = w, maxX = 0, minY = h, maxY = 0;
    skinCandidates.forEach((p) => {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    });

    if (maxX > minX && maxY > minY) {
      detectedFaces.push({
        faceId: "local_person_1",
        expression: "neutral (local analysis)",
        estimatedAgeGroup: "unclassified",
        box: {
          ymin: Math.max(0, Math.round((minY / h) * 1000)),
          xmin: Math.max(0, Math.round((minX / w) * 1000)),
          ymax: Math.min(1000, Math.round((maxY / h) * 1000)),
          xmax: Math.min(1000, Math.round((maxX / w) * 1000)),
        },
      });
      detectedObjects.push({
        name: "person",
        confidence: 0.88,
        box: detectedFaces[0].box,
      });
    }
  } else if (edgeDensity > 0.35 && brightness > 150) {
    category = "Documents & Receipts";
    tags.push("document", "text-scan", "paperwork", "high-contrast");
    ocrText = "[Local Mode] High-contrast text density detected. Toggle cloud/Gemini mode for full verbatim OCR transcription.";
    detectedObjects.push({
      name: "printed_document",
      confidence: 0.85,
      box: { ymin: 100, xmin: 100, ymax: 900, xmax: 900 },
    });
  } else if (avgG > avgR * 1.15 && avgG > avgB) {
    category = "Nature & Landscapes";
    tags.push("nature", "foliage", "outdoor", "vegetation");
    detectedObjects.push({
      name: "flora / nature",
      confidence: 0.82,
      box: { ymin: 200, xmin: 100, ymax: 850, xmax: 900 },
    });
  } else if (avgB > avgR * 1.15) {
    category = "Nature & Landscapes";
    tags.push("sky", "water", "outdoor", "cool-tones");
    detectedObjects.push({
      name: "water / sky element",
      confidence: 0.80,
      box: { ymin: 50, xmin: 50, ymax: 600, xmax: 950 },
    });
  } else {
    category = "Artwork & Design";
    tags.push("visual-media", "composite");
    detectedObjects.push({
      name: "visual subject",
      confidence: 0.75,
      box: { ymin: 150, xmin: 150, ymax: 850, xmax: 850 },
    });
  }

  const altText = `A locally analyzed ${category.toLowerCase()} image containing dominant color tones ${dominantColors.join(", ")}, with an estimated exposure level of ${Math.round(brightness)}/255. Processed privately on-device.`;
  const summary = `Local on-device analysis: ${category} with ${tags.slice(0, 4).join(", ")}.`;

  return {
    category,
    summary,
    altText,
    tags,
    ocrText,
    detectedObjects,
    detectedFaces,
    dominantColors,
    isLocalProcessed: true,
  };
}
