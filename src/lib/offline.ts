/**
 * Offline download helpers for StreamSync
 *
 * Downloads audio + cover art to IndexedDB and provides blob URLs
 * for offline playback.
 */

import { apiUrl } from './api';
import { cacheAudioTrack, cacheCover, cacheMetadata, removeCachedTrack, isTrackCached, getCachedAudioTrack, getCachedCover } from './indexedDB';
import type { ApiFile } from '../types';

export interface DownloadProgress {
  status: 'idle' | 'downloading' | 'done' | 'error';
  progress: number; // 0–100
  bytes: number;
  totalBytes: number;
  error?: string;
}

/** Active download progress tracked per fileId */
const activeDownloads = new Map<string, DownloadProgress>();

export function getDownloadProgress(fileId: string): DownloadProgress {
  return activeDownloads.get(fileId) ?? { status: 'idle', progress: 0, bytes: 0, totalBytes: 0 };
}

/**
 * Download a track's audio + cover into IndexedDB.
 * Returns a promise that resolves when done or rejects on error.
 */
export async function downloadTrackForOffline(
  file: ApiFile,
  token: string,
  onProgress?: (p: DownloadProgress) => void,
): Promise<void> {
  const fileId = file.id;

  // Skip if already cached
  if (await isTrackCached(fileId)) {
    const p: DownloadProgress = { status: 'done', progress: 100, bytes: 0, totalBytes: 0 };
    activeDownloads.set(fileId, p);
    onProgress?.(p);
    return;
  }

  const progress: DownloadProgress = { status: 'downloading', progress: 0, bytes: 0, totalBytes: 0 };
  activeDownloads.set(fileId, progress);

  try {
    // 1. Download audio
    const streamUrl = apiUrl(`/api/stream/${fileId}?token=${encodeURIComponent(token)}`);
    const audioResp = await fetch(streamUrl);
    if (!audioResp.ok) throw new Error(`Server error: ${audioResp.status}`);

    const contentLength = audioResp.headers.get('content-length');
    const total = contentLength ? parseInt(contentLength, 10) : 0;
    progress.totalBytes = total;

    // Read as ReadableStream for progress tracking
    if (audioResp.body && total > 0) {
      const reader = audioResp.body.getReader();
      const chunks: Uint8Array[] = [];
      let received = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        received += value.length;
        progress.bytes = received;
        progress.progress = Math.round((received / total) * 100);
        onProgress?.(progress);
      }

      // Combine chunks into single ArrayBuffer
      const buffer = new Uint8Array(received);
      let offset = 0;
      for (const chunk of chunks) {
        buffer.set(chunk, offset);
        offset += chunk.length;
      }
      await cacheAudioTrack(fileId, buffer.buffer);
    } else {
      // Fallback: no streaming body or unknown size
      const buffer = await audioResp.arrayBuffer();
      await cacheAudioTrack(fileId, buffer);
      progress.bytes = buffer.byteLength;
      progress.progress = 100;
      onProgress?.(progress);
    }

    // 2. Save metadata
    await cacheMetadata(fileId, {
      title: file.title,
      artist: file.artist,
      album: file.album,
      duration: file.duration,
      mimeType: file.mimeType,
      size: file.size,
    });

    // 3. Download cover art (if available)
    try {
      if (file.hasArtwork) {
        const coverUrl = apiUrl(`/api/cover/${fileId}?token=${encodeURIComponent(token)}`);
        const coverResp = await fetch(coverUrl);
        if (coverResp.ok) {
          const coverBuf = await coverResp.arrayBuffer();
          await cacheCover(fileId, coverBuf);
        }
      } else if (file.artist && file.album) {
        // Try iTunes cover
        const params = new URLSearchParams({ artist: file.artist, album: file.album, token });
        const coverUrl = apiUrl(`/api/album-cover?${params.toString()}`);
        const coverResp = await fetch(coverUrl);
        if (coverResp.ok) {
          const coverBuf = await coverResp.arrayBuffer();
          await cacheCover(fileId, coverBuf);
        }
      }
    } catch {
      // Cover download failures are non-fatal — track audio is what matters
    }

    progress.status = 'done';
    progress.progress = 100;
    activeDownloads.set(fileId, progress);
    onProgress?.(progress);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    progress.status = 'error';
    progress.error = message;
    activeDownloads.set(fileId, progress);
    onProgress?.(progress);
    throw err;
  }
}

/**
 * Get a blob URL for playing a cached track.
 * Returns null if the track is not cached.
 */
export async function getOfflineStreamUrl(fileId: string): Promise<string | null> {
  const buffer = await getCachedAudioTrack(fileId);
  if (!buffer) return null;
  const blob = new Blob([buffer], { type: 'audio/mpeg' });
  return URL.createObjectURL(blob);
}

/**
 * Get a blob URL for cached cover art.
 * Returns null if not cached.
 */
export async function getOfflineCoverUrl(fileId: string): Promise<string | null> {
  const buffer = await getCachedCover(fileId);
  if (!buffer) return null;
  // Determine mime type from magic bytes
  const arr = new Uint8Array(buffer);
  let mime = 'image/jpeg';
  if (arr[0] === 0x89 && arr[1] === 0x50) mime = 'image/png';
  else if (arr[0] === 0x47 && arr[1] === 0x49) mime = 'image/gif';
  else if (arr[0] === 0x52 && arr[1] === 0x49) mime = 'image/webp';
  else if (arr[0] === 0x3C) mime = 'image/svg+xml';

  const blob = new Blob([buffer], { type: mime });
  return URL.createObjectURL(blob);
}

/**
 * Remove a track from offline cache (audio + cover + metadata).
 */
export async function deleteOfflineTrack(fileId: string): Promise<void> {
  await removeCachedTrack(fileId);
  activeDownloads.delete(fileId);
}

/**
 * Revoke all blob URLs created for a fileId to free memory.
 * Call this when the track is no longer needed (e.g., user navigates away).
 */
export function revokeOfflineUrls(fileId: string): void {
  // Blob URLs are auto-revoked on page unload, but we can be more explicit:
  // We don't track URLs centrally; callers should manage their own URLs.
  // This is a placeholder for future URL tracking if needed.
  void fileId;
}
