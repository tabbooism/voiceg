import React, { useState, useMemo } from "react";
import {
  Folder as FolderIcon,
  Plus,
  Search,
  CheckSquare,
  Square,
  Sparkles,
  Mic,
  Sliders,
  Trash2,
  Download,
  Star,
  Tag,
  Users,
  Grid,
  List as ListIcon,
  ShieldCheck,
  HardDrive,
  FileImage,
  FileVideo,
  FileAudio,
  FolderPlus,
  RefreshCw,
  ExternalLink,
  Cloud,
  Globe,
} from "lucide-react";
import { MediaItem, Folder } from "../types";
import { createSyntheticAudioBuffer, encodeWAV } from "../lib/audioIsolation";
import { getAudioContext } from "../lib/audioIsolation";

interface MediaLibraryProps {
  media: MediaItem[];
  folders: Folder[];
  selectedId: string | null;
  onSelectMedia: (id: string) => void;
  onOpenInspector: (id: string) => void;
  onOpenEditor: (id: string) => void;
  onOpenIsolator: (id: string) => void;
  onCreateFolder: (name: string) => void;
  onDeleteFolder: (id: string) => void;
  onDeleteMedia: (ids: string[]) => void;
  onUploadFiles: (files: FileList | File[]) => void;
  onAddSynthesizedAudio: () => void;
  onSyncDrive: () => void;
  isSyncing: boolean;
  onMoveToFolder: (mediaIds: string[], folderId: string | null) => void;
  onToggleFavorite: (id: string) => void;
  onOpenGooglePhotos?: () => void;
}

export const MediaLibrary: React.FC<MediaLibraryProps> = ({
  media,
  folders,
  selectedId,
  onSelectMedia,
  onOpenInspector,
  onOpenEditor,
  onOpenIsolator,
  onCreateFolder,
  onDeleteFolder,
  onDeleteMedia,
  onUploadFiles,
  onAddSynthesizedAudio,
  onSyncDrive,
  isSyncing,
  onMoveToFolder,
  onToggleFavorite,
  onOpenGooglePhotos,
}) => {
  // Navigation & Filtering
  const [selectedFolderId, setSelectedFolderId] = useState<string | "all" | "favorites" | "local" | "google_photos" | "verified">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "image" | "video" | "audio">("all");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [selectedFaceId, setSelectedFaceId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  // Multi-selection for bulk operations
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  // Extract all categories, tags, and face clusters from library
  const categories = useMemo(() => {
    const counts: Record<string, number> = {};
    media.forEach((item) => {
      if (item.category) {
        counts[item.category] = (counts[item.category] || 0) + 1;
      }
    });
    return Object.entries(counts);
  }, [media]);

  const allTags = useMemo(() => {
    const counts: Record<string, number> = {};
    media.forEach((item) => {
      item.tags.forEach((t) => {
        counts[t] = (counts[t] || 0) + 1;
      });
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 16);
  }, [media]);

  const faceClusters = useMemo(() => {
    const clusters: Record<string, number> = {};
    media.forEach((item) => {
      item.detectedFaces?.forEach((f) => {
        clusters[f.faceId] = (clusters[f.faceId] || 0) + 1;
      });
    });
    return Object.entries(clusters);
  }, [media]);

  // Deep search and filter logic
  const filteredMedia = useMemo(() => {
    return media.filter((item) => {
      // Folder filter
      if (selectedFolderId === "favorites") {
        if (!item.isFavorite) return false;
      } else if (selectedFolderId === "local") {
        if (!item.isLocalProcessed) return false;
      } else if (selectedFolderId === "google_photos") {
        if (!item.isGooglePhoto) return false;
      } else if (selectedFolderId === "verified") {
        if (!item.sourceLookup) return false;
      } else if (selectedFolderId !== "all") {
        if (item.folderId !== selectedFolderId) return false;
      }

      // Type filter
      if (typeFilter !== "all" && item.type !== typeFilter) {
        return false;
      }

      // Category filter
      if (categoryFilter && item.category !== categoryFilter) {
        return false;
      }

      // Tag filter
      if (selectedTag && !item.tags.includes(selectedTag)) {
        return false;
      }

      // Face filter
      if (selectedFaceId && !item.detectedFaces?.some((f) => f.faceId === selectedFaceId)) {
        return false;
      }

      // Deep Text & OCR & Object search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = item.name.toLowerCase().includes(q);
        const matchesOcr = item.ocrText?.toLowerCase().includes(q);
        const matchesSummary = item.summary?.toLowerCase().includes(q);
        const matchesAlt = item.altText?.toLowerCase().includes(q);
        const matchesCategory = item.category?.toLowerCase().includes(q);
        const matchesTags = item.tags.some((t) => t.toLowerCase().includes(q));
        const matchesObjects = item.detectedObjects?.some((obj) => obj.name.toLowerCase().includes(q));
        const matchesFaces = item.detectedFaces?.some((face) => face.faceId.toLowerCase().includes(q) || face.expression?.toLowerCase().includes(q));

        if (!matchesName && !matchesOcr && !matchesSummary && !matchesAlt && !matchesCategory && !matchesTags && !matchesObjects && !matchesFaces) {
          return false;
        }
      }

      return true;
    });
  }, [media, selectedFolderId, typeFilter, categoryFilter, selectedTag, selectedFaceId, searchQuery]);

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredMedia.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredMedia.map((m) => m.id));
    }
  };

  const toggleItemSelection = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((item) => item !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleCreateFolder = (e: React.FormEvent) => {
    e.preventDefault();
    if (newFolderName.trim()) {
      onCreateFolder(newFolderName.trim());
      setNewFolderName("");
      setIsCreatingFolder(false);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-60px)] overflow-hidden bg-slate-950 text-slate-200">
      {/* Sidebar: Structured Folder Tree & Categorization */}
      <aside className="w-full lg:w-72 bg-slate-900/80 border-r border-slate-800 flex flex-col shrink-0 overflow-y-auto p-4 gap-6">
        {/* Quick Folder Links */}
        <div>
          <div className="flex items-center justify-between text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            <span>Library Folders</span>
            <button
              id="btn-add-folder"
              onClick={() => setIsCreatingFolder(true)}
              className="text-indigo-400 hover:text-indigo-300 p-1 rounded hover:bg-slate-800 transition-colors"
              title="Create new folder"
            >
              <FolderPlus className="w-4 h-4" />
            </button>
          </div>

          {isCreatingFolder && (
            <form onSubmit={handleCreateFolder} className="mb-2 flex gap-1">
              <input
                type="text"
                autoFocus
                placeholder="Folder name..."
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                className="flex-1 bg-slate-950 border border-indigo-500 rounded px-2 py-1 text-xs text-white focus:outline-none"
              />
              <button
                type="submit"
                className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-2.5 py-1 rounded"
              >
                Add
              </button>
              <button
                type="button"
                onClick={() => setIsCreatingFolder(false)}
                className="text-slate-400 hover:text-white text-xs px-2 py-1 rounded"
              >
                ✕
              </button>
            </form>
          )}

          <div className="space-y-0.5 text-xs">
            <button
              id="folder-all"
              onClick={() => {
                setSelectedFolderId("all");
                setCategoryFilter(null);
                setSelectedTag(null);
                setSelectedFaceId(null);
              }}
              className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg font-medium transition-colors ${
                selectedFolderId === "all" ? "bg-indigo-600/20 text-indigo-400 border border-indigo-500/30" : "hover:bg-slate-800/60 text-slate-300"
              }`}
            >
              <span className="flex items-center gap-2">
                <FolderIcon className="w-3.5 h-3.5 text-indigo-400" />
                All Assets
              </span>
              <span className="text-[11px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">{media.length}</span>
            </button>

            <button
              id="folder-favorites"
              onClick={() => {
                setSelectedFolderId("favorites");
                setCategoryFilter(null);
              }}
              className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg font-medium transition-colors ${
                selectedFolderId === "favorites" ? "bg-amber-600/20 text-amber-400 border border-amber-500/30" : "hover:bg-slate-800/60 text-slate-300"
              }`}
            >
              <span className="flex items-center gap-2">
                <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                Starred
              </span>
              <span className="text-[11px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                {media.filter((m) => m.isFavorite).length}
              </span>
            </button>

            <button
              id="folder-local"
              onClick={() => {
                setSelectedFolderId("local");
                setCategoryFilter(null);
              }}
              className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg font-medium transition-colors ${
                selectedFolderId === "local" ? "bg-emerald-600/20 text-emerald-400 border border-emerald-500/30" : "hover:bg-slate-800/60 text-slate-300"
              }`}
            >
              <span className="flex items-center gap-2">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                Local Privacy Scans
              </span>
              <span className="text-[11px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                {media.filter((m) => m.isLocalProcessed).length}
              </span>
            </button>

            <button
              id="folder-google-photos"
              onClick={() => {
                setSelectedFolderId("google_photos");
                setCategoryFilter(null);
              }}
              className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg font-medium transition-colors ${
                selectedFolderId === "google_photos" ? "bg-rose-600/20 text-rose-400 border border-rose-500/30" : "hover:bg-slate-800/60 text-slate-300"
              }`}
            >
              <span className="flex items-center gap-2">
                <Cloud className="w-3.5 h-3.5 text-rose-400" />
                Google Photos
              </span>
              <span className="text-[11px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                {media.filter((m) => m.isGooglePhoto).length}
              </span>
            </button>

            <button
              id="folder-verified"
              onClick={() => {
                setSelectedFolderId("verified");
                setCategoryFilter(null);
              }}
              className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg font-medium transition-colors ${
                selectedFolderId === "verified" ? "bg-amber-600/20 text-amber-400 border border-amber-500/30" : "hover:bg-slate-800/60 text-slate-300"
              }`}
            >
              <span className="flex items-center gap-2">
                <Globe className="w-3.5 h-3.5 text-amber-400" />
                Verified Sources
              </span>
              <span className="text-[11px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                {media.filter((m) => m.sourceLookup).length}
              </span>
            </button>

            {/* Custom Folders */}
            {folders.map((folder) => {
              const count = media.filter((m) => m.folderId === folder.id).length;
              return (
                <div
                  key={folder.id}
                  className={`group flex items-center justify-between px-2.5 py-2 rounded-lg font-medium transition-colors cursor-pointer ${
                    selectedFolderId === folder.id ? "bg-indigo-600/20 text-indigo-400 border border-indigo-500/30" : "hover:bg-slate-800/60 text-slate-300"
                  }`}
                  onClick={() => setSelectedFolderId(folder.id)}
                >
                  <span className="flex items-center gap-2 truncate">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: folder.color || "#818cf8" }} />
                    <span className="truncate">{folder.name}</span>
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">{count}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Delete folder "${folder.name}"? Media items will be moved to uncategorized.`)) {
                          onDeleteFolder(folder.id);
                        }
                      }}
                      className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-rose-400 p-0.5"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Categories Breakdown */}
        {categories.length > 0 && (
          <div>
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center justify-between">
              <span>ML Categories</span>
              {categoryFilter && (
                <button onClick={() => setCategoryFilter(null)} className="text-[10px] text-indigo-400 hover:underline">
                  Clear
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {categories.map(([cat, count]) => (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(categoryFilter === cat ? null : cat)}
                  className={`px-2 py-1 rounded-md text-[11px] font-medium border transition-all ${
                    categoryFilter === cat
                      ? "bg-indigo-600 text-white border-indigo-500"
                      : "bg-slate-800/50 text-slate-300 border-slate-700/60 hover:bg-slate-800 hover:border-slate-600"
                  }`}
                >
                  {cat} ({count})
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Face Recognition Clusters */}
        {faceClusters.length > 0 && (
          <div>
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-purple-400" />
                Face Clusters
              </span>
              {selectedFaceId && (
                <button onClick={() => setSelectedFaceId(null)} className="text-[10px] text-indigo-400 hover:underline">
                  Clear
                </button>
              )}
            </div>
            <div className="space-y-1">
              {faceClusters.map(([faceId, count]) => (
                <button
                  key={faceId}
                  onClick={() => setSelectedFaceId(selectedFaceId === faceId ? null : faceId)}
                  className={`w-full flex items-center justify-between px-2 py-1.5 rounded text-xs transition-colors ${
                    selectedFaceId === faceId ? "bg-purple-600/30 text-purple-300 border border-purple-500/40" : "hover:bg-slate-800/60 text-slate-300"
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-purple-400" />
                    <span className="capitalize">{faceId.replace(/_/g, " ")}</span>
                  </span>
                  <span className="text-[10px] text-slate-400">{count} photos</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Tags Cloud */}
        {allTags.length > 0 && (
          <div>
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-pink-400" />
                Descriptive Tags
              </span>
              {selectedTag && (
                <button onClick={() => setSelectedTag(null)} className="text-[10px] text-indigo-400 hover:underline">
                  Clear
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-1">
              {allTags.map(([tag, count]) => (
                <button
                  key={tag}
                  onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                  className={`px-2 py-0.5 rounded text-[11px] transition-colors border ${
                    selectedTag === tag
                      ? "bg-pink-600 text-white border-pink-500"
                      : "bg-slate-800/40 text-slate-400 border-slate-800 hover:bg-slate-800 hover:text-slate-200"
                  }`}
                >
                  #{tag} ({count})
                </button>
              ))}
            </div>
          </div>
        )}
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Control Bar: Search & Action buttons */}
        <div className="p-4 border-b border-slate-800 bg-slate-900/40 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Deep Search Input */}
          <div className="relative flex-1 max-w-lg">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id="input-deep-search"
              type="text"
              placeholder="Deep search OCR text, objects, tags, faces, colors, or file name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-8 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs"
              >
                ✕
              </button>
            )}
          </div>

          {/* Type filters & actions */}
          <div className="flex items-center flex-wrap gap-2">
            {/* Type selector */}
            <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
              <button
                onClick={() => setTypeFilter("all")}
                className={`px-2.5 py-1 rounded font-medium ${typeFilter === "all" ? "bg-slate-800 text-white" : "text-slate-400 hover:text-white"}`}
              >
                All
              </button>
              <button
                onClick={() => setTypeFilter("image")}
                className={`px-2.5 py-1 rounded font-medium ${typeFilter === "image" ? "bg-slate-800 text-white" : "text-slate-400 hover:text-white"}`}
              >
                Images
              </button>
              <button
                onClick={() => setTypeFilter("video")}
                className={`px-2.5 py-1 rounded font-medium ${typeFilter === "video" ? "bg-slate-800 text-white" : "text-slate-400 hover:text-white"}`}
              >
                Videos
              </button>
              <button
                onClick={() => setTypeFilter("audio")}
                className={`px-2.5 py-1 rounded font-medium ${typeFilter === "audio" ? "bg-slate-800 text-white" : "text-slate-400 hover:text-white"}`}
              >
                Audio
              </button>
            </div>

            {/* View Mode */}
            <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800 text-slate-400">
              <button
                onClick={() => setViewMode("grid")}
                className={`p-1 rounded ${viewMode === "grid" ? "bg-slate-800 text-white" : "hover:text-white"}`}
                title="Grid view"
              >
                <Grid className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`p-1 rounded ${viewMode === "list" ? "bg-slate-800 text-white" : "hover:text-white"}`}
                title="List view"
              >
                <ListIcon className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Google Photos Cloud Sync Trigger */}
            {onOpenGooglePhotos && (
              <button
                id="btn-google-photos-sync"
                onClick={onOpenGooglePhotos}
                className="flex items-center gap-1.5 bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white px-3 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition-all"
                title="Open Google Photos Media Manager & Sync across all devices"
              >
                <Cloud className="w-3.5 h-3.5" />
                <span>Google Photos Sync</span>
              </button>
            )}

            {/* Google Drive Sync Trigger */}
            <button
              id="btn-sync-drive"
              onClick={onSyncDrive}
              disabled={isSyncing}
              className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-700 transition-colors"
              title="Sync library with Google Drive"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-sky-400 ${isSyncing ? "animate-spin" : ""}`} />
              <span>{isSyncing ? "Syncing..." : "Sync Drive"}</span>
            </button>

            {/* Add Audio Demo */}
            <button
              id="btn-demo-audio"
              onClick={onAddSynthesizedAudio}
              className="flex items-center gap-1.5 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
              title="Add a sample synthesized multitrack audio file for voice isolation"
            >
              <Mic className="w-3.5 h-3.5 text-indigo-400" />
              <span>+ Sample Audio</span>
            </button>

            {/* File Upload Input */}
            <label className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer shadow-sm transition-colors">
              <Plus className="w-3.5 h-3.5" />
              <span>Import Media</span>
              <input
                id="file-upload-input"
                type="file"
                multiple
                accept="image/*,video/*,audio/*"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.length) {
                    onUploadFiles(e.target.files);
                  }
                }}
              />
            </label>
          </div>
        </div>

        {/* Bulk Actions Bar (Shown when items are selected) */}
        {selectedIds.length > 0 && (
          <div className="bg-indigo-950/70 border-b border-indigo-800/60 px-4 py-2 flex items-center justify-between text-xs text-indigo-200">
            <div className="flex items-center gap-3">
              <span className="font-semibold">{selectedIds.length} items selected</span>
              <button
                onClick={toggleSelectAll}
                className="text-indigo-400 hover:underline"
              >
                {selectedIds.length === filteredMedia.length ? "Deselect all" : "Select all"}
              </button>
            </div>

            <div className="flex items-center gap-2">
              {/* Move to folder dropdown */}
              <select
                onChange={(e) => {
                  if (e.target.value) {
                    onMoveToFolder(selectedIds, e.target.value === "none" ? null : e.target.value);
                    setSelectedIds([]);
                  }
                }}
                defaultValue=""
                className="bg-slate-900 border border-indigo-500/40 text-xs text-slate-200 rounded px-2 py-1 focus:outline-none"
              >
                <option value="" disabled>Move to Folder...</option>
                <option value="none">Uncategorized</option>
                {folders.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>

              {/* Bulk Delete */}
              <button
                onClick={() => {
                  if (confirm(`Delete ${selectedIds.length} media item(s)?`)) {
                    onDeleteMedia(selectedIds);
                    setSelectedIds([]);
                  }
                }}
                className="flex items-center gap-1 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 px-2.5 py-1 rounded transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
              </button>
            </div>
          </div>
        )}

        {/* Gallery / Media Grid */}
        <div
          className="flex-1 overflow-y-auto p-4"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (e.dataTransfer.files?.length) {
              onUploadFiles(e.dataTransfer.files);
            }
          }}
        >
          {filteredMedia.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-500">
              <HardDrive className="w-12 h-12 stroke-[1.5] text-slate-600 mb-3" />
              <h3 className="text-base font-semibold text-slate-300 mb-1">No media assets found</h3>
              <p className="text-xs max-w-sm text-slate-400 mb-4">
                {searchQuery
                  ? `No items match query "${searchQuery}". Try searching for specific OCR text, objects, tags, or colors.`
                  : "Import photos, videos, or audio files to start automatic categorization and voice stem isolation."}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={onAddSynthesizedAudio}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs px-3 py-1.5 rounded-lg border border-slate-700"
                >
                  Generate Demo Audio
                </button>
                <label className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-3 py-1.5 rounded-lg cursor-pointer">
                  Import Files
                  <input
                    type="file"
                    multiple
                    accept="image/*,video/*,audio/*"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files?.length) onUploadFiles(e.target.files);
                    }}
                  />
                </label>
              </div>
            </div>
          ) : viewMode === "grid" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredMedia.map((item) => {
                const isSelected = selectedIds.includes(item.id);
                const isCurrent = selectedId === item.id;

                return (
                  <div
                    key={item.id}
                    id={`media-card-${item.id}`}
                    onClick={() => onSelectMedia(item.id)}
                    className={`group relative bg-slate-900 rounded-xl border transition-all overflow-hidden flex flex-col cursor-pointer ${
                      isCurrent
                        ? "border-indigo-500 ring-2 ring-indigo-500/20 shadow-lg shadow-indigo-500/10"
                        : "border-slate-800 hover:border-slate-700 hover:bg-slate-900/90"
                    }`}
                  >
                    {/* Media Thumbnail Container */}
                    <div className="relative aspect-video bg-slate-950 flex items-center justify-center overflow-hidden">
                      {item.type === "image" ? (
                        <img
                          src={item.url}
                          alt={item.altText || item.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : item.type === "video" ? (
                        <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 to-indigo-950 text-indigo-400 p-4">
                          <FileVideo className="w-10 h-10 mb-1" />
                          <span className="text-[11px] font-mono">Video Asset</span>
                        </div>
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 to-purple-950 text-purple-400 p-4">
                          <FileAudio className="w-10 h-10 mb-1" />
                          <span className="text-[11px] font-mono">Multitrack Audio</span>
                        </div>
                      )}

                      {/* Top Action Overlay (Select & Favorite) */}
                      <div className="absolute top-2 left-2 right-2 flex items-center justify-between opacity-90 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => toggleItemSelection(item.id, e)}
                          className="p-1 rounded bg-slate-950/70 text-slate-300 hover:text-white backdrop-blur"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-indigo-400" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-400" />
                          )}
                        </button>

                        <div className="flex items-center gap-1">
                          {item.isLocalProcessed && (
                            <span
                              title="Processed Privately On-Device (Local Mode)"
                              className="bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 p-1 rounded backdrop-blur"
                            >
                              <ShieldCheck className="w-3.5 h-3.5" />
                            </span>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onToggleFavorite(item.id);
                            }}
                            className="p-1 rounded bg-slate-950/70 text-slate-400 hover:text-amber-400 backdrop-blur"
                          >
                            <Star
                              className={`w-4 h-4 ${item.isFavorite ? "text-amber-400 fill-amber-400" : ""}`}
                            />
                          </button>
                        </div>
                      </div>

                      {/* Type & Source Badges */}
                      <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between pointer-events-none">
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] uppercase font-mono tracking-wider px-1.5 py-0.5 rounded bg-slate-950/80 text-slate-300 border border-slate-800 backdrop-blur">
                            {item.category || item.type}
                          </span>
                          {item.voiceIsolation && (
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-purple-950/80 text-purple-300 border border-purple-800/80 backdrop-blur flex items-center gap-1">
                              <Mic className="w-2.5 h-2.5" /> Stems
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1">
                          {item.isGooglePhoto && (
                            <span
                              title="Imported from Google Photos"
                              className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-rose-950/90 text-rose-300 border border-rose-800/80 backdrop-blur flex items-center gap-0.5"
                            >
                              <Cloud className="w-2.5 h-2.5" /> Photos
                            </span>
                          )}
                          {item.sourceLookup && (
                            <span
                              title={`Google Image Verified: ${item.sourceLookup.verifiedSource || "Web Match"}`}
                              className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-amber-950/90 text-amber-300 border border-amber-800/80 backdrop-blur flex items-center gap-0.5"
                            >
                              <Globe className="w-2.5 h-2.5" /> Verified
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Card Information */}
                    <div className="p-3 flex-1 flex flex-col justify-between">
                      <div>
                        <h4 className="text-xs font-semibold text-white truncate mb-1" title={item.name}>
                          {item.name}
                        </h4>

                        {/* OCR text snippet preview */}
                        {item.ocrText && (
                          <p className="text-[11px] text-indigo-300/90 font-mono line-clamp-1 bg-indigo-950/30 px-1.5 py-0.5 rounded border border-indigo-900/40 mb-1.5">
                            OCR: "{item.ocrText.slice(0, 45)}..."
                          </p>
                        )}

                        {/* Summary / Alt Text */}
                        <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed mb-2">
                          {item.summary || item.altText || "No ML analysis performed yet."}
                        </p>

                        {/* Tags preview */}
                        <div className="flex flex-wrap gap-1 mb-3">
                          {item.tags.slice(0, 3).map((t) => (
                            <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                              #{t}
                            </span>
                          ))}
                          {item.tags.length > 3 && (
                            <span className="text-[10px] text-slate-500">+{item.tags.length - 3}</span>
                          )}
                        </div>
                      </div>

                      {/* Card Action Buttons */}
                      <div className="flex items-center gap-1 pt-2 border-t border-slate-800/80">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenInspector(item.id);
                          }}
                          className="flex-1 flex items-center justify-center gap-1 bg-slate-800 hover:bg-indigo-600 text-slate-200 hover:text-white py-1 rounded text-[11px] font-medium transition-colors"
                          title="Inspect text, objects, and ask AI"
                        >
                          <Sparkles className="w-3 h-3" />
                          <span>Inspect</span>
                        </button>

                        {item.type === "image" && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenEditor(item.id);
                            }}
                            className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                            title="Open photo editor (crop, rotate, filters)"
                          >
                            <Sliders className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {(item.type === "audio" || item.type === "video") && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenIsolator(item.id);
                            }}
                            className="p-1 rounded bg-purple-950/80 hover:bg-purple-900 border border-purple-800 text-purple-300 transition-colors"
                            title="Isolate voice & multitrack stem lab"
                          >
                            <Mic className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* List View */
            <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden divide-y divide-slate-800">
              {filteredMedia.map((item) => (
                <div
                  key={item.id}
                  onClick={() => onSelectMedia(item.id)}
                  className={`p-3 flex items-center justify-between gap-4 hover:bg-slate-800/50 cursor-pointer transition-colors ${
                    selectedId === item.id ? "bg-indigo-950/40" : ""
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <button
                      onClick={(e) => toggleItemSelection(item.id, e)}
                      className="text-slate-400 hover:text-white"
                    >
                      {selectedIds.includes(item.id) ? (
                        <CheckSquare className="w-4 h-4 text-indigo-400" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>

                    <div className="w-12 h-12 rounded bg-slate-950 overflow-hidden shrink-0 flex items-center justify-center">
                      {item.type === "image" ? (
                        <img src={item.url} alt="" className="w-full h-full object-cover" />
                      ) : item.type === "video" ? (
                        <FileVideo className="w-6 h-6 text-indigo-400" />
                      ) : (
                        <FileAudio className="w-6 h-6 text-purple-400" />
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-white truncate">{item.name}</span>
                        {item.category && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300">
                            {item.category}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 truncate">
                        {item.ocrText ? `OCR: ${item.ocrText}` : item.summary || item.altText || "No analysis yet."}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenInspector(item.id);
                      }}
                      className="px-2.5 py-1 rounded bg-slate-800 hover:bg-indigo-600 text-xs text-slate-200 font-medium"
                    >
                      Inspect
                    </button>
                    {item.type === "image" && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenEditor(item.id);
                        }}
                        className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
                        title="Edit"
                      >
                        <Sliders className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {(item.type === "audio" || item.type === "video") && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenIsolator(item.id);
                        }}
                        className="p-1 rounded bg-purple-950 hover:bg-purple-900 border border-purple-800 text-purple-300"
                        title="Voice Isolator"
                      >
                        <Mic className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
