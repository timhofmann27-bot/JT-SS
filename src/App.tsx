import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Heart,
  ListMusic,
  Plus,
  Repeat,
  Repeat1,
  Search,
  Shuffle,
  SkipBack,
  SkipForward,
  Upload,
  Volume2,
  VolumeX,
  Pause,
  Play,
  Disc3,
  Home,
  Library,
  PlusSquare,
  ChevronLeft,
  ChevronRight,
  X,
  MoreHorizontal,
  Share2,
  Clock,
  FileMusic,
  User,
  Download,
  HardDriveDownload,
  ChevronUp,
  ArrowUp,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import type { ApiFile, ApiStatus, AuthUser, QueueItem, PlayHistoryEntry, RoomState, UploadState, View, Album, Artist, Playlist, NavTab } from './types';
import { LoginView, RegisterView } from './auth-views';
import { Sidebar, BottomNav } from './components/layout';
import { LikeButton, Section, EmptyState, TrackRow, MediaCard, useContextMenu, ContextMenu, type ContextMenuItem } from './components/ui';
import { FullscreenPlayer, QueueSheet } from './components/player';
import { SkeletonTrackList, SkeletonCardGrid } from './components/Skeleton';
import { usePWA } from './hooks/usePWA';
import { useWakeLock } from './hooks/useWakeLock';
import { useMediaSession } from './hooks/useMediaSession';
import { useHashRouter } from './hooks/useHashRouter';
import { apiUrl, coverUrl } from './lib/api';
import { shareTrack } from './lib/utils';
import { useSearchHistory } from './hooks/useSearchHistory';
import { formatTime, trackSubtitle, trackArtist, hueFromString } from './lib/format';
import { extractDominantColor } from './lib/colorExtract';
import { toast, showToast } from './lib/toast';
import * as playlistApi from './lib/playlists';
import { downloadTrackForOffline, deleteOfflineTrack, getOfflineStreamUrl, getDownloadProgress } from './lib/offline';
import { isTrackCached, getAllCachedTrackIds } from './lib/indexedDB';
import CreatePlaylistDialog from './components/playlist/CreatePlaylistDialog';
import {
  HomeView,
  SearchView,
  LibraryView,
  LikedSongsView,
  AlbumDetailView,
  ArtistDetailView,
  PlaylistDetailView,
  YouTubeView,
  AIStudioView,
} from './views';
import ProfileView from './views/ProfileView';

const TOKEN_STORAGE_KEY = 'jt-mp3.sessionToken';
const PLAYER_STATE_KEY = 'jt-mp3.playerState';

function savePlayerState(fileId: string | null, time: number, playing: boolean, vol: number, shuf: boolean, rep: string) {
  if (!fileId) return;
  try {
    localStorage.setItem(PLAYER_STATE_KEY, JSON.stringify({
      fileId, currentTime: time, isPlaying: playing, volume: vol, shuffle: shuf, repeat: rep, savedAt: Date.now(),
    }));
  } catch { /* quota exceeded */ }
}

