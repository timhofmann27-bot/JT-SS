import React, { useState, useCallback } from 'react';
import { Heart, Play, Pause, MoreHorizontal, ListPlus, Share2, Trash2, Music2, ChevronRight, ListMusic, Plus, Check, WifiOff } from 'lucide-react';
import { motion, useMotionValue, useTransform } from 'motion/react';
import type { ApiFile, Playlist } from '../types';
import { coverUrl } from '../lib/api';
import { formatTime, trackSubtitle, trackArtist, hueFromString } from '../lib/format';

interface ContextMenuItem {
  icon?: React.ReactNode;
  label: string;
  shortcut?: string;
  onClick: () => void;
  danger?: boolean;
  divider?: boolean;
}

interface ContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
  onAddToPlaylist?: (file: ApiFile) => void;
  file?: ApiFile;
  playlists?: Playlist[];
  onSelectPlaylist?: (playlistId: string, file: ApiFile) => void;
  onCreatePlaylist?: () => void;
}

function ContextMenu({ x, y, items, onClose, file, onAddToPlaylist, playlists, onSelectPlaylist, onCreatePlaylist }: ContextMenuProps) {
  const [submenu, setSubmenu] = useState<{ label: string; items: ContextMenuItem[] } | null>(null);
  const [addedPlaylistId, setAddedPlaylistId] = useState<string | null>(null);
  const [showPlaylistSub, setShowPlaylistSub] = useState(false);

  const handleItemClick = (item: ContextMenuItem) => {
    if (item.divider) return;
    // If this is the "Add to Playlist" item and we have playlist data, handle with submenu
    if (item.label === 'Zu Playlist hinzufuegen' && playlists && onSelectPlaylist && file) {
      // Don't close - submenu will be shown inline
      return;
    }
    item.onClick();
    onClose();
  };

  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onClose();
  }, [onClose]);

  let adjustedX = x;
  let adjustedY = y;

  if (typeof window !== 'undefined') {
    const menuWidth = 240;
    const menuHeight = items.length * 44 + 16;

    if (x + menuWidth > window.innerWidth) {
      adjustedX = window.innerWidth - menuWidth - 16;
    }
    if (y + menuHeight > window.innerHeight) {
      adjustedY = window.innerHeight - menuHeight - 16;
    }
  }

  return (
    <>
      <div className="ctx-menu-backdrop" onClick={handleBackdropClick} />
      <div
        className="ctx-menu"
        style={{ left: adjustedX, top: adjustedY }}
        onClick={(e) => e.stopPropagation()}
      >
        {items.map((item, idx) =>
          item.divider ? (
            <div key={`div-${idx}`} className="ctx-menu-divider" />
          ) : item.label === 'Zu Playlist hinzufuegen' && playlists && onSelectPlaylist && file ? (
            <div key={`item-${idx}`}>
              <div
                className="ctx-menu-item"
                onClick={() => setShowPlaylistSub(!showPlaylistSub)}
              >
                {item.icon && <span className="ctx-menu-item-icon">{item.icon}</span>}
                <span className="ctx-menu-item-label">{item.label}</span>
                <ChevronRight className="h-4 w-4 ml-auto text-muted" />
              </div>
              {showPlaylistSub && (
                <div className="ctx-playlist-submenu">
                  {playlists.map((pl) => (
                    <div
                      key={pl.id}
                      className={`ctx-menu-item ${addedPlaylistId === pl.id ? 'is-add-confirm' : ''}`}
                      onClick={() => {
                        onSelectPlaylist(pl.id, file);
                        setAddedPlaylistId(pl.id);
                        setTimeout(() => { onClose(); }, 500);
                      }}
                    >
                      <span className="ctx-menu-item-icon"><ListMusic className="h-4 w-4" /></span>
                      <span className="ctx-menu-item-label">{pl.name}</span>
                      <span className="ctx-menu-item-shortcut">{pl.trackIds?.length ?? 0}</span>
                      {addedPlaylistId === pl.id && <Check className="h-4 w-4 text-brand ml-1" />}
                    </div>
                  ))}
                  {onCreatePlaylist && (
                    <>
                      <div className="ctx-menu-divider" />
                      <div
                        className="ctx-menu-item"
                        onClick={() => { onCreatePlaylist(); onClose(); }}
                      >
                        <span className="ctx-menu-item-icon"><Plus className="h-4 w-4" /></span>
                        <span className="ctx-menu-item-label">Neue Playlist</span>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div
              key={`item-${idx}`}
              className={`ctx-menu-item ${item.danger ? 'is-danger' : ''}`}
              onClick={() => handleItemClick(item)}
            >
              {item.icon && <span className="ctx-menu-item-icon">{item.icon}</span>}
              <span className="ctx-menu-item-label">{item.label}</span>
              {item.shortcut && <span className="ctx-menu-item-shortcut">{item.shortcut}</span>}
            </div>
          )
        )}
      </div>
    </>
  );
}

function useContextMenu() {
  const [menu, setMenu] = useState<{
    x: number;
    y: number;
    items: ContextMenuItem[];
    file?: ApiFile;
    playlists?: Playlist[];
    onSelectPlaylist?: (playlistId: string, file: ApiFile) => void;
    onCreatePlaylist?: () => void;
  } | null>(null);

  const open = useCallback((e: React.MouseEvent, items: ContextMenuItem[], file?: ApiFile, extra?: { playlists?: Playlist[]; onSelectPlaylist?: (playlistId: string, file: ApiFile) => void; onCreatePlaylist?: () => void }) => {
    e.preventDefault();
    e.stopPropagation();
    setMenu({ x: e.clientX, y: e.clientY, items, file, ...(extra ?? {}) });
  }, []);

  const close = useCallback(() => setMenu(null), []);

  const ContextMenuComponent = menu ? (
    <ContextMenu
      x={menu.x}
      y={menu.y}
      items={menu.items}
      file={menu.file}
      onClose={close}
      playlists={menu.playlists}
      onSelectPlaylist={menu.onSelectPlaylist}
      onCreatePlaylist={menu.onCreatePlaylist}
    />
  ) : null;

  return { open, close, menu: ContextMenuComponent };
}

export { ContextMenu, useContextMenu };
export type { ContextMenuItem };

/* ============ Icon Button ============ */
export function IconButton({
  onClick,
  ariaLabel,
  children,
  className = '',
  active = false,
  size = 'md',
}: {
  onClick?: (e: React.MouseEvent) => void;
  ariaLabel: string;
  children: React.ReactNode;
  className?: string;
  active?: boolean;
  size?: 'sm' | 'md' | 'lg';
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className={`btn-icon ${size === 'lg' ? 'btn-icon-lg' : ''} ${active ? 'text-brand' : ''} ${className}`}
    >
      {children}
    </button>
  );
}

/* ============ Like Button ============ */
export function LikeButton({ liked, onToggle, size = 20 }: { liked: boolean; onToggle: () => void; size?: number }) {
  const [burst, setBurst] = useState(false);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!liked) {
      setBurst(true);
      setTimeout(() => setBurst(false), 600);
    }
    onToggle();
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={liked ? 'Aus Lieblingstiteln entfernen' : 'Zu Lieblingstiteln hinzufuegen'}
      className={`btn-icon like-btn ${liked ? 'is-liked' : ''} ${burst ? 'like-burst' : ''}`}
    >
      <Heart className={`h-5 w-5 ${liked || burst ? 'fill-current' : ''}`} style={{ width: size, height: size }} />
      {burst && <span className="like-burst-particles" aria-hidden>
        <span /><span /><span /><span /><span /><span /><span /><span />
      </span>}
    </button>
  );
}

/* ============ Play FAB ============ */
export function PlayFab({
  playing,
  onClick,
  size = 'md',
  ariaLabel,
}: {
  playing: boolean;
  onClick: (e: React.MouseEvent) => void;
  size?: 'sm' | 'md' | 'lg';
  ariaLabel?: string;
}) {
  const icon = playing
    ? <Pause className="h-6 w-6" />
    : <Play className="h-6 w-6 fill-current translate-x-[1px]" />;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel ?? (playing ? 'Pause' : 'Abspielen')}
      className={`btn-play-fab ${size === 'lg' ? 'btn-play-fab-xl' : ''} ${size === 'sm' ? 'w-10 h-10' : ''}`}
    >
      {size === 'sm' ? React.cloneElement(icon, { className: 'h-4 w-4' }) : icon}
    </button>
  );
}

