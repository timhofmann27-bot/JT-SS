/**
 * Cover image cache + preloader
 *
 * Caches loaded cover images as blob URLs so re-renders are instant.
 * Preloads covers in batches after initial app load.
 */

const BATCH_SIZE = 6;
const MAX_CACHED = 200;

const memoryCache = new Map<string, string>();
const pendingRequests = new Map<string, Promise<string | null>>();
let preloadQueue: string[] = [];
let preloading = false;

/**
 * Fetch a cover and cache it as a blob URL.
 * Returns null if the fetch fails.
 */
async function fetchAndCache(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { cache: 'force-cache' });
    if (!res.ok) return null;
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    // Evict oldest if over limit
    if (memoryCache.size >= MAX_CACHED) {
      const firstKey = memoryCache.keys().next().value;
      if (firstKey) {
        URL.revokeObjectURL(memoryCache.get(firstKey)!);
        memoryCache.delete(firstKey);
      }
    }
    memoryCache.set(url, blobUrl);
    return blobUrl;
  } catch {
    return null;
  }
}

/**
 * Get a cover URL, using the memory cache if available.
 * On first call, loads via fetch + blob URL and caches it.
 */
export function getCoverUrl(url: string): string {
  // Return cached blob URL if available
  const cached = memoryCache.get(url);
  if (cached) return cached;

  // Kick off fetch if not already pending
  if (!pendingRequests.has(url)) {
    const promise = fetchAndCache(url);
    pendingRequests.set(url, promise);
    promise.finally(() => pendingRequests.delete(url));
  }

  // Return original URL while loading
  return url;
}

/**
 * Preload a list of cover URLs in batches.
 * Call this after the initial data load.
 */
export function preloadCovers(urls: string[]): void {
  preloadQueue.push(...urls);

  if (preloading) return;
  preloading = true;

  const processBatch = () => {
    const batch = preloadQueue.splice(0, BATCH_SIZE);
    if (batch.length === 0) {
      preloading = false;
      return;
    }

    Promise.allSettled(
      batch.map(async (url) => {
        if (memoryCache.has(url) || pendingRequests.has(url)) return;
        const promise = fetchAndCache(url);
        pendingRequests.set(url, promise);
        await promise;
      }),
    ).then(() => {
      setTimeout(processBatch, 100);
    });
  };

  processBatch();
}

/**
 * Preload covers for the first N files (visible + just below the fold).
 * Uses the correct API base URL from the app config.
 */
export function preloadVisibleCovers(
  files: { id: string; hasArtwork: boolean }[],
  opts?: { token?: string },
  count: number = 40,
): void {
  try {
    // Dynamic import to get the apiUrl function
    import('./api').then(({ apiUrl }) => {
      const { token = '' } = opts ?? {};
      const urls = files
        .slice(0, count)
        .filter((f) => f.hasArtwork)
        .map((f) => apiUrl(`/api/cover/${f.id}${token ? `?token=${token}` : ''}`));
      preloadCovers(urls);
    });
  } catch {
    // Silently fail if API module isn't available
  }
}

/**
 * Clear all cached cover blobs, freeing memory.
 */
export function clearCoverCache(): void {
  for (const blobUrl of memoryCache.values()) {
    URL.revokeObjectURL(blobUrl);
  }
  memoryCache.clear();
  pendingRequests.clear();
  preloadQueue = [];
  preloading = false;
}
