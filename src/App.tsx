/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from "react";
import { User } from "firebase/auth";
import { Navbar } from "./components/Navbar";
import { MediaLibrary } from "./components/MediaLibrary";
import { ImageInspector } from "./components/ImageInspector";
import { ImageEditor } from "./components/ImageEditor";
import { VoiceIsolator } from "./components/VoiceIsolator";
import { VeoVideoStudio } from "./components/VeoVideoStudio";
import { GeminiChatbot } from "./components/GeminiChatbot";
import { BatchLab } from "./components/BatchLab";
import { PluginManager } from "./components/PluginManager";
import { ShortcutsModal } from "./components/ShortcutsModal";
import { GooglePhotosConnector } from "./components/GooglePhotosConnector";

import { MediaItem, Folder, PluginDefinition, MacroAction } from "./types";
import { INITIAL_MEDIA, INITIAL_FOLDERS, createSyntheticAudioBuffer } from "./lib/demoData";
import { INITIAL_PLUGINS, INITIAL_MACROS, executePlugin } from "./lib/plugins";
import { getAudioContext, encodeWAV, isolateVocalStems } from "./lib/audioIsolation";
import { processImageLocally } from "./lib/localAnalysis";
import {
  initAuth,
  googleSignIn,
  logout,
  listDriveMediaFiles,
  getAccessToken,
  uploadMediaToDrive,
} from "./lib/firebase";