/* ============ Equaliser bars (for currently playing row) ============ */
export function EqBars({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <span className="eq-bars" aria-hidden>
      <span /><span /><span />
    </span>
  );
}

/* ============ Cover Image (with fade-in placeholder) ============ */
export function CoverImage({
  src,
  alt,
  className = '',
  hue,
  size = 40,
}: {
  src: string;
  alt: string;
  className?: string;
  hue?: string;
  size?: number;
}) {
  const [loaded, setLoaded] = useState(false);
  const [imgSrc, setImgSrc] = useState<string | null>(null);

  // Generate gradient placeholder from hue
  const bgColor = hue || '#282828';
  const placeholderStyle: React.CSSProperties = {
    background: `linear-gradient(135deg, ${bgColor}, ${bgColor}88)`,
    width: '100%',
    height: '100%',
    position: 'absolute',
    inset: 0,
    transition: 'opacity 0.4s ease',
  };

  useEffect(() => {
    setLoaded(false);
    setImgSrc(null);
    // Use the coverCache if available
    const load = async () => {
      try {
        const { getCoverUrl } = await import('../lib/coverCache');
        const cached = getCoverUrl(src);
        if (cached !== src) {
          setImgSrc(cached);
          setLoaded(true);
          return;
        }
      } catch { /* fall through */ }
      setImgSrc(src);
    };
    load();
  }, [src]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
      <div style={{ ...placeholderStyle, opacity: loaded ? 0 : 1 }} />
      {imgSrc && (
        <img
          src={imgSrc}
          alt={alt}
          className={className}
          loading="lazy"
          onLoad={() => setLoaded(true)}
          style={{ opacity: loaded ? 1 : 0, transition: 'opacity 0.3s ease', width: '100%', height: '100%', objectFit: 'cover' }}
        />
      )}
    </div>
  );
}

