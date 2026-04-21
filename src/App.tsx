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
  Clock,
  Music,
  User,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import type { ApiFile, ApiStatus, QueueItem, RoomState, UploadState, View, Album, Artist, Playlist, NavTab, AuthUser, LoginResponse } from './types';
import { LoginView, RegisterView } from './auth-views';
import { Sidebar, BottomNav, MiniPlayer } from './components/layout';
import { LikeButton, Section, EmptyState, TrackRow, MediaCard, useContextMenu, ContextMenu, type ContextMenuItem } from './components/ui';
import { FullscreenPlayer, QueueSheet } from './components/player';
import { usePWA } from './hooks/usePWA';
import { useWakeLock } from './hooks/useWakeLock';
import { useHashRouter } from './hooks/useHashRouter';
import { coverUrl, apiFetch } from './lib/api';
import { formatTime, trackSubtitle, trackArtist, hueFromString } from './lib/format';
import {
  HomeView,
  SearchView,
  LibraryView,
  LikedSongsView,
  AlbumDetailView,
  ArtistDetailView,
  PlaylistDetailView,
  ProfileView,
} from './views';

const TOKEN_STORAGE_KEY = 'jt-mp3.sessionToken';
const API_BASE = import.meta.env.VITE_API_BASE ?? '';

function apiUrl(path: string) { return `${API_BASE}${path}`; }

function getCoverUrl(file: ApiFile | null, token?: string) {
  if (!file) return '/icon.svg';
  if (file.hasArtwork) return apiUrl(`/api/cover/${file.id}${token ? `?token=${token}` : ''}`);
  return '/icon.svg';
}

function haptic(pattern: number | number[] = 10) {
  if ('vibrate' in navigator) { try { navigator.vibrate(pattern); } catch { /* silent */ } }
}

