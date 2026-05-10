import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function hapticFeedback(pattern: 'light' | 'medium' | 'heavy' | 'success' | 'error' = 'light') {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    const patterns = {
      light: 10,
      medium: 20,
      heavy: 40,
      success: [10, 50, 10],
      error: [40, 50, 40],
    };
    navigator.vibrate(patterns[pattern]);
  }
}

export function triggerHaptic(event: React.MouseEvent | React.TouchEvent, pattern: 'light' | 'medium' | 'heavy' | 'success' | 'error' = 'light') {
  hapticFeedback(pattern);
}

/**
 * Share a track via the native Web Share API.
 * Falls back to copying the URL to clipboard.
 */
export async function shareTrack(title: string, artist?: string, url?: string): Promise<void> {
  const shareData: ShareData = {
    title: `${title}${artist ? ` by ${artist}` : ''}`,
    text: `🎵 ${title}${artist ? ` — ${artist}` : ''}`,
    url: url || window.location.href,
  };

  if (navigator.share && window.matchMedia('(hover: none) and (pointer: coarse)').matches) {
    try { await navigator.share(shareData); return; } catch { /* user cancelled */ }
  }

  // Fallback: copy to clipboard
  try {
    const text = `${shareData.text} — ${shareData.url}`;
    await navigator.clipboard.writeText(text);
    // Toast will be shown by the caller
  } catch { /* clipboard unavailable */ }
}