function loadPlayerState(): { fileId: string; currentTime: number; isPlaying: boolean; volume: number; shuffle: boolean; repeat: string } | null {
  try {
    const raw = localStorage.getItem(PLAYER_STATE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    // Expire after 24 hours
    if (Date.now() - data.savedAt > 86400000) { localStorage.removeItem(PLAYER_STATE_KEY); return null; }
    return data;
  } catch { return null; }
}

function haptic(pattern: number | number[] = 10) {
  if ('vibrate' in navigator) { try { navigator.vibrate(pattern); } catch { /* silent */ } }
}

export default function App() {
  const { view, albumId, artistId, playlistId, navigate } = useHashRouter();
  const [token, setToken] = useState(() => sessionStorage.getItem(TOKEN_STORAGE_KEY) ?? '');
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<ApiStatus | null>(null);
  const [files, setFiles] = useState<ApiFile[]>([]);
  const [roomState, setRoomState] = useState<RoomState>({ likedIds: [], queue: [], playlists: [], playHistory: [], updatedAt: '' });
  const [currentFile, setCurrentFile] = useState<ApiFile | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);
  const [upload, setUpload] = useState<UploadState>({ active: false, progress: 0, message: '' });
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState<'off' | 'all' | 'one'>('off');
  const [volume, setVolume] = useState(1);
  const [showQueue, setShowQueue] = useState(false);
  const [uploadInputRef] = useState(() => React.createRef<HTMLInputElement>());
  const [libraryFilter, setLibraryFilter] = useState<'playlists' | 'artists' | 'albums' | 'offline'>('playlists');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showCreatePlaylist, setShowCreatePlaylist] = useState(false);
  const [cachedFileIds, setCachedFileIds] = useState<Set<string>>(new Set());
  const [offlineDownload, setOfflineDownload] = useState<{ fileId: string; progress: number; status: string } | null>(null);
  const [batchDownloading, setBatchDownloading] = useState(false);
  const [batchDownloadDone, setBatchDownloadDone] = useState(false);
  const [toasts, setToasts] = useState<{ id: number; message: string; icon?: string }[]>([]);
  const [ambientColor, setAmbientColor] = useState('#181818');
  const { history: searchHistory, addQuery: addSearchQuery, clearHistory: clearSearchHistory } = useSearchHistory();
  let toastId = useRef(0);

  // Extract dominant color from current cover
  useEffect(() => {
    if (!currentFile) { setAmbientColor('#181818'); return; }
    const url = coverUrl(currentFile, { token, artist: currentFile?.artist, album: currentFile?.album });
    extractDominantColor(url).then(setAmbientColor);
  }, [currentFile?.id, token]);

  const showToast = useCallback((message: string, icon?: string) => {
    const id = ++toastId.current;
    setToasts(prev => [...prev, { id, message, icon }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
  }, []);
  const audioRef = useRef<HTMLAudioElement>(null);
  const mainScrollRef = useRef<HTMLDivElement>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  // Ref to hold the restore position from saved state (avoids race with useEffect src load)
  const restoreTimeRef = useRef<number | null>(null);
  const restorePlayRef = useRef<boolean>(false);

  // Track scroll position for scroll-to-top button
  useEffect(() => {
    const el = mainScrollRef.current;
    if (!el) return;
    const handler = () => setShowScrollTop(el.scrollTop > 400);
    el.addEventListener('scroll', handler, { passive: true });
    return () => el.removeEventListener('scroll', handler);
  }, []);

  // ── Derived data (case-insensitive grouping) ──
  const albums = useMemo(() => {
    const albumMap = new Map<string, Album>();
    const seen = new Set<string>();
    files.forEach((file) => {
      const albumName = (file.album || 'Unknown').trim();
      const key = albumName.toLowerCase();
      if (seen.has(key)) {
        // Add track to existing album (matched case-insensitively)
        for (const [k, v] of albumMap) {
          if (k.toLowerCase() === key) { v.tracks.push(file); v.trackCount = v.tracks.length; break; }
        }
      } else {
        seen.add(key);
        albumMap.set(albumName, { id: albumName.toLowerCase().replace(/\s+/g, '-'), name: albumName, artist: file.artist, tracks: [file], trackCount: 1 });
      }
    });
    return Array.from(albumMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [files]);

  const artists = useMemo(() => {
    const artistMap = new Map<string, Artist>();
    files.forEach((file) => {
      const artistName = (file.artist || 'Unknown').trim();
      const key = artistName.toLowerCase();
      const existing = Array.from(artistMap.entries()).find(([k]) => k.toLowerCase() === key);
      if (existing) {
        const [, artist] = existing;
        artist.topTracks.push(file);
        // Add album if new
        const albumKey = (file.album || 'Unknown').toLowerCase().trim();
        if (!artist.albums.some(a => a.name.toLowerCase() === albumKey)) {
          artist.albums.push({ id: (file.album || 'Unknown').toLowerCase().replace(/\s+/g, '-'), name: file.album || 'Unknown', artist: artistName, tracks: [file], trackCount: 1 });
        }
      } else {
        artistMap.set(artistName, {
          id: artistName.toLowerCase().replace(/\s+/g, '-'),
          name: artistName,
          albums: [{ id: (file.album || 'Unknown').toLowerCase().replace(/\s+/g, '-'), name: file.album || 'Unknown', artist: artistName, tracks: [file], trackCount: 1 }],
          topTracks: [file],
        });
      }
    });
    return Array.from(artistMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [files]);

  const selectedAlbum = useMemo(() => {
    if (!albumId) return null;
    return albums.find((a) => a.id === albumId) ?? null;
  }, [albumId, albums]);

  const selectedArtist = useMemo(() => {
    if (!artistId) return null;
    return artists.find((a) => a.id === artistId) ?? null;
  }, [artistId, artists]);

  const selectedPlaylist = useMemo(() => {
    if (!playlistId) return null;
    return (roomState.playlists || []).find((p) => p.id === playlistId) ?? null;
  }, [playlistId, roomState.playlists]);

  const changeView = useCallback((nextView: View) => { haptic(); navigate(nextView); }, [navigate]);

  const { isOffline } = usePWA();
  const { isSupported: wakeLockSupported, isActive: wakeLockActive, request: requestWakeLock, release: releaseWakeLock } = useWakeLock();

  const { open: openContextMenu, close: closeContextMenu, menu: ContextMenuComponent } = useContextMenu();

  useEffect(() => {
    if (isPlaying && wakeLockSupported) void requestWakeLock();
    else if (!isPlaying && wakeLockActive) void releaseWakeLock();
    return () => { if (wakeLockActive) void releaseWakeLock(); };
  }, [isPlaying, wakeLockSupported, wakeLockActive, requestWakeLock, releaseWakeLock]);

  const isAuthenticated = token.length > 0;
  const authHeaders = useMemo(() => ({ 'x-share-token': token }), [token]);
  const progress = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;
  const likedIds = useMemo(() => new Set(roomState.likedIds), [roomState.likedIds]);
  const likedFiles = useMemo(() => files.filter((f) => likedIds.has(f.id)), [files, likedIds]);

  const filteredFiles = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return files;
    return files.filter((file) =>
      file.title.toLowerCase().includes(needle) ||
      file.artist?.toLowerCase().includes(needle) ||
      file.album?.toLowerCase().includes(needle)
    );
  }, [files, query]);

  const sidebarPlaylists = useMemo(() => {
    return (roomState.playlists || []).map((p) => ({ id: p.id, name: p.name }));
  }, [roomState.playlists]);

  const recentlyPlayed = useMemo(() => {
    if (!roomState.playHistory?.length) return files.slice(0, 4);
    const fileMap = new Map(files.map((f) => [f.id, f]));
    const seen = new Set<string>();
    const result: ApiFile[] = [];
    for (const entry of roomState.playHistory) {
      const file = fileMap.get(entry.fileId);
      if (file && !seen.has(file.id)) {
        seen.add(file.id);
        result.push(file);
        if (result.length >= 4) break;
      }
    }
    return result;
  }, [files, roomState.playHistory]);

  // Current play context - which tracks to shuffle/skip within
  const playContext = useMemo(() => {
    if (view === 'liked') return likedFiles;
    if (view === 'album-detail' && selectedAlbum) return selectedAlbum.tracks;
    if (view === 'artist-detail' && selectedArtist) return selectedArtist.topTracks;
    if (view === 'playlist-detail' && selectedPlaylist) {
      const fileMap = new Map(files.map((f) => [f.id, f]));
      return selectedPlaylist.trackIds.map((id) => fileMap.get(id)).filter(Boolean) as ApiFile[];
    }
    if (view === 'search' && query.trim()) return filteredFiles;
    return files;
  }, [view, files, likedFiles, filteredFiles, selectedAlbum, selectedArtist, selectedPlaylist, query]);

  async function loadStatus() {
    try {
      const response = await fetch(apiUrl('/api/status'), { headers: { 'x-share-token': token } });
      if (!response.ok) throw new Error();
      setStatus(await response.json());
    } catch { /* silent */ }
  }

  async function loadFiles() {
    try {
      const response = await fetch(apiUrl('/api/files'), { headers: { 'x-share-token': token } });
      if (!response.ok) throw new Error();
      const data = await response.json();
      setFiles(data.files);
      // Preload cover images in background (batches of 6)
      import('./lib/coverCache').then(({ preloadVisibleCovers }) => {
        setTimeout(() => preloadVisibleCovers(data.files, { token }), 500);
      });
      // Restore last playing state
      if (!currentFile) {
        const saved = loadPlayerState();
        if (saved && data.files.length > 0) {
          const savedFile = data.files.find((f: ApiFile) => f.id === saved.fileId);
          if (savedFile) {
            // Store restore intent in refs — the audio src useEffect will apply them
            restoreTimeRef.current = saved.currentTime || 0;
            restorePlayRef.current = saved.isPlaying;
            setCurrentFile(savedFile);
            setVolume(saved.volume ?? 1);
            setShuffle(saved.shuffle ?? false);
            setRepeat((saved.repeat as 'off' | 'all' | 'one') ?? 'off');
            return;
          }
        }
        if (data.files.length > 0) setCurrentFile(data.files[0]);
      }
    } catch { /* silent */ }
  }

  async function loadUser() {
    try {
      const response = await fetch(apiUrl('/api/auth/me'), { headers: { 'x-auth-token': token } });
      if (response.ok) setCurrentUser(await response.json());
    } catch { /* silent */ }
  }

  async function loadRoomState() {
    try {
      const response = await fetch(apiUrl('/api/state'), { headers: { 'x-share-token': token } });
      if (!response.ok) throw new Error();
      setRoomState(await response.json());
    } catch { /* silent */ }
  }

  useEffect(() => {
    if (!isAuthenticated) return;
    Promise.all([loadStatus(), loadFiles(), loadRoomState(), loadUser()]).catch(() => {});
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    let backoff = 1000;
    let timeout: ReturnType<typeof setTimeout> | null = null;
    let es: EventSource | null = null;

    function connect() {
      es = new EventSource(apiUrl(`/api/events?token=${encodeURIComponent(token)}`));
      es.addEventListener('state', (event) => {
        try { setRoomState(JSON.parse((event as MessageEvent).data)); } catch { /* silent */ }
        // Reset backoff on successful connection
        backoff = 1000;
      });
      es.onerror = () => {
        es?.close();
        timeout = setTimeout(() => {
          backoff = Math.min(backoff * 2, 30000);
          connect();
        }, backoff);
      };
    }

    connect();
    return () => {
      es?.close();
      if (timeout) clearTimeout(timeout);
    };
  }, [isAuthenticated, token]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentFile) return;

    const fileId = currentFile.id;
    const savedTime = restoreTimeRef.current;
    const savedPlay = restorePlayRef.current;
    // Clear restore refs immediately to avoid double-apply
    restoreTimeRef.current = null;
    restorePlayRef.current = false;

    // Try offline cache first, fall back to streaming
    getOfflineStreamUrl(fileId).then((blobUrl) => {
      // Guard against race: if file changed while fetching, skip
      if (audio !== audioRef.current || !currentFile || currentFile.id !== fileId) return;

      if (blobUrl) {
        audio.src = blobUrl;
      } else {
        audio.src = apiUrl(`/api/stream/${fileId}?token=${encodeURIComponent(token)}`);
      }
      audio.load();

      // If we have a saved restore position, apply it; otherwise start from 0
      if (savedTime !== null && savedTime > 0) {
        // Wait for 'loadedmetadata' so duration is available, then seek
        const onMeta = () => {
          audio.removeEventListener('loadedmetadata', onMeta);
          if (audio !== audioRef.current) return;
          audio.currentTime = savedTime;
          setCurrentTime(savedTime);
          if (savedPlay) {
            audio.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
          } else {
            setIsPlaying(false);
          }
        };
        audio.addEventListener('loadedmetadata', onMeta);
        // Safety timeout: if metadata already loaded, trigger immediately
        if (audio.readyState >= 1) onMeta();
      } else {
        setCurrentTime(0); setDuration(0);
        if (isPlaying) void audio.play().catch(() => setIsPlaying(false));
      }
    });

    // Track play history
    fetch(apiUrl('/api/play-history'), {
      method: 'POST', headers: { ...authHeaders, 'content-type': 'application/json' },
      body: JSON.stringify({ fileId: currentFile.id }),
    }).catch(() => {});
  }, [currentFile, token]);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) audio.volume = volume;
  }, [volume]);

  // Persist player state to localStorage (throttled every 5s)
  useEffect(() => {
    const id = setInterval(() => {
      if (!audioRef.current?.src) return;
      savePlayerState(
        currentFile?.id ?? null,
        audioRef.current.currentTime,
        isPlaying, volume, shuffle, repeat,
      );
    }, 5000);
    return () => clearInterval(id);
  }, []);

  // Save on significant state changes (track change, play/pause, shuffle, repeat, volume)
  useEffect(() => {
    if (!currentFile) return;
    savePlayerState(currentFile.id, currentTime, isPlaying, volume, shuffle, repeat);
  }, [currentFile?.id, isPlaying, shuffle, repeat]);

  // Load cached offline track IDs on mount
  useEffect(() => {
    getAllCachedTrackIds().then((ids) => setCachedFileIds(new Set(ids)));
  }, []);

  async function handleAuthLogin(username: string, password: string) {
    setError('');
    try {
      const res = await fetch(apiUrl('/api/auth/login'), {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'login failed');
      sessionStorage.setItem(TOKEN_STORAGE_KEY, data.token);
      setToken(data.token);
      await loadFiles();
      await loadRoomState();
      haptic(); navigate('home');
    } catch (e) { setError(e instanceof Error ? e.message : 'Anmeldung fehlgeschlagen'); }
  }

  async function handleAuthRegister(username: string, password: string, inviteCode: string) {
    setError('');
    try {
      const res = await fetch(apiUrl('/api/auth/register'), {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username, password, inviteCode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'registration failed');
      sessionStorage.setItem(TOKEN_STORAGE_KEY, data.token);
      setToken(data.token);
      await loadFiles();
      haptic(); navigate('home');
    } catch (e) { setError(e instanceof Error ? e.message : 'Registrierung fehlgeschlagen'); }
  }

  function logout() {
    haptic(); setToken(''); setCurrentUser(null); setFiles([]); setRoomState({ likedIds: [], queue: [], playlists: [], playHistory: [], updatedAt: '' });
    setCurrentFile(null); setIsPlaying(false);
    sessionStorage.removeItem(TOKEN_STORAGE_KEY);
  }

  const playFile = useCallback((file: ApiFile) => {
    haptic(); setCurrentFile(file); setIsPlaying(true); setIsPlayerOpen(true);
  }, []);

  const togglePlay = useCallback(() => {
    if (!currentFile) return;
    haptic();
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    }
  }, [currentFile, isPlaying]);

  const skip = useCallback((offset: number) => {
    if (playContext.length === 0 || !currentFile) return;
    haptic();
    let nextIndex: number;
    if (shuffle) {
      do { nextIndex = Math.floor(Math.random() * playContext.length); }
      while (playContext.length > 1 && nextIndex === playContext.findIndex((f) => f.id === currentFile.id));
    } else {
      const index = playContext.findIndex((file) => file.id === currentFile.id);
      nextIndex = (index + offset + playContext.length) % playContext.length;
    }
    setCurrentFile(playContext[nextIndex]); setIsPlaying(true);
  }, [playContext, currentFile, shuffle]);

  const toggleShuffle = useCallback(() => { haptic(); setShuffle((prev) => !prev); }, []);
  const toggleRepeat = useCallback(() => {
    haptic();
    setRepeat((prev) => { if (prev === 'off') return 'all'; if (prev === 'all') return 'one'; return 'off'; });
  }, []);

  // Media Session API: lock screen / notification controls
  useMediaSession(
    currentFile ? { title: currentFile.title, artist: currentFile.artist, album: currentFile.album } : null,
    isPlaying,
    {
      onPlay: () => { if (!isPlaying) togglePlay(); },
      onPause: togglePlay,
      onPrev: () => skip(-1),
      onNext: () => skip(1),
      onSeekBackward: () => { if (audioRef.current) { audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - 10); } },
      onSeekForward: () => { if (audioRef.current) { audioRef.current.currentTime = Math.min(audioRef.current.duration || 0, audioRef.current.currentTime + 10); } },
    },
    currentFile?.hasArtwork ? apiUrl(`/api/cover/${currentFile.id}?token=${encodeURIComponent(token)}`) : undefined,
  );

  async function uploadFiles(fileList: FileList | File[]) {
    const selected = Array.from(fileList).filter((file) => file.type.startsWith('audio/') || file.type.startsWith('video/'));
    if (selected.length === 0) { setUpload({ active: false, progress: 0, message: 'Bitte Audio- oder Videodateien auswaehlen.' }); return; }
    setUpload({ active: true, progress: 0, message: 'Upload startet...' });
    const totalBytes = selected.reduce((sum, f) => sum + f.size, 0);
    let uploadedBytes = 0;
    try {
      for (let index = 0; index < selected.length; index += 1) {
        const file = selected[index];
        const fileStartBytes = uploadedBytes;
        setUpload({ active: true, progress: 0, message: `${file.name} wird uebertragen...` });
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
              const fileProgress = e.loaded / e.total;
              const overall = Math.round(((fileStartBytes + e.loaded) / totalBytes) * 100);
              setUpload({ active: true, progress: overall, message: `${file.name} (${Math.round(fileProgress * 100)}%)` });
            }
          });
          xhr.addEventListener('load', () => {
            uploadedBytes += file.size;
            if (xhr.status >= 200 && xhr.status < 300) resolve();
            else {
              try { reject(new Error(JSON.parse(xhr.responseText).error || `${file.name} fehlgeschlagen.`)); }
              catch { reject(new Error(`${file.name} fehlgeschlagen (Status ${xhr.status}).`)); }
            }
          });
          xhr.addEventListener('error', () => reject(new Error(`Netzwerkfehler bei ${file.name}.`)));
          xhr.addEventListener('abort', () => reject(new Error('Upload abgebrochen.')));
          xhr.open('POST', apiUrl(`/api/upload?name=${encodeURIComponent(file.name)}`));
          for (const [key, value] of Object.entries(authHeaders)) xhr.setRequestHeader(key, value);
          xhr.setRequestHeader('content-type', file.type || 'application/octet-stream');
          xhr.send(file);
        });
      }
      await loadFiles(); haptic(); setUpload({ active: false, progress: 100, message: 'Bibliothek aktualisiert.' });
    } catch (e) { setUpload({ active: false, progress: 0, message: e instanceof Error ? e.message : 'Upload fehlgeschlagen.' }); }
  }

  const toggleLike = useCallback(async (file: ApiFile) => {
    haptic();
    const wasLiked = likedIds.has(file.id);
    const response = await fetch(apiUrl(`/api/likes/${file.id}`), {
      method: 'POST', headers: { ...authHeaders, 'content-type': 'application/json' },
      body: JSON.stringify({ liked: !wasLiked }),
    });
    if (response.ok) {
      setRoomState(await response.json());
      if (wasLiked) toast.unliked(file.title);
      else toast.liked(file.title);
    }
  }, [authHeaders, likedIds]);

  const deleteFile = useCallback(async (file: ApiFile) => {
    if (!confirm(`${file.title} wirklich loeschen?`)) return;
    haptic();
    const response = await fetch(apiUrl(`/api/files/${file.id}`), { method: 'DELETE', headers: authHeaders });
    if (response.ok) {
      const data = await response.json();
      setRoomState(data.state);
      setFiles((prev) => prev.filter((f) => f.id !== file.id));
      if (currentFile?.id === file.id) { setCurrentFile(null); setIsPlaying(false); }
    }
  }, [authHeaders, currentFile]);

  const deleteAlbum = useCallback(async (album: Album) => {
    if (!confirm(`Album "${album.name}" mit ${album.trackCount} Titeln wirklich loeschen?`)) return;
    haptic();
    const errors: string[] = [];
    await Promise.all(album.tracks.map(async (track) => {
      try {
        const r = await fetch(apiUrl(`/api/files/${track.id}`), { method: 'DELETE', headers: authHeaders });
        if (!r.ok) errors.push(track.title);
      } catch { errors.push(track.title); }
    }));
    if (errors.length) console.warn(`Could not delete: ${errors.join(', ')}`);
    const res = await fetch(apiUrl('/api/files'), { headers: authHeaders });
    if (res.ok) {
      const files = await res.json();
      setFiles(files);
      if (currentFile && album.tracks.some(t => t.id === currentFile.id)) {
        setCurrentFile(null);
        setIsPlaying(false);
      }
    }
  }, [authHeaders, currentFile]);

  async function playNextFromQueue() {
    const next = roomState.queue[0];
    if (!next) {
      if (repeat === 'one') { setCurrentFile(currentFile); setIsPlaying(true); return; }
      if (playContext.length === 0) return;
      skip(1); return;
    }
    await removeFromQueue(next.id, false);
    playFile(next.file);
  }

  function seek(value: number) {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const newTime = (value / 100) * duration;
    audio.currentTime = newTime;
    // Update UI immediately — don't wait for onTimeUpdate (avoids seek-bar flicker)
    setCurrentTime(newTime);
  }

  async function removeFromQueue(itemId: string, updateUi = true) {
    const response = await fetch(apiUrl(`/api/queue/${itemId}`), { method: 'DELETE', headers: authHeaders });
    if (response.ok && updateUi) setRoomState(await response.json());
  }

  async function clearQueue() {
    haptic();
    const response = await fetch(apiUrl('/api/queue/clear'), { method: 'POST', headers: authHeaders });
    if (response.ok) setRoomState(await response.json());
  }

  const openUpload = useCallback(() => { uploadInputRef.current?.click(); }, []);

  const playAlbum = useCallback((album: Album) => {
    if (album.tracks[0]) playFile(album.tracks[0]);
  }, [playFile]);

  const addToQueue = useCallback(async (file: ApiFile) => {
    haptic();
    const response = await fetch(apiUrl('/api/queue'), {
      method: 'POST', headers: { ...authHeaders, 'content-type': 'application/json' },
      body: JSON.stringify({ fileId: file.id }),
    });
    if (response.ok) {
      setRoomState(await response.json());
      toast.addedToQueue(file.title);
    }
  }, [authHeaders]);

  // ── Offline download handlers ──
  const handleDownloadOffline = useCallback(async (file: ApiFile) => {
    try {
      setOfflineDownload({ fileId: file.id, progress: 0, status: 'downloading' });
      await downloadTrackForOffline(file, token, (p) => {
        setOfflineDownload({ fileId: file.id, progress: p.progress, status: p.status });
      });
      setCachedFileIds((prev) => new Set(prev).add(file.id));
      showToast(`"${file.title}" offline gespeichert`, 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Fehler beim Download';
      showToast(msg, 'error');
      setOfflineDownload({ fileId: file.id, progress: 0, status: 'error' });
    }
  }, [token]);

  const handleDeleteOffline = useCallback(async (file: ApiFile) => {
    await deleteOfflineTrack(file.id);
    setCachedFileIds((prev) => {
      const next = new Set(prev);
      next.delete(file.id);
      return next;
    });
    showToast(`"${file.title}" aus Offline-Speicher entfernt`);
  }, []);

  // ── Batch download all liked songs ──
  const handleDownloadAllLiked = useCallback(async () => {
    const toDownload = likedFiles.filter((f) => !cachedFileIds.has(f.id));
    if (toDownload.length === 0) {
      showToast('Alle Lieblingstitel sind bereits offline verfügbar');
      setBatchDownloadDone(true);
      setTimeout(() => setBatchDownloadDone(false), 3000);
      return;
    }

    setBatchDownloading(true);
    setBatchDownloadDone(false);
    let succeeded = 0;
    let failed = 0;

    for (let i = 0; i < toDownload.length; i++) {
      const file = toDownload[i];
      try {
        setOfflineDownload({ fileId: file.id, progress: 0, status: 'downloading' });
        await downloadTrackForOffline(file, token, (p) => {
          setOfflineDownload({ fileId: file.id, progress: p.progress, status: p.status });
        });
        setCachedFileIds((prev) => new Set(prev).add(file.id));
        succeeded++;
      } catch {
        failed++;
      }
    }

    setOfflineDownload(null);
    setBatchDownloading(false);
    setBatchDownloadDone(true);
    if (failed === 0) {
      showToast(`${succeeded} Titel offline gespeichert`, 'success');
    } else {
      showToast(`${succeeded} gespeichert, ${failed} fehlgeschlagen`, 'error');
    }
    setTimeout(() => setBatchDownloadDone(false), 5000);
  }, [likedFiles, cachedFileIds, token]);

  // ── Playlist handlers ──
  const handleCreatePlaylist = useCallback(async (name: string, description: string) => {
    await playlistApi.createPlaylist(name, description, authHeaders);
    await loadRoomState();
    showToast(`Playlist "${name}" erstellt`, 'success');
  }, [authHeaders, loadRoomState]);

  const handleAddToPlaylist = useCallback(async (playlistId: string, fileId: string) => {
    haptic();
    try {
      await playlistApi.addTrackToPlaylist(playlistId, fileId, authHeaders);
      await loadRoomState();
      showToast('Zur Playlist hinzugefügt', 'success');
    } catch { showToast('Fehler beim Hinzufügen', 'error'); }
  }, [authHeaders, loadRoomState]);

  const handleRemoveFromPlaylist = useCallback(async (playlistId: string, fileId: string) => {
    haptic();
    try {
      await playlistApi.removeTrackFromPlaylist(playlistId, fileId, authHeaders);
      await loadRoomState();
      showToast('Aus Playlist entfernt', 'info');
    } catch { showToast('Fehler beim Entfernen', 'error'); }
  }, [authHeaders, loadRoomState]);

  const handleDeletePlaylist = useCallback(async (playlistId: string) => {
    try {
      await playlistApi.deletePlaylist(playlistId, authHeaders);
      await loadRoomState();
      showToast('Playlist gelöscht', 'info');
    } catch { showToast('Fehler beim Löschen', 'error'); }
  }, [authHeaders, loadRoomState]);

  const handleRenamePlaylist = useCallback(async (playlistId: string, name: string) => {
    try {
      await playlistApi.renamePlaylist(playlistId, { name }, authHeaders);
      await loadRoomState();
    } catch { showToast('Fehler beim Umbenennen', 'error'); }
  }, [authHeaders, loadRoomState]);

  const handlePlaylistSelect = useCallback((id: string) => {
    navigate('playlist-detail', { playlistId: id });
    setSidebarOpen(false);
  }, [navigate]);

  const handleLikedSongs = useCallback(() => { navigate('liked'); setSidebarOpen(false); }, [navigate]);

  const handleTabChange = useCallback((tab: string) => { navigate(tab as View); setSidebarOpen(false); }, [navigate]);

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      const key = e.key.toLowerCase();
      switch (key) {
        case ' ':
          e.preventDefault();
          if (currentFile) togglePlay();
          break;
        case 'arrowright':
          if (e.shiftKey) skip(1);
          break;
        case 'arrowleft':
          if (e.shiftKey) skip(-1);
          break;
        case 's':
          if (e.shiftKey) toggleShuffle();
          break;
        case 'r':
          if (e.shiftKey) toggleRepeat();
          break;
        case 'm':
          if (e.shiftKey) {
            const v = volume > 0 ? 0 : 0.5;
            if (audioRef.current) audioRef.current.volume = v;
            setVolume(v);
          }
          break;
        case 'q':
          if (e.shiftKey) setShowQueue((prev) => !prev);
          break;
        case 'l':
          if (e.shiftKey && currentFile) toggleLike(currentFile);
          break;
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentFile, volume, togglePlay, skip, toggleShuffle, toggleRepeat, toggleLike]);

  const showLogin = view === 'login' || view === 'register';

  if (!isAuthenticated || showLogin) {
    if (view === 'register') {
      return <RegisterView onRegister={handleAuthRegister} error={error} onSwitchToLogin={() => navigate('login')} />;
    }
    return <LoginView onLogin={handleAuthLogin} error={error} onSwitchToRegister={() => navigate('register')} />;
  }

  return (
    <>
      <div className="app-layout">
        {/* Mobile sidebar overlay */}
        {sidebarOpen && (
          <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />
        )}

        <div className={`sidebar-responsive ${sidebarOpen ? 'is-open' : ''}`}>
          <Sidebar
            activeTab={view as NavTab}
            onTabChange={handleTabChange}
            onUpload={openUpload}
            playlists={sidebarPlaylists}
            onPlaylistSelect={handlePlaylistSelect}
            likedCount={likedIds.size}
            onLikedSongs={handleLikedSongs}
            onCreatePlaylist={() => setShowCreatePlaylist(true)}
          />
        </div>

        <div className="main-content">
          <audio
            ref={audioRef}
            onEnded={() => void playNextFromQueue()}
            onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
            onDurationChange={(e) => setDuration(e.currentTarget.duration)}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onError={() => { setIsPlaying(false); console.warn('Audio playback error for', currentFile?.title); }}
          />

          <div ref={mainScrollRef} className="main-scroll">
            <div className="main-top-bar">
              <div className="main-top-bar-nav">
                <button className="top-bar-nav-btn mobile-menu-btn" aria-label="Menu" onClick={() => setSidebarOpen(true)}>
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 12h18M3 6h18M3 18h18" />
                  </svg>
                </button>
                <button className="top-bar-nav-btn" aria-label="Zurueck" onClick={() => window.history.back()}>
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button className="top-bar-nav-btn" aria-label="Vorwaerts" disabled>
                  <ChevronRight className="h-5 w-5" />
                </button>
                <span className="top-bar-title-text retro-glow">JT-MP3</span>
              </div>

              {(view === 'home' || view === 'search') && (
                <div className="main-top-bar-search">
                  <Search className="search-icon" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && query.trim().length > 1) addSearchQuery(query); }}
                    className="main-search-input"
                    placeholder="Was moechtest du hoeren?"
                  />
                </div>
              )}
            </div>

            <Suspense fallback={<SkeletonTrackList count={8} />}>
              {view === 'home' && (
                <HomeView
                  token={token} files={files} filteredFiles={filteredFiles}
                  currentFile={currentFile} isPlaying={isPlaying} likedIds={likedIds}
                  onPlay={playFile} onLike={toggleLike} onOpenUpload={openUpload}
                  likedFiles={likedFiles} albums={albums} onAlbumSelect={(a) => { navigate("album-detail", { albumId: a.id }); }}
                  onArtistSelect={(a) => { navigate("artist-detail", { artistId: a.id }); }} onPlayAlbum={playAlbum}
                  onAddToQueue={addToQueue} onDelete={deleteFile}
                  playlists={roomState.playlists || []}
                  onAddToPlaylist={(playlistId, file) => handleAddToPlaylist(playlistId, file.id)}
                  onCreatePlaylist={() => setShowCreatePlaylist(true)}
                  cachedFileIds={cachedFileIds}
                />
              )}

              {view === 'search' && (
                <SearchView
                  token={token} files={filteredFiles} query={query}
                  currentFile={currentFile} isPlaying={isPlaying} likedIds={likedIds}
                  onPlay={playFile} onLike={toggleLike} onDelete={deleteFile} onAddToQueue={addToQueue}
                  albums={albums} artists={artists} onAlbumSelect={(a) => { navigate('album-detail', { albumId: a.id }); }}
                  onArtistSelect={(a) => { navigate('artist-detail', { artistId: a.id }); }}
                  cachedFileIds={cachedFileIds}
                  searchHistory={searchHistory}
                  onSearch={addSearchQuery}
                  onClearSearchHistory={clearSearchHistory}
                />
              )}

              {view === 'library' && (
                <LibraryView
                  token={token} files={files} currentFile={currentFile} isPlaying={isPlaying} likedIds={likedIds}
                  onPlay={playFile} onLike={toggleLike} onOpenUpload={openUpload}
                  albums={albums} artists={artists} playlists={roomState.playlists || []}
                  filter={libraryFilter} setFilter={setLibraryFilter}
                  onAlbumSelect={(a) => { navigate('album-detail', { albumId: a.id }); }}
                  onArtistSelect={(a) => { navigate('artist-detail', { artistId: a.id }); }}
                  onPlaylistSelect={(p) => { navigate('playlist-detail', { playlistId: p.id }); }}
                  onDelete={deleteFile}
                  onCreatePlaylist={() => setShowCreatePlaylist(true)}
                  cachedFileIds={cachedFileIds}
                />
              )}

              {view === 'liked' && (
                <LikedSongsView
                  token={token} likedFiles={likedFiles} currentFile={currentFile} isPlaying={isPlaying} likedIds={likedIds}
                  onPlay={playFile} onLike={toggleLike} onDelete={deleteFile} onAddToQueue={addToQueue}
                  cachedFileIds={cachedFileIds}
                  onDownloadAllOffline={handleDownloadAllLiked}
                  batchDownloading={batchDownloading}
                  batchDownloadDone={batchDownloadDone}
                />
              )}

              {view === 'album-detail' && selectedAlbum && (
                <AlbumDetailView
                  token={token} album={selectedAlbum} currentFile={currentFile} isPlaying={isPlaying} likedIds={likedIds}
                  onPlay={playFile} onLike={toggleLike} onBack={() => navigate('library')}
                  onDelete={deleteFile} onDeleteAlbum={deleteAlbum} onAddToQueue={addToQueue}
                  cachedFileIds={cachedFileIds}
                />
              )}

              {view === 'artist-detail' && selectedArtist && (
                <ArtistDetailView
                  token={token} artist={selectedArtist} currentFile={currentFile} isPlaying={isPlaying} likedIds={likedIds}
                  onPlay={playFile} onLike={toggleLike} onBack={() => navigate('library')}
                  onDelete={deleteFile} onAddToQueue={addToQueue}
                  cachedFileIds={cachedFileIds}
                />
              )}

              {view === 'playlist-detail' && selectedPlaylist && (
                <PlaylistDetailView
                  token={token} playlist={selectedPlaylist} files={files} currentFile={currentFile} isPlaying={isPlaying}
                  likedIds={likedIds}
                  onPlay={playFile} onLike={toggleLike} onBack={() => navigate('library')}
                  onDelete={deleteFile} onAddToQueue={addToQueue}
                  onRemoveTrack={handleRemoveFromPlaylist}
                  onDeletePlaylist={handleDeletePlaylist}
                  onRenamePlaylist={handleRenamePlaylist}
                  cachedFileIds={cachedFileIds}
                />
              )}

              {view === 'profile' && (
                <ProfileView
                  user={currentUser}
                  token={token}
                  likedCount={likedIds.size}
                  onLikedSongs={handleLikedSongs}
                  onLogout={logout}
                />
              )}

              {view === 'youtube' && (
                <YouTubeView token={token} />
              )}

              {view === 'aistudio' && (
                <AIStudioView token={token} />
              )}
            </Suspense>
          </div>

          <div className="player-bar" style={{ '--player-ambient': ambientColor } as React.CSSProperties}>
            {/* Mini progress bar at top */}
            {currentFile && (
              <div className="player-bar-progress" style={{ width: `${progress}%` }} />
            )}
            <div
              className="player-track-info"
              onClick={() => currentFile && setIsPlayerOpen(true)}
              style={{ cursor: currentFile ? 'pointer' : 'default' }}
            >
              {currentFile && (
                <>
                  <img src={coverUrl(currentFile, { token, artist: currentFile?.artist, album: currentFile?.album })} alt="" className={`player-track-cover ${isPlaying ? 'is-playing' : ''}`} />
                  <div className="player-track-text">
                    <p className="player-track-title">{currentFile.title}</p>
                    <p className="player-track-artist">{trackArtist(currentFile)}</p>
                  </div>
                  <LikeButton liked={likedIds.has(currentFile.id)} onToggle={() => toggleLike(currentFile)} size={22} />
                  <button
                    onClick={() => shareTrack(currentFile.title, trackArtist(currentFile))}
                    className="player-btn-icon"
                    aria-label="Teilen"
                    title="Teilen"
                  >
                    <Share2 className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => {
                      const url = apiUrl(`/api/stream/${currentFile.id}?token=${encodeURIComponent(token)}`);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `${currentFile.title}.mp3`;
                      a.click();
                    }}
                    className="player-btn-icon"
                    aria-label="Download"
                    title="Download"
                  >
                    <Download className="h-5 w-5" />
                  </button>
                </>
              )}
            </div>

            <div className="player-controls">
              <div className="player-buttons-row">
                <button onClick={toggleShuffle} className={`player-btn-icon ${shuffle ? 'is-active' : ''}`} aria-label="Zufallswiedergabe" disabled={!currentFile}><Shuffle className="h-4 w-4" /></button>
                <button onClick={() => skip(-1)} className="player-btn-icon" aria-label="Zurueck" disabled={!currentFile}><SkipBack className="h-5 w-5" /></button>
                <button onClick={togglePlay} className="player-btn-play" aria-label={isPlaying ? 'Pause' : 'Abspielen'} disabled={!currentFile}>
                  {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 fill-current translate-x-0.5" />}
                </button>
                <button onClick={() => skip(1)} className="player-btn-icon" aria-label="Weiter" disabled={!currentFile}><SkipForward className="h-5 w-5" /></button>
                <button onClick={toggleRepeat} className={`player-btn-icon ${repeat !== 'off' ? 'is-active' : ''}`} aria-label="Wiederholen" disabled={!currentFile}>{repeat === 'one' ? <Repeat1 className="h-4 w-4" /> : <Repeat className="h-4 w-4" />}</button>
              </div>
              <div className="player-seek-row">
                <span className="player-time retro-mono">{formatTime(currentTime)}</span>
                <div className="player-seek-bar" onClick={(e) => { if (!currentFile || !duration) return; const rect = e.currentTarget.getBoundingClientRect(); const percent = ((e.clientX - rect.left) / rect.width) * 100; seek(Math.max(0, Math.min(100, percent))); }}>
                  <div className="player-seek-fill" style={{ width: `${progress}%` }} />
                </div>
                <span className="player-time retro-mono">{formatTime(duration)}</span>
              </div>
            </div>

            <div className="player-volume">
              <button onClick={() => { const v = volume > 0 ? 0 : 0.5; if (audioRef.current) audioRef.current.volume = v; setVolume(v); }} className="player-btn-icon" aria-label={volume > 0 ? 'Stumm' : 'Ton an'}>
                {volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </button>
              <div className="player-volume-bar" onClick={(e) => { const rect = e.currentTarget.getBoundingClientRect(); const v = (e.clientX - rect.left) / rect.width; if (audioRef.current) audioRef.current.volume = v; setVolume(v); }}>
                <div className="player-volume-fill" style={{ width: `${volume * 100}%` }} />
              </div>
            </div>
          </div>

          <BottomNav active={view as NavTab} onChange={(tab) => handleTabChange(tab)} likedCount={likedIds.size} />
        </div>
      </div>

      {/* Scroll-to-top button */}
      {showScrollTop && (
        <motion.button
          className="scroll-top-btn"
          onClick={() => mainScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.5 }}
          aria-label="Nach oben scrollen"
        >
          <ArrowUp className="h-5 w-5" />
        </motion.button>
      )}

      <input type="file" ref={uploadInputRef} multiple accept="audio/*,video/*" className="hidden" onChange={(e) => e.target.files && void uploadFiles(e.target.files)} />

      {upload.active && (
        <div className="upload-toast">
          <div className="upload-toast-header">
            <Upload className="h-5 w-5" />
            <span className="upload-toast-title">Upload laeuft...</span>
            <button className="upload-toast-close" onClick={() => setUpload({ active: false, progress: 0, message: '' })}>
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="upload-toast-progress">
            <div className="upload-toast-fill" style={{ width: `${upload.progress}%` }} />
          </div>
          <p className="upload-toast-text">{upload.message}</p>
        </div>
      )}

      {offlineDownload && (offlineDownload.status === 'downloading' || offlineDownload.status === 'error') && (
        <div className="upload-toast">
          <div className="upload-toast-header">
            <HardDriveDownload className="h-5 w-5" />
            <span className="upload-toast-title">
              {offlineDownload.status === 'error' ? 'Download fehlgeschlagen' : 'Offline-Download...'}
            </span>
            <button className="upload-toast-close" onClick={() => setOfflineDownload(null)}>
              <X className="h-4 w-4" />
            </button>
          </div>
          {offlineDownload.status === 'downloading' && (
            <div className="upload-toast-progress">
              <div className="upload-toast-fill" style={{ width: `${offlineDownload.progress}%` }} />
            </div>
          )}
          <p className="upload-toast-text">
            {offlineDownload.status === 'error'
              ? 'Fehler beim Speichern - versuche es erneut'
              : `${offlineDownload.progress}%`}
          </p>
        </div>
      )}

      <QueueSheet open={showQueue} current={currentFile} queue={roomState.queue} token={token} onClose={() => setShowQueue(false)} onPlay={playFile} onRemove={(id) => void removeFromQueue(id)} onClear={() => void clearQueue()} />

      <AnimatePresence>
        {isPlayerOpen && (
          <FullscreenPlayer
            file={currentFile} token={token} isPlaying={isPlaying} currentTime={currentTime} duration={duration}
            progress={progress} volume={volume} shuffle={shuffle} repeat={repeat}
            liked={currentFile ? likedIds.has(currentFile.id) : false}
            queue={roomState.queue}
            onClose={() => setIsPlayerOpen(false)} onToggle={togglePlay}
            onSkip={skip} onSeek={seek} onVolume={(v) => { if (audioRef.current) audioRef.current.volume = v; setVolume(v); }}
            onShuffle={toggleShuffle} onRepeat={toggleRepeat}
            onToggleLike={() => currentFile && toggleLike(currentFile)}
            onShare={() => { if (currentFile) shareTrack(currentFile.title, currentFile.artist); }} onOpenQueue={() => setShowQueue(true)}
            onAddToQueue={(f) => addToQueue(f)}
            onPlayFromQueue={(f) => playFile(f)}
            playlists={roomState.playlists || []}
            onAddToPlaylist={(playlistId) => currentFile && handleAddToPlaylist(playlistId, currentFile.id)}
            onCreatePlaylist={() => setShowCreatePlaylist(true)}
            isOffline={currentFile ? cachedFileIds.has(currentFile.id) : false}
            onDownloadOffline={handleDownloadOffline}
            onDeleteOffline={handleDeleteOffline}
          />
        )}
      </AnimatePresence>

      {ContextMenuComponent}

      <CreatePlaylistDialog
        open={showCreatePlaylist}
        onClose={() => setShowCreatePlaylist(false)}
        onCreate={handleCreatePlaylist}
      />
    </>
  );
}

