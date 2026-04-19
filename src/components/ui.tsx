import React, { useState, useCallback } from 'react';
import { Heart, Play, Pause, MoreHorizontal, ListPlus, Share2, Trash2, Music2, ChevronRight } from 'lucide-react';
import { motion } from 'motion/react';
import type { ApiFile } from '../types';
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
}

function ContextMenu({ x, y, items, onClose, file, onAddToPlaylist }: ContextMenuProps) {
  const [submenu, setSubmenu] = useState<{ label: string; items: ContextMenuItem[] } | null>(null);

  const handleItemClick = (item: ContextMenuItem) => {
    if (item.divider) return;
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
          ) : (
            <div
              key={`item-${idx}`}
              className={`ctx-menu-item ${item.danger ? 'is-danger' : ''}`}
              onClick={() => handleItemClick(item)}
            >
              {item.icon && <span className="ctx-menu-item-icon">{item.icon}</span>}
              <span className="ctx-menu-item-label">{item.label}</span>
              {item.shortcut && <span className="ctx-menu-item-shortcut">{item.shortcut}</span>}
              {item.label === 'Zu Playlist hinzufuegen' && (
                <ChevronRight className="h-4 w-4 ml-auto text-muted" />
              )}
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
  } | null>(null);

  const open = useCallback((e: React.MouseEvent, items: ContextMenuItem[], file?: ApiFile) => {
    e.preventDefault();
    e.stopPropagation();
    setMenu({ x: e.clientX, y: e.clientY, items, file });
  }, []);

  const close = useCallback(() => setMenu(null), []);

  const ContextMenuComponent = menu ? (
    <ContextMenu
      x={menu.x}
      y={menu.y}
      items={menu.items}
      file={menu.file}
      onClose={close}
    />
  ) : null;

  return { open, close, menu: ContextMenuComponent };
}

export { ContextMenu, useContextMenu };
import { motion } from 'motion/react';
import type { ApiFile } from '../types';
import { coverUrl } from '../lib/api';
import { formatTime, trackSubtitle, trackArtist, hueFromString } from '../lib/format';

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
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onToggle(); }}
      aria-label={liked ? 'Aus Lieblingstiteln entfernen' : 'Zu Lieblingstiteln hinzufuegen'}
      className={`btn-icon like-btn ${liked ? 'is-liked' : ''}`}
    >
      <Heart className={`h-5 w-5 ${liked ? 'fill-current' : ''}`} style={{ width: size, height: size }} />
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
      {icon && <div className="text-brand" style={{ color: 'var(--color-brand)' }}>{icon}</div>}
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
  showIndex = true,
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
  showIndex?: boolean;
}) {
  const isCurrent = currentId === file.id;
  return (
    <motion.div
      layout
      className={`track-row ${isCurrent ? 'is-current' : ''}`}
      onClick={() => onPlay(file)}
      whileTap={{ scale: 0.995 }}
    >
      {showIndex ? (
        <div className="relative w-6 text-center">
          {isCurrent && isPlaying ? (
            <EqBars active />
          ) : (
            <>
              <span className="track-index text-sm text-muted">{(index ?? 0) + 1}</span>
              <span className="track-play-inline absolute inset-0 flex items-center justify-center">
                <Play className="h-4 w-4 fill-current" />
              </span>
            </>
          )}
        </div>
      ) : (
        <div className="w-6" />
      )}
      <img src={coverUrl(file, token)} alt="" className="h-14 w-14 rounded object-cover bg-black/40" />
      <div className="min-w-0">
        <p className="track-title line-clamp-1 font-semibold text-[0.96rem]">{file.title}</p>
        <p className="line-clamp-1 text-xs text-muted mt-0.5">{trackSubtitle(file)}</p>
      </div>
      <div className="flex items-center gap-1 text-muted">
        <LikeButton liked={liked} onToggle={() => onToggleLike(file)} />
        {file.durationLabel && (
          <span className="hidden text-xs sm:inline">{file.durationLabel}</span>
        )}
        {onMore && (
          <IconButton
            ariaLabel="Mehr"
            onClick={(e) => { e.stopPropagation(); onMore(file); }}
          >
            <MoreHorizontal className="h-5 w-5" />
          </IconButton>
        )}
      </div>
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

export { coverUrl, formatTime, trackSubtitle, trackArtist, hueFromString };
