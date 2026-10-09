import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { GoogleGenAI, ThinkingLevel, Type, GenerateVideosOperation } from "@google/genai";

dotenv.config();

const PORT = 3000;

// Lazy or safe initialization of Gemini SDK
function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

async function startServer() {
  const app = express();

  // Increase payload size for base64 image/audio uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ extended: true, limit: "50mb" }));

  // API Health Check
  app.get("/api/health", (_req, res) => {
    res.json({
      status: "ok",
      hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
      timestamp: new Date().toISOString(),
    });
  });

  // 1. Analyze Image (OCR, Object Detection, Face Clustering, Alt-Text, Tags, Categorization)
  app.post("/api/gemini/analyze-image", async (req, res) => {
    try {
      const ai = getGeminiClient();
      if (!ai) {
        return res.status(500).json({ error: "GEMINI_API_KEY is not configured on the server." });
      }

      const { imageBase64, mimeType = "image/jpeg", preferredModel = "gemini-3.1-pro-preview" } = req.body;
      if (!imageBase64) {
        return res.status(400).json({ error: "Missing imageBase64 payload." });
      }

      // Clean base64 string
      const cleanBase64 = imageBase64.replace(/^data:image\/[a-zA-Z0-9.+]+;base64,/, "");

      const prompt = `You are an expert computer vision system and digital asset manager.
Perform deep inspection of this image and output a strict JSON object with the following fields:
1. "category": Primary category from ["Documents & Receipts", "Nature & Landscapes", "Architecture & Real Estate", "People & Portraits", "Food & Dining", "Technology & Gadgets", "Artwork & Design", "Fashion & Apparel", "Vehicles & Transport", "Screenshots & Diagrams", "Other"].
2. "altText": Rich, descriptive, accessible alt-text (2-3 sentences) suitable for screen readers and search indexing.
3. "summary": A concise single-sentence summary.
4. "tags": Array of 8-15 specific, searchable lowercase keyword tags (e.g. ["sunset", "mountain", "snow", "outdoor", "golden hour"]).
5. "ocrText": All readable text visible in the image verbatim with line breaks. If no text is visible, set to "".
6. "detectedObjects": Array of objects detected, each with:
   - "name": string
   - "confidence": number (0.0 to 1.0)
   - "box": {"ymin": number, "xmin": number, "ymax": number, "xmax": number} normalized to 0-1000 scale.
7. "detectedFaces": Array of faces detected, each with:
   - "faceId": string like "person_1"
   - "expression": string (e.g. "smiling", "neutral", "thoughtful")
   - "estimatedAgeGroup": string (e.g. "young adult", "middle age", "child", "senior")
   - "box": {"ymin": number, "xmin": number, "ymax": number, "xmax": number} normalized to 0-1000 scale.
8. "dominantColors": Array of 3-5 hex color codes representing dominant tones (e.g. ["#2C3E50", "#E74C3C"]).
9. "sourceContext": Suggested search query or source keywords to verify origin.`;

      // Try preferred model (gemini-3.1-pro-preview), with fallback to gemini-3.8-flash if unavailable
      let response;
      try {
        response = await ai.models.generateContent({
          model: preferredModel,
          contents: {
            parts: [
              {
                inlineData: {
                  mimeType,
                  data: cleanBase64,
                },
              },
              { text: prompt },
            ],
          },
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                category: { type: Type.STRING },
                altText: { type: Type.STRING },
                summary: { type: Type.STRING },
                tags: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
                ocrText: { type: Type.STRING },
                detectedObjects: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      name: { type: Type.STRING },
                      confidence: { type: Type.NUMBER },
                      box: {
                        type: Type.OBJECT,
                        properties: {
                          ymin: { type: Type.NUMBER },
                          xmin: { type: Type.NUMBER },
                          ymax: { type: Type.NUMBER },
                          xmax: { type: Type.NUMBER },
                        },
                      },
                    },
                  },
                },
                detectedFaces: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      faceId: { type: Type.STRING },
                      expression: { type: Type.STRING },
                      estimatedAgeGroup: { type: Type.STRING },
                      box: {
                        type: Type.OBJECT,
                        properties: {
                          ymin: { type: Type.NUMBER },
                          xmin: { type: Type.NUMBER },
                          ymax: { type: Type.NUMBER },
                          xmax: { type: Type.NUMBER },
                        },
                      },
                    },
                  },
                },
                dominantColors: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
                sourceContext: { type: Type.STRING },
              },
            },
          },
        });
      } catch (err: any) {
        console.warn("Retrying analyze-image with fallback model gemini-3.8-flash:", err?.message);
        response = await ai.models.generateContent({
          model: "gemini-3.8-flash",
          contents: {
            parts: [
              {
                inlineData: {
                  mimeType,
                  data: cleanBase64,
                },
              },
              { text: prompt },
            ],
          },
          config: {
            responseMimeType: "application/json",
          },
        });
      }

      const text = response.text || "{}";
      const parsed = JSON.parse(text);
      res.json(parsed);
    } catch (error: any) {
      console.error("Image analysis error:", error);
      res.status(500).json({ error: error?.message || "Failed to analyze image." });
    }
  });

  // 2. Analyze Video Content (gemini-3.1-pro-preview)
  app.post("/api/gemini/analyze-video", async (req, res) => {
    try {
      const ai = getGeminiClient();
      if (!ai) {
        return res.status(500).json({ error: "GEMINI_API_KEY is not configured on the server." });
      }

      const { videoBase64, mimeType = "video/mp4", customPrompt } = req.body;
      if (!videoBase64) {
        return res.status(400).json({ error: "Missing videoBase64 payload." });
      }

      const cleanBase64 = videoBase64.replace(/^data:video\/[a-zA-Z0-9.+]+;base64,/, "");

      const defaultPrompt = `Analyze this video thoroughly. Extract:
1. A concise overview of scenes, actions, and spoken/visual events.
2. Key timestamps and scene descriptions.
3. Spoken dialogue or audio events detected.
4. Core subjects, faces, and themes.
Output valid JSON with keys: "overview", "scenes": [{"timestamp": string, "description": string}], "audioSummary", "tags": string[].`;

      const prompt = customPrompt || defaultPrompt;

      let response;
      try {
        response = await ai.models.generateContent({
          model: "gemini-3.1-pro-preview",
          contents: {
            parts: [
              {
                inlineData: {
                  mimeType,
                  data: cleanBase64,
                },
              },
              { text: prompt },
            ],
          },
          config: {
            responseMimeType: "application/json",
          },
        });
      } catch (err: any) {
        console.warn("Fallback to gemini-3.8-flash for video analysis:", err?.message);
        response = await ai.models.generateContent({
          model: "gemini-3.8-flash",
          contents: {
            parts: [
              {
                inlineData: {
                  mimeType,
                  data: cleanBase64,
                },
              },
              { text: prompt },
            ],
          },
          config: {
            responseMimeType: "application/json",
          },
        });
      }

      res.json(JSON.parse(response.text || "{}"));
    } catch (error: any) {
      console.error("Video analysis error:", error);
      res.status(500).json({ error: error?.message || "Failed to analyze video." });
    }
  });

  // 3. Audio Transcription (gemini-3.5-transcribe)
  app.post("/api/gemini/transcribe-audio", async (req, res) => {
    try {
      const ai = getGeminiClient();
      if (!ai) {
        return res.status(500).json({ error: "GEMINI_API_KEY is not configured on the server." });
      }

      const { audioBase64, mimeType = "audio/webm" } = req.body;
      if (!audioBase64) {
        return res.status(400).json({ error: "Missing audioBase64 payload." });
      }

      const cleanBase64 = audioBase64.replace(/^data:audio\/[a-zA-Z0-9.+]+;base64,/, "");

      const audioPart = {
        inlineData: {
          mimeType,
          data: cleanBase64,
        },
      };

      const response = await ai.models.generateContent({
        model: "gemini-3.5-transcribe",
        contents: {
          parts: [
            audioPart,
            {
              text: "Provide a complete verbatim transcription of this audio. Also include speaker tags if multiple speakers are detected, and summarize key vocal tone / clarity.",
            },
          ],
        },
      });

      res.json({
        transcription: response.text || "",
      });
    } catch (error: any) {
      console.error("Transcription error:", error);
      res.status(500).json({ error: error?.message || "Audio transcription failed." });
    }
  });

  // 4. Multimodal Chat & In-depth Inquiries (Multi-turn, Roles, Search & Maps Grounding)
  app.post("/api/gemini/chat", async (req, res) => {
    try {
      const ai = getGeminiClient();
      if (!ai) {
        return res.status(500).json({ error: "GEMINI_API_KEY is not configured on the server." });
      }

      const {
        messages,
        mediaBase64,
        mediaMimeType,
        model = "gemini-3.5-flash",
        roleSystemInstruction,
        enableGoogleSearch = false,
        enableGoogleMaps = false,
        userLocation,
        useHighThinking = false,
      } = req.body;

      // System instruction for media production expert or specific role
      const defaultInstruction = `You are MediaVision & Voice Isolator's lead digital media forensics expert and post-production assistant.
Help the user analyze pictures, video sequences, audio stems, color grading, facial clusters, OCR texts, and audio isolation workflows.
Provide deep, insightful, accurate, and helpful answers. Format formulas or audio timecodes clearly.`;

      const systemInstruction = roleSystemInstruction || defaultInstruction;

      // Build contents array for multi-turn history
      const formattedContents: any[] = [];

      // Add user turns
      if (Array.isArray(messages)) {
        for (let i = 0; i < messages.length; i++) {
          const m = messages[i];
          const parts: any[] = [{ text: m.content }];

          // If this is the last message and media is attached
          if (i === messages.length - 1 && mediaBase64) {
            const clean = mediaBase64.replace(/^data:[a-zA-Z0-9/.-]+;base64,/, "");
            parts.unshift({
              inlineData: {
                mimeType: mediaMimeType || "image/jpeg",
                data: clean,
              },
            });
          }

          formattedContents.push({
            role: m.role === "assistant" ? "model" : "user",
            parts,
          });
        }
      }

      // Configure tools and model
      let activeModel = model;
      const config: any = {
        systemInstruction,
      };

      if (enableGoogleMaps) {
        // Maps Grounding requires gemini-3.5-flash and cannot be mixed with googleSearch
        activeModel = "gemini-3.5-flash";
        config.tools = [{ googleMaps: {} }];
        if (userLocation && typeof userLocation.latitude === "number") {
          config.toolConfig = {
            retrievalConfig: {
              latLng: {
                latitude: userLocation.latitude,
                longitude: userLocation.longitude,
              },
            },
          };
        }
      } else if (enableGoogleSearch) {
        // Search Grounding with gemini-3.5-flash
        activeModel = "gemini-3.5-flash";
        config.tools = [{ googleSearch: {} }];
      } else if (useHighThinking || activeModel === "gemini-3.1-pro-preview") {
        config.thinkingConfig = {
          thinkingLevel: ThinkingLevel.HIGH,
        };
      }

      let response;
      try {
        response = await ai.models.generateContent({
          model: activeModel,
          contents: formattedContents,
          config,
        });
      } catch (err: any) {
        console.warn(`Model ${activeModel} error, trying fallback to gemini-3.5-flash:`, err?.message);
        // Fallback to gemini-3.5-flash without thinking config
        delete config.thinkingConfig;
        activeModel = "gemini-3.5-flash";
        response = await ai.models.generateContent({
          model: activeModel,
          contents: formattedContents,
          config,
        });
      }

      // Extract Grounding Chunks (Web Search & Google Maps)
      const candidate = response.candidates?.[0];
      const groundingMetadata = candidate?.groundingMetadata;
      const rawChunks = groundingMetadata?.groundingChunks || [];

      // Extract Google Search citations
      const searchSources: Array<{ title: string; url: string }> = [];
      // Extract Google Maps place links & review snippets
      const mapsSources: Array<{ title: string; uri: string; reviewSnippets?: string[] }> = [];

      for (const chunk of rawChunks) {
        if (chunk.web?.uri) {
          searchSources.push({
            title: chunk.web.title || "Web Source",
            url: chunk.web.uri,
          });
        }
        if (chunk.maps?.uri) {
          const rawReviews = chunk.maps.placeAnswerSources?.reviewSnippets || [];
          const stringReviews: string[] = rawReviews.map((r: any) =>
            typeof r === "string" ? r : r?.snippet || r?.text || JSON.stringify(r)
          );
          mapsSources.push({
            title: chunk.maps.title || "Google Maps Location",
            uri: chunk.maps.uri,
            reviewSnippets: stringReviews,
          });
        }
      }

      res.json({
        reply: response.text || "",
        modelUsed: activeModel,
        searchSources,
        mapsSources,
      });
    } catch (error: any) {
      console.error("Chat error:", error);
      res.status(500).json({ error: error?.message || "Failed to process chat message." });
    }
  });

  // 4B. Veo 3 Video Generation (veo-3.1-fast-generate-preview)
  // Step 1: Start Video Generation
  app.post("/api/gemini/generate-video", async (req, res) => {
    try {
      const ai = getGeminiClient();
      if (!ai) {
        return res.status(500).json({ error: "GEMINI_API_KEY is not configured on the server." });
      }

      const {
        prompt,
        imageBase64,
        mimeType = "image/png",
        aspectRatio = "16:9",
        resolution = "720p",
      } = req.body;

      const validAspect = aspectRatio === "9:16" ? "9:16" : "16:9";
      const validRes = resolution === "1080p" ? "1080p" : "720p";

      const config: any = {
        numberOfVideos: 1,
        resolution: validRes,
        aspectRatio: validAspect,
      };

      const params: any = {
        model: "veo-3.1-fast-generate-preview",
        prompt: prompt || (imageBase64 ? "Animate this scene with natural fluid cinematic movement and depth" : "Cinematic 4K footage"),
        config,
      };

      if (imageBase64) {
        const clean = imageBase64.replace(/^data:[a-zA-Z0-9.+/-]+;base64,/, "");
        params.image = {
          imageBytes: clean,
          mimeType,
        };
      }

      const operation = await ai.models.generateVideos(params);
      res.json({
        operationName: operation.name,
        aspectRatio: validAspect,
        resolution: validRes,
      });
    } catch (error: any) {
      console.error("Video generation start error:", error);
      res.status(500).json({ error: error?.message || "Failed to initiate video generation." });
    }
  });

  // Step 2: Poll Video Generation Status
  app.post("/api/gemini/video-status", async (req, res) => {
    try {
      const ai = getGeminiClient();
      if (!ai) {
        return res.status(500).json({ error: "GEMINI_API_KEY is not configured on the server." });
      }

      const { operationName } = req.body;
      if (!operationName) {
        return res.status(400).json({ error: "Missing operationName." });
      }

      const op = new GenerateVideosOperation();
      op.name = operationName;
      const updated = await ai.operations.getVideosOperation({ operation: op });

      res.json({
        done: Boolean(updated.done),
        error: updated.error || null,
      });
    } catch (error: any) {
      console.error("Video status polling error:", error);
      res.status(500).json({ error: error?.message || "Failed to poll video status." });
    }
  });

  // Step 3: Download & Stream Video MP4
  app.post("/api/gemini/video-download", async (req, res) => {
    try {
      const ai = getGeminiClient();
      const apiKey = process.env.GEMINI_API_KEY;
      if (!ai || !apiKey) {
        return res.status(500).json({ error: "GEMINI_API_KEY is not configured on the server." });
      }

      const { operationName } = req.body;
      if (!operationName) {
        return res.status(400).json({ error: "Missing operationName." });
      }

      const op = new GenerateVideosOperation();
      op.name = operationName;
      const updated = await ai.operations.getVideosOperation({ operation: op });

      const uri = updated.response?.generatedVideos?.[0]?.video?.uri;
      if (!uri) {
        return res.status(404).json({ error: "Video URI not found or generation not finished." });
      }

      const videoRes = await fetch(uri, {
        headers: { "x-goog-api-key": apiKey },
      });

      if (!videoRes.ok) {
        return res.status(videoRes.status).json({ error: `Failed to fetch video stream from Google (${videoRes.status})` });
      }

      res.setHeader("Content-Type", "video/mp4");
      const arrayBuffer = await videoRes.arrayBuffer();
      res.send(Buffer.from(arrayBuffer));
    } catch (error: any) {
      console.error("Video download streaming error:", error);
      res.status(500).json({ error: error?.message || "Failed to download generated video." });
    }
  });

  // 5. Advanced Google Image Lookup & Source Verification (Multimodal + Google Search Grounding)
  app.post("/api/gemini/source-lookup", async (req, res) => {
    try {
      const ai = getGeminiClient();
      if (!ai) {
        return res.status(500).json({ error: "GEMINI_API_KEY is not configured on the server." });
      }

      const { query, ocrText, tags, imageBase64, mimeType = "image/jpeg" } = req.body;
      const parts: any[] = [];

      // If image is supplied, provide inline image for direct reverse visual lookup
      if (imageBase64 && imageBase64.startsWith("data:")) {
        const cleanBase64 = imageBase64.replace(/^data:[a-zA-Z0-9.+/-]+;base64,/, "");
        parts.push({
          inlineData: {
            mimeType,
            data: cleanBase64,
          },
        });
      }

      const contextHint = query || `${ocrText ? `OCR extracted text: "${ocrText.slice(0, 150)}". ` : ""} ${tags && tags.length ? `Tags: ${tags.slice(0, 6).join(", ")}.` : ""}`;

      parts.push({
        text: `You are an expert digital forensics and image verification specialist.
Perform an advanced reverse Google Image Lookup and web investigation on this photo.
${contextHint ? `Contextual clues: ${contextHint}` : ""}

Using Google Search grounding:
1. Identify the origin and verified source (original creator, photographer, agency, publication, or official repository).
2. Gather detailed metadata:
   - Verified Source / Author / Organization
   - Source Confidence Rating (choose one: "High - Verified Origin", "Moderate - Web Match", "Stock/Commercial", "Public Domain Archive", "Unverified/User Generated", "AI Synthetic")
   - Likely License / Copyright status (e.g. "Public Domain", "Creative Commons CC-BY", "Editorial Copyright", "Commercial Stock", "All Rights Reserved")
   - First Known Appearance date or era
   - Location or Landmark identification if visible
   - 3 to 6 key Entity Tags (people, landmarks, brand, artwork, or events)
3. Provide an in-depth factual verification summary analyzing where this photo or its subject appears on the web, its authenticity, and historical relevance.

Be precise, objective, and cite authoritative source details.`,
      });

      let response;
      try {
        response = await ai.models.generateContent({
          model: "gemini-3.8-flash",
          contents: { parts },
          config: {
            tools: [{ googleSearch: {} }],
          },
        });
      } catch (err: any) {
        console.warn("Fallback to gemini-3.5-flash for source lookup:", err?.message);
        response = await ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: { parts },
          config: {
            tools: [{ googleSearch: {} }],
          },
        });
      }

      // Extract search grounding chunks & sources
      const candidate = response.candidates?.[0];
      const groundingMetadata = candidate?.groundingMetadata;
      const fullText = response.text || "";

      // Heuristic extraction for structured pills from the response text
      let verifiedSource = "Web Search Verified";
      let sourceConfidence = "Moderate - Web Match";
      let licenseType = "Standard Copyright / Editorial";
      let firstSeen = "Recent / Web Index";
      let locationContext = "";
      const entityTags: string[] = [];

      const lines = fullText.split("\n");
      for (const line of lines) {
        const lower = line.toLowerCase();
        if (lower.includes("verified source") || lower.includes("origin:")) {
          verifiedSource = line.split(/:\s*/)[1]?.slice(0, 80) || verifiedSource;
        } else if (lower.includes("confidence") || lower.includes("rating:")) {
          sourceConfidence = line.split(/:\s*/)[1]?.slice(0, 50) || sourceConfidence;
        } else if (lower.includes("license") || lower.includes("copyright:")) {
          licenseType = line.split(/:\s*/)[1]?.slice(0, 50) || licenseType;
        } else if (lower.includes("first known") || lower.includes("date:") || lower.includes("era:")) {
          firstSeen = line.split(/:\s*/)[1]?.slice(0, 50) || firstSeen;
        } else if (lower.includes("location") || lower.includes("landmark:")) {
          locationContext = line.split(/:\s*/)[1]?.slice(0, 80) || locationContext;
        }
      }

      // Format sources cleanly
      const rawChunks = groundingMetadata?.groundingChunks || [];
      const sources = rawChunks
        .map((chunk: any) => {
          if (chunk.web) {
            return {
              title: chunk.web.title || "Web Reference",
              url: chunk.web.uri || "",
            };
          }
          return null;
        })
        .filter((s: any) => s && s.url);

      res.json({
        lookupSummary: fullText,
        verifiedSource,
        sourceConfidence,
        licenseType,
        firstSeen,
        locationContext,
        entityTags: entityTags.length ? entityTags : (tags || []).slice(0, 4),
        sources,
        searchQueries: groundingMetadata?.webSearchQueries || [],
      });
    } catch (error: any) {
      console.error("Advanced image lookup error:", error);
      res.status(500).json({ error: error?.message || "Google Image lookup failed." });
    }
  });

  // 6. Google Maps Grounding for Location Verification
  app.post("/api/gemini/geo-lookup", async (req, res) => {
    try {
      const ai = getGeminiClient();
      if (!ai) {
        return res.status(500).json({ error: "GEMINI_API_KEY is not configured on the server." });
      }

      const { locationQuery } = req.body;
      if (!locationQuery) {
        return res.status(400).json({ error: "Missing locationQuery." });
      }

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: `Identify the geographic location, landmark information, address details, and coordinates for: "${locationQuery}".`,
        config: {
          tools: [{ googleMaps: {} }],
        },
      });

      const rawChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      const mapsSources: Array<{ title: string; uri: string; reviewSnippets: string[] }> = [];

      for (const chunk of rawChunks) {
        if (chunk.maps?.uri) {
          const rawReviews = chunk.maps.placeAnswerSources?.reviewSnippets || [];
          const stringReviews: string[] = rawReviews.map((r: any) =>
            typeof r === "string" ? r : r?.snippet || r?.text || JSON.stringify(r)
          );
          mapsSources.push({
            title: chunk.maps.title || "Google Maps Location",
            uri: chunk.maps.uri,
            reviewSnippets: stringReviews,
          });
        }
      }

      res.json({
        geoSummary: response.text || "",
        mapsSources,
        metadata: response.candidates?.[0]?.groundingMetadata || {},
      });
    } catch (error: any) {
      console.error("Geo lookup error:", error);
      res.status(500).json({ error: error?.message || "Google Maps lookup failed." });
    }
  });

  // Vite middleware or static serving
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`MediaVision Studio server listening at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Fatal server boot error:", err);
  process.exit(1);
});
