import React, { useState } from 'react';
import {
  ChevronDown,
  Disc3,
  Heart,
  ListMusic,
  ListOrdered,
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
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import type { ApiFile, QueueItem } from '../types';
import { coverUrl } from '../lib/api';
import { formatTime, trackArtist, trackSubtitle, hueFromString } from '../lib/format';

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
}) {
  const [showVolume, setShowVolume] = useState(false);
  const hue = file ? hueFromString(file.album || file.artist || file.title) : 'var(--color-brand)';

  return (
    <motion.div
      className="full-player"
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
    >
      <div className="full-player-bg" style={{ background: `radial-gradient(circle at 50% 30%, ${hue}30 0%, #000 80%)` }} />

      <header className="full-player-header">
        <button onClick={onClose} className="full-player-close" aria-label="Schliessen">
          <ChevronDown className="h-8 w-8" />
        </button>

        <div className="full-player-header-center">
          <span className="full-player-header-label">Wird abgespielt</span>
        </div>

        <button onClick={onOpenQueue} className="full-player-queue-btn" aria-label="Warteschlange">
          <ListOrdered className="h-6 w-6" />
        </button>
      </header>

      <div className="full-player-body">
        <div className="full-player-artwork">
          <motion.div
            key={file?.id}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', damping: 20 }}
            className="full-player-cover"
          >
            {file ? (
              <img
                src={coverUrl(file, token)}
                alt=""
                className="full-player-cover-img"
              />
            ) : (
              <div className="full-player-cover-placeholder">
                <Disc3 className="h-24 w-24 text-white/10" />
              </div>
            )}
          </motion.div>
        </div>

        <div className="full-player-info">
          <div className="full-player-track">
            <h1 className="full-player-title">{file?.title ?? 'Kein Titel'}</h1>
            <p className="full-player-artist">{file ? trackArtist(file) : 'Wähle einen Titel'}</p>
          </div>

          <div className="full-player-actions">
            <button
              onClick={onToggleLike}
              className={`full-player-like ${liked ? 'is-active' : ''}`}
            >
              <Heart className={`h-8 w-8 ${liked ? 'fill-current' : ''}`} />
            </button>
          </div>
        </div>

        <div className="full-player-seek">
          <div className="full-seek-bar-container" onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const percent = ((e.clientX - rect.left) / rect.width) * 100;
            onSeek(percent);
          }}>
            <div className="full-seek-bar">
              <div className="full-seek-fill" style={{ width: `${progress}%` }} />
            </div>
          </div>
          <div className="full-player-time-row">
            <span className="full-player-time retro-mono">{formatTime(currentTime)}</span>
            <span className="full-player-time retro-mono">{formatTime(duration)}</span>
          </div>
        </div>

        <div className="full-player-controls">
          <button onClick={onShuffle} className={`ctrl-btn-small ${shuffle ? 'is-active' : ''}`}>
            <Shuffle className="h-6 w-6" />
          </button>

          <button onClick={() => onSkip(-1)} className="ctrl-btn-skip">
            <SkipBack className="h-8 w-8 fill-current" />
          </button>

          <button onClick={onToggle} disabled={!file} className="ctrl-btn-play">
            {isPlaying ? (
              <Pause className="h-10 w-10 fill-current" />
            ) : (
              <Play className="h-10 w-10 fill-current translate-x-1" />
            )}
          </button>

          <button onClick={() => onSkip(1)} className="ctrl-btn-skip">
            <SkipForward className="h-8 w-8 fill-current" />
          </button>

          <button onClick={onRepeat} className={`ctrl-btn-small ${repeat !== 'off' ? 'is-active' : ''}`}>
            {repeat === 'one' ? <Repeat1 className="h-6 w-6" /> : <Repeat className="h-6 w-6" />}
          </button>
        </div>

        <div className="full-player-footer">
          <button className="ctrl-btn-small" onClick={onShare}>
            <Share2 className="h-6 w-6" />
          </button>
          
          <div className="flex-1" />

          <button className="ctrl-btn-small" onClick={() => setShowVolume(!showVolume)}>
            {volume === 0 ? <VolumeX className="h-6 w-6" /> : <Volume2 className="h-6 w-6" />}
          </button>

          {showVolume && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="absolute bottom-20 right-8 w-40 p-4 bg-black/80 backdrop-blur-xl rounded-2xl border border-white/10">
               <input
                type="range"
                min={0}
                max={100}
                value={volume * 100}
                onChange={(e) => onVolume(Number(e.target.value) / 100)}
                className="w-full accent-brand"
              />
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

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
          <motion.div
            key="backdrop"
            className="queue-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.aside
            key="sheet"
            className="queue-sheet"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          >
            <div className="queue-sheet-header">
              <h2 className="queue-sheet-title">Warteschlange</h2>
              <div className="queue-sheet-actions">
                <button
                  onClick={onClear}
                  disabled={queue.length === 0}
                  className="queue-clear-btn"
                >
                  Leeren
                </button>
                <button onClick={onClose} className="spotify-ctrl-btn" aria-label="Schliessen">
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="queue-content">
              {current && (
                <div className="queue-section">
                  <p className="queue-section-title">Aktuell</p>
                  <div className="queue-current-item">
                    <img src={coverUrl(current, token)} alt="" className="queue-cover" />
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
                        <button
                          onClick={() => onPlay(item.file)}
                          className="queue-item-btn"
                        >
                          <img src={coverUrl(item.file, token)} alt="" className="queue-cover" />
                          <div className="queue-item-info">
                            <p className="queue-item-title">{item.file.title}</p>
                            <p className="queue-item-subtitle">{trackArtist(item.file)}</p>
                          </div>
                        </button>
                        <button
                          onClick={() => onRemove(item.id)}
                          className="queue-remove-btn"
                          aria-label="Entfernen"
                        >
                          <X className="h-4 w-4" />
                        </button>
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