export default function App() {
  // Navigation
  const [currentTab, setCurrentTab] = useState<
    "library" | "inspector" | "editor" | "isolator" | "video" | "chat" | "batch" | "plugins"
  >("library");

  // Core Data
  const [media, setMedia] = useState<MediaItem[]>(() => {
    const saved = localStorage.getItem("mediavision_media");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // fallback
      }
    }
    return INITIAL_MEDIA;
  });

  const [folders, setFolders] = useState<Folder[]>(() => {
    const saved = localStorage.getItem("mediavision_folders");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // fallback
      }
    }
    return INITIAL_FOLDERS;
  });

  const [selectedId, setSelectedId] = useState<string | null>(
    INITIAL_MEDIA[0]?.id || null
  );

  // Settings & Modes
  const [localMode, setLocalMode] = useState<boolean>(false);
  const [plugins, setPlugins] = useState<PluginDefinition[]>(INITIAL_PLUGINS);
  const [macros, setMacros] = useState<MacroAction[]>(INITIAL_MACROS);

  // Auth & Cloud Sync
  const [user, setUser] = useState<User | null>(null);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState<boolean>(false);
  const [isGooglePhotosOpen, setIsGooglePhotosOpen] = useState<boolean>(false);

  // Save to localStorage
  useEffect(() => {
    try {
      localStorage.setItem("mediavision_media", JSON.stringify(media));
    } catch (e) {
      // ignore storage quota errors for large data blobs
    }
  }, [media]);

  useEffect(() => {
    localStorage.setItem("mediavision_folders", JSON.stringify(folders));
  }, [folders]);

  // Listen for Firebase Auth changes
  useEffect(() => {
    const unsubscribe = initAuth(
      (currentUser) => {
        setUser(currentUser);
      },
      () => {
        setUser(null);
      }
    );
    return () => unsubscribe();
  }, []);

  // Keyboard Shortcuts Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing inside an input or textarea
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      if (e.key === "1") setCurrentTab("library");
      else if (e.key === "2") setCurrentTab("inspector");
      else if (e.key === "3") setCurrentTab("editor");
      else if (e.key === "4") setCurrentTab("isolator");
      else if (e.key === "5") setCurrentTab("video");
      else if (e.key === "6") setCurrentTab("chat");
      else if (e.key === "7") setCurrentTab("batch");
      else if (e.key === "8") setCurrentTab("plugins");
      else if (e.key === "l" || e.key === "L") setLocalMode((prev) => !prev);
      else if (e.key === "?") setIsShortcutsOpen((prev) => !prev);
      else if (e.key === "Escape") setIsShortcutsOpen(false);
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        handleSyncDrive();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "o") {
        e.preventDefault();
        document.getElementById("file-upload-input")?.click();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Update Media Item helper
  const handleUpdateMedia = useCallback((updated: MediaItem) => {
    setMedia((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
  }, []);

  // Currently selected media object
  const currentMedia = media.find((m) => m.id === selectedId) || media[0] || null;

  // Sign In with Google
  const handleSignIn = async () => {
    try {
      const res = await googleSignIn();
      if (res) {
        setUser(res.user);
        alert(`Successfully connected Google account: ${res.user.email}`);
      }
    } catch (err: any) {
      alert(`Sign in failed: ${err.message}`);
    }
  };

  const handleSignOut = async () => {
    await logout();
    setUser(null);
  };

  // Sync with Google Drive
  const handleSyncDrive = async () => {
    const token = await getAccessToken();
    if (!token) {
      alert("Please connect your Google Drive account first to sync.");
      handleSignIn();
      return;
    }

    setIsSyncing(true);
    try {
      const driveFiles = await listDriveMediaFiles(token);
      if (driveFiles.length === 0) {
        alert("No media files found in your Google Drive or Drive Photos.");
      } else {
        const newDriveItems: MediaItem[] = driveFiles.map((file: any) => ({
          id: `drive_${file.id}`,
          name: file.name,
          type: file.mimeType.startsWith("video/")
            ? "video"
            : file.mimeType.startsWith("audio/")
            ? "audio"
            : "image",
          size: Number(file.size || 0),
          mimeType: file.mimeType,
          url: file.thumbnailLink?.replace(/=s\d+/, "=s1600") || file.webContentLink || "",
          thumbnailUrl: file.thumbnailLink,
          createdAt: new Date(file.createdTime).getTime(),
          updatedAt: Date.now(),
          tags: ["google-drive", "cloud-synced"],
          summary: `Imported from Google Drive (${file.name})`,
          driveFileId: file.id,
          syncedAt: new Date().toISOString(),
        }));

        setMedia((prev) => {
          const existingIds = new Set(prev.map((p) => p.id));
          const toAdd = newDriveItems.filter((item) => !existingIds.has(item.id));
          return [...toAdd, ...prev];
        });

        alert(`Synced ${newDriveItems.length} media items from Google Drive!`);
      }
    } catch (err: any) {
      alert(`Google Drive sync error: ${err.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  // Import items from Google Photos
  const handleImportGooglePhotos = (importedItems: MediaItem[]) => {
    setMedia((prev) => {
      const existingIds = new Set(prev.map((p) => p.id));
      const toAdd = importedItems.filter((item) => !existingIds.has(item.id));
      return [...toAdd, ...prev];
    });
    if (importedItems.length > 0 && !selectedId) {
      setSelectedId(importedItems[0].id);
    }
  };

  // Upload Local Files
  const handleUploadFiles = (files: FileList | File[]) => {
    const newItems: MediaItem[] = [];

    Array.from(files).forEach((file) => {
      const isVideo = file.type.startsWith("video/");
      const isAudio = file.type.startsWith("audio/");
      const isImage = file.type.startsWith("image/");

      const type: "image" | "video" | "audio" = isVideo
        ? "video"
        : isAudio
        ? "audio"
        : "image";

      const url = URL.createObjectURL(file);

      const newItem: MediaItem = {
        id: `media_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        name: file.name,
        type,
        size: file.size,
        mimeType: file.type || (isAudio ? "audio/wav" : isVideo ? "video/mp4" : "image/jpeg"),
        url,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        tags: ["user-upload", type],
        summary: `Imported asset: ${file.name}`,
      };

      newItems.push(newItem);
    });

    setMedia((prev) => [...newItems, ...prev]);
    if (newItems.length > 0) {
      setSelectedId(newItems[0].id);
    }
  };

  // Add Synthesized Multitrack Demo Audio
  const handleAddSynthesizedAudio = async () => {
    try {
      const ctx = getAudioContext();
      const buffer = createSyntheticAudioBuffer(ctx, 8);
      const wavBlob = encodeWAV(buffer, 24);
      const url = URL.createObjectURL(wavBlob);

      const newItem: MediaItem = {
        id: `audio_synth_${Date.now()}`,
        name: "Studio_Multitrack_Vocal_Chords_Demo.wav",
        type: "audio",
        size: wavBlob.size,
        mimeType: "audio/wav",
        url,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        isFavorite: true,
        tags: ["voice-isolation", "multitrack-demo", "synthesized-vocal", "24bit"],
        category: "Audio & Stems",
        summary: "Synthesized multi-channel audio asset with centered speech syllables and wide stereo chords for testing voice isolation.",
      };

      setMedia((prev) => [newItem, ...prev]);
      setSelectedId(newItem.id);
      setCurrentTab("isolator");
    } catch (err: any) {
      alert(`Failed to synthesize audio: ${err.message}`);
    }
  };

  // Folder management
  const handleCreateFolder = (name: string) => {
    const newFolder: Folder = {
      id: `folder_${Date.now()}`,
      name,
      parentId: null,
      color: "#6366f1",
      createdAt: Date.now(),
    };
    setFolders((prev) => [...prev, newFolder]);
  };

  const handleDeleteFolder = (id: string) => {
    setFolders((prev) => prev.filter((f) => f.id !== id));
    setMedia((prev) =>
      prev.map((m) => (m.folderId === id ? { ...m, folderId: null } : m))
    );
  };

  const handleMoveToFolder = (mediaIds: string[], folderId: string | null) => {
    setMedia((prev) =>
      prev.map((m) => (mediaIds.includes(m.id) ? { ...m, folderId } : m))
    );
  };

  const handleDeleteMedia = (ids: string[]) => {
    setMedia((prev) => prev.filter((m) => !ids.includes(m.id)));
    if (selectedId && ids.includes(selectedId)) {
      setSelectedId(media.find((m) => !ids.includes(m.id))?.id || null);
    }
  };

  const handleToggleFavorite = (id: string) => {
    setMedia((prev) =>
      prev.map((m) => (m.id === id ? { ...m, isFavorite: !m.isFavorite } : m))
    );
  };

  // Run Custom Macro Pipeline
  const handleRunMacro = async (macro: MacroAction) => {
    if (!currentMedia) {
      alert("Please select a media item to run this macro on.");
      return;
    }

    let updated = { ...currentMedia };
    alert(`Executing Macro: "${macro.name}" (${macro.steps.length} steps)...`);

    for (const step of macro.steps) {
      if (step === "ocr" || step === "objects" || step === "faces" || step === "altText") {
        if (localMode || updated.type !== "image") {
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.src = updated.url;
          await new Promise((r) => (img.onload = r));
          const localRes = await processImageLocally(img);
          updated = { ...updated, ...localRes };
        } else {
          try {
            const res = await fetch("/api/gemini/analyze-image", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ imageBase64: updated.url, mimeType: updated.mimeType }),
            });
            if (res.ok) {
              const data = await res.json();
              updated = {
                ...updated,
                category: data.category || updated.category,
                summary: data.summary || updated.summary,
                altText: data.altText || updated.altText,
                tags: Array.from(new Set([...updated.tags, ...(data.tags || [])])),
                ocrText: data.ocrText,
                detectedObjects: data.detectedObjects,
                detectedFaces: data.detectedFaces,
                dominantColors: data.dominantColors,
              };
            }
          } catch (e) {
            console.error("Macro AI step failed:", e);
          }
        }
      } else if (step === "autoEnhance") {
        updated = {
          ...updated,
          editSettings: {
            brightness: 4,
            contrast: 15,
            saturation: 15,
            exposure: 0,
            warmth: 10,
            vignette: 15,
            sharpen: 10,
            sepia: 0,
            grayscale: 0,
            invert: 0,
            blur: 0,
            rotation: 0,
            flipH: false,
            flipV: false,
          },
        };
      } else if (step === "voiceIsolate") {
        try {
          const ctx = getAudioContext();
          const buf = createSyntheticAudioBuffer(ctx, 6);
          const stems = await isolateVocalStems(buf);
          updated = { ...updated, voiceIsolation: stems };
        } catch (e) {
          console.error("Macro voice isolate failed:", e);
        }
      }
    }

    handleUpdateMedia({ ...updated, updatedAt: Date.now() });
    alert(`Macro "${macro.name}" executed successfully!`);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Studio Header */}
      <Navbar
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        localMode={localMode}
        setLocalMode={setLocalMode}
        user={user}
        onSignIn={handleSignIn}
        onSignOut={handleSignOut}
        onOpenShortcuts={() => setIsShortcutsOpen(true)}
        syncedCount={media.filter((m) => m.driveFileId || m.isGooglePhoto).length}
        onOpenGooglePhotos={() => setIsGooglePhotosOpen(true)}
      />

      {/* Main Workspace View */}
      <div className="flex-1 flex flex-col min-w-0">
        {currentTab === "library" && (
          <MediaLibrary
            media={media}
            folders={folders}
            selectedId={selectedId}
            onSelectMedia={(id) => {
              setSelectedId(id);
            }}
            onOpenInspector={(id) => {
              setSelectedId(id);
              setCurrentTab("inspector");
            }}
            onOpenEditor={(id) => {
              setSelectedId(id);
              setCurrentTab("editor");
            }}
            onOpenIsolator={(id) => {
              setSelectedId(id);
              setCurrentTab("isolator");
            }}
            onCreateFolder={handleCreateFolder}
            onDeleteFolder={handleDeleteFolder}
            onDeleteMedia={handleDeleteMedia}
            onUploadFiles={handleUploadFiles}
            onAddSynthesizedAudio={handleAddSynthesizedAudio}
            onSyncDrive={handleSyncDrive}
            isSyncing={isSyncing}
            onMoveToFolder={handleMoveToFolder}
            onToggleFavorite={handleToggleFavorite}
            onOpenGooglePhotos={() => setIsGooglePhotosOpen(true)}
          />
        )}

        {currentTab === "inspector" && (
          currentMedia ? (
            <ImageInspector
              media={currentMedia}
              onUpdateMedia={handleUpdateMedia}
              localMode={localMode}
              onOpenEditor={(id) => {
                setSelectedId(id);
                setCurrentTab("editor");
              }}
              onOpenIsolator={(id) => {
                setSelectedId(id);
                setCurrentTab("isolator");
              }}
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-slate-500">
              <p>No media asset selected.</p>
              <button
                onClick={() => setCurrentTab("library")}
                className="mt-3 text-indigo-400 underline text-xs"
              >
                Back to Library
              </button>
            </div>
          )
        )}

        {currentTab === "editor" && (
          currentMedia && currentMedia.type === "image" ? (
            <ImageEditor
              media={currentMedia}
              onUpdateMedia={handleUpdateMedia}
              onBackToLibrary={() => setCurrentTab("library")}
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-slate-500">
              <p>Please select an image asset from the library to edit.</p>
              <button
                onClick={() => setCurrentTab("library")}
                className="mt-3 text-indigo-400 underline text-xs"
              >
                Back to Library
              </button>
            </div>
          )
        )}

        {currentTab === "isolator" && (
          <VoiceIsolator
            media={currentMedia}
            onUpdateMedia={handleUpdateMedia}
            onSelectMedia={(id) => setSelectedId(id)}
            allMedia={media}
          />
        )}

        {currentTab === "video" && (
          <VeoVideoStudio
            onAddMediaItem={(item) => {
              setMedia((prev) => [item, ...prev]);
              setSelectedId(item.id);
            }}
            availableMedia={media}
          />
        )}

        {currentTab === "chat" && (
          <GeminiChatbot
            media={currentMedia}
            onSelectMedia={(id) => setSelectedId(id)}
            availableMedia={media}
          />
        )}

        {currentTab === "batch" && (
          <BatchLab
            media={media}
            onUpdateMediaItem={handleUpdateMedia}
            localMode={localMode}
          />
        )}

        {currentTab === "plugins" && (
          <PluginManager
            plugins={plugins}
            macros={macros}
            onTogglePlugin={(id) => {
              setPlugins((prev) =>
                prev.map((p) => (p.id === id ? { ...p, enabled: !p.enabled } : p))
              );
            }}
            onAddPlugin={(newP) => setPlugins((prev) => [...prev, newP])}
            onCreateMacro={(newM) => setMacros((prev) => [...prev, newM])}
            onRunMacro={handleRunMacro}
          />
        )}
      </div>

      {/* Keyboard Shortcuts Modal */}
      <ShortcutsModal
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />

      {/* Google Photos Cloud Connector & Cross-Device Sync Modal */}
      <GooglePhotosConnector
        isOpen={isGooglePhotosOpen}
        onClose={() => setIsGooglePhotosOpen(false)}
        localMedia={media}
        onImportPhotos={handleImportGooglePhotos}
        userEmail={user?.email || undefined}
        onInspectPhoto={(item) => {
          setSelectedId(item.id);
          setCurrentTab("inspector");
          setIsGooglePhotosOpen(false);
        }}
      />
    </div>
  );
}
