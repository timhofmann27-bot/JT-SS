import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import {
  Heart,
  Play,
  ListMusic,
  Plus,
  Disc3,
  Music2,
  User,
  HardDriveDownload,
  WifiOff,
  Trash2,
} from 'lucide-react';
import type { ApiFile, Album, Artist, Playlist } from '../types';
import { coverUrl } from '../lib/api';
import { EmptyState, TrackRow } from '../components/ui';
import { trackSubtitle } from '../lib/format';


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
  filter: 'playlists' | 'artists' | 'albums' | 'offline';
  setFilter: (f: 'playlists' | 'artists' | 'albums' | 'offline') => void;
  onAlbumSelect: (a: Album) => void;
  onArtistSelect: (a: Artist) => void;
  onPlaylistSelect: (p: Playlist) => void;
  onDelete: (f: ApiFile) => void;
  onCreatePlaylist?: () => void;
  token?: string;
  cachedFileIds?: Set<string>;
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
  onCreatePlaylist,
  token,
  cachedFileIds,
}: LibraryViewProps) {
  const offlineFiles = useMemo(
    () => files.filter((f) => cachedFileIds?.has(f.id)),
    [files, cachedFileIds],
  );

  const filters = ['playlists', 'artists', 'albums', 'offline'] as const;
  const filterLabels: Record<string, string> = {
    playlists: 'Playlists',
    artists: 'Künstler',
    albums: 'Alben',
    offline: 'Offline',
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="library-view">
      <div className="library-header">
        <h1 className="library-title">Deine Bibliothek</h1>
      </div>

      <div className="library-filter">
        {filters.map((f) => (
          <button
            key={f}
            className={`library-filter-btn ${filter === f ? 'is-active' : ''}`}
            onClick={() => setFilter(f)}
          >
            {filterLabels[f]}
          </button>
        ))}
      </div>

      <div className="library-content">
        {/* ── Offline / Heruntergeladen ── */}
        {filter === 'offline' && (offlineFiles.length === 0 ? (
          <EmptyState
            icon={<HardDriveDownload className="h-10 w-10" />}
            title="Noch keine Titel offline"
            message={`Tippe im Player auf ⋮ → „Offline speichern", um Titel herunterzuladen.`}
          />
        ) : (
          <div className="library-offline-section">
            <div className="library-offline-header">
              <HardDriveDownload className="h-5 w-5 text-green-400" />
              <span>{offlineFiles.length} Titel offline verfügbar</span>
            </div>
            <div className="home-track-list">
              {offlineFiles.map((file, index) => (
                <TrackRow
                  key={file.id}
                  file={file}
                  index={index}
                  liked={likedIds.has(file.id)}
                  currentId={currentFile?.id ?? null}
                  isPlaying={isPlaying}
                  token={token}
                  onPlay={onPlay}
                  onToggleLike={onLike}
                  onAddToQueue={undefined}
                  swipeToQueue
                  isOffline
                />
              ))}
            </div>
          </div>
        ))}

        {/* ── Playlists ── */}
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
            <div className="library-create-card" onClick={onCreatePlaylist}>
              <div className="library-create-icon">
                <Plus className="h-8 w-8" />
              </div>
              <p className="library-create-text">Playlist erstellen</p>
            </div>
          </div>
        ))}

        {/* ── Künstler ── */}
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

        {/* ── Alben ── */}
        {filter === 'albums' && (albums.length === 0 ? (
          <EmptyState
            icon={<Disc3 className="h-10 w-10" />}
            title="Noch keine Alben"
            message="Lade Musik hoch, um Alben in deiner Bibliothek zu sehen."
          />
        ) : (
          <div className="library-grid">
            {albums.map((album) => {
              const isActive = currentFile !== null && album.tracks.some(t => t.id === currentFile.id);
              return (
              <div key={album.id} className={`home-card ${isActive ? 'is-active' : ''}`} onClick={() => onAlbumSelect(album)}>
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
              );
            })}
          </div>
        ))}
      </div>
    </motion.div>
  );
}
