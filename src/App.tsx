import React, {useEffect, useMemo, useRef, useState} from 'react';
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
  Search,
  Shield,
  SkipBack,
  SkipForward,
  Upload,
  Trash2,
  Users,
  Wifi,
  X,
} from 'lucide-react';
import {AnimatePresence, motion} from 'motion/react';
import type {ApiFile, ApiStatus, QueueItem, RoomState, UploadState, View} from './types';

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

function coverUrl(file: ApiFile | null, token: string) {
  if (!file) return '/icon.svg';
  return apiUrl(`/api/art/${file.id}?token=${encodeURIComponent(token)}`);
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
  const audioRef = useRef<HTMLAudioElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isAuthenticated = token.length > 0;
  const authHeaders = useMemo(() => ({'x-share-token': token}), [token]);
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const likedIds = useMemo(() => new Set(roomState.likedIds), [roomState.likedIds]);

  const filteredFiles = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return files;
    return files.filter((file) => file.title.toLowerCase().includes(needle) || file.name.toLowerCase().includes(needle));
  }, [files, query]);

  async function loadStatus(activeToken = token) {
    const response = await fetch(apiUrl('/api/status'), {
      headers: activeToken ? {'x-share-token': activeToken} : undefined,
    });
    if (!response.ok) throw new Error('Status konnte nicht geladen werden.');
    setStatus(await response.json());
  }

  async function loadFiles(activeToken = token) {
    const response = await fetch(apiUrl('/api/files'), {headers: {'x-share-token': activeToken}});
    if (!response.ok) throw new Error('Bibliothek konnte nicht geladen werden.');
    const data = await response.json();
    setFiles(data.files);
    if (data.files.length > 0 && !currentFile) {
      setCurrentFile(data.files[0]);
    }
  }

  async function loadRoomState(activeToken = token) {
    const response = await fetch(apiUrl('/api/state'), {headers: {'x-share-token': activeToken}});
    if (!response.ok) throw new Error('Raumzustand konnte nicht geladen werden.');
    setRoomState(await response.json());
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

    const events = new EventSource(apiUrl(`/api/events?token=${encodeURIComponent(token)}`));
    events.addEventListener('state', (event) => {
      setRoomState(JSON.parse((event as MessageEvent).data));
    });
    events.onerror = () => {
      events.close();
    };

    return () => events.close();
  }, [isAuthenticated, token]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentFile) return;

    audio.src = apiUrl(`/api/stream/${currentFile.id}?token=${encodeURIComponent(token)}`);
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
    if (!('mediaSession' in navigator) || !currentFile) return;

    const artwork = [
      {src: coverUrl(currentFile, token), sizes: '512x512', type: currentFile.hasArtwork ? 'image/jpeg' : 'image/svg+xml'},
    ];

    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentFile.title,
      artist: currentFile.artist || 'JT-MP3',
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
    setIsPlaying(!isPlaying);
  }

  function skip(offset: number) {
    if (files.length === 0 || !currentFile) return;
    haptic();
    const index = files.findIndex((file) => file.id === currentFile.id);
    const nextIndex = (index + offset + files.length) % files.length;
    setCurrentFile(files[nextIndex]);
    setIsPlaying(true);
  }

  async function playNextFromQueue() {
    const next = roomState.queue[0];
    if (!next) {
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
        setUpload({active: false, progress: 0, message: `${file.name} konnte nicht hochgeladen werden.`});
        return;
      }
    }

    await loadFiles();
    haptic();
    setUpload({active: false, progress: 100, message: 'Bibliothek aktualisiert.'});
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
          token={token}
          isPlaying={isPlaying}
          currentTime={currentTime}
          duration={duration}
          progress={progress}
          onToggle={togglePlay}
          onSkip={skip}
          onSeek={seek}
        />

        <QuickStats status={status} fileCount={files.length} />

        <AnimatePresence mode="wait">
          {view === 'library' && (
            <LibraryView
              files={filteredFiles}
              query={query}
              setQuery={setQuery}
              currentFile={currentFile}
              token={token}
              isPlaying={isPlaying}
              likedIds={likedIds}
              onPlay={playFile}
              onLike={toggleLike}
              onQueue={addToQueue}
              onRefresh={() => void loadFiles()}
              onOpenUpload={() => changeView('upload')}
            />
          )}

          {view === 'queue' && (
            <QueueView
              queue={roomState.queue}
              token={token}
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
        token={token}
        isPlaying={isPlaying}
        queueCount={roomState.queue.length}
        progress={progress}
        onToggle={togglePlay}
        onSkip={skip}
        onOpenPlayer={() => setIsPlayerOpen(true)}
      />

      <AnimatePresence>
        {isPlayerOpen && (
          <FullscreenPlayer
            file={currentFile}
            token={token}
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
            <p className="text-sm font-bold text-mint">JT-MP3</p>
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
            <h1 className="truncate text-lg font-black">JT-MP3</h1>
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

function NowPlayingHero({file, token, isPlaying, currentTime, duration, progress, onToggle, onSkip, onSeek}: {
  file: ApiFile | null;
  token: string;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  progress: number;
  onToggle: () => void;
  onSkip: (offset: number) => void;
  onSeek: (value: number) => void;
}) {
  return (
    <section className="surface overflow-hidden p-4 sm:p-5">
      <div className="grid gap-4 sm:grid-cols-[12rem_1fr] sm:items-end">
        <div className="cover-wrap mx-auto w-full max-w-56 sm:mx-0">
          <img src={coverUrl(file, token)} alt="" className="cover-art" />
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

          <div className="mt-5 flex items-center justify-center gap-3 sm:justify-start">
            <button onClick={() => onSkip(-1)} className="round-button" aria-label="Zurueck">
              <SkipBack className="h-5 w-5" />
            </button>
            <button onClick={onToggle} disabled={!file} className="play-button" aria-label={isPlaying ? 'Pausieren' : 'Abspielen'}>
              {isPlaying ? <Pause className="h-8 w-8" /> : <Play className="h-8 w-8 fill-current" />}
            </button>
            <button onClick={() => onSkip(1)} className="round-button" aria-label="Weiter">
              <SkipForward className="h-5 w-5" />
            </button>
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

function LibraryView({files, query, setQuery, currentFile, token, isPlaying, likedIds, onPlay, onLike, onQueue, onRefresh, onOpenUpload}: {
  files: ApiFile[];
  query: string;
  setQuery: (value: string) => void;
  currentFile: ApiFile | null;
  token: string;
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
            <div key={file.id} className="track-row">
              <button onClick={() => onPlay(file)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                <img src={coverUrl(file, token)} alt="" className="h-14 w-14 rounded-lg object-cover" />
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
            </div>
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

function QueueView({queue, token, onPlay, onRemove, onClear}: {
  queue: QueueItem[];
  token: string;
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
            <div key={item.id} className="track-row">
              <button onClick={() => onPlay(item.file)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-soft text-sm font-black text-mint">{index + 1}</div>
                <img src={coverUrl(item.file, token)} alt="" className="h-14 w-14 rounded-lg object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-black">{item.file.title}</p>
                  <p className="mt-1 truncate text-xs font-bold text-muted">{trackMeta(item.file)}</p>
                </div>
              </button>
              <button onClick={() => onRemove(item)} className="track-play" aria-label="Aus Queue entfernen">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
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
            <h2 className="text-2xl font-black">{status?.roomName ?? 'JT-MP3'}</h2>
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

function BottomDock({view, setView, file, token, isPlaying, queueCount, progress, onToggle, onSkip, onOpenPlayer}: {
  view: View;
  setView: (view: View) => void;
  file: ApiFile | null;
  token: string;
  isPlaying: boolean;
  queueCount: number;
  progress: number;
  onToggle: () => void;
  onSkip: (offset: number) => void;
  onOpenPlayer: () => void;
}) {
  return (
    <footer className="bottom-dock">
      {file && (
        <div className="dock-player" role="button" tabIndex={0} onClick={onOpenPlayer} onKeyDown={(event) => event.key === 'Enter' && onOpenPlayer()}>
          <img src={coverUrl(file, token)} alt="" className="h-11 w-11 rounded-lg object-cover" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-black">{file.title}</p>
            <p className="truncate text-[11px] font-bold text-muted">{trackMeta(file)}</p>
            <div className="mt-2 h-1 overflow-hidden rounded-lg bg-line">
              <div className="h-full bg-mint" style={{width: `${progress}%`}} />
            </div>
          </div>
          <button onClick={(event) => { event.stopPropagation(); onSkip(-1); }} className="mini-button" aria-label="Zurueck">
            <SkipBack className="h-4 w-4" />
          </button>
          <button onClick={(event) => { event.stopPropagation(); onToggle(); }} className="mini-button bg-mint text-night" aria-label={isPlaying ? 'Pausieren' : 'Abspielen'}>
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 fill-current" />}
          </button>
        </div>
      )}

      <nav className="dock-nav" aria-label="Hauptnavigation">
        <NavButton active={view === 'library'} onClick={() => setView('library')} icon={<Library className="h-5 w-5" />} label="Musik" />
        <NavButton active={view === 'queue'} onClick={() => setView('queue')} icon={<ListMusic className="h-5 w-5" />} label={`Queue ${queueCount}`} />
        <NavButton active={view === 'upload'} onClick={() => setView('upload')} icon={<Plus className="h-5 w-5" />} label="Teilen" />
        <NavButton active={view === 'room'} onClick={() => setView('room')} icon={<Shield className="h-5 w-5" />} label="Raum" />
      </nav>
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

function FullscreenPlayer({file, token, isPlaying, currentTime, duration, progress, onClose, onToggle, onSkip, onSeek}: {
  file: ApiFile | null;
  token: string;
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
      <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col px-5 pb-8 pt-4">
        <div className="mb-5 flex items-center justify-between">
          <button onClick={onClose} className="icon-button" aria-label="Player schliessen">
            <X className="h-5 w-5" />
          </button>
          <p className="text-sm font-black text-muted">JT-MP3</p>
          <div className="h-11 w-11" />
        </div>

        <div className="flex flex-1 flex-col justify-center">
          <div className="cover-wrap mx-auto w-full max-w-sm">
            <img src={coverUrl(file, token)} alt="" className="cover-art" />
          </div>

          <div className="mt-8 text-center">
            <p className="mb-2 text-sm font-bold text-mint">{file?.artist || 'Privater Raum'}</p>
            <h2 className="line-clamp-2 text-4xl font-black leading-tight">{file?.title ?? 'Kein Track ausgewaehlt'}</h2>
            <p className="mt-3 truncate text-sm font-bold text-muted">{file ? trackMeta(file) : 'Waehle Musik aus deiner Bibliothek.'}</p>
          </div>

          <div className="mt-8">
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

          <div className="mt-8 flex items-center justify-center gap-5">
            <button onClick={() => onSkip(-1)} className="round-button h-14 w-14" aria-label="Zurueck">
              <SkipBack className="h-6 w-6" />
            </button>
            <button onClick={onToggle} disabled={!file} className="play-button h-20 w-20" aria-label={isPlaying ? 'Pausieren' : 'Abspielen'}>
              {isPlaying ? <Pause className="h-10 w-10" /> : <Play className="h-10 w-10 fill-current" />}
            </button>
            <button onClick={() => onSkip(1)} className="round-button h-14 w-14" aria-label="Weiter">
              <SkipForward className="h-6 w-6" />
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
