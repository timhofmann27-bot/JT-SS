import React from 'react';
import { motion } from 'motion/react';
import {
  Heart,
  Play,
  ListMusic,
  Plus,
  Disc3,
  Music2,
  User,
} from 'lucide-react';
import type { ApiFile, Album, Artist, Playlist } from '../types';
import { coverUrl } from '../lib/api';
import { EmptyState } from '../components/ui';


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
  onDelete: (f: ApiFile) => void;
  token?: string;
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
  onDelete,
  token,
}: LibraryViewProps) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="library-view">
      <div className="library-header">
        <h1 className="library-title">Deine Bibliothek</h1>
      </div>

      <div className="library-filter">
        {(['playlists', 'artists', 'albums'] as const).map((f) => (
          <button
            key={f}
            className={`library-filter-btn ${filter === f ? 'is-active' : ''}`}
            onClick={() => setFilter(f)}
          >
            {f === 'playlists' ? 'Playlists' : f === 'artists' ? 'Künstler' : 'Alben'}
          </button>
        ))}
      </div>

      <div className="library-content">
        {filter === 'playlists' && (playlists.length === 0 ? (
          <EmptyState
            icon={<ListMusic className="h-10 w-10" />}
            title="Noch keine Playlists"
            message="Erstelle deine erste Playlist über die Seitenleiste."
          />
        ) : (
          <div className="library-grid">
            {playlists.map((playlist) => (
              <div key={playlist.id} className="home-card" onClick={() => onPlaylistSelect(playlist)}>
                <div className="home-card-cover">
                  <div className="home-card-placeholder">
                    <ListMusic className="h-10 w-10" />
                  </div>
                  <div className="home-card-play">
                    <div className="home-card-play-btn">
                      <Play className="h-5 w-5 fill-current translate-x-0.5" />
                    </div>
                  </div>
                </div>
                <p className="home-card-title">{playlist.name}</p>
                <p className="home-card-subtitle">{playlist.trackIds.length} Titel</p>
              </div>
            ))}
            <div className="library-create-card" onClick={onOpenUpload}>
              <div className="library-create-icon">
                <Plus className="h-8 w-8" />
              </div>
              <p className="library-create-text">Playlist erstellen</p>
            </div>
          </div>
        ))}

        {filter === 'artists' && (artists.length === 0 ? (
          <EmptyState
            icon={<User className="h-10 w-10" />}
            title="Noch keine Künstler"
            message="Lade Musik hoch, um Künstler in deiner Bibliothek zu sehen."
          />
        ) : (
          <div className="library-grid">
            {artists.map((artist) => (
              <div key={artist.id} className="home-card" onClick={() => onArtistSelect(artist)}>
                <div className="home-card-cover is-circle">
                  <img
                    src={coverUrl(artist.topTracks[0], { token, artist: artist.topTracks[0]?.artist, album: artist.topTracks[0]?.album })}
                    alt={artist.name}
                    className="home-card-img"
                  />
                  <div className="home-card-play">
                    <div className="home-card-play-btn">
                      <Play className="h-5 w-5 fill-current translate-x-0.5" />
                    </div>
                  </div>
                </div>
                <p className="home-card-title text-center">{artist.name}</p>
                <p className="home-card-subtitle text-center">{artist.albums.length} Alben</p>
              </div>
            ))}
          </div>
        ))}

        {filter === 'albums' && (albums.length === 0 ? (
          <EmptyState
            icon={<Disc3 className="h-10 w-10" />}
            title="Noch keine Alben"
            message="Lade Musik hoch, um Alben in deiner Bibliothek zu sehen."
          />
        ) : (
          <div className="library-grid">
            {albums.map((album) => (
              <div key={album.id} className="home-card" onClick={() => onAlbumSelect(album)}>
                <div className="home-card-cover">
                  <img
                    src={coverUrl(album.tracks[0], { token, artist: album.tracks[0]?.artist, album: album.tracks[0]?.album })}
                    alt={album.name}
                    className="home-card-img"
                  />
                  <div className="home-card-play">
                    <div className="home-card-play-btn">
                      <Play className="h-5 w-5 fill-current translate-x-0.5" />
                    </div>
                  </div>
                </div>
                <p className="home-card-title">{album.name}</p>
                <p className="home-card-subtitle">{album.artist || `${album.trackCount} Titel`}</p>
              </div>
            ))}
          </div>
        ))}
      </div>
    </motion.div>
  );
}
