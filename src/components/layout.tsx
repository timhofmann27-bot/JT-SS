import React, { useState } from 'react';
import {
  Disc3,
  Home,
  Search,
  Library,
  PlusSquare,
  Heart,
  Upload,
  Settings,
  ChevronLeft,
  Pause,
  Play,
  Clock,
  Music2,
} from 'lucide-react';
import type { NavTab, ApiFile } from '../types';
import { coverUrl } from '../lib/api';
import { trackSubtitle } from '../lib/format';

interface SidebarProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  onUpload: () => void;
  playlists: { id: string; name: string }[];
  onPlaylistSelect: (id: string) => void;
  likedCount: number;
  onLikedSongs: () => void;
}

export function Sidebar({ activeTab, onTabChange, onUpload, playlists, onPlaylistSelect, likedCount, onLikedSongs }: SidebarProps) {
  const [showCreatePlaylist, setShowCreatePlaylist] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');

  const mainNavItems: { id: NavTab; label: string; icon: React.ReactNode }[] = [
    { id: 'home', label: 'Start', icon: <Home className="sidebar-item-icon" /> },
    { id: 'search', label: 'Suchen', icon: <Search className="sidebar-item-icon" /> },
    { id: 'library', label: 'Bibliothek', icon: <Library className="sidebar-item-icon" /> },
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-top">
        <a href="#" className="sidebar-logo" onClick={(e) => { e.preventDefault(); onTabChange('home'); }}>
          <div className="sidebar-logo-icon">
            <Disc3 className="h-5 w-5 text-white" />
          </div>
          <span className="sidebar-logo-text">JT-MP3</span>
        </a>
      </div>

      <nav className="sidebar-nav">
        <div className="sidebar-section">
          {mainNavItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`sidebar-item w-full ${activeTab === item.id ? 'is-active' : ''}`}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </div>

        <div className="sidebar-section">
          <div className="sidebar-item w-full hover:bg-transparent cursor-default">
            <LibraryIcon className="sidebar-item-icon" />
            <span className="sidebar-section-title" style={{ margin: 0, padding: 0 }}>Deine Bibliothek</span>
          </div>

          <button
            onClick={onLikedSongs}
            className="sidebar-item w-full"
          >
            <div className="sidebar-item-icon w-6 h-6 rounded bg-gradient-to-br from-[#4000BF] to-[#8000FF] flex items-center justify-center">
              <Heart className="h-3.5 w-3.5 text-white" fill="white" />
            </div>
            <span>Lieblingstitel</span>
            <span className="sidebar-count">{likedCount}</span>
          </button>

          <button className="sidebar-item w-full">
            <div className="sidebar-item-icon w-6 h-6 rounded bg-[#5038A0] flex items-center justify-center">
              <Music2 className="h-3.5 w-3.5 text-white" />
            </div>
            <span>Erstellte playlists</span>
          </button>

          <button className="sidebar-item w-full" onClick={() => setShowCreatePlaylist(true)}>
            <PlusSquare className="sidebar-item-icon" />
            <span>Playlist erstellen</span>
          </button>
        </div>

        <div className="sidebar-section sidebar-playlists">
          {playlists.map((playlist) => (
            <button
              key={playlist.id}
              onClick={() => onPlaylistSelect(playlist.id)}
              className="sidebar-item w-full"
            >
              <div className="sidebar-item-icon w-6 h-6 rounded bg-[#282828] flex items-center justify-center">
                <Music2 className="h-3 w-3 text-[#b3b3b3]" />
              </div>
              <span className="line-clamp-1">{playlist.name}</span>
            </button>
          ))}
        </div>
      </nav>

      {showCreatePlaylist && (
        <div className="sidebar-create-playlist">
          <input
            type="text"
            value={newPlaylistName}
            onChange={(e) => setNewPlaylistName(e.target.value)}
            placeholder="Playlist-Name"
            className="sidebar-input"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newPlaylistName.trim()) {
                // Create playlist callback would go here
                setShowCreatePlaylist(false);
                setNewPlaylistName('');
              }
              if (e.key === 'Escape') {
                setShowCreatePlaylist(false);
                setNewPlaylistName('');
              }
            }}
          />
          <div className="flex gap-2">
            <button
              onClick={() => {
                if (newPlaylistName.trim()) {
                  setShowCreatePlaylist(false);
                  setNewPlaylistName('');
                }
              }}
              className="sidebar-btn-primary"
            >
              Erstellen
            </button>
            <button onClick={() => setShowCreatePlaylist(false)} className="sidebar-btn-secondary">
              Abbrechen
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}

function LibraryIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M3 4a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4zm3 1v10h8V5H6zm2 2h4v2H8V7zm0 4h4v2H8v-2zm0 4h4v2H8v-2z"/>
    </svg>
  );
}

export function AppHeader({ title, showBack, onBack, transparent = false }: {
  title?: string;
  showBack?: boolean;
  onBack?: () => void;
  transparent?: boolean;
}) {
  return (
    <header className={`top-bar-header ${transparent ? 'transparent' : ''}`}>
      <div className="flex items-center gap-2">
        {showBack ? (
          <button onClick={onBack} className="top-bar-btn" aria-label="Zurueck">
            <ChevronLeft className="h-5 w-5" />
          </button>
        ) : (
          <div className="w-9" />
        )}
        {!transparent && (
          <button className="top-bar-btn" aria-label="Vorwaerts" disabled>
            <ChevronLeft className="h-5 w-5 opacity-30 rotate-180" />
          </button>
        )}
      </div>
      {title && <h1 className="top-bar-title truncate">{title}</h1>}
      <div className="w-9" />
    </header>
  );
}

export function BottomNav({ active, onChange }: {
  active: NavTab;
  onChange: (tab: NavTab) => void;
}) {
  const tabs: { id: NavTab; label: string; icon: React.ReactNode }[] = [
    { id: 'home', label: 'Start', icon: <Home className="h-6 w-6" /> },
    { id: 'search', label: 'Suchen', icon: <Search className="h-6 w-6" /> },
    { id: 'library', label: 'Bibliothek', icon: <Library className="h-6 w-6" /> },
    { id: 'profile', label: 'Profil', icon: <Heart className="h-6 w-6" /> },
  ];

  return (
    <nav className="bottom-nav" aria-label="Hauptnavigation">
      <div className="bottom-nav-grid">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`nav-tab ${active === tab.id ? 'is-active' : ''}`}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}

export function MiniPlayer({ file, token, isPlaying, progress, onToggle, onOpen }: {
  file: ApiFile | null; token: string; isPlaying: boolean; progress: number;
  onToggle: () => void; onOpen: () => void;
}) {
  if (!file) return null;
  return (
    <div className="mini-player" role="button" tabIndex={0} onClick={onOpen} onKeyDown={(e) => e.key === 'Enter' && onOpen()}>
      <img className="mini-player-cover" src={coverUrl(file, token)} alt="" />
      <div className="min-w-0 flex-1">
        <p className="line-clamp-1 text-sm font-semibold">{file.title}</p>
        <p className="line-clamp-1 text-xs text-muted">{trackSubtitle(file)}</p>
        <div className="progress-track mt-1" style={{ height: 2 }}>
          <div className="progress-fill" style={{ width: `${progress}%` }} />
        </div>
      </div>
      <button type="button" onClick={(e) => { e.stopPropagation(); onToggle(); }} className="btn-icon btn-icon-lg">
        {isPlaying ? <Pause className="h-6 w-6 fill-current" /> : <Play className="h-6 w-6 fill-current translate-x-[1px]" />}
      </button>
    </div>
  );
}

export function ProfileMenuRow({ icon, label, onClick, danger = false }: {
  icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean;
}) {
  return (
    <button type="button" onClick={onClick} className="card-hover flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left"
      style={{ background: 'var(--color-surface)', color: danger ? 'var(--color-danger)' : 'var(--color-text)' }}>
      <span className="text-muted">{icon}</span>
      <span className="font-semibold text-[0.95rem]">{label}</span>
    </button>
  );
}

export { Settings };