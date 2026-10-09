import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
  signOut,
} from "firebase/auth";
import firebaseConfig from "../../firebase-applet-config.json";

// Initialize Firebase once
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

export const SCOPES = [
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/drive.readonly",
  "https://www.googleapis.com/auth/drive.photos.readonly",
];

const provider = new GoogleAuthProvider();
SCOPES.forEach((scope) => provider.addScope(scope));

let isSigningIn = false;
let cachedAccessToken: string | null = null;

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user && cachedAccessToken) {
      if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
    } else {
      if (!isSigningIn) {
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    }
  });
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error("Failed to obtain OAuth access token from Google sign in.");
    }
    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    if (
      error?.code === "auth/popup-closed-by-user" ||
      error?.code === "auth/cancelled-popup-request" ||
      error?.message?.includes("cancelled-popup-request") ||
      error?.message?.includes("popup-closed-by-user")
    ) {
      console.log("Sign-in popup closed or cancelled by user.");
      return null;
    }
    console.error("Sign-in failed:", error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const logout = async () => {
  await signOut(auth);
  cachedAccessToken = null;
};

/**
 * Google Drive & Google Photos API helpers
 */
export async function listDriveMediaFiles(token: string) {
  try {
    const q = encodeURIComponent("mimeType contains 'image/' or mimeType contains 'video/' or mimeType contains 'audio/'");
    const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,mimeType,size,thumbnailLink,createdTime,webContentLink,imageMediaMetadata)&pageSize=35`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `Drive API request failed (${res.status})`);
    }
    const data = await res.json();
    return data.files || [];
  } catch (err: any) {
    console.error("Failed to list Drive files:", err);
    throw err;
  }
}

/**
 * Specifically query Google Photos items with full photographic EXIF & camera metadata
 */
export async function fetchGooglePhotosMedia(token: string, pageSize = 35) {
  try {
    // Querying image files with photos scope
    const q = encodeURIComponent("mimeType contains 'image/' and trashed = false");
    const fields = encodeURIComponent("files(id,name,mimeType,size,thumbnailLink,webContentLink,createdTime,modifiedTime,imageMediaMetadata,spaces)");
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${q}&fields=${fields}&pageSize=${pageSize}&orderBy=createdTime desc`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `Google Photos fetch failed (${res.status})`);
    }

    const data = await res.json();
    return data.files || [];
  } catch (err: any) {
    console.error("Failed to fetch Google Photos:", err);
    throw err;
  }
}

export async function uploadMediaToDrive(
  token: string,
  blob: Blob,
  fileName: string,
  mimeType: string,
  targetFolderId?: string
) {
  const metadata: any = {
    name: fileName,
    mimeType,
  };

  if (targetFolderId) {
    metadata.parents = [targetFolderId];
  }

  const form = new FormData();
  form.append(
    "metadata",
    new Blob([JSON.stringify(metadata)], { type: "application/json" })
  );
  form.append("file", blob);

  const res = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,thumbnailLink,size,createdTime,imageMediaMetadata",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: form,
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Failed to upload file to Google Drive (${res.status})`);
  }

  return await res.json();
}

/**
 * Ensure dedicated MediaVision Studio cloud folder exists for organized sync
 */
export async function getOrCreateStudioSyncFolder(token: string): Promise<string> {
  try {
    const q = encodeURIComponent("name = 'MediaVision Studio' and mimeType = 'application/vnd.google-apps.folder' and trashed = false");
    const checkRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const checkData = await checkRes.json();
    if (checkData.files && checkData.files.length > 0) {
      return checkData.files[0].id;
    }

    // Create folder
    const createRes = await fetch("https://www.googleapis.com/drive/v3/files", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "MediaVision Studio",
        mimeType: "application/vnd.google-apps.folder",
      }),
    });
    const newFolder = await createRes.json();
    return newFolder.id;
  } catch (e) {
    console.warn("Could not check/create dedicated studio folder, using root:", e);
    return "";
  }
}
