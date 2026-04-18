import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Disc3,
  FileAudio,
  FileVideo,
  Heart,
  Headphones,
  Library,
  ListMusic,
  Lock,
  LogOut,
  Pause,
  Play,
  Plus,
  RefreshCcw,
  Repeat,
  Repeat1,
  Search,
  Settings,
  Shield,
  Shuffle,
  SkipBack,
  SkipForward,
  Upload,
  Trash2,
  Users,
  Wifi,
  X,
  Volume2,
  Clock,
  TrendingUp,
  Music,
  User,
  Disc,
  Star,
  Flame,
  MonitorSpeaker,
  Maximize2,
  HeartHandshake,
  Mic2,
  ListPlus,
  GripVertical,
  MoreHorizontal,
  ChevronRight,
  ChevronLeft,
  Home,
  Compass,
  BarChart3,
  Timer,
  Sliders,
} from 'lucide-react';
import {AnimatePresence, motion} from 'motion/react';
import type {ApiFile, ApiStatus, QueueItem, RoomState, UploadState, View, Album, Artist, Playlist, ChartItem, UserSettings} from './types';

const TOKEN_STORAGE_KEY = 'jt-mp3.sessionToken';
const API_BASE = import.meta.env.VITE_API_BASE ?? '';

function apiUrl(path: string) {
  return `${API_BASE}${path}`;
}

