import { useCallback, useEffect, useState } from 'react';
import type { View } from '../types';

interface RouteState {
  view: View;
  albumId: string | null;
  artistId: string | null;
  playlistId: string | null;
}

function parseHash(hash: string): RouteState {
  const clean = hash.replace(/^#\/?/, '') || 'home';
  const parts = clean.split('/').filter(Boolean);

  if (parts[0] === 'album' && parts[1]) {
    return { view: 'album-detail', albumId: decodeURIComponent(parts[1]), artistId: null, playlistId: null };
  }
  if (parts[0] === 'artist' && parts[1]) {
    return { view: 'artist-detail', artistId: decodeURIComponent(parts[1]), albumId: null, playlistId: null };
  }
  if (parts[0] === 'playlist' && parts[1]) {
    return { view: 'playlist-detail', playlistId: decodeURIComponent(parts[1]), albumId: null, artistId: null };
  }

  const viewMap: Record<string, View> = {
    home: 'home',
    search: 'search',
    library: 'library',
    profile: 'profile',
    liked: 'liked',
    login: 'login',
    register: 'register',
  };

  return {
    view: viewMap[parts[0]] || 'home',
    albumId: null,
    artistId: null,
    playlistId: null,
  };
}

function buildHash(route: RouteState): string {
  if (route.view === 'album-detail' && route.albumId) {
    return `#/album/${encodeURIComponent(route.albumId)}`;
  }
  if (route.view === 'artist-detail' && route.artistId) {
    return `#/artist/${encodeURIComponent(route.artistId)}`;
  }
  if (route.view === 'playlist-detail' && route.playlistId) {
    return `#/playlist/${encodeURIComponent(route.playlistId)}`;
  }

  const viewMap: Record<View, string> = {
    home: 'home',
    search: 'search',
    library: 'library',
    liked: 'liked',
    login: 'login',
    register: 'register',
    'album-detail': 'home',
    'artist-detail': 'home',
    'playlist-detail': 'home',
    profile: 'profile',
    queue: 'home',
    albums: 'library',
    artists: 'library',
    playlists: 'library',
    discover: 'home',
    charts: 'home',
    settings: 'home',
    upload: 'home',
    room: 'home',
    share: 'home',
    public: 'home',
    admin: 'home',
    team: 'home',
  };

  return `#/${viewMap[route.view]}`;
}

export function useHashRouter(): RouteState & { navigate: (view: View, params?: { albumId?: string; artistId?: string; playlistId?: string }) => void } {
  const [route, setRoute] = useState<RouteState>(() => parseHash(window.location.hash));

  useEffect(() => {
    const onHashChange = () => setRoute(parseHash(window.location.hash));
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const navigate = useCallback((view: View, params?: { albumId?: string; artistId?: string; playlistId?: string }) => {
    const newRoute: RouteState = {
      view,
      albumId: params?.albumId ?? null,
      artistId: params?.artistId ?? null,
      playlistId: params?.playlistId ?? null,
    };
    window.location.hash = buildHash(newRoute);
  }, []);

  return { ...route, navigate };
}
