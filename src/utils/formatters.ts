import type { ApiFile } from '../types';

export { formatTime } from '../lib/format';

export function trackMeta(file: ApiFile): string {
  const artist = file.artist?.trim();
  const album = file.album?.trim();
  const type = file.kind === 'audio' ? 'Audio' : 'Video';
  const duration = file.durationLabel ? `${file.durationLabel} - ` : '';

  if (artist && album) return `${artist} - ${album} - ${duration}${file.sizeLabel}`;
  if (artist) return `${artist} - ${duration}${file.sizeLabel}`;
  return `${type} - ${duration}${file.sizeLabel}`;
}

export function haptic(): void {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try { navigator.vibrate(10); } catch { /* noop */ }
  }
}
