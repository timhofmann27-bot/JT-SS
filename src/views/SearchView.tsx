import React from 'react';
import { motion } from 'motion/react';
import {
  Heart,
  Play,
  Search,
} from 'lucide-react';
import type { ApiFile, Album, Artist } from '../types';
import { EmptyState } from '../components/ui';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';

const API_BASE = import.meta.env.VITE_API_BASE ?? '';

function apiUrl(path: string) {
  return `${API_BASE}${path}`;
}

function getCoverUrl(file: ApiFile | null, token?: string) {
  if (!file) return '/icon.svg';
  if (file.hasArtwork) return apiUrl(`/api/cover/${file.id}${token ? `?token=${token}` : ''}`);
  return '/icon.svg';
}

interface SearchViewProps {
  files: ApiFile[];
  query: string;
  currentFile: ApiFile | null;
  isPlaying: boolean;
  likedIds: Set<string>;
  onPlay: (f: ApiFile) => void;
  onLike: (f: ApiFile) => void;
  albums: Album[];
  artists: Artist[];
  onAlbumSelect: (a: Album) => void;
  onArtistSelect: (a: Artist) => void;
}

export default function SearchView({
  files,
  query,
  currentFile,
  isPlaying,
  likedIds,
  onPlay,
  onLike,
  albums,
  artists,
  onAlbumSelect,
  onArtistSelect,
}: SearchViewProps) {
  const hasQuery = query.trim().length > 0;

  const {
    visibleItems: visibleTracks,
    hasMore: hasMoreTracks,
    observerRef: trackObserverRef,
  } = useInfiniteScroll({ items: files, pageSize: 20 });

  if (!hasQuery) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="search-view">
        <div className="search-section">
          <h2 className="search-section-title">Browsen</h2>
          <div className="search-genre-grid">
            {[
              { name: 'Pop', color: '#1DB954' },
              { name: 'Hip-Hop', color: '#E91429' },
              { name: 'Rock', color: '#8B5CF6' },
              { name: 'Electronic', color: '#06B6D4' },
              { name: 'R&B', color: '#F59E0B' },
              { name: 'Jazz', color: '#3B82F6' },
            ].map((genre) => (
              <div key={genre.name} className="search-genre-tile" style={{ background: genre.color }} onClick={() => {}}>
                <span className="search-genre-name">{genre.name}</span>
              </div>
            ))}
          </div>
        </div>

        {albums.length > 0 && (
          <div className="search-section">
            <h2 className="search-section-title">Alben</h2>
            <div className="home-scroll-row">
              {albums.slice(0, 6).map((album) => (
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
          </div>
        )}

        {artists.length > 0 && (
          <div className="search-section">
            <h2 className="search-section-title">Kuenstler</h2>
            <div className="home-scroll-row">
              {artists.slice(0, 6).map((artist) => (
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
                  <p className="home-card-subtitle text-center">Kuenstler</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="search-view">
      <div className="search-results">
        {files.length === 0 ? (
          <EmptyState icon={<Search className="h-12 w-12" />} title="Keine Ergebnisse" message={`Keine Titel gefunden für "${query}"`} />
        ) : (
          <div className="home-track-list">
            {visibleTracks.map((file, index) => (
              <div key={file.id} className={`home-track-item ${currentFile?.id === file.id ? 'is-playing' : ''}`} onClick={() => onPlay(file)}>
                <div className="home-track-index">
                  {currentFile?.id === file.id && isPlaying ? (
                    <div className="home-eq-bars"><span /><span /><span /></div>
                  ) : (
                    <span className="home-track-number retro-mono">{index + 1}</span>
                  )}
                </div>
                <img src={getCoverUrl(file)} alt="" className="home-track-cover" />
                <div className="home-track-info">
                  <p className="home-track-title">{file.title}</p>
                  <p className="home-track-artist">{file.artist || 'Unbekannt'}</p>
                </div>
                <button className={`home-track-like ${likedIds.has(file.id) ? 'is-liked' : ''}`} onClick={(e) => { e.stopPropagation(); onLike(file); }}>
                  <Heart className={`h-5 w-5 ${likedIds.has(file.id) ? 'fill-current' : ''}`} />
                </button>
                <span className="home-track-duration">{file.durationLabel || '0:00'}</span>
              </div>
            ))}
            {hasMoreTracks && (
              <div ref={trackObserverRef} className="infinite-scroll-sentinel">
                <div className="loading-spinner" />
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}
