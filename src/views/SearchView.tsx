import React from 'react';
import { motion } from 'motion/react';
import {
  Heart,
  Play,
  Search as SearchIcon,
  User,
} from 'lucide-react';
import type { ApiFile, Album, Artist } from '../types';
import { EmptyState } from '../components/ui';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';
import { coverUrl } from '../lib/api';

interface SearchViewProps {
  files: ApiFile[];
  query: string;
  currentFile: ApiFile | null;
  isPlaying: boolean;
  likedIds: Set<string>;
  onPlay: (f: ApiFile) => void;
  onLike: (f: ApiFile) => void;
  onDelete: (f: ApiFile) => void;
  albums: Album[];
  artists: Artist[];
  onAlbumSelect: (a: Album) => void;
  onArtistSelect: (a: Artist) => void;
  token?: string;
}

export default function SearchView({
  files,
  query,
  currentFile,
  isPlaying,
  likedIds,
  onPlay,
  onLike,
  onDelete,
  artists,
  token,
}: SearchViewProps) {
  const hasQuery = query.trim().length > 0;

  const {
    visibleItems: visibleTracks,
    hasMore: hasMoreTracks,
    observerRef: trackObserverRef,
  } = useInfiniteScroll({ items: files, pageSize: 20 });

  // Top 8 artists (sorted by track count descending)
  const topArtists = React.useMemo(() => {
    return [...artists]
      .sort((a, b) => b.topTracks.length - a.topTracks.length)
      .slice(0, 8);
  }, [artists]);

  // Top 10 tracks (by most recent? just first 10)
  const topTracks = React.useMemo(() => {
    return files.slice(0, 10);
  }, [files]);

  if (!hasQuery) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="search-view">
        <div className="search-browse-container">
          {/* Vorgeschlagene Künstler */}
          {topArtists.length > 0 && (
            <div className="search-section">
              <h2 className="search-section-title">Vorgeschlagene Künstler</h2>
              <div className="search-artist-suggestions">
                {topArtists.map((artist) => (
                  <div
                    key={artist.id}
                    className="search-artist-item"
                    onClick={() => onArtistSelect(artist)}
                  >
                    <div className="search-artist-avatar">
                      <img
                        src={coverUrl(artist.topTracks[0], {
                          token,
                          artist: artist.topTracks[0]?.artist,
                          album: artist.topTracks[0]?.album,
                        })}
                        alt={artist.name}
                        className="search-artist-avatar-img"
                      />
                    </div>
                    <p className="search-artist-name">{artist.name}</p>
                    <p className="search-artist-meta">Künstler</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Vorgeschlagene Titel */}
          {topTracks.length > 0 && (
            <div className="search-section">
              <h2 className="search-section-title">Vorgeschlagene Titel</h2>
              <div className="home-track-list">
                {topTracks.map((file, index) => (
                  <div
                    key={file.id}
                    className={`home-track-item ${currentFile?.id === file.id ? 'is-playing' : ''}`}
                    onClick={() => onPlay(file)}
                  >
                    <div className="home-track-index">
                      {currentFile?.id === file.id && isPlaying ? (
                        <div className="home-eq-bars"><span /><span /><span /></div>
                      ) : (
                        <>
                          <span className="home-track-number">{index + 1}</span>
                          <span className="home-track-play">
                            <Play className="h-4 w-4 fill-current text-white" />
                          </span>
                        </>
                      )}
                    </div>
                    <img
                      src={coverUrl(file, { token, artist: file?.artist, album: file?.album })}
                      alt=""
                      className="home-track-cover"
                    />
                    <div className="home-track-info">
                      <p className="home-track-title">{file.title}</p>
                      <p className="home-track-artist">{file.artist || file.album || 'Unbekannt'}</p>
                    </div>
                    <button
                      className={`home-track-like ${likedIds.has(file.id) ? 'is-liked' : ''}`}
                      onClick={(e) => { e.stopPropagation(); onLike(file); }}
                    >
                      <Heart className={`h-5 w-5 ${likedIds.has(file.id) ? 'fill-current' : ''}`} />
                    </button>
                    <span className="home-track-duration">{file.durationLabel || '0:00'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="search-view">
      <div className="search-results">
        {files.length === 0 ? (
          <EmptyState
            icon={<SearchIcon className="h-12 w-12" />}
            title="Keine Ergebnisse"
            message={`Keine Titel gefunden für "${query}"`}
          />
        ) : (
          <div className="search-section">
            <h2 className="search-section-title">Suchergebnisse</h2>
            <div className="home-track-list">
              {visibleTracks.map((file, index) => (
                <div
                  key={file.id}
                  className={`home-track-item ${currentFile?.id === file.id ? 'is-playing' : ''}`}
                  onClick={() => onPlay(file)}
                >
                  <div className="home-track-index">
                    {currentFile?.id === file.id && isPlaying ? (
                      <div className="home-eq-bars"><span /><span /><span /></div>
                    ) : (
                      <>
                        <span className="home-track-number">{index + 1}</span>
                        <span className="home-track-play">
                          <Play className="h-4 w-4 fill-current text-white" />
                        </span>
                      </>
                    )}
                  </div>
                  <img src={coverUrl(file, { token, artist: file?.artist, album: file?.album })} alt="" className="home-track-cover" />
                  <div className="home-track-info">
                    <p className="home-track-title">{file.title}</p>
                    <p className="home-track-artist">{file.artist || file.album || 'Unbekannt'}</p>
                  </div>
                  <button
                    className={`home-track-like ${likedIds.has(file.id) ? 'is-liked' : ''}`}
                    onClick={(e) => { e.stopPropagation(); onLike(file); }}
                  >
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
          </div>
        )}
      </div>
    </motion.div>
  );
}