function formatTime(value: number) {
  if (!Number.isFinite(value)) return '0:00';
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function haptic() {
  if ('vibrate' in navigator) {
    navigator.vibrate(10);
  }
}

function BackgroundGlow({ coverUrl }: { coverUrl: string }) {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
      <motion.div
        key={coverUrl}
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.4 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 1.5 }}
        className="absolute inset-0"
        style={{
          background: `radial-gradient(circle at 20% 30%, var(--color-mint), transparent 40%),
                       radial-gradient(circle at 80% 70%, var(--color-coral), transparent 40%),
                       var(--color-night)`,
        }}
      />
      {coverUrl !== '/icon.svg' && (
        <motion.div
          key={`glow-${coverUrl}`}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 0.3, scale: 1.2 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 2 }}
          className="absolute inset-0 blur-[100px] saturate-150"
          style={{
            backgroundImage: `url(${coverUrl})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: 'blur(100px) brightness(0.8)',
          }}
        />
      )}
    </div>
  );
}

export default function App() {
  const [view, setView] = useState<View>('library');
  const [token, setToken] = useState(() => sessionStorage.getItem(TOKEN_STORAGE_KEY) ?? '');
  const [loginToken, setLoginToken] = useState('');
  const [status, setStatus] = useState<ApiStatus | null>(null);
  const [files, setFiles] = useState<ApiFile[]>([]);
  const [roomState, setRoomState] = useState<RoomState>({likedIds: [], queue: [], updatedAt: ''});
  const [currentFile, setCurrentFile] = useState<ApiFile | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);
  const [upload, setUpload] = useState<UploadState>({active: false, progress: 0, message: ''});
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState<'off' | 'all' | 'one'>('off');
  const [volume, setVolume] = useState(1);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null);
  const [selectedArtist, setSelectedArtist] = useState<Artist | null>(null);
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);
  const [showCreatePlaylist, setShowCreatePlaylist] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [sleepTimer, setSleepTimer] = useState(0);
  const [settings, setSettings] = useState<UserSettings>({
    audioQuality: 'normal',
    sleepTimer: 0,
    autoplay: true,
    crossfade: 0,
    normalize: false,
  });
  const audioRef = useRef<HTMLAudioElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isAuthenticated = token.length > 0;
  const authHeaders = useMemo(() => ({'x-share-token': token}), [token]);
  const progress = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;
  const likedIds = useMemo(() => new Set(roomState.likedIds), [roomState.likedIds]);

  const filteredFiles = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return files;
    return files.filter((file) =>
      file.title.toLowerCase().includes(needle) ||
      file.name.toLowerCase().includes(needle) ||
      file.artist?.toLowerCase().includes(needle) ||
      file.album?.toLowerCase().includes(needle)
    );
  }, [files, query]);

  const albums = useMemo(() => {
    const albumMap = new Map<string, Album>();
    files.forEach((file) => {
      const albumName = file.album || file.title.split('-')[0]?.trim() || 'Unknown';
      const existing = albumMap.get(albumName);
      if (existing) {
        existing.tracks.push(file);
      } else {
        albumMap.set(albumName, {
          id: albumName.toLowerCase().replace(/\s+/g, '-'),
          name: albumName,
          artist: file.artist,
          tracks: [file],
          trackCount: 1,
        });
      }
    });
    return Array.from(albumMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [files]);

  const artists = useMemo(() => {
    const artistMap = new Map<string, Artist>();
    files.forEach((file) => {
      const artistName = file.artist || 'Unknown';
      const existing = artistMap.get(artistName);
      if (existing) {
        existing.topTracks.push(file);
        const albumName = file.album || file.title.split('-')[0]?.trim() || 'Unknown';
        let album = existing.albums.find((a) => a.name === albumName);
        if (!album) {
          album = {
            id: albumName.toLowerCase().replace(/\s+/g, '-'),
            name: albumName,
            artist: artistName,
            tracks: [],
            trackCount: 0,
          };
          existing.albums.push(album);
        }
        album.tracks.push(file);
        album.trackCount = album.tracks.length;
      } else {
        const albumName = file.album || file.title.split('-')[0]?.trim() || 'Unknown';
        artistMap.set(artistName, {
          id: artistName.toLowerCase().replace(/\s+/g, '-'),
          name: artistName,
          albums: [{
            id: albumName.toLowerCase().replace(/\s+/g, '-'),
            name: albumName,
            artist: artistName,
            tracks: [file],
            trackCount: 1,
          }],
          topTracks: [file],
        });
      }
    });
    return Array.from(artistMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [files]);

  const charts = useMemo(() => {
    return files.map((file, index) => ({
      rank: index + 1,
      file,
      plays: Math.floor(Math.random() * 1000),
      trend: Math.random() > 0.5 ? 'up' : Math.random() > 0.3 ? 'stable' : 'down' as const,
    })).sort((a, b) => b.plays - a.plays);
  }, [files]);

  async function loadStatus(activeToken = token) {
    try {
      const response = await fetch(apiUrl('/api/status'), {
        headers: activeToken ? {'x-share-token': activeToken} : undefined,
      });
      if (!response.ok) throw new Error('Status konnte nicht geladen werden.');
      setStatus(await response.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Status-Fehler');
      throw e;
    }
  }

  async function loadFiles(activeToken = token) {
    try {
      const response = await fetch(apiUrl('/api/files'), {headers: {'x-share-token': activeToken}});
      if (!response.ok) throw new Error('Bibliothek konnte nicht geladen werden.');
      const data = await response.json();
setFiles(data.files);
        if (data.files.length > 0 && !currentFile) {
          setCurrentFile(data.files[0]);
        }
        buildAlbumsArtists(data.files);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Dateiladen-Fehler');
      throw e;
    }
  }

  async function loadRoomState(activeToken = token) {
    try {
      const response = await fetch(apiUrl('/api/state'), {headers: {'x-share-token': activeToken}});
      if (!response.ok) throw new Error('Raumzustand konnte nicht geladen werden.');
      setRoomState(await response.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'State-Fehler');
      throw e;
    }
  }

  useEffect(() => {
    if (!isAuthenticated) return;

    Promise.all([loadStatus(), loadFiles(), loadRoomState()]).catch((reason) => {
      setError(reason instanceof Error ? reason.message : 'Verbindung zum lokalen Server fehlgeschlagen.');
      setToken('');
      sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    });
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;

    const events = new EventSource(apiUrl(`/api/events`));
    events.addEventListener('state', (event) => {
      try {
        setRoomState(JSON.parse((event as MessageEvent).data));
      } catch (e) {
        console.error('SSE Parse Error:', e);
      }
    });
    events.onerror = () => {
      events.close();
      setError('SSE Verbindung unterbrochen.');
    };

    return () => events.close();
  }, [isAuthenticated, token]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentFile) return;

    audio.src = apiUrl(`/api/stream/${currentFile.id}`);
    audio.load();
    setCurrentTime(0);
    setDuration(0);
    if (isPlaying) {
      void audio.play().catch(() => setIsPlaying(false));
    }
  }, [currentFile, token]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      void audio.play().catch(() => setIsPlaying(false));
    } else {
      audio.pause();
    }
  }, [isPlaying]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = volume;
  }, [volume]);

  useEffect(() => {
    if (!('mediaSession' in navigator) || !currentFile) return;

    const artwork = [
      {src: coverUrl(currentFile), sizes: '512x512', type: currentFile.hasArtwork ? 'image/jpeg' : 'image/svg+xml'},
    ];

    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentFile.title,
      artist: currentFile.artist || 'StreamSync',
      album: currentFile.album || status?.roomName || 'Privater Raum',
      artwork,
    });

    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
    navigator.mediaSession.setActionHandler('play', () => setIsPlaying(true));
    navigator.mediaSession.setActionHandler('pause', () => setIsPlaying(false));
    navigator.mediaSession.setActionHandler('previoustrack', () => skip(-1));
    navigator.mediaSession.setActionHandler('nexttrack', () => skip(1));
    navigator.mediaSession.setActionHandler('seekto', (details) => {
      const audio = audioRef.current;
      if (!audio || details.seekTime === undefined) return;
      audio.currentTime = details.seekTime;
    });

    if ('setPositionState' in navigator.mediaSession && duration > 0) {
      navigator.mediaSession.setPositionState({
        duration,
        playbackRate: 1,
        position: currentTime,
      });
    }
  }, [currentFile, currentTime, duration, isPlaying, status?.roomName, token]);

  async function handleLogin(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    const nextToken = loginToken.trim();
    if (!nextToken) return;

    try {
      await loadStatus(nextToken);
      await loadFiles(nextToken);
      await loadRoomState(nextToken);
      sessionStorage.setItem(TOKEN_STORAGE_KEY, nextToken);
      setToken(nextToken);
      setLoginToken('');
      haptic();
    } catch {
      setError('Dieser Gruppenschluessel passt nicht zum lokalen Server.');
    }
  }

  function logout() {
    haptic();
    setToken('');
    setLoginToken('');
    setFiles([]);
    setRoomState({likedIds: [], queue: [], updatedAt: ''});
    setCurrentFile(null);
    setIsPlaying(false);
    sessionStorage.removeItem(TOKEN_STORAGE_KEY);
  }

  function playFile(file: ApiFile) {
    haptic();
    setCurrentFile(file);
    setIsPlaying(true);
    setIsPlayerOpen(true);
  }

  function togglePlay() {
    haptic();
    setIsPlaying((prev) => !prev);
  }

  const skip = useCallback((offset: number) => {
    if (files.length === 0 || !currentFile) return;
    haptic();
    let nextIndex: number;
    if (shuffle) {
      do {
        nextIndex = Math.floor(Math.random() * files.length);
      } while (files.length > 1 && nextIndex === files.findIndex((f) => f.id === currentFile.id));
    } else {
      const index = files.findIndex((file) => file.id === currentFile.id);
      nextIndex = (index + offset + files.length) % files.length;
    }
    setCurrentFile(files[nextIndex]);
    setIsPlaying(true);
  }, [files, currentFile, shuffle]);

  const toggleShuffle = useCallback(() => {
    haptic();
    setShuffle((prev) => !prev);
  }, []);

  const toggleRepeat = useCallback(() => {
    haptic();
    setRepeat((prev) => {
      if (prev === 'off') return 'all';
      if (prev === 'all') return 'one';
      return 'off';
    });
  }, []);

  const changeVolume = useCallback((value: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = value;
    setVolume(value);
  }, []);

  async function playNextFromQueue() {
    const next = roomState.queue[0];
    if (!next) {
      if (repeat === 'one') {
        setCurrentFile(currentFile);
        setIsPlaying(true);
        return;
      }
      if (repeat === 'all' || files.length === 0) {
        skip(1);
        return;
      }
      skip(1);
      return;
    }

    await removeFromQueue(next.id, false);
    playFile(next.file);
  }

  function seek(value: number) {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    audio.currentTime = (value / 100) * duration;
  }

  function changeView(nextView: View) {
    haptic();
    setView(nextView);
  }

  async function uploadFiles(fileList: FileList | File[]) {
    const selected = Array.from(fileList).filter((file) => file.type.startsWith('audio/') || file.type.startsWith('video/'));
    if (selected.length === 0) {
      setUpload({active: false, progress: 0, message: 'Bitte Audio- oder Videodateien auswaehlen.'});
      return;
    }

    setUpload({active: true, progress: 0, message: 'Upload startet...'});

    try {
      for (let index = 0; index < selected.length; index += 1) {
        const file = selected[index];
        setUpload({active: true, progress: Math.round((index / selected.length) * 100), message: `${file.name} wird uebertragen...`});
        const response = await fetch(apiUrl(`/api/upload?name=${encodeURIComponent(file.name)}`), {
          method: 'POST',
          headers: {
            ...authHeaders,
            'content-type': file.type || 'application/octet-stream',
          },
          body: file,
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error || `${file.name} konnte nicht hochgeladen werden.`);
        }
      }

      await loadFiles();
      haptic();
      setUpload({active: false, progress: 100, message: 'Bibliothek aktualisiert.'});
    } catch (e) {
      setUpload({active: false, progress: 0, message: e instanceof Error ? e.message : 'Upload fehlgeschlagen.'});
    }
  }

  async function toggleLike(file: ApiFile) {
    haptic();
    const response = await fetch(apiUrl(`/api/likes/${file.id}`), {
      method: 'POST',
      headers: {
        ...authHeaders,
        'content-type': 'application/json',
      },
      body: JSON.stringify({liked: !likedIds.has(file.id)}),
    });
    if (response.ok) setRoomState(await response.json());
  }

  async function createPlaylist() {
    if (!newPlaylistName.trim()) return;
    haptic();
    const newPlaylist: Playlist = {
      id: Date.now().toString(),
      name: newPlaylistName.trim(),
      trackIds: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isPublic: true,
    };
    setPlaylists([...playlists, newPlaylist]);
    setNewPlaylistName('');
    setShowCreatePlaylist(false);
    setView('playlists');
  }

  async function addToPlaylist(playlistId: string, fileId: string) {
    haptic();
    const playlist = playlists.find((p) => p.id === playlistId);
    if (!playlist || playlist.trackIds.includes(fileId)) return;
    const updated = { ...playlist, trackIds: [...playlist.trackIds, fileId], updatedAt: new Date().toISOString() };
    setPlaylists(playlists.map((p) => (p.id === playlistId ? updated : p)));
  }

  async function removeFromPlaylist(playlistId: string, fileId: string) {
    haptic();
    const playlist = playlists.find((p) => p.id === playlistId);
    if (!playlist) return;
    const updated = { ...playlist, trackIds: playlist.trackIds.filter((id) => id !== fileId), updatedAt: new Date().toISOString() };
    setPlaylists(playlists.map((p) => (p.id === playlistId ? updated : p)));
  }

  async function deletePlaylist(playlistId: string) {
    haptic();
    setPlaylists(playlists.filter((p) => p.id !== playlistId));
  }

  function playAlbum(album: Album) {
    if (album.tracks.length === 0) return;
    haptic();
    setCurrentFile(album.tracks[0]);
    setIsPlaying(true);
    setIsPlayerOpen(true);
  }

  function playArtist(artist: Artist) {
    if (artist.topTracks.length === 0) return;
    haptic();
    setCurrentFile(artist.topTracks[0]);
    setIsPlaying(true);
    setIsPlayerOpen(true);
  }

  function playPlaylist(playlist: Playlist) {
    const track = files.find((f) => playlist.trackIds.includes(f.id));
    if (!track) return;
    haptic();
    setCurrentFile(track);
    setIsPlaying(true);
    setIsPlayerOpen(true);
  }

  function startSleepTimer(minutes: number) {
    setSleepTimer(minutes * 60);
  }

  function cancelSleepTimer() {
    setSleepTimer(0);
  }

  useEffect(() => {
    if (sleepTimer <= 0) return;
    const timer = setInterval(() => {
      setSleepTimer((prev) => {
        if (prev <= 1) {
          setIsPlaying(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [sleepTimer]);

  function updateSettings(newSettings: Partial<UserSettings>) {
    setSettings((prev) => ({ ...prev, ...newSettings }));
  }

  async function addToQueue(file: ApiFile) {
    haptic();
    const response = await fetch(apiUrl('/api/queue'), {
      method: 'POST',
      headers: {
        ...authHeaders,
        'content-type': 'application/json',
      },
      body: JSON.stringify({fileId: file.id}),
    });
    if (response.ok) {
      setRoomState(await response.json());
      setView('queue');
    }
  }

  async function removeFromQueue(itemId: string, updateUi = true) {
    const response = await fetch(apiUrl(`/api/queue/${itemId}`), {
      method: 'DELETE',
      headers: authHeaders,
    });
    if (response.ok && updateUi) setRoomState(await response.json());
  }

  async function clearQueue() {
    haptic();
    const response = await fetch(apiUrl('/api/queue/clear'), {
      method: 'POST',
      headers: authHeaders,
    });
    if (response.ok) setRoomState(await response.json());
  }

  if (!isAuthenticated) {
    return <LoginView token={loginToken} error={error} setToken={setLoginToken} onLogin={handleLogin} />;
  }

  return (
    <div className="app-shell">
      <BackgroundGlow coverUrl={coverUrl(currentFile)} />
      <audio
        ref={audioRef}
        onEnded={() => void playNextFromQueue()}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
        onDurationChange={(event) => setDuration(event.currentTarget.duration)}
      />
      <Header status={status} onLogout={logout} />

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 pb-44 pt-3 sm:px-6 lg:px-8">
        <NowPlayingHero
          file={currentFile}
          isPlaying={isPlaying}
          currentTime={currentTime}
          duration={duration}
          progress={progress}
          onToggle={togglePlay}
          onSkip={skip}
          onSeek={seek}
          shuffle={shuffle}
          repeat={repeat}
          volume={volume}
          onShuffle={toggleShuffle}
          onRepeat={toggleRepeat}
          onVolume={changeVolume}
        />

        <QuickStats status={status} fileCount={files.length} />

        <AnimatePresence mode="wait">
          {view === 'library' && (
            <LibraryView
              files={filteredFiles}
              query={query}
              setQuery={setQuery}
              currentFile={currentFile}
              isPlaying={isPlaying}
              likedIds={likedIds}
              onPlay={playFile}
              onLike={toggleLike}
              onQueue={addToQueue}
              onRefresh={() => void loadFiles()}
              onOpenUpload={() => changeView('upload')}
            />
          )}

          {view === 'albums' && (
            <AlbumsView
              albums={albums}
              onPlayAlbum={playAlbum}
              onSelectAlbum={setSelectedAlbum}
            />
          )}

          {view === 'artists' && (
            <ArtistsView
              artists={artists}
              onPlayArtist={playArtist}
              onSelectArtist={setSelectedArtist}
            />
          )}

          {view === 'playlists' && (
            <PlaylistsView
              playlists={playlists}
              files={files}
              onPlayPlaylist={playPlaylist}
              onCreatePlaylist={() => setShowCreatePlaylist(true)}
              onDeletePlaylist={deletePlaylist}
              showCreate={showCreatePlaylist}
              newPlaylistName={newPlaylistName}
              setNewPlaylistName={setNewPlaylistName}
              onConfirmCreate={createPlaylist}
              onCancel={() => setShowCreatePlaylist(false)}
            />
          )}

          {view === 'discover' && (
            <DiscoverView
              files={files}
              likedIds={likedIds}
              onPlay={playFile}
              onLike={toggleLike}
            />
          )}

          {view === 'charts' && (
            <ChartsView
              charts={charts}
              onPlay={playFile}
            />
          )}

          {view === 'settings' && (
            <SettingsView
              settings={settings}
              sleepTimer={sleepTimer}
              onUpdateSettings={updateSettings}
              onStartSleepTimer={startSleepTimer}
              onCancelSleepTimer={cancelSleepTimer}
            />
          )}

          {view === 'queue' && (
            <QueueView
              queue={roomState.queue}
              onPlay={playFile}
              onRemove={(item) => void removeFromQueue(item.id)}
              onClear={() => void clearQueue()}
            />
          )}

          {view === 'upload' && (
            <UploadView inputRef={fileInputRef} upload={upload} onFiles={uploadFiles} />
          )}

          {view === 'room' && (
            <RoomView status={status} onRefresh={() => void loadStatus()} />
          )}
        </AnimatePresence>
      </main>

      <BottomDock
        view={view}
        setView={changeView}
        file={currentFile}
        isPlaying={isPlaying}
        queueCount={roomState.queue.length}
        progress={progress}
        onToggle={togglePlay}
        onSkip={skip}
        onOpenPlayer={() => setIsPlayerOpen(true)}
        shuffle={shuffle}
        repeat={repeat}
      />

      <AnimatePresence>
        {isPlayerOpen && (
          <FullscreenPlayer
            file={currentFile}
            isPlaying={isPlaying}
            currentTime={currentTime}
            duration={duration}
            progress={progress}
            onClose={() => setIsPlayerOpen(false)}
            onToggle={togglePlay}
            onSkip={skip}
            onSeek={seek}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function LoginView({token, error, setToken, onLogin}: {
  token: string;
  error: string;
  setToken: (value: string) => void;
  onLogin: (event: React.FormEvent) => void;
}) {
  return (
    <main className="app-shell flex min-h-screen items-center justify-center px-4 py-8">
      <motion.section initial={{opacity: 0, y: 18}} animate={{opacity: 1, y: 0}} className="w-full max-w-md">
        <div className="mb-6 flex items-center gap-3">
          <div className="brand-mark">
            <Headphones className="h-7 w-7" />
          </div>
          <div>
            <p className="text-sm font-bold text-mint">StreamSync</p>
            <h1 className="text-2xl font-black leading-tight">Privater Musikraum</h1>
          </div>
        </div>

        <form onSubmit={onLogin} className="surface p-5">
          <img src="/icon.svg" alt="" className="mb-5 h-20 w-20 rounded-lg object-cover" />
          <h2 className="text-2xl font-black leading-tight">Sicher rein, sofort hoeren.</h2>
          <p className="mt-2 text-sm leading-6 text-muted">Dein lokaler Raum bleibt privat. Wer den Schluessel kennt, kann im Netzwerk streamen und Musik teilen.</p>

          <label className="mb-2 mt-6 block text-sm font-bold text-muted" htmlFor="token">Gruppenschluessel</label>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" />
            <input
              id="token"
              type="password"
              value={token}
              onChange={(event) => setToken(event.target.value)}
              autoFocus
              className="touch-input pl-12"
              placeholder="lokaler Gruppen-Key"
            />
          </div>

          {error && (
            <p className="mt-3 flex items-center gap-2 text-sm text-red">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </p>
          )}

          <button className="primary-button mt-5 w-full">
            Raum betreten
          </button>
        </form>
      </motion.section>
    </main>
  );
}

function Header({status, onLogout}: {status: ApiStatus | null; onLogout: () => void}) {
  return (
    <header className="sticky top-0 z-30 border-b border-line/80 bg-night/88 px-4 py-3 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="brand-mark h-10 w-10">
            <Disc3 className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-black">StreamSync</h1>
            <p className="truncate text-xs text-muted">{status?.roomName ?? 'Lokaler Raum'}</p>
          </div>
        </div>
        <button onClick={onLogout} className="icon-button" aria-label="Abmelden">
          <LogOut className="h-5 w-5" />
        </button>
      </div>
    </header>
  );
}

function NowPlayingHero({file, isPlaying, currentTime, duration, progress, onToggle, onSkip, onSeek, shuffle, repeat, volume, onShuffle, onRepeat, onVolume}: {
  file: ApiFile | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  progress: number;
  onToggle: () => void;
  onSkip: (offset: number) => void;
  onSeek: (value: number) => void;
  shuffle: boolean;
  repeat: 'off' | 'all' | 'one';
  volume: number;
  onShuffle: () => void;
  onRepeat: () => void;
  onVolume: (value: number) => void;
}) {
  return (
    <section className="surface overflow-hidden p-4 sm:p-5">
      <div className="grid gap-4 sm:grid-cols-[12rem_1fr] sm:items-end">
        <div className="cover-wrap mx-auto w-full max-w-56 sm:mx-0 relative group">
          <img src={coverUrl(file, token)} alt="" className="cover-art" />
          <button
            onClick={onToggle}
            disabled={!file}
            className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm"
          >
            {isPlaying ? <Pause className="h-12 w-12" /> : <Play className="h-12 w-12 fill-current" />}
          </button>
        </div>

        <div className="min-w-0">
          <p className="mb-2 text-sm font-bold text-mint">Jetzt laeuft</p>
          <h2 className="line-clamp-2 text-3xl font-black leading-tight sm:text-5xl">
            {file?.title ?? 'Waehle den ersten Track'}
          </h2>
          <p className="mt-2 truncate text-sm text-muted">
            {file ? trackMeta(file) : 'Lege Musik ab oder teile direkt aus dem Raum.'}
          </p>

          <div className="mt-5">
            <input
              type="range"
              min="0"
              max="100"
              value={Number.isFinite(progress) ? progress : 0}
              onChange={(event) => onSeek(Number(event.target.value))}
              className="seek-slider"
              aria-label="Position"
            />
            <div className="mt-2 flex justify-between text-xs font-bold text-muted">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          <div className="mt-5 flex items-center justify-center sm:justify-start gap-2">
            <button
              onClick={onShuffle}
              className={`round-button ${shuffle ? 'text-mint border-mint' : ''}`}
              aria-label="Zufallswiedergabe"
            >
              <Shuffle className="h-4 w-4" />
            </button>
            <button onClick={() => onSkip(-1)} className="round-button" aria-label="Zurueck">
              <SkipBack className="h-5 w-5" />
            </button>
            <button onClick={onToggle} disabled={!file} className="play-button" aria-label={isPlaying ? 'Pausieren' : 'Abspielen'}>
              {isPlaying ? <Pause className="h-8 w-8" /> : <Play className="h-8 w-8 fill-current" />}
            </button>
            <button onClick={() => onSkip(1)} className="round-button" aria-label="Weiter">
              <SkipForward className="h-5 w-5" />
            </button>
            <button
              onClick={onRepeat}
              className={`round-button ${repeat !== 'off' ? 'text-mint border-mint' : ''}`}
              aria-label="Wiederholen"
            >
              {repeat === 'one' ? <Repeat1 className="h-4 w-4" /> : <Repeat className="h-4 w-4" />}
            </button>

            <div className="ml-3 flex items-center gap-2">
              <Volume2 className="h-4 w-4 text-muted" />
              <input
                type="range"
                min="0"
                max="100"
                value={volume * 100}
                onChange={(event) => onVolume(Number(event.target.value) / 100)}
                className="w-20 h-1 accent-mint"
                aria-label="Lautstaerke"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function QuickStats({status, fileCount}: {status: ApiStatus | null; fileCount: number}) {
  return (
    <section className="grid grid-cols-3 gap-2">
      <Stat icon={<Users className="h-4 w-4" />} label="Limit" value={`${status?.maxPeers ?? 50}`} />
      <Stat icon={<Wifi className="h-4 w-4" />} label="Live" value={`${status?.livePeers ?? 0}`} />
      <Stat icon={<FileAudio className="h-4 w-4" />} label="Tracks" value={`${fileCount}`} />
    </section>
  );
}

function Stat({icon, label, value}: {icon: React.ReactNode; label: string; value: string}) {
  return (
    <div className="surface-quiet px-3 py-3">
      <div className="mb-2 text-mint">{icon}</div>
      <p className="text-[11px] font-bold text-muted">{label}</p>
      <p className="truncate text-sm font-black">{value}</p>
    </div>
  );
}

function LibraryView({files, query, setQuery, currentFile, isPlaying, likedIds, onPlay, onLike, onQueue, onRefresh, onOpenUpload}: {
  files: ApiFile[];
  query: string;
  setQuery: (value: string) => void;
  currentFile: ApiFile | null;
  isPlaying: boolean;
  likedIds: Set<string>;
  onPlay: (file: ApiFile) => void;
  onLike: (file: ApiFile) => void;
  onQueue: (file: ApiFile) => void;
  onRefresh: () => void;
  onOpenUpload: () => void;
}) {
  return (
    <motion.section initial={{opacity: 0, y: 12}} animate={{opacity: 1, y: 0}} exit={{opacity: 0, y: -12}} className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} className="touch-input pl-12" placeholder="Suchen" />
        </div>
        <button onClick={onRefresh} className="icon-button h-12 w-12" aria-label="Aktualisieren">
          <RefreshCcw className="h-5 w-5" />
        </button>
        <button onClick={onOpenUpload} className="icon-button h-12 w-12 bg-mint text-night" aria-label="Teilen">
          <Plus className="h-5 w-5" />
        </button>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-xl font-black">Bibliothek</h2>
        <p className="text-sm font-bold text-muted">{files.length} Dateien</p>
      </div>

      {files.length === 0 ? (
        <div className="empty-state">
          <Disc3 className="h-11 w-11 text-mint" />
          <h3 className="text-xl font-black">Noch nichts im Raum</h3>
          <p className="max-w-sm text-sm leading-6 text-muted">Lege Dateien in den Medienordner oder lade sie direkt ueber den Teilen-Tab hoch.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {files.map((file) => (
            <motion.div key={file.id} className="track-row" whileHover={{ scale: 1.01, backgroundColor: 'rgba(24, 32, 28, 0.8)' }} whileTap={{ scale: 0.99 }}>
              <button onClick={() => onPlay(file)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                <img src={coverUrl(file)} alt="" className="h-14 w-14 rounded-lg object-cover" />
                <div className="min-w-0 flex-1">
                <p className="truncate text-base font-black">{file.title}</p>
                <p className="mt-1 truncate text-xs font-bold text-muted">{trackMeta(file)}</p>
                </div>
              </button>
              <button onClick={() => onLike(file)} className={`track-play ${likedIds.has(file.id) ? 'is-liked' : ''}`} aria-label={likedIds.has(file.id) ? 'Like entfernen' : 'Liken'}>
                <Heart className="h-4 w-4" />
              </button>
              <button onClick={() => onQueue(file)} className={`track-play ${currentFile?.id === file.id && isPlaying ? 'is-playing' : ''}`} aria-label="Zur Queue hinzufuegen">
                <ListMusic className="h-4 w-4" />
              </button>
            </motion.div>
          ))}
        </div>
      )}
    </motion.section>
  );
}

function UploadView({inputRef, upload, onFiles}: {
  inputRef: React.RefObject<HTMLInputElement | null>;
  upload: UploadState;
  onFiles: (files: FileList | File[]) => void;
}) {
  return (
    <motion.section initial={{opacity: 0, y: 12}} animate={{opacity: 1, y: 0}} exit={{opacity: 0, y: -12}} className="space-y-4">
      <div
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          void onFiles(event.dataTransfer.files);
        }}
        className="upload-zone"
      >
        <Upload className="h-12 w-12 text-mint" />
        <h2 className="text-3xl font-black leading-tight">Teilen ohne Umwege</h2>
        <p className="max-w-md text-sm leading-6 text-muted">Audio oder Video auswaehlen. Die Dateien bleiben lokal und sind sofort im Raum verfuegbar.</p>
        <input ref={inputRef} type="file" multiple accept="audio/*,video/*" className="hidden" onChange={(event) => event.target.files && void onFiles(event.target.files)} />
        <button onClick={() => inputRef.current?.click()} className="primary-button">
          Dateien auswaehlen
        </button>
      </div>

      <div className="surface p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-black">Upload</h3>
          <span className="text-sm font-bold text-muted">{upload.progress}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-lg bg-line">
          <div className="h-full bg-mint transition-all duration-300" style={{width: `${upload.progress}%`}} />
        </div>
        <p className="mt-3 flex items-center gap-2 text-sm font-bold text-muted">
          {upload.active ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4 text-mint" />}
          {upload.message || 'Bereit fuer deine Musik.'}
        </p>
      </div>
    </motion.section>
  );
}

function QueueView({queue, onPlay, onRemove, onClear}: {
  queue: QueueItem[];
  onPlay: (file: ApiFile) => void;
  onRemove: (item: QueueItem) => void;
  onClear: () => void;
}) {
  return (
    <motion.section initial={{opacity: 0, y: 12}} animate={{opacity: 1, y: 0}} exit={{opacity: 0, y: -12}} className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-mint">Gemeinsam hoeren</p>
          <h2 className="text-2xl font-black">Queue</h2>
        </div>
        <button onClick={onClear} disabled={queue.length === 0} className="icon-button" aria-label="Queue leeren">
          <Trash2 className="h-5 w-5" />
        </button>
      </div>

      {queue.length === 0 ? (
        <div className="empty-state">
          <ListMusic className="h-11 w-11 text-mint" />
          <h3 className="text-xl font-black">Die Queue ist frei</h3>
          <p className="max-w-sm text-sm leading-6 text-muted">Fuege Tracks aus der Bibliothek hinzu. Alle verbundenen Geraete sehen die Aenderung live.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {queue.map((item, index) => (
            <motion.div key={item.id} className="track-row" whileHover={{ scale: 1.01, backgroundColor: 'rgba(24, 32, 28, 0.8)' }} whileTap={{ scale: 0.99 }}>
              <button onClick={() => onPlay(item.file)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-soft text-sm font-black text-mint">{index + 1}</div>
                <img src={coverUrl(item.file)} alt="" className="h-14 w-14 rounded-lg object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-black">{item.file.title}</p>
                  <p className="mt-1 truncate text-xs font-bold text-muted">{trackMeta(item.file)}</p>
                </div>
              </button>
              <button onClick={() => onRemove(item)} className="track-play" aria-label="Aus Queue entfernen">
                <Trash2 className="h-4 w-4" />
              </button>
            </motion.div>
          ))}
        </div>
      )}
    </motion.section>
  );
}

function RoomView({status, onRefresh}: {status: ApiStatus | null; onRefresh: () => void}) {
  return (
    <motion.section initial={{opacity: 0, y: 12}} animate={{opacity: 1, y: 0}} exit={{opacity: 0, y: -12}} className="space-y-4">
      <div className="surface p-5">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-mint">Raum</p>
            <h2 className="text-2xl font-black">{status?.roomName ?? 'StreamSync'}</h2>
          </div>
          <button onClick={onRefresh} className="icon-button" aria-label="Status aktualisieren">
            <RefreshCcw className="h-5 w-5" />
          </button>
        </div>
        <dl className="space-y-3 text-sm">
          <InfoRow label="Host" value={status?.host ?? 'lokal'} />
          <InfoRow label="Live" value={`${status?.livePeers ?? 0} verbunden`} />
          <InfoRow label="Maximal" value={`${status?.maxPeers ?? 50} Personen`} />
          <InfoRow label="Speicherort" value={status?.mediaPath ?? 'media'} />
          <InfoRow label="Daten" value={status?.dataPath ?? 'data'} />
        </dl>
      </div>

      <div className="space-y-2">
        <TrustRow icon={<Shield className="h-5 w-5" />} text="Token-Pflicht fuer API, Uploads und Streams." />
        <TrustRow icon={<Lock className="h-5 w-5" />} text="Dateien bleiben auf diesem Rechner." />
        <TrustRow icon={<Users className="h-5 w-5" />} text="Fuer private Gruppen im eigenen Netzwerk gebaut." />
      </div>
    </motion.section>
  );
}

function InfoRow({label, value}: {label: string; value: string}) {
  return (
    <div className="flex justify-between gap-4 border-b border-line pb-3 last:border-b-0">
      <dt className="text-muted">{label}</dt>
      <dd className="min-w-0 truncate text-right font-bold">{value}</dd>
    </div>
  );
}

function TrustRow({icon, text}: {icon: React.ReactNode; text: string}) {
  return (
    <div className="surface-quiet flex items-center gap-3 p-4 text-sm font-bold text-muted">
      <div className="text-mint">{icon}</div>
      <p>{text}</p>
    </div>
  );
}

function BottomDock({view, setView, file, isPlaying, queueCount, progress, onToggle, onSkip, onOpenPlayer, shuffle, repeat}: {
  view: View;
  setView: (view: View) => void;
  file: ApiFile | null;
  isPlaying: boolean;
  queueCount: number;
  progress: number;
  onToggle: () => void;
  onSkip: (offset: number) => void;
  onOpenPlayer: () => void;
  shuffle: boolean;
  repeat: 'off' | 'all' | 'one';
}) {
  return (
    <footer className="bottom-dock">
      <div className="dock-container">
        {file && (
          <motion.div
            className="dock-player cursor-pointer"
            role="button"
            tabIndex={0}
            onClick={onOpenPlayer}
            onKeyDown={(event) => event.key === 'Enter' && onOpenPlayer()}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <div className="relative">
              <img src={coverUrl(file)} alt="" className="h-14 w-14 rounded-xl object-cover shadow-lg" />
              <div className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-mint text-night">
                {isPlaying ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3 fill-current" />}
              </div>
            </div>
            <div className="min-w-0 flex-1 px-2">
              <p className="truncate text-sm font-bold">{file.title}</p>
              <p className="truncate text-xs text-muted">{trackMeta(file)}</p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-soft">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-mint to-cyan-400"
                  style={{ width: `${progress}%` }}
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            </div>
            <div className="flex items-center gap-1">
              {shuffle && <Shuffle className="h-3 w-3 text-mint" />}
              {repeat !== 'off' && <Repeat className={`h-3 w-3 ${repeat === 'one' ? 'text-mint' : 'text-muted'}`} />}
              <button onClick={(event) => { event.stopPropagation(); onSkip(-1); }} className="mini-button" aria-label="Zurueck">
                <SkipBack className="h-4 w-4" />
              </button>
              <button onClick={(event) => { event.stopPropagation(); onToggle(); }} className="mini-button bg-mint text-night" aria-label={isPlaying ? 'Pausieren' : 'Abspielen'}>
                {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 fill-current" />}
              </button>
            </div>
          </motion.div>
        )}

        <nav className="dock-nav" aria-label="Hauptnavigation">
          <NavButton active={view === 'library'} onClick={() => setView('library')} icon={<Home className="h-5 w-5" />} label="Start" />
          <NavButton active={view === 'discover'} onClick={() => setView('discover')} icon={<Compass className="h-5 w-5" />} label="Entdecken" />
          <NavButton active={view === 'charts'} onClick={() => setView('charts')} icon={<BarChart3 className="h-5 w-5" />} label="Charts" />
          <NavButton active={view === 'playlists'} onClick={() => setView('playlists')} icon={<ListMusic className="h-5 w-5" />} label="Playlists" />
          <NavButton active={view === 'settings'} onClick={() => setView('settings')} icon={<Settings className="h-5 w-5" />} label="Einstell." />
          <NavButton active={view === 'queue'} onClick={() => setView('queue')} icon={<ListMusic className="h-5 w-5" />} label={`Queue ${queueCount}`} />
          <NavButton active={view === 'albums'} onClick={() => setView('albums')} icon={<Disc className="h-5 w-5" />} label="Alben" />
          <NavButton active={view === 'artists'} onClick={() => setView('artists')} icon={<User className="h-5 w-5" />} label="Kuenstler" />
        </nav>
      </div>
    </footer>
  );
}

function trackMeta(file: ApiFile) {
  const artist = file.artist?.trim();
  const album = file.album?.trim();
  const type = file.kind === 'audio' ? 'Audio' : 'Video';
  const duration = file.durationLabel ? `${file.durationLabel} - ` : '';

  if (artist && album) return `${artist} - ${album} - ${duration}${file.sizeLabel}`;
  if (artist) return `${artist} - ${duration}${file.sizeLabel}`;
  return `${type} - ${duration}${file.sizeLabel}`;
}

function FullscreenPlayer({file, isPlaying, currentTime, duration, progress, onClose, onToggle, onSkip, onSeek}: {
  file: ApiFile | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  progress: number;
  onClose: () => void;
  onToggle: () => void;
  onSkip: (offset: number) => void;
  onSeek: (value: number) => void;
}) {
  return (
    <motion.section
      className="player-sheet"
      initial={{opacity: 0, y: 80}}
      animate={{opacity: 1, y: 0}}
      exit={{opacity: 0, y: 80}}
      transition={{type: 'spring', damping: 28, stiffness: 260}}
    >
      <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col px-5 pb-8 pt-4 relative">
        <div className="absolute inset-0 -z-10 overflow-hidden rounded-3xl pointer-events-none">
          <motion.img
            src={coverUrl(file)}
            className="h-full w-full object-cover blur-3xl scale-110 opacity-40"
            animate={{ scale: [1.1, 1.2, 1.1] }}
            transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-night/20 via-night/60 to-night" />
        </div>

        <div className="mb-5 flex items-center justify-between relative z-10">
          <button onClick={onClose} className="icon-button bg-soft/50" aria-label="Player schliessen">
            <X className="h-5 w-5" />
          </button>
          <p className="text-sm font-black text-muted uppercase tracking-widest">Jetzt abspielen</p>
          <div className="h-11 w-11" />
        </div>

        <div className="flex flex-1 flex-col justify-center relative z-10">
          <div className="cover-wrap mx-auto w-full max-w-sm shadow-2xl transition-transform duration-500 hover:scale-[1.02]">
            <img src={coverUrl(file)} alt="" className="cover-art" />
          </div>

          <div className="mt-12 text-center">
            <p className="mb-2 text-sm font-bold text-mint uppercase tracking-wider">{file?.artist || 'Privater Raum'}</p>
            <h2 className="line-clamp-2 text-5xl font-black leading-tight tracking-tight">{file?.title ?? 'Kein Track ausgewaehlt'}</h2>
            <p className="mt-4 truncate text-lg font-medium text-muted opacity-80">{file ? trackMeta(file) : 'Waehle Musik aus deiner Bibliothek.'}</p>
          </div>

          <div className="mt-12 max-w-md mx-auto w-full">
            <input
              type="range"
              min="0"
              max="100"
              value={Number.isFinite(progress) ? progress : 0}
              onChange={(event) => onSeek(Number(event.target.value))}
              className="seek-slider"
              aria-label="Position"
            />
            <div className="mt-3 flex justify-between text-xs font-bold text-muted px-1">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          <div className="mt-12 flex items-center justify-center gap-8">
            <button onClick={() => onSkip(-1)} className="round-button h-16 w-16 bg-soft/40 backdrop-blur-md" aria-label="Zurueck">
              <SkipBack className="h-7 w-7" />
            </button>
            <button onClick={onToggle} disabled={!file} className="play-button h-24 w-24 shadow-2xl scale-110" aria-label={isPlaying ? 'Pausieren' : 'Abspielen'}>
              {isPlaying ? <Pause className="h-12 w-12" /> : <Play className="h-12 w-12 fill-current" />}
            </button>
            <button onClick={() => onSkip(1)} className="round-button h-16 w-16 bg-soft/40 backdrop-blur-md" aria-label="Weiter">
              <SkipForward className="h-7 w-7" />
            </button>
          </div>
        </div>
      </div>
    </motion.section>
  );
}

function NavButton({active, onClick, icon, label}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button onClick={onClick} className={`dock-nav-button ${active ? 'is-active' : ''}`}>
      {icon}
      <span>{label}</span>
    </button>
  );
}