export default function App() {
  const { view, albumId, artistId, playlistId, navigate } = useHashRouter();
  const [token, setToken] = useState(() => sessionStorage.getItem(TOKEN_STORAGE_KEY) ?? '');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [status, setStatus] = useState<ApiStatus | null>(null);
  const [files, setFiles] = useState<ApiFile[]>([]);
  const [roomState, setRoomState] = useState<RoomState>({ likedIds: [], queue: [], playlists: [], updatedAt: '' });
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
  const [libraryFilter, setLibraryFilter] = useState<'playlists' | 'artists' | 'albums'>('playlists');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const mainScrollRef = useRef<HTMLDivElement>(null);

  const albums = useMemo(() => {
    const albumMap = new Map<string, Album>();
    files.forEach((file) => {
      const albumName = file.album || 'Unknown';
      const existing = albumMap.get(albumName);
      if (existing) existing.tracks.push(file);
      else albumMap.set(albumName, { id: albumName.toLowerCase().replace(/\s+/g, '-'), name: albumName, artist: file.artist, tracks: [file], trackCount: 1 });
    });
    return Array.from(albumMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [files]);

  const artists = useMemo(() => {
    const artistMap = new Map<string, Artist>();
    files.forEach((file) => {
      const artistName = file.artist || 'Unknown';
      const existing = artistMap.get(artistName);
      if (existing) existing.topTracks.push(file);
      else {
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
    return roomState.playlists.find((p) => p.id === playlistId) ?? null;
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
    return roomState.playlists.map((p) => ({ id: p.id, name: p.name }));
  }, [roomState.playlists]);

  const recentlyPlayed = useMemo(() => {
    return files.slice(0, 4);
  }, [files]);

  useEffect(() => {
    // Initial auth check
    apiFetch<AuthUser>('/api/auth/me')
      .then(u => {
        setUser(u);
        setToken('true');
        sessionStorage.setItem(TOKEN_STORAGE_KEY, 'true');
      })
      .catch(() => {
        setToken('');
        setUser(null);
        sessionStorage.removeItem(TOKEN_STORAGE_KEY);
      })
      .finally(() => setAuthChecking(false));
  }, []);

  async function loadStatus() {
    try {
      const data = await apiFetch<ApiStatus>('/api/status', { token });
      setStatus(data);
    } catch { /* silent */ }
  }

  async function loadMe() {
    try {
      const data = await apiFetch<AuthUser>('/api/auth/me', { token });
      setUser(data);
    } catch { /* silent */ }
  }

  async function loadFiles() {
    try {
      const data = await apiFetch<{ files: ApiFile[] }>('/api/files', { token });
      setFiles(data.files);
      if (data.files.length > 0 && !currentFile) setCurrentFile(data.files[0]);
    } catch { /* silent */ }
  }

  async function loadRoomState() {
    try {
      const data = await apiFetch<RoomState>('/api/state', { token });
      setRoomState(data);
    } catch { /* silent */ }
  }

  useEffect(() => {
    if (!isAuthenticated) return;
    Promise.all([loadStatus(), loadFiles(), loadRoomState(), loadMe()]).catch(() => {});
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const events = new EventSource(apiUrl(`/api/events?token=${encodeURIComponent(token)}`), { withCredentials: true });
    events.addEventListener('state', (event) => {
      try { setRoomState(JSON.parse((event as MessageEvent).data)); } catch { /* silent */ }
    });
    events.onerror = () => events.close();
    return () => events.close();
  }, [isAuthenticated, token]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentFile) return;
    audio.src = apiUrl(`/api/stream/${currentFile.id}`);
    audio.load();
    setCurrentTime(0); setDuration(0);
    if (isPlaying) void audio.play().catch(() => setIsPlaying(false));
  }, [currentFile, token]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) void audio.play().catch(() => setIsPlaying(false));
    else audio.pause();
  }, [isPlaying]);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) audio.volume = volume;
  }, [volume]);

  async function handleAuthLogin(username: string, password: string, mfaToken?: string) {
    setError('');
    try {
      const data = await apiFetch<LoginResponse>('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username, password, mfaToken }),
      });
      setToken('true');
      setUser(data.user);
      sessionStorage.setItem(TOKEN_STORAGE_KEY, 'true');
      await loadFiles();
      await loadRoomState();
      haptic(); navigate('home');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    }
  }

  async function handleAuthRegister(username: string, password: string, inviteCode: string) {
    setError('');
    try {
      const data = await apiFetch<LoginResponse>('/api/auth/register', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username, password, inviteCode }),
      });
      setToken('true');
      setUser(data.user);
      sessionStorage.setItem(TOKEN_STORAGE_KEY, 'true');
      await loadFiles();
      haptic(); navigate('home');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    }
  }

  async function handleAuthLogout() {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST', token });
    } catch { /* silent */ }
    setToken('');
    setUser(null);
    setFiles([]);
    setRoomState({ likedIds: [], queue: [], playlists: [], updatedAt: '' });
    setCurrentFile(null);
    setIsPlaying(false);
    sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    haptic();
    navigate('home');
  }

  const playFile = useCallback((file: ApiFile) => {
    haptic(); setCurrentFile(file); setIsPlaying(true); setIsPlayerOpen(true);
  }, []);

  const togglePlay = useCallback(() => { haptic(); setIsPlaying((prev) => !prev); }, []);

  const skip = useCallback((offset: number) => {
    if (files.length === 0 || !currentFile) return;
    haptic();
    let nextIndex: number;
    if (shuffle) {
      do { nextIndex = Math.floor(Math.random() * files.length); }
      while (files.length > 1 && nextIndex === files.findIndex((f) => f.id === currentFile.id));
    } else {
      const index = files.findIndex((file) => file.id === currentFile.id);
      nextIndex = (index + offset + files.length) % files.length;
    }
    setCurrentFile(files[nextIndex]); setIsPlaying(true);
  }, [files, currentFile, shuffle]);

  const toggleShuffle = useCallback(() => { haptic(); setShuffle((prev) => !prev); }, []);
  const toggleRepeat = useCallback(() => {
    haptic();
    setRepeat((prev) => { if (prev === 'off') return 'all'; if (prev === 'all') return 'one'; return 'off'; });
  }, []);

  async function uploadFiles(fileList: FileList | File[]) {
    const selected = Array.from(fileList).filter((file) => file.type.startsWith('audio/') || file.type.startsWith('video/'));
    if (selected.length === 0) { setUpload({ active: false, progress: 0, message: 'Bitte Audio- oder Videodateien auswählen.' }); return; }
    setUpload({ active: true, progress: 0, message: 'Upload startet...' });
    try {
      for (let index = 0; index < selected.length; index += 1) {
        const file = selected[index];
        setUpload({ active: true, progress: Math.round((index / selected.length) * 100), message: `${file.name} wird übertragen...` });
        await apiFetch(`/api/upload?name=${encodeURIComponent(file.name)}`, {
          method: 'POST',
          token,
          headers: { 'content-type': file.type || 'application/octet-stream' },
          body: file,
        });
      }
      await loadFiles(); haptic(); setUpload({ active: false, progress: 100, message: 'Bibliothek aktualisiert.' });
    } catch (e) { setUpload({ active: false, progress: 0, message: e instanceof Error ? e.message : 'Upload fehlgeschlagen.' }); }
  }

  const toggleLike = useCallback(async (file: ApiFile) => {
    haptic();
    try {
      const data = await apiFetch<RoomState>(`/api/likes/${file.id}`, {
        method: 'POST',
        token,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ liked: !likedIds.has(file.id) }),
      });
      setRoomState(data);
    } catch { /* silent */ }
  }, [token, likedIds]);

  async function playNextFromQueue() {
    const next = roomState.queue[0];
    if (!next) {
      if (repeat === 'one') { setCurrentFile(currentFile); setIsPlaying(true); return; }
      if (repeat === 'all' || files.length === 0) { skip(1); return; }
      skip(1); return;
    }
    await removeFromQueue(next.id, false);
    playFile(next.file);
  }

  function seek(value: number) {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    audio.currentTime = (value / 100) * duration;
  }

  async function removeFromQueue(itemId: string, updateUi = true) {
    try {
      const data = await apiFetch<RoomState>(`/api/queue/${itemId}`, { method: 'DELETE', token });
      if (updateUi) setRoomState(data);
    } catch { /* silent */ }
  }

  async function clearQueue() {
    haptic();
    try {
      const data = await apiFetch<RoomState>('/api/queue/clear', { method: 'POST', token });
      setRoomState(data);
    } catch { /* silent */ }
  }

  const openUpload = useCallback(() => { uploadInputRef.current?.click(); }, []);

  const playAlbum = useCallback((album: Album) => {
    if (album.tracks[0]) playFile(album.tracks[0]);
  }, [playFile]);

  const addToQueue = useCallback(async (file: ApiFile) => {
    haptic();
    try {
      const data = await apiFetch<RoomState>('/api/queue', {
        method: 'POST',
        token,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ fileId: file.id }),
      });
      setRoomState(data);
    } catch { /* silent */ }
  }, [token]);

  const handlePlaylistSelect = useCallback((id: string) => {
    navigate('playlist-detail', { playlistId: id });
    setSidebarOpen(false);
  }, [navigate]);

  const createPlaylist = async (name: string) => {
    try {
      const newPlaylist = await apiFetch<Playlist>('/api/playlists', {
        method: 'POST',
        token,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name })
      });
      setRoomState(prev => ({
        ...prev,
        playlists: [...prev.playlists, newPlaylist]
      }));
      haptic();
      navigate('playlist-detail', { playlistId: newPlaylist.id });
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Fehler');
    }
  };

  const handleLikedSongs = useCallback(() => { navigate('liked'); setSidebarOpen(false); }, [navigate]);

  const handleTabChange = useCallback((tab: string) => { navigate(tab as View); setSidebarOpen(false); }, [navigate]);

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          if (currentFile) togglePlay();
          break;
        case 'ArrowRight':
          if (e.shiftKey) skip(1);
          break;
        case 'ArrowLeft':
          if (e.shiftKey) skip(-1);
          break;
        case 'KeyS':
          if (e.shiftKey) toggleShuffle();
          break;
        case 'KeyR':
          if (e.shiftKey) toggleRepeat();
          break;
        case 'KeyM':
          if (e.shiftKey) {
            const v = volume > 0 ? 0 : 0.5;
            if (audioRef.current) audioRef.current.volume = v;
            setVolume(v);
          }
          break;
        case 'KeyQ':
          if (e.shiftKey) setShowQueue((prev) => !prev);
          break;
        case 'KeyL':
          if (e.shiftKey && currentFile) toggleLike(currentFile);
          break;
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentFile, volume, togglePlay, skip, toggleShuffle, toggleRepeat, toggleLike]);

  const showLogin = view === 'login' || view === 'register';

  if (!isAuthenticated || showLogin) return <LoginView onLogin={handleAuthLogin} error={error} />;

  return (
    <div className="app-shell flex flex-col h-[100svh] overflow-hidden">
      <div className="atmosphere" />
      <div className="atmosphere-glow" />
      <div className="app-layout flex-1 overflow-hidden">
        <div className={`sidebar-responsive ${sidebarOpen ? 'is-open' : ''}`}>
          <Sidebar
            activeTab={view as NavTab}
            onTabChange={(tab) => { handleTabChange(tab); setSidebarOpen(false); }}
            onUpload={() => { openUpload(); setSidebarOpen(false); }}
            playlists={sidebarPlaylists}
            onCreatePlaylist={createPlaylist}
            onPlaylistSelect={(p) => { handlePlaylistSelect(p); setSidebarOpen(false); }}
            likedCount={likedIds.size}
            onLikedSongs={() => { handleLikedSongs(); setSidebarOpen(false); }}
          />
        </div>

        <div className="main-content">
          <audio ref={audioRef} onEnded={() => void playNextFromQueue()} onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)} onDurationChange={(e) => setDuration(e.currentTarget.duration)} />

          <div ref={mainScrollRef} className="main-scroll">
            <div className="main-top-bar flex items-center justify-between">
              <div className="main-top-bar-nav flex items-center gap-2">
                <button className="top-bar-nav-btn md:hidden" aria-label="Menu" onClick={() => setSidebarOpen(true)}>
                  <div className="w-5 h-0.5 bg-current mb-1" />
                  <div className="w-5 h-0.5 bg-current mb-1" />
                  <div className="w-5 h-0.5 bg-current" />
                </button>
                <button className="top-bar-nav-btn" aria-label="Zurück" onClick={() => window.history.back()}>
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <span className="top-bar-title-text hidden sm:inline retro-glow">StreamSync</span>
              </div>

              <div className="flex-1 max-w-lg mx-4 hidden sm:block">
                {(view === 'home' || view === 'search') && (
                  <div className="main-top-bar-search">
                    <Search className="search-icon" />
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      className="main-search-input"
                      placeholder="Was möchtest du hören?"
                    />
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3">
                <button onClick={openUpload} className="sidebar-btn-primary flex items-center gap-2 px-4 shadow-lg shadow-orange-500/20">
                  <Upload className="h-4 w-4" />
                  <span className="hidden sm:inline">Upload</span>
                </button>
              </div>
            </div>

            <Suspense fallback={<div className="loading-spinner" />}>
              {view === 'home' && (
                <HomeView
                  files={files} filteredFiles={filteredFiles}
                  currentId={currentFile?.id ?? null} isPlaying={isPlaying} likedIds={likedIds}
                  onPlay={playFile} onLike={toggleLike} onOpenUpload={openUpload}
                  likedFiles={likedFiles} albums={albums} onAlbumSelect={(a) => navigate('album-detail', { albumId: a.id })}
                  onArtistSelect={(a) => navigate('artist-detail', { artistId: a.id })} onPlayAlbum={playAlbum}
                  onAddToQueue={addToQueue}
                />
              )}

              {view === 'search' && (
                <SearchView
                  files={filteredFiles} query={query} onQueryChange={setQuery}
                  currentFile={currentFile} isPlaying={isPlaying} likedIds={likedIds}
                  onPlay={playFile} onLike={toggleLike}
                  albums={albums} artists={artists} onAlbumSelect={(a) => { navigate('album-detail', { albumId: a.id }); }}
                  onArtistSelect={(a) => { navigate('artist-detail', { artistId: a.id }); }}
                />
              )}

              {view === 'library' && (
                <LibraryView
                  files={files} currentFile={currentFile} isPlaying={isPlaying} likedIds={likedIds}
                  onPlay={playFile} onLike={toggleLike} onOpenUpload={openUpload}
                  albums={albums} artists={artists} playlists={roomState.playlists}
                  filter={libraryFilter} setFilter={setLibraryFilter}
                  onAlbumSelect={(a) => { navigate('album-detail', { albumId: a.id }); }}
                  onArtistSelect={(a) => { navigate('artist-detail', { artistId: a.id }); }}
                  onPlaylistSelect={(p) => { navigate('playlist-detail', { playlistId: p.id }); }}
                  onCreatePlaylist={createPlaylist}
                />
              )}

              {view === 'liked' && (
                <LikedSongsView
                  likedFiles={likedFiles} currentFile={currentFile} isPlaying={isPlaying}
                  onPlay={playFile} onLike={toggleLike}
                />
              )}

              {view === 'album-detail' && selectedAlbum && (
                <AlbumDetailView
                  album={selectedAlbum} currentFile={currentFile} isPlaying={isPlaying}
                  onPlay={playFile} onLike={toggleLike} onBack={() => navigate('library')}
                  onAddToQueue={addToQueue}
                />
              )}

              {view === 'artist-detail' && selectedArtist && (
                <ArtistDetailView
                  artist={selectedArtist} currentFile={currentFile} isPlaying={isPlaying}
                  onPlay={playFile} onLike={toggleLike} onBack={() => navigate('library')}
                  onAddToQueue={addToQueue}
                />
              )}

              {view === 'playlist-detail' && selectedPlaylist && (
                <PlaylistDetailView
                  playlist={selectedPlaylist} files={files} currentFile={currentFile} isPlaying={isPlaying}
                  likedIds={likedIds}
                  onPlay={playFile} onLike={toggleLike} onBack={() => navigate('library')}
                  onAddToQueue={addToQueue}
                />
              )}

              {view === 'profile' && (
                <ProfileView
                  user={user}
                  token={token}
                  likedCount={likedFiles.length}
                  onLikedSongs={handleLikedSongs}
                  onLogout={handleAuthLogout}
                />
              )}
            </Suspense>
          </div>

          <div className="player-bar-desktop hidden md:block">
            <div className="player-bar">
              <div className="player-track-info">
                {currentFile && (
                  <>
                    <img src={getCoverUrl(currentFile, token)} alt="" className="player-track-cover" />
                    <div className="player-track-text">
                      <p className="player-track-title">{currentFile.title}</p>
                      <p className="player-track-artist">{trackArtist(currentFile)}</p>
                    </div>
                    <LikeButton liked={likedIds.has(currentFile.id)} onToggle={() => toggleLike(currentFile)} size={18} />
                  </>
                )}
              </div>

              <div className="player-controls">
                <div className="player-buttons-row">
                  <button onClick={toggleShuffle} className={`player-btn-icon ${shuffle ? 'is-active' : ''}`} aria-label="Zufallswiedergabe"><Shuffle className="h-4 w-4" /></button>
                  <button onClick={() => skip(-1)} className="player-btn-icon" aria-label="Zurück"><SkipBack className="h-5 w-5" /></button>
                  <button onClick={togglePlay} className="player-btn-play" aria-label={isPlaying ? 'Pause' : 'Abspielen'}>
                    {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 fill-current translate-x-0.5" />}
                  </button>
                  <button onClick={() => skip(1)} className="player-btn-icon" aria-label="Weiter"><SkipForward className="h-5 w-5" /></button>
                  <button onClick={toggleRepeat} className={`player-btn-icon ${repeat !== 'off' ? 'is-active' : ''}`} aria-label="Wiederholen">{repeat === 'one' ? <Repeat1 className="h-4 w-4" /> : <Repeat className="h-4 w-4" />}</button>
                </div>
                <div className="player-seek-row">
                  <span className="player-time retro-mono">{formatTime(currentTime)}</span>
                  <div className="player-seek-bar" onClick={(e) => { const rect = e.currentTarget.getBoundingClientRect(); const percent = ((e.clientX - rect.left) / rect.width) * 100; seek(Math.max(0, Math.min(100, percent))); }}>
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
          </div>
        </div>
      </div>

      <div className="mobile-nav-container md:hidden">
        <MiniPlayer
          file={currentFile}
          token={token}
          isPlaying={isPlaying}
          progress={progress}
          onToggle={togglePlay}
          onOpen={() => setIsPlayerOpen(true)}
        />
        <BottomNav active={view as NavTab} onChange={handleTabChange} />
      </div>

      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      <input type="file" ref={uploadInputRef} multiple accept="audio/*,video/*" className="hidden" onChange={(e) => e.target.files && void uploadFiles(e.target.files)} />

      {upload.active && (
        <div className="upload-toast">
          <div className="upload-toast-header">
            <Upload className="h-5 w-5" />
            <span className="upload-toast-title">Upload läuft...</span>
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

      <QueueSheet open={showQueue} current={currentFile} queue={roomState.queue} token={token} onClose={() => setShowQueue(false)} onPlay={playFile} onRemove={(id) => void removeFromQueue(id)} onClear={() => void clearQueue()} />

      <AnimatePresence>
        {isPlayerOpen && (
          <FullscreenPlayer
            file={currentFile} token={token} isPlaying={isPlaying} currentTime={currentTime} duration={duration}
            progress={progress} volume={volume} shuffle={shuffle} repeat={repeat}
            liked={currentFile ? likedIds.has(currentFile.id) : false}
            onClose={() => setIsPlayerOpen(false)} onToggle={togglePlay}
            onSkip={skip} onSeek={seek} onVolume={(v) => { if (audioRef.current) audioRef.current.volume = v; setVolume(v); }}
            onShuffle={toggleShuffle} onRepeat={toggleRepeat}
            onToggleLike={() => currentFile && toggleLike(currentFile)}
            onShare={() => {}} onOpenQueue={() => setShowQueue(true)}
          />
        )}
      </AnimatePresence>

      {ContextMenuComponent}
    </div>
  );
}