/* ============ Section ============ */
export function Section({
  title,
  action,
  children,
  className = '',
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`px-3 ${className}`}>
      <div className="section-header">
        <h2 className="section-title">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

/* ============ Empty State ============ */
export function EmptyState({
  icon,
  title,
  message,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  message?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty-state">
      {icon && (
        <div className="mb-4 w-20 h-20 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center">
          <div className="opacity-30">{icon}</div>
        </div>
      )}
      <h3>{title}</h3>
      {message && <p className="max-w-sm text-sm leading-6">{message}</p>}
      {action}
    </div>
  );
}

/* ============ Chip row ============ */
export function ChipRow({
  items,
  value,
  onChange,
}: {
  items: { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto px-3 pb-1" style={{ scrollbarWidth: 'none' }}>
      {items.map((item) => (
        <button
          key={item.id}
          onClick={() => onChange(item.id)}
          className={`chip ${value === item.id ? 'chip-active' : ''}`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

/* ============ Track Row (list item) ============ */
export function TrackRow({
  file,
  index,
  liked,
  currentId,
  isPlaying,
  token,
  onPlay,
  onToggleLike,
  onMore,
  onAddToQueue,
  showIndex = true,
  swipeToQueue = false,
  isOffline = false,
}: {
  file: ApiFile;
  index?: number;
  liked: boolean;
  currentId: string | null;
  isPlaying: boolean;
  token?: string;
  onPlay: (file: ApiFile) => void;
  onToggleLike: (file: ApiFile) => void;
  onMore?: (file: ApiFile) => void;
  onAddToQueue?: (file: ApiFile) => void;
  showIndex?: boolean;
  swipeToQueue?: boolean;
  isOffline?: boolean;
}) {
  const isCurrent = currentId === file.id;
  const dragX = useMotionValue(0);
  const rightOpacity = useTransform(dragX, [0, 40, 120], [0, 0, 1]);

  const content = (
    <>
      {/* Left: index or playing indicator */}
      <div className="track-index-cell">
        {isCurrent && isPlaying ? (
          <EqBars active />
        ) : (
          <>
            <span className="track-index-num">{(index ?? 0) + 1}</span>
            <span className="track-play-inline">
              <Play className="h-3.5 w-3.5 fill-current" />
            </span>
          </>
        )}
      </div>

      {/* Cover thumbnail */}
      <img
        className="track-row-cover"
        src={coverUrl(file, { token, artist: file?.artist, album: file?.album })}
        alt=""
        loading="lazy"
      />

      {/* Center: title + subtitle */}
      <div className="track-row-info">
        <p className={`track-row-title ${isCurrent ? 'text-brand' : ''}`}>
          {file.title}
          {isOffline && <WifiOff className="track-offline-badge" aria-label="Offline verfuegbar" />}
        </p>
        <p className="track-row-sub">{trackSubtitle(file)}</p>
      </div>

      {/* Right: duration + actions */}
      {file.durationLabel && (
        <span className="track-duration-label">{file.durationLabel}</span>
      )}

      <div className="track-row-actions">
        {onAddToQueue && (
          <button
            className="track-action-btn"
            onClick={(e) => { e.stopPropagation(); onAddToQueue(file); }}
            aria-label="Zur Warteschlange"
            title="Zur Warteschlange hinzufügen"
          >
            <ListPlus className="h-4 w-4" />
          </button>
        )}
        <LikeButton liked={liked} onToggle={() => onToggleLike(file)} />
        {onMore && (
          <button
            className="track-action-btn"
            onClick={(e) => { e.stopPropagation(); onMore(file); }}
            aria-label="Mehr"
          >
            <MoreHorizontal className="h-5 w-5" />
          </button>
        )}
      </div>
    </>
  );

  if (onAddToQueue) {
    return (
      <div style={{ position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', pointerEvents: 'none' }}>
          <motion.div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 20, background: '#FF6B35', opacity: rightOpacity }}>
            <ListPlus className="h-5 w-5 text-white" />
          </motion.div>
        </div>
        <motion.div
          layout
          className={`track-row ${isCurrent ? 'is-current' : ''}`}
          onClick={() => onPlay(file)}
          drag="x"
          dragConstraints={{ left: 0, right: 120 }}
          dragElastic={0.1}
          dragSnapToOrigin
          style={{ x: dragX, position: 'relative', zIndex: 1, touchAction: 'pan-y' }}
          onDragEnd={(_, info) => { if (info.offset.x > 80) onAddToQueue(file); }}
          whileTap={{ scale: 0.995 }}
        >
          {content}
        </motion.div>
      </div>
    );
  }

  return (
    <motion.div
      layout
      className={`track-row ${isCurrent ? 'is-current' : ''}`}
      onClick={() => onPlay(file)}
      whileTap={{ scale: 0.995 }}
    >
      {content}
    </motion.div>
  );
}

/* ============ Shortcut tile (Home) ============ */
export function Shortcut({
  title,
  cover,
  gradient,
  onClick,
  icon,
}: {
  title: string;
  cover?: string;
  gradient?: string;
  onClick: () => void;
  icon?: React.ReactNode;
}) {
  return (
    <button className="shortcut card-hover" onClick={onClick}>
      {gradient ? (
        <div
          className="shortcut-cover flex items-center justify-center"
          style={{ background: gradient }}
          aria-hidden
        >
          {icon}
        </div>
      ) : (
        <img className="shortcut-cover" src={cover || '/icon.svg'} alt="" />
      )}
      <span className="shortcut-title line-clamp-2 text-left">{title}</span>
    </button>
  );
}

/* ============ Media Card (Album / Playlist) ============ */
export function MediaCard({
  title,
  subtitle,
  cover,
  gradient,
  circle = false,
  onClick,
  onPlay,
}: {
  title: string;
  subtitle?: string;
  cover?: string;
  gradient?: string;
  circle?: boolean;
  onClick: () => void;
  onPlay?: (e: React.MouseEvent) => void;
}) {
  return (
    <motion.div
      className={`media-card ${circle ? 'is-artist' : ''}`}
      onClick={onClick}
      whileTap={{ scale: 0.98 }}
    >
      <div className="media-card-cover" style={gradient ? { background: gradient } : undefined}>
        {cover && <img src={cover} alt="" />}
        {onPlay && (
          <span className="media-card-play">
            <PlayFab playing={false} onClick={(e) => { e.stopPropagation(); onPlay(e); }} />
          </span>
        )}
      </div>
      <p className="media-card-title line-clamp-2">{title}</p>
      {subtitle && <p className="media-card-subtitle line-clamp-2">{subtitle}</p>}
    </motion.div>
  );
}

/* ============ Gradient hero for detail views ============ */
export function GradientHero({
  title,
  subtitle,
  meta,
  cover,
  circle = false,
  hue,
  children,
}: {
  title: string;
  subtitle?: string;
  meta?: React.ReactNode;
  cover?: string;
  circle?: boolean;
  hue?: string;
  children?: React.ReactNode;
}) {
  const color = hue ?? hueFromString(title);
  return (
    <div
      className="hero"
      style={{ ['--hero-gradient-top' as string]: color } as React.CSSProperties}
    >
      <div className={`hero-cover ${circle ? 'is-circle' : ''}`}>
        {cover ? <img src={cover} alt="" /> : null}
      </div>
      <div className="mt-5 text-center">
        {subtitle && (
          <p className="text-xs uppercase tracking-widest text-secondary font-semibold">
            {subtitle}
          </p>
        )}
        <h1 className="hero-title mt-2">{title}</h1>
        {meta && <p className="mt-2 text-sm text-secondary">{meta}</p>}
      </div>
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}



// Stub components for ProfileView
export function Dialog({ isOpen, open, onClose, title, footer, children }: any) {
  const isOpen_ = open ?? isOpen;
  if (!isOpen_) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={onClose}>
      <div className="fixed inset-0 bg-black/70" />
      <div className="relative z-10 w-full max-w-md rounded-xl bg-[#282828] p-6" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-bold mb-4">{title}</h2>
        {children}
        {footer}
      </div>
    </div>
  );
}

export function ImmersiveInput({ value, onChange, placeholder, label, type, required, className }: any) {
  return (
    <div>
      {label && <label className="text-sm text-muted mb-1 block">{label}</label>}
      <input
        type={type ?? 'text'}
        value={value}
        onChange={(e: any) => onChange(e.target?.value ?? e)}
        required={required}
        placeholder={placeholder}
        className={className ?? 'w-full h-12 px-4 rounded-lg bg-[#3e3e3e] border border-white/10 text-white placeholder:text-muted outline-none focus:border-[#FF6B35] transition-colors'}
      />
    </div>
  );
}

export function ImmersiveButton({ onClick, children, isLoading }: any) {
  return (
    <button
      onClick={onClick}
      disabled={isLoading}
      className="w-full h-12 rounded-full bg-[#FF6B35] text-black font-bold hover:bg-[#FF8C5A] transition-colors disabled:opacity-50"
    >
      {isLoading ? 'Bitte warten...' : children}
    </button>
  );
}
