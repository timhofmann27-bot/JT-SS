import React, { useState } from 'react';
import { Plus, ChevronRight, Check, ListMusic } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { Playlist } from '../../types';

interface AddToPlaylistMenuProps {
  playlists: Playlist[];
  trackId: string;
  onAddToPlaylist: (playlistId: string) => void;
  onCreateNewPlaylist: () => void;
  onClose: () => void;
}

export default function AddToPlaylistMenu({
  playlists,
  trackId,
  onAddToPlaylist,
  onCreateNewPlaylist,
  onClose,
}: AddToPlaylistMenuProps) {
  const [addedId, setAddedId] = useState<string | null>(null);
  const [showNewInput, setShowNewInput] = useState(false);
  const [newName, setNewName] = useState('');

  const handleAdd = (playlistId: string) => {
    setAddedId(playlistId);
    onAddToPlaylist(playlistId);
    setTimeout(() => onClose(), 500);
  };

  const handleCreateAndAdd = () => {
    if (newName.trim()) {
      onCreateNewPlaylist();
      setShowNewInput(false);
      setNewName('');
    }
  };

  return (
    <div className="add-to-playlist-menu">
      <div className="add-to-playlist-header">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted">Zu Playlist hinzufügen</span>
      </div>

      {playlists.length === 0 ? (
        <div className="add-to-playlist-empty">
          <p className="text-sm text-muted">Noch keine Playlists</p>
          <button
            onClick={() => { setShowNewInput(true); }}
            className="add-to-playlist-create-link"
          >
            <Plus className="h-4 w-4" />
            Neue Playlist erstellen
          </button>
        </div>
      ) : (
        <div className="add-to-playlist-list">
          {playlists.map((playlist) => (
            <button
              key={playlist.id}
              onClick={() => handleAdd(playlist.id)}
              className="add-to-playlist-item"
            >
              <div className="add-to-playlist-item-icon">
                <ListMusic className="h-4 w-4" />
              </div>
              <span className="add-to-playlist-item-name">{playlist.name}</span>
              <span className="add-to-playlist-item-count">{playlist.trackIds?.length ?? 0}</span>
              {addedId === playlist.id && (
                <Check className="h-4 w-4 text-brand ml-auto" />
              )}
            </button>
          ))}

          <div className="add-to-playlist-divider" />

          {showNewInput ? (
            <div className="add-to-playlist-new-form">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Playlist-Name"
                className="add-to-playlist-new-input"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateAndAdd();
                  if (e.key === 'Escape') { setShowNewInput(false); setNewName(''); }
                }}
              />
              <div className="flex gap-2 mt-2">
                <button onClick={handleCreateAndAdd} className="add-to-playlist-new-btn" disabled={!newName.trim()}>
                  Erstellen
                </button>
                <button onClick={() => { setShowNewInput(false); setNewName(''); }} className="add-to-playlist-cancel-btn">
                  Abbrechen
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowNewInput(true)}
              className="add-to-playlist-item add-to-playlist-new-item"
            >
              <div className="add-to-playlist-item-icon">
                <Plus className="h-4 w-4" />
              </div>
              <span className="add-to-playlist-item-name">Neue Playlist</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
