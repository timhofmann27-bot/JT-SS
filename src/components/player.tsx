import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  ChevronDown,
  Heart,
  ThumbsDown,
  ListMusic,
  ListOrdered,
  Moon,
  MoreHorizontal,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Share2,
  X,
  Download,
  ListPlus,
  Plus,
  Check,
  HardDriveDownload,
  WifiOff,
  Trash2,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import type { ApiFile, QueueItem, Playlist } from '../types';
import { coverUrl } from '../lib/api';
import { formatTime, trackArtist, trackSubtitle, hueFromString } from '../lib/format';
import { extractDominantColor } from '../lib/colorExtract';

/* ═══════════════════════════════════════════════════════
   YouTube Music-style Fullscreen Player (2026 Redesign)
   ═══════════════════════════════════════════════════════ */
export function FullscreenPlayer({
  file,
  token,
  isPlaying,
  currentTime,
  duration,
  progress,
  volume,
  shuffle,
  repeat,
  liked,
  queue,
  onClose,
  onToggle,
  onSkip,
  onSeek,
  onVolume,
  onShuffle,
  onRepeat,
  onToggleLike,
  onShare,
  onOpenQueue,
  onAddToQueue,
  onPlayFromQueue,
  playlists,
  onAddToPlaylist,
  onCreatePlaylist,
  isOffline,
  onDownloadOffline,
  onDeleteOffline,
}: {
  file: ApiFile | null;
  token: string;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  progress: number;
  volume: number;
  shuffle: boolean;
  repeat: 'off' | 'all' | 'one';
  liked: boolean;
  queue?: QueueItem[];
  onClose: () => void;
  onToggle: () => void;
  onSkip: (offset: number) => void;
  onSeek: (value: number) => void;
  onVolume: (v: number) => void;
  onShuffle: () => void;
  onRepeat: () => void;
  onToggleLike: () => void;
  onShare: () => void;
  onOpenQueue: () => void;
  onAddToQueue: (file: ApiFile) => void;
  onPlayFromQueue?: (file: ApiFile) => void;
  playlists?: Playlist[];
  onAddToPlaylist?: (playlistId: string) => void;
  onCreatePlaylist?: () => void;
  isOffline: boolean;
  onDownloadOffline?: (file: ApiFile) => void;
  onDeleteOffline?: (file: ApiFile) => void;
}) {
  const [showMore, setShowMore] = useState(false);
  const [showPlaylistSub, setShowPlaylistSub] = useState(false);
  const [addedPlaylistId, setAddedPlaylistId] = useState<string | null>(null);
  const [sleeptimerEnd, setSleeptimerEnd] = useState<number | null>(null);
  const [showSleeptimer, setShowSleeptimer] = useState(false);
  const [sleeptimerRemaining, setSleeptimerRemaining] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [isSeeking, setIsSeeking] = useState(false);
  const [isDraggingVolume, setIsDraggingVolume] = useState(false);
  const [ambientColor, setAmbientColor] = useState('#1a1a2e');
  const isPlayingRef = useRef(isPlaying);
  const onToggleRef = useRef(onToggle);
  const hue = file ? hueFromString(file.album || file.artist || file.title) : '#FF0000';
  
  // Extract dominant color from cover art for ambient background
  useEffect(() => {
    if (!file) return;
    const url = coverUrl(file, { token, artist: file?.artist, album: file?.album });
    extractDominantColor(url).then(setAmbientColor);
  }, [file?.id, file?.hasArtwork, token]);

  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);
  useEffect(() => { onToggleRef.current = onToggle; }, [onToggle]);

  useEffect(() => {
    if (sleeptimerEnd === null) { setSleeptimerRemaining(null); return; }
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((sleeptimerEnd - Date.now()) / 1000));
      setSleeptimerRemaining(remaining);
      if (remaining <= 0) { setSleeptimerEnd(null); if (isPlayingRef.current) onToggleRef.current(); }
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [sleeptimerEnd]);

  const handleSleeptimerSet = (minutes: number) => {
    setSleeptimerEnd(Date.now() + minutes * 60 * 1000);
    setSleeptimerRemaining(minutes * 60);
    setShowSleeptimer(false);
    setToast(`Sleeptimer: ${minutes} Min`);
    setTimeout(() => setToast(null), 2500);
  };

  const handleDownload = useCallback(() => {
    if (!file) return;
    if (isOffline) {
      // Already cached — offer to remove
      onDeleteOffline?.(file);
    } else {
      // Download to IndexedDB for offline playback
      onDownloadOffline?.(file);
    }
    setShowMore(false);
  }, [file, isOffline, onDownloadOffline, onDeleteOffline]);

  const remainingTime = duration > 0 ? duration - currentTime : 0;
  const queuePreview = (queue || []).slice(0, 3);

  return (
    <motion.div
      className="ytm-player"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
    >
      {/* Background layers */}
      <div className="ytm-bg">
        <div className="ytm-bg-layer" style={{ background: `radial-gradient(ellipse 80% 50% at 50% 30%, ${ambientColor}33 0%, transparent 70%)` }} />
        {file?.hasArtwork && (
          <div className="ytm-bg-blur" style={{ backgroundImage: `url(${coverUrl(file, { token, artist: file?.artist, album: file?.album })})` }} />
        )}
        <div className="ytm-bg-gradient" style={{ background: `linear-gradient(180deg, ${ambientColor}22 0%, #0f0f0f 55%, #0f0f0f 100%)` }} />
      </div>

      {/* Header */}
      <header className="ytm-header">
        <button onClick={onClose} className="ytm-close-btn" aria-label="Schliessen">
          <ChevronDown className="h-6 w-6" />
        </button>
        <div className="ytm-header-center">
          {sleeptimerEnd && sleeptimerRemaining !== null ? (
            <span className="ytm-sleeptimer-badge" onClick={(e) => { e.stopPropagation(); handleSleeptimerCancel(); }}>
              🌙 {formatTime(sleeptimerRemaining)} <X className="h-3 w-3 ml-1" />
            </span>
          ) : (
            <span className="ytm-header-label">WIRD ABGESPIELT</span>
          )}
        </div>
        <div className="ytm-header-actions">
          <button onClick={() => setShowSleeptimer(true)} className="ytm-icon-btn" aria-label="Sleeptimer">
            <Moon className="h-5 w-5" />
          </button>
          <button onClick={onOpenQueue} className="ytm-icon-btn" aria-label="Warteschlange">
            <ListOrdered className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* Middle Content — fills available space, vertically centered */}
      <div className="ytm-content">

        {/* Cover Art — smooth crossfade */}
        <div className="ytm-cover-wrapper">
        <AnimatePresence mode="wait">
          <motion.div
            key={file?.id || 'empty'}
            className="ytm-cover"
            style={{ boxShadow: `0 4px 40px ${ambientColor}30, 0 16px 80px rgba(0,0,0,0.5)` }}
            initial={{ scale: 0.92, opacity: 0, filter: 'blur(8px)' }}
            animate={{ scale: 1, opacity: 1, filter: 'blur(0px)' }}
            exit={{ scale: 1.05, opacity: 0, filter: 'blur(12px)' }}
            transition={{ duration: 0.5, ease: [0.32, 0.72, 0, 1] }}
          >
          {file ? (
            <img src={coverUrl(file, { token, artist: file?.artist, album: file?.album })} alt="" className="ytm-cover-img" />
          ) : (
            <div className="ytm-cover-placeholder"><ListMusic className="h-16 w-16 text-white/10" /></div>
          )}
        </motion.div>
        </AnimatePresence>
      </div>

      {/* Track Info */}
      <div className="ytm-track-info">
        <motion.h1
          key={file?.id}
          initial={{ y: 8, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.05 }}
          className="ytm-title"
        >
          {file?.title ?? 'Kein Titel'}
          {isOffline && <WifiOff className="ytm-offline-badge" aria-label="Offline verfügbar" />}
        </motion.h1>
        <motion.p
          key={`sub-${file?.id}`}
          initial={{ y: 6, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.08 }}
          className="ytm-artist"
        >
          {file ? trackSubtitle(file) : ''}
        </motion.p>
      </div>

      {/* Action Buttons Row */}
      <div className="ytm-actions">
        <motion.button
          onClick={onToggleLike}
          className={`ytm-action-btn ${liked ? 'is-active' : ''}`}
          aria-label={liked ? 'Aus Favoriten' : 'Favorit'}
          whileTap={{ scale: 0.85 }}
        >
          <Heart className={`h-6 w-6 ${liked ? 'fill-current' : ''}`} />
        </motion.button>

        <button className="ytm-action-btn" aria-label="Nicht gefallen" onClick={() => {/* dislike stub */}}>
          <ThumbsDown className="h-5 w-5" />
        </button>

        <motion.button
          onClick={() => { if (file) onAddToQueue(file); setToast('Zur Warteschlange hinzugefügt'); setTimeout(() => setToast(null), 2500); }}
          className="ytm-action-btn"
          aria-label="Zur Warteschlange"
          whileTap={{ scale: 0.85 }}
        >
          <ListPlus className="h-5 w-5" />
        </motion.button>

        <div style={{ position: 'relative' }}>
          <button onClick={() => setShowMore(!showMore)} className="ytm-action-btn" aria-label="Mehr">
            <MoreHorizontal className="h-5 w-5" />
          </button>
          <AnimatePresence>
            {showMore && (
              <>
                <div className="ytm-overlay" onClick={() => setShowMore(false)} />
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 4, scale: 0.95 }}
                  className="ytm-menu"
                >
                  <button className="ytm-menu-item" onClick={handleDownload}>
                    {isOffline ? (
                      <><Trash2 className="h-4 w-4" /> Aus Offline-Speicher entfernen</>
                    ) : (
                      <><HardDriveDownload className="h-4 w-4" /> Offline speichern</>
                    )}
                  </button>
                  <button className="ytm-menu-item" onClick={() => { onShare(); setShowMore(false); }}>
                    <Share2 className="h-4 w-4" /> Teilen
                  </button>
                  {playlists && playlists.length > 0 && onAddToPlaylist && (
                    <div style={{ position: 'relative' }}>
                      <button className="ytm-menu-item" onClick={() => setShowPlaylistSub(!showPlaylistSub)}>
                        <ListMusic className="h-4 w-4" /> Zu Playlist <span style={{ marginLeft: 'auto', opacity: 0.4 }}>›</span>
                      </button>
                      <AnimatePresence>
                        {showPlaylistSub && (
                          <motion.div
                            initial={{ opacity: 0, y: -4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -4 }}
                            className="ytm-submenu"
                          >
                            {playlists.map((pl) => (
                              <button
                                key={pl.id}
                                className={`ytm-submenu-item ${addedPlaylistId === pl.id ? 'is-added' : ''}`}
                                onClick={() => {
                                  onAddToPlaylist(pl.id); setAddedPlaylistId(pl.id);
                                  setShowPlaylistSub(false); setShowMore(false);
                                  setToast(`Zu „${pl.name}" hinzugefügt`);
                                  setTimeout(() => { setToast(null); setAddedPlaylistId(null); }, 2500);
                                }}
                              >
                                <span>{pl.name}</span>
                                {addedPlaylistId === pl.id && <Check className="h-4 w-4 text-green-500" />}
                              </button>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}
                  {onCreatePlaylist && (
                    <button className="ytm-menu-item" onClick={() => { onCreatePlaylist(); setShowMore(false); }}>
                      <Plus className="h-4 w-4" /> Neue Playlist
                    </button>
                  )}
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>
      </div>{/* end ytm-content */}

      {/* Bottom Controls — pinned to bottom */}
      <div className="ytm-footer">

      {/* Seek Bar — thick, YTM-style */}
      <div className="ytm-seek">
        <div
          className={`ytm-seek-bar ${isSeeking ? 'is-seeking' : ''}`}
          onPointerDown={(e) => { setIsSeeking(true); handleSeekFromEvent(e); }}
          onPointerMove={(e) => { if (isSeeking) handleSeekFromEvent(e); }}
          onPointerUp={() => setIsSeeking(false)}
          onPointerLeave={() => setIsSeeking(false)}
        >
          <div className="ytm-seek-track">
            <div className="ytm-seek-fill" style={{ width: `${progress}%` }} />
            <div className="ytm-seek-thumb" style={{ left: `${progress}%`, opacity: isSeeking ? 1 : undefined }} />
          </div>
        </div>
        <div className="ytm-times">
          <span>{formatTime(currentTime)}</span>
          <span>-{formatTime(remainingTime)}</span>
        </div>
      </div>

      {/* Transport Controls */}
      <div className="ytm-controls">
        <button onClick={onShuffle} className={`ytm-ctrl-btn ${shuffle ? 'is-active' : ''}`} aria-label="Shuffle">
          <Shuffle className="h-5 w-5" />
        </button>
        <button onClick={() => onSkip(-1)} className="ytm-ctrl-btn" aria-label="Zurück">
          <SkipBack className="h-7 w-7 fill-current" />
        </button>
        <motion.button
          onClick={onToggle}
          disabled={!file}
          className="ytm-play-btn"
          aria-label={isPlaying ? 'Pause' : 'Play'}
          whileTap={{ scale: 0.9 }}
        >
          {isPlaying ? <Pause className="h-10 w-10 fill-current" /> : <Play className="h-10 w-10 fill-current ml-1" />}
        </motion.button>
        <button onClick={() => onSkip(1)} className="ytm-ctrl-btn" aria-label="Weiter">
          <SkipForward className="h-7 w-7 fill-current" />
        </button>
        <button onClick={onRepeat} className={`ytm-ctrl-btn ${repeat !== 'off' ? 'is-active' : ''}`} aria-label="Repeat">
          {repeat === 'one' ? <Repeat1 className="h-5 w-5" /> : <Repeat className="h-5 w-5" />}
        </button>
      </div>

      {/* Up Next — Queue Preview */}
      {queuePreview.length > 0 && (
        <div className="ytm-upnext">
          <div className="ytm-upnext-header" onClick={onOpenQueue}>
            <span>Als Nächstes</span>
            <ChevronDown className="h-4 w-4 rotate-[-90deg]" />
          </div>
          {queuePreview.map((item) => (
            <div key={item.id} className="ytm-upnext-item" onClick={() => onPlayFromQueue?.(item.file)}>
              <img src={coverUrl(item.file, { token, artist: item.file?.artist, album: item.file?.album })} alt="" className="ytm-upnext-cover" />
              <div className="ytm-upnext-info">
                <p className="ytm-upnext-title">{item.file.title}</p>
                <p className="ytm-upnext-sub">{trackArtist(item.file)}</p>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); onAddToQueue(item.file); setToast('Zur Warteschlange'); setTimeout(() => setToast(null), 2500); }}
                className="ytm-upnext-add"
                aria-label="Erneut hinzufügen"
              >
                <ListPlus className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Volume (bottom) */}
      <div className="ytm-volume-row">
        <button onClick={() => onVolume(volume > 0 ? 0 : 0.5)} className="ytm-icon-btn" aria-label="Volume">
          {volume === 0 ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
        </button>
        <div
          className={`ytm-volume-bar ${isDraggingVolume ? 'is-dragging' : ''}`}
          onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); setIsDraggingVolume(true); handleVolumeFromEvent(e); }}
          onPointerMove={(e) => { if (isDraggingVolume) handleVolumeFromEvent(e); }}
          onPointerUp={() => setIsDraggingVolume(false)}
          onPointerLeave={() => setIsDraggingVolume(false)}
        >
          <div className="ytm-volume-fill" style={{ width: `${volume * 100}%` }} />
        </div>
      </div>

      </div>{/* end ytm-footer */}

      {/* Sleeptimer Modal */}
      <AnimatePresence>
        {showSleeptimer && (
          <motion.div className="ytm-overlay ytm-overlay-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowSleeptimer(false)}>
            <motion.div className="ytm-sleeptimer-modal" initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }} onClick={(e) => e.stopPropagation()}>
              <h3>🌙 Sleeptimer</h3>
              <div className="ytm-sleeptimer-grid">
                {[15, 30, 45, 60, 90, 120].map((min) => (
                  <button key={min} onClick={() => handleSleeptimerSet(min)}>{min} Min</button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="ytm-toast">
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );

  function handleSeekFromEvent(e: React.PointerEvent) {
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    onSeek(pct);
  }

  function handleVolumeFromEvent(e: React.PointerEvent) {
    const rect = e.currentTarget.getBoundingClientRect();
    const v = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    onVolume(v);
  }
}

/* ═══════════════════════════════════════════════════════
   Queue Sheet (right-side drawer)
   ═══════════════════════════════════════════════════════ */
export function QueueSheet({
  open,
  current,
  queue,
  token,
  onClose,
  onPlay,
  onRemove,
  onClear,
}: {
  open: boolean;
  current: ApiFile | null;
  queue: QueueItem[];
  token: string;
  onClose: () => void;
  onPlay: (file: ApiFile) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
}) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div key="backdrop" className="queue-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.aside key="sheet" className="queue-sheet" initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 30, stiffness: 300 }}>
            <div className="queue-sheet-header">
              <h2 className="queue-sheet-title">Warteschlange</h2>
              <div className="queue-sheet-actions">
                <button onClick={onClear} disabled={queue.length === 0} className="queue-clear-btn">Leeren</button>
                <button onClick={onClose} className="ytm-icon-btn" aria-label="Schliessen"><X className="h-5 w-5" /></button>
              </div>
            </div>
            <div className="queue-content">
              {current && (
                <div className="queue-section">
                  <p className="queue-section-title">Aktuell</p>
                  <div className="queue-current-item">
                    <img src={coverUrl(current, { token, artist: current?.artist, album: current?.album })} alt="" className="queue-cover" />
                    <div className="queue-item-info">
                      <p className="queue-item-title">{current.title}</p>
                      <p className="queue-item-subtitle">{trackArtist(current)}</p>
                    </div>
                  </div>
                </div>
              )}
              {queue.length > 0 && (
                <div className="queue-section">
                  <p className="queue-section-title">Als nächstes</p>
                  <div className="queue-list">
                    {queue.map((item) => (
                      <div key={item.id} className="queue-item">
                        <button onClick={() => onPlay(item.file)} className="queue-item-btn">
                          <img src={coverUrl(item.file, { token, artist: item.file?.artist, album: item.file?.album })} alt="" className="queue-cover" />
                          <div className="queue-item-info">
                            <p className="queue-item-title">{item.file.title}</p>
                            <p className="queue-item-subtitle">{trackArtist(item.file)}</p>
                          </div>
                        </button>
                        <button onClick={() => onRemove(item.id)} className="queue-remove-btn" aria-label="Entfernen"><X className="h-4 w-4" /></button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {queue.length === 0 && !current && (
                <div className="queue-empty">
                  <ListMusic className="h-12 w-12 text-[#6a6a6a] mb-3" />
                  <p className="text-[#b3b3b3] font-semibold">Warteschlange ist leer</p>
                  <p className="text-[#6a6a6a] text-sm mt-1">Füge Titel hinzu, um sie als nächstes abzuspielen.</p>
                </div>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
