import { useEffect } from 'react';

interface MediaSessionTrack {
  title: string;
  artist?: string;
  album?: string;
  artwork?: { src: string; sizes: string; type: string }[];
}

interface MediaSessionActions {
  onPlay: () => void;
  onPause: () => void;
  onPrev: () => void;
  onNext: () => void;
}

export function useMediaSession(
  track: MediaSessionTrack | null,
  isPlaying: boolean,
  actions: MediaSessionActions,
  coverUrl?: string,
) {
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;

    if (track) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.title,
        artist: track.artist || 'Unbekannter Künstler',
        album: track.album || '',
        artwork: coverUrl
          ? [{ src: coverUrl, sizes: '512x512', type: 'image/jpeg' }]
          : [],
      });
    }
  }, [track?.title, track?.artist, track?.album, coverUrl]);

  useEffect(() => {
    if (!('mediaSession' in navigator)) return;

    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';

    const handlers: [MediaSessionAction, MediaSessionActionHandler][] = [
      ['play', () => actions.onPlay()],
      ['pause', () => actions.onPause()],
      ['previoustrack', () => actions.onPrev()],
      ['nexttrack', () => actions.onNext()],
    ];

    for (const [action, handler] of handlers) {
      try { navigator.mediaSession.setActionHandler(action, handler); } catch {}
    }

    return () => {
      for (const [action] of handlers) {
        try { navigator.mediaSession.setActionHandler(action, null); } catch {}
      }
    };
  }, [isPlaying, actions.onPlay, actions.onPause, actions.onPrev, actions.onNext]);
}
