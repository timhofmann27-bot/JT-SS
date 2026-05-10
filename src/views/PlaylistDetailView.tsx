import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  Heart,
  Play,
  ListMusic,
  ChevronLeft,
  Trash2,
  MoreHorizontal,
  Pencil,
  Check,
  X,
} from 'lucide-react';
import type { ApiFile, Playlist } from '../types';
import { TrackRow } from '../components/ui';
import { formatTime } from '../lib/format';
import { coverUrl } from '../lib/api';


interface PlaylistDetailViewProps {
  playlist: Playlist;
  files: ApiFile[];
  currentFile: ApiFile | null;
  isPlaying: boolean;
  likedIds: Set<string>;
  onPlay: (f: ApiFile) => void;
  onLike: (f: ApiFile) => void;
  onBack: () => void;
  onDelete: (f: ApiFile) => void;
  onAddToQueue: (f: ApiFile) => void;
  onRemoveTrack: (playlistId: string, fileId: string) => void;
  onDeletePlaylist: (playlistId: string) => void;
  onRenamePlaylist: (playlistId: string, name: string) => void;
  token?: string;
  cachedFileIds?: Set<string>;
}

export default function PlaylistDetailView({
  playlist,
  files,
  currentFile,
  isPlaying,
  likedIds,
  onPlay,
  onLike,
  onBack,
  onDelete,
  onAddToQueue,
  onRemoveTrack,
  onDeletePlaylist,
  onRenamePlaylist,
  token,
  cachedFileIds,
}: PlaylistDetailViewProps) {
  const playlistFiles = playlist.trackIds.map((id) => files.find((f) => f.id === id)).filter(Boolean) as ApiFile[];
  const totalDuration = playlistFiles.reduce((acc, f) => acc + (f.duration || 0), 0);

  const [showMore, setShowMore] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(playlist.name);

  const handleRename = () => {
    if (editName.trim() && editName.trim() !== playlist.name) {
      onRenamePlaylist(playlist.id, editName.trim());
    }
    setIsEditing(false);
  };

  const firstTrackCover = playlistFiles[0]?.hasArtwork
    ? coverUrl(playlistFiles[0], { token, artist: playlistFiles[0]?.artist, album: playlistFiles[0]?.album })
    : undefined;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="detail-hero">
        <button onClick={onBack} className="detail-back-btn">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="detail-hero-cover">
          {firstTrackCover ? (
            <img src={firstTrackCover} alt={playlist.name} />
          ) : (
            <div className="home-card-placeholder">
              <ListMusic className="h-12 w-12" />
            </div>
          )}
        </div>
        <div className="detail-hero-info">
          <p className="detail-hero-type">Playlist</p>

          {isEditing ? (
            <div className="flex items-center gap-2 mt-1">
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="detail-hero-title-input"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRename();
                  if (e.key === 'Escape') { setIsEditing(false); setEditName(playlist.name); }
                }}
              />
              <button onClick={handleRename} className="detail-icon-btn">
                <Check className="h-5 w-5 text-brand" />
              </button>
              <button onClick={() => { setIsEditing(false); setEditName(playlist.name); }} className="detail-icon-btn">
                <X className="h-5 w-5 text-muted" />
              </button>
            </div>
          ) : (
            <h1 className="detail-hero-title">{playlist.name}</h1>
          )}

          {playlist.description && (
            <p className="detail-hero-desc">{playlist.description}</p>
          )}
          <p className="detail-hero-meta">{playlistFiles.length} Titel{playlistFiles.length > 0 ? ` • ${formatTime(totalDuration)}` : ''}</p>
          <div className="detail-hero-actions">
            <button onClick={() => playlistFiles[0] && onPlay(playlistFiles[0])} className="detail-play-btn">
              <Play className="h-6 w-6 fill-current" />
            </button>

            <div style={{ position: 'relative' }}>
              <button onClick={() => setShowMore(!showMore)} className="detail-download-btn">
                <MoreHorizontal className="h-5 w-5" />
              </button>
              {showMore && (
                <>
                  <div
                    className="ctx-menu-backdrop"
                    onClick={() => setShowMore(false)}
                  />
                  <div
                    className="ctx-menu"
                    style={{ position: 'absolute', top: '100%', right: 0, marginTop: 8, zIndex: 100 }}
                  >
                    <button
                      className="ctx-menu-item"
                      onClick={() => { setIsEditing(true); setShowMore(false); }}
                    >
                      <span className="ctx-menu-item-icon"><Pencil className="h-4 w-4" /></span>
                      <span className="ctx-menu-item-label">Umbenennen</span>
                    </button>
                    <div className="ctx-menu-divider" />
                    <button
                      className="ctx-menu-item is-danger"
                      onClick={() => {
                        setShowMore(false);
                        if (confirm(`Playlist "${playlist.name}" wirklich löschen?`)) {
                          onDeletePlaylist(playlist.id);
                          onBack();
                        }
                      }}
                    >
                      <span className="ctx-menu-item-icon"><Trash2 className="h-4 w-4" /></span>
                      <span className="ctx-menu-item-label">Playlist löschen</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="detail-content">
        {playlistFiles.length === 0 ? (
          <div className="empty-state" style={{ padding: '3rem 1rem' }}>
            <ListMusic className="h-12 w-12 opacity-30 mb-4" />
            <h3>Playlist ist leer</h3>
            <p className="text-sm text-muted mt-1">Füge Titel über das Kontextmenü hinzu.</p>
          </div>
        ) : (
          <div className="home-track-list">
            {playlistFiles.map((file, index) => (
              <div key={file.id} className="playlist-track-row">
                <div className="flex-1 min-w-0">
                  <TrackRow
                    file={file}
                    index={index}
                    liked={likedIds.has(file.id)}
                    currentId={currentFile?.id ?? null}
                    isPlaying={isPlaying}
                    token={token}
                    onPlay={onPlay}
                    onToggleLike={onLike}
                    onAddToQueue={onAddToQueue}
                    swipeToQueue
                    isOffline={cachedFileIds?.has(file.id) ?? false}
                  />
                </div>
                <button
                  className="playlist-track-remove"
                  onClick={(e) => { e.stopPropagation(); onRemoveTrack(playlist.id, file.id); }}
                  aria-label="Aus Playlist entfernen"
                  title="Aus Playlist entfernen"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
