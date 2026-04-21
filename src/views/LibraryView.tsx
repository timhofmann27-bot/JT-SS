import React from 'react';
import { motion } from 'motion/react';
import {
  Heart,
  Play,
  ListMusic,
  Plus,
} from 'lucide-react';
import type { ApiFile, Album, Artist, Playlist } from '../types';
import { Dialog, ImmersiveInput, ImmersiveButton } from '../components/ui';

const API_BASE = import.meta.env.VITE_API_BASE ?? '';

function apiUrl(path: string) {
  return `${API_BASE}${path}`;
}

function getCoverUrl(file: ApiFile | null, token?: string) {
  if (!file) return '/icon.svg';
  if (file.hasArtwork) return apiUrl(`/api/cover/${file.id}${token ? `?token=${token}` : ''}`);
  return '/icon.svg';
}

interface LibraryViewProps {
  files: ApiFile[];
  currentFile: ApiFile | null;
  isPlaying: boolean;
  likedIds: Set<string>;
  onPlay: (f: ApiFile) => void;
  onLike: (f: ApiFile) => void;
  onOpenUpload: () => void;
  albums: Album[];
  artists: Artist[];
  playlists: Playlist[];
  filter: 'playlists' | 'artists' | 'albums';
  setFilter: (f: 'playlists' | 'artists' | 'albums') => void;
  onAlbumSelect: (a: Album) => void;
  onArtistSelect: (a: Artist) => void;
  onPlaylistSelect: (p: Playlist) => void;
  onCreatePlaylist: (name: string) => void;
}

export default function LibraryView({
  files,
  currentFile,
  isPlaying,
  likedIds,
  onPlay,
  onLike,
  onOpenUpload,
  albums,
  artists,
  playlists,
  filter,
  setFilter,
  onAlbumSelect,
  onArtistSelect,
  onPlaylistSelect,
  onCreatePlaylist,
}: LibraryViewProps) {
  const [isCreating, setIsCreating] = React.useState(false);
  const [newName, setNewName] = React.useState('');

  const handleCreate = () => {
    if (newName.trim()) {
      onCreatePlaylist(newName.trim());
      setNewName('');
      setIsCreating(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="library-view">
      <div className="library-header">
        <h1 className="library-title">Deine Bibliothek</h1>
      </div>

      <div className="library-filter">
        {(['playlists', 'artists', 'albums'] as const).map((f) => (
          <button key={f} className={`library-filter-btn ${filter === f ? 'is-active' : ''}`} onClick={() => setFilter(f)}>
            {f === 'playlists' ? 'Playlists' : f === 'artists' ? 'Künstler' : 'Alben'}
          </button>
        ))}
      </div>

      <div className="library-content">
        {filter === 'playlists' && (
          <div className="library-grid">
            {playlists.map((playlist) => (
              <div key={playlist.id} className="home-card" onClick={() => onPlaylistSelect(playlist)}>
                <div className="home-card-cover">
                  <div className="home-card-placeholder">
                    <ListMusic className="h-8 w-8" />
                  </div>
                  <div className="home-card-play">
                    <div className="home-card-play-btn">
                      <Play className="h-5 w-5 fill-current" />
                    </div>
                  </div>
                </div>
                <p className="home-card-title">{playlist.name}</p>
                <p className="home-card-subtitle">{playlist.trackIds.length} Titel</p>
              </div>
            ))}
            <div className="library-create-card" onClick={() => setIsCreating(true)}>
              <div className="library-create-icon">
                <Plus className="h-8 w-8" />
              </div>
              <p className="library-create-text">Playlist erstellen</p>
            </div>
          </div>
        )}

        <Dialog
          isOpen={isCreating}
          onClose={() => setIsCreating(false)}
          title="Playlist erstellen"
          footer={
            <ImmersiveButton onClick={handleCreate}>
              Erstellen
            </ImmersiveButton>
          }
        >
          <ImmersiveInput 
            label="Name der Playlist"
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="z.B. Sommergefühle"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreate();
            }}
          />
        </Dialog>

        {filter === 'artists' && (
          <div className="library-grid">
            {artists.map((artist) => (
              <div key={artist.id} className="home-card" onClick={() => onArtistSelect(artist)}>
                <div className="home-card-cover is-circle">
                  <img src={getCoverUrl(artist.topTracks[0])} alt={artist.name} className="home-card-img" />
                  <div className="home-card-play">
                    <div className="home-card-play-btn">
                      <Play className="h-5 w-5 fill-current" />
                    </div>
                  </div>
                </div>
                <p className="home-card-title text-center">{artist.name}</p>
                <p className="home-card-subtitle text-center">Künstler</p>
              </div>
            ))}
          </div>
        )}

        {filter === 'albums' && (
          <div className="library-grid">
            {albums.map((album) => (
              <div key={album.id} className="home-card" onClick={() => onAlbumSelect(album)}>
                <div className="home-card-cover">
                  <img src={getCoverUrl(album.tracks[0])} alt={album.name} className="home-card-img" />
                  <div className="home-card-play">
                    <div className="home-card-play-btn">
                      <Play className="h-5 w-5 fill-current" />
                    </div>
                  </div>
                </div>
                <p className="home-card-title">{album.name}</p>
                <p className="home-card-subtitle">{album.artist || 'Unbekannt'}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
