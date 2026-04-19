import React, { useState } from 'react';
import {
  ChevronDown,
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
  const hue = file ? hueFromString(file.album || file.artist || file.title) : '#1DB954';

  return (
    <motion.div
      className="spotify-player"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="spotify-player-bg" style={{ background: `radial-gradient(circle at 50% 30%, ${hue}40 0%, #121212 70%)` }} />

      <header className="spotify-player-header">
        <button onClick={onClose} className="spotify-player-close" aria-label="Schliessen">
          <ChevronDown className="h-6 w-6" />
        </button>

        <div className="spotify-player-header-center">
          <span className="spotify-player-header-label">Wird abgespielt</span>
        </div>

        <button onClick={onOpenQueue} className="spotify-player-queue-btn" aria-label="Warteschlange">
          <ListOrdered className="h-5 w-5" />
        </button>
      </header>

      <div className="spotify-player-body">
        <div className="spotify-player-artwork">
          <motion.div
            key={file?.id}
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.4 }}
            className="spotify-player-cover"
          >
            {file ? (
              <img
                src={coverUrl(file, token)}
                alt=""
                className="spotify-player-cover-img"
              />
            ) : (
              <div className="spotify-player-cover-placeholder">
                <ListMusic className="h-20 w-20 text-[#282828]" />
              </div>
            )}
          </motion.div>
        </div>

        <div className="spotify-player-info">
          <div className="spotify-player-track">
            <h1 className="spotify-player-title line-clamp-2">{file?.title ?? 'Kein Titel'}</h1>
            <p className="spotify-player-artist">{file ? trackArtist(file) : 'Waehle einen Titel'}</p>
          </div>

          <div className="spotify-player-actions">
            <button
              onClick={onToggleLike}
              className={`spotify-player-like ${liked ? 'is-active' : ''}`}
              aria-label={liked ? 'Gefaellt mir entfernen' : 'Gefaellt mir'}
            >
              <Heart className={`h-7 w-7 ${liked ? 'fill-current' : ''}`} />
            </button>
            <button className="spotify-player-more" aria-label="Mehr">
              <MoreHorizontal className="h-6 w-6" />
            </button>
          </div>
        </div>

        <div className="spotify-player-seek">
          <input
            type="range"
            min={0}
            max={100}
            step={0.1}
            value={Number.isFinite(progress) ? progress : 0}
            onChange={(e) => onSeek(Number(e.target.value))}
            className="spotify-seek-slider"
            style={{ ['--seek' as string]: `${progress}%` } as React.CSSProperties}
            aria-label="Position"
          />
          <div className="spotify-player-time-row">
            <span className="spotify-player-time">{formatTime(currentTime)}</span>
            <span className="spotify-player-time">{formatTime(duration)}</span>
          </div>
        </div>

        <div className="spotify-player-controls">
          <button
            onClick={onShuffle}
            className={`spotify-ctrl-btn ${shuffle ? 'is-active' : ''}`}
            aria-label="Zufallswiedergabe"
          >
            <Shuffle className="h-5 w-5" />
          </button>

          <button onClick={() => onSkip(-1)} className="spotify-ctrl-btn" aria-label="Zurueck">
            <SkipBack className="h-6 w-6 fill-current" />
          </button>

          <button
            onClick={onToggle}
            disabled={!file}
            className="spotify-ctrl-play"
            aria-label={isPlaying ? 'Pause' : 'Abspielen'}
          >
            {isPlaying ? (
              <Pause className="h-8 w-8 fill-current" />
            ) : (
              <Play className="h-8 w-8 fill-current translate-x-0.5" />
            )}
          </button>

          <button onClick={() => onSkip(1)} className="spotify-ctrl-btn" aria-label="Weiter">
            <SkipForward className="h-6 w-6 fill-current" />
          </button>

          <button
            onClick={onRepeat}
            className={`spotify-ctrl-btn ${repeat !== 'off' ? 'is-active' : ''}`}
            aria-label="Wiederholen"
          >
            {repeat === 'one' ? <Repeat1 className="h-5 w-5" /> : <Repeat className="h-5 w-5" />}
          </button>
        </div>

        <div className="spotify-player-footer">
          <button
            onClick={() => setShowVolume(!showVolume)}
            className="spotify-ctrl-btn"
            aria-label="Lautstaerke"
          >
            {volume === 0 ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
          </button>

          {showVolume && (
            <div className="spotify-volume-popover">
              <input
                type="range"
                min={0}
                max={100}
                value={volume * 100}
                onChange={(e) => onVolume(Number(e.target.value) / 100)}
                className="spotify-seek-slider"
                style={{ ['--seek' as string]: `${volume * 100}%` } as React.CSSProperties}
                aria-label="Lautstaerke"
              />
            </div>
          )}

          <div className="spotify-player-footer-right">
            <button className="spotify-ctrl-btn" aria-label="Teilen">
              <Share2 className="h-5 w-5" />
            </button>
          </div>
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
                  <p className="queue-section-title">Als naechstes</p>
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
                  <p className="text-[#6a6a6a] text-sm mt-1">Fuege Titel hinzu, um sie als naechstes abzuspielen.</p>
                </div>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}