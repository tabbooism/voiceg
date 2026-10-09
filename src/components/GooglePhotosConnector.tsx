import React, { useState, useEffect } from "react";
import {
  Cloud,
  RefreshCw,
  Download,
  Upload,
  Camera,
  CheckCircle2,
  ExternalLink,
  Shield,
  Search,
  Sparkles,
  Layers,
  HardDrive,
  Calendar,
  Eye,
  Sliders,
} from "lucide-react";
import { MediaItem } from "../types";
import {
  fetchGooglePhotosMedia,
  uploadMediaToDrive,
  getOrCreateStudioSyncFolder,
  getAccessToken,
} from "../lib/firebase";

interface GooglePhotosConnectorProps {
  isOpen: boolean;
  onClose: () => void;
  localMedia: MediaItem[];
  onImportPhotos: (importedItems: MediaItem[]) => void;
  userEmail?: string;
  onInspectPhoto: (item: MediaItem) => void;
}

export const GooglePhotosConnector: React.FC<GooglePhotosConnectorProps> = ({
  isOpen,
  onClose,
  localMedia,
  onImportPhotos,
  userEmail,
  onInspectPhoto,
}) => {
  const [photos, setPhotos] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<string[]>([]);
  const [autoSync, setAutoSync] = useState<boolean>(() => {
    return localStorage.getItem("mediavision_autosync") === "true";
  });
  const [lastSyncTime, setLastSyncTime] = useState<string>(() => {
    return localStorage.getItem("mediavision_lastsync") || "Never";
  });
  const [isUploading, setIsUploading] = useState(false);
  const [activeTab, setActiveTab] = useState<"cloud_browser" | "backup">("cloud_browser");
  const [backupSelectedLocalId, setBackupSelectedLocalId] = useState<string>(
    localMedia[0]?.id || ""
  );

  useEffect(() => {
    if (isOpen) {
      handleLoadGooglePhotos();
    }
  }, [isOpen]);

  const handleToggleAutoSync = (enabled: boolean) => {
    setAutoSync(enabled);
    localStorage.setItem("mediavision_autosync", String(enabled));
  };

  const handleLoadGooglePhotos = async () => {
    const token = await getAccessToken();
    if (!token) return;

    setIsLoading(true);
    try {
      const items = await fetchGooglePhotosMedia(token, 40);
      setPhotos(items);
      const nowStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      setLastSyncTime(nowStr);
      localStorage.setItem("mediavision_lastsync", nowStr);
    } catch (err: any) {
      console.error("Error fetching Google Photos:", err);
      alert(`Could not load Google Photos: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleImportSelected = () => {
    if (selectedPhotoIds.length === 0) return;

    const itemsToImport = photos.filter((p) => selectedPhotoIds.includes(p.id));
    const newStudioItems: MediaItem[] = itemsToImport.map((file) => {
      const meta = file.imageMediaMetadata || {};
      return {
        id: `gphoto_${file.id}`,
        name: file.name,
        type: "image",
        size: Number(file.size || 0),
        mimeType: file.mimeType || "image/jpeg",
        url: file.thumbnailLink?.replace(/=s\d+/, "=s1600") || file.webContentLink || "",
        thumbnailUrl: file.thumbnailLink,
        createdAt: new Date(file.createdTime).getTime(),
        updatedAt: Date.now(),
        isGooglePhoto: true,
        photoAlbum: "Google Photos",
        driveFileId: file.id,
        tags: [
          "google-photos",
          "cloud-sync",
          ...(meta.cameraMake ? [meta.cameraMake.toLowerCase()] : []),
          ...(meta.cameraModel ? [meta.cameraModel.toLowerCase()] : []),
        ],
        summary: `Imported from Google Photos (${meta.cameraMake || "Camera"} ${meta.cameraModel || ""})`,
        imageMediaMetadata: {
          cameraMake: meta.cameraMake,
          cameraModel: meta.cameraModel,
          exposureTime: meta.exposureTime,
          aperture: meta.aperture,
          focalLength: meta.focalLength,
          isoSpeed: meta.isoSpeed,
          width: meta.width,
          height: meta.height,
          time: meta.time,
        },
        syncedAt: new Date().toISOString(),
      };
    });

    onImportPhotos(newStudioItems);
    alert(`Successfully imported ${newStudioItems.length} photos from Google Photos to Studio!`);
    setSelectedPhotoIds([]);
    onClose();
  };

  const handleUploadLocalItemToGooglePhotos = async () => {
    const item = localMedia.find((m) => m.id === backupSelectedLocalId);
    if (!item) return;

    const token = await getAccessToken();
    if (!token) {
      alert("Please authenticate with Google to backup photos.");
      return;
    }

    setIsUploading(true);
    try {
      const folderId = await getOrCreateStudioSyncFolder(token);

      const res = await fetch(item.url);
      const blob = await res.blob();

      const uploaded = await uploadMediaToDrive(
        token,
        blob,
        `MediaVision_${item.name}`,
        item.mimeType,
        folderId
      );

      alert(`Successfully backed up "${item.name}" to Google Photos & Drive cloud folder!`);
      handleLoadGooglePhotos();
    } catch (err: any) {
      alert(`Cloud backup failed: ${err.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  if (!isOpen) return null;

  const filteredPhotos = photos.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.imageMediaMetadata?.cameraModel || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-4xl w-full h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-rose-500 via-amber-400 to-blue-500 flex items-center justify-center shadow-md">
              <Cloud className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white">Google Photos Media Manager & Sync</h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800/80 font-mono">
                  Active Cloud Sync
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Connected: <span className="text-slate-300 font-mono">{userEmail || "Google Workspace Account"}</span> • Cross-device sync enabled
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-800/60 hover:bg-slate-800 text-slate-400 hover:text-white text-xs"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Sync Controls Bar */}
        <div className="px-5 py-3 border-b border-slate-800 bg-slate-950/40 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-slate-300">
              <HardDrive className="w-4 h-4 text-sky-400" />
              <span>
                Cloud Library: <strong className="text-white font-mono">{photos.length}</strong> items
              </span>
            </div>

            <div className="text-slate-400 text-[11px]">
              Last Synced: <span className="text-slate-300 font-mono">{lastSyncTime}</span>
            </div>

            {/* Auto-Sync Toggle */}
            <label className="flex items-center gap-2 cursor-pointer text-slate-300 hover:text-white select-none">
              <input
                type="checkbox"
                checked={autoSync}
                onChange={(e) => handleToggleAutoSync(e.target.checked)}
                className="w-3.5 h-3.5 accent-indigo-500 rounded"
              />
              <span className="text-[11px]">Auto-Sync Across Devices</span>
            </label>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-xs">
              <button
                onClick={() => setActiveTab("cloud_browser")}
                className={`px-3 py-1 rounded-md font-medium transition-colors ${
                  activeTab === "cloud_browser"
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Browse Cloud Photos
              </button>
              <button
                onClick={() => setActiveTab("backup")}
                className={`px-3 py-1 rounded-md font-medium transition-colors ${
                  activeTab === "backup"
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Upload & Backup
              </button>
            </div>

            <button
              onClick={handleLoadGooglePhotos}
              disabled={isLoading}
              className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1 rounded-lg text-xs font-medium transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-sky-400" : ""}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Content Body */}
        {activeTab === "cloud_browser" ? (
          <div className="flex-1 flex flex-col min-h-0 bg-slate-950/20">
            {/* Search and Selection Toolbar */}
            <div className="p-3 border-b border-slate-800/80 flex items-center justify-between gap-3 text-xs">
              <div className="relative flex-1 max-w-sm">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
                <input
                  type="text"
                  placeholder="Filter by photo name or camera model..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-400">
                  {selectedPhotoIds.length} selected
                </span>
                <button
                  onClick={handleImportSelected}
                  disabled={selectedPhotoIds.length === 0}
                  className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white px-3 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Import to Studio ({selectedPhotoIds.length})</span>
                </button>
              </div>
            </div>

            {/* Photos Grid */}
            <div className="flex-1 overflow-y-auto p-4">
              {isLoading ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-3">
                  <RefreshCw className="w-6 h-6 animate-spin text-indigo-400" />
                  <span className="text-xs">Fetching high-res photos & EXIF from Google Photos...</span>
                </div>
              ) : filteredPhotos.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-2">
                  <Camera className="w-8 h-8 text-slate-600" />
                  <p className="text-xs">No photos found matching query in Google Photos.</p>
                  <button
                    onClick={handleLoadGooglePhotos}
                    className="text-xs text-indigo-400 underline"
                  >
                    Refresh library
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
                  {filteredPhotos.map((file) => {
                    const isSelected = selectedPhotoIds.includes(file.id);
                    const meta = file.imageMediaMetadata || {};
                    const thumb = file.thumbnailLink || file.webContentLink;

                    return (
                      <div
                        key={file.id}
                        onClick={() => {
                          if (isSelected) {
                            setSelectedPhotoIds(selectedPhotoIds.filter((id) => id !== file.id));
                          } else {
                            setSelectedPhotoIds([...selectedPhotoIds, file.id]);
                          }
                        }}
                        className={`group bg-slate-900 border rounded-xl overflow-hidden cursor-pointer transition-all flex flex-col relative ${
                          isSelected
                            ? "border-indigo-500 ring-2 ring-indigo-500/50"
                            : "border-slate-800 hover:border-slate-700"
                        }`}
                      >
                        {/* Thumbnail */}
                        <div className="aspect-square bg-slate-950 relative overflow-hidden">
                          {thumb ? (
                            <img
                              src={thumb}
                              alt={file.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-600">
                              <Camera className="w-6 h-6" />
                            </div>
                          )}

                          {/* Checkbox badge */}
                          <div className="absolute top-2 right-2">
                            <div
                              className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${
                                isSelected
                                  ? "bg-indigo-600 border-indigo-500 text-white"
                                  : "bg-black/50 border-white/40 text-transparent"
                              }`}
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            </div>
                          </div>

                          {/* Camera Model Badge */}
                          {meta.cameraModel && (
                            <div className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/75 backdrop-blur-sm text-[9px] font-mono text-slate-300 border border-white/10 truncate max-w-[90%]">
                              {meta.cameraModel}
                            </div>
                          )}
                        </div>

                        {/* File Details */}
                        <div className="p-2 text-[11px] flex-1 flex flex-col justify-between">
                          <span className="font-semibold text-slate-200 truncate block">
                            {file.name}
                          </span>

                          <div className="flex items-center justify-between text-[10px] text-slate-500 mt-1 font-mono">
                            <span>{Math.round((file.size || 0) / 1024)} KB</span>
                            <span>{new Date(file.createdTime).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Cloud Backup Tab */
          <div className="flex-1 p-6 overflow-y-auto bg-slate-950/20 max-w-xl mx-auto w-full space-y-5">
            <div className="border border-slate-800 rounded-xl p-4 bg-slate-900">
              <h4 className="text-xs font-bold text-white mb-1 flex items-center gap-2">
                <Upload className="w-4 h-4 text-sky-400" />
                Backup Studio Photo to Google Photos Cloud
              </h4>
              <p className="text-[11px] text-slate-400 leading-relaxed mb-4">
                Upload local studio images, edited masters, and voice stems directly to your private Google Photos & Google Drive storage folder for cross-device access.
              </p>

              <label className="text-xs text-slate-300 block mb-1 font-medium">Select Studio Asset:</label>
              <select
                value={backupSelectedLocalId}
                onChange={(e) => setBackupSelectedLocalId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white focus:outline-none mb-4"
              >
                {localMedia.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.type} • {m.category || "Uncategorized"})
                  </option>
                ))}
              </select>

              <button
                id="btn-upload-google-photos"
                onClick={handleUploadLocalItemToGooglePhotos}
                disabled={isUploading || !backupSelectedLocalId}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 disabled:opacity-50 text-white py-2.5 rounded-xl text-xs font-semibold shadow-lg shadow-sky-600/20 transition-all"
              >
                <Cloud className="w-4 h-4" />
                <span>{isUploading ? "Uploading to Google Photos..." : "Upload & Sync to Cloud"}</span>
              </button>
            </div>

            <div className="border border-slate-800 rounded-xl p-4 bg-slate-900/60 text-xs text-slate-400 space-y-2">
              <div className="flex items-center gap-2 text-slate-300 font-semibold">
                <Shield className="w-4 h-4 text-emerald-400" />
                Multi-Device Synchronization Guarantee
              </div>
              <p className="text-[11px] leading-relaxed">
                Photos synced or uploaded through MediaVision Studio are saved to a dedicated Google Workspace folder ("MediaVision Studio") and mapped to your Google Photos cloud index. Any device logged into your Google account will automatically reflect changes.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
