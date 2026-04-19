import type { ApiFile } from '../types';

export function formatTime(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '0:00';
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '';
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours} Std. ${mins} Min.`;
  return `${mins} Min.`;
}

export function trackArtist(file: ApiFile): string {
  return file.artist?.trim() || 'Unbekannter Kuenstler';
}

export function trackSubtitle(file: ApiFile): string {
  const artist = file.artist?.trim();
  const album = file.album?.trim();
  if (artist && album) return `${artist} - ${album}`;
  if (artist) return artist;
  if (album) return album;
  return file.kind === 'audio' ? 'Audio' : 'Video';
}

export function greet(): string {
  const h = new Date().getHours();
  if (h < 5) return 'Gute Nacht';
  if (h < 11) return 'Guten Morgen';
  if (h < 17) return 'Guten Tag';
  if (h < 22) return 'Guten Abend';
  return 'Gute Nacht';
}

export function totalLibraryDuration(files: ApiFile[]): number {
  return files.reduce((sum, f) => sum + (f.duration ?? 0), 0);
}

/**
 * Deterministic-ish color from a string (artist/album/playlist id).
 * Used to drive hero gradient background.
 */
export function hueFromString(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = input.charCodeAt(i) + ((hash << 5) - hash);
    hash |= 0;
  }
  const palette = [
    '#3b1878', '#5b21b6', '#7c3aed', '#9333ea', '#a855f7',
    '#6d28d9', '#4c1d95', '#db2777', '#be123c', '#ea580c',
    '#be185d', '#0f766e', '#1d4ed8', '#0891b2',
  ];
  const idx = Math.abs(hash) % palette.length;
  return palette[idx];
}
