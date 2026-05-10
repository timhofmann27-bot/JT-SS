import React, { useMemo, useCallback } from 'react';
import { motion } from 'motion/react';
import {
  Heart,
  Play,
  Search as SearchIcon,
  Shuffle,
  Clock,
  Sparkles,
  Music,
  Headphones,
  Flame,
} from 'lucide-react';
import type { ApiFile, Album, Artist } from '../types';
import { EmptyState, TrackRow, PlayFab } from '../components/ui';
import { SkeletonTrackList } from '../components/Skeleton';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';
import { coverUrl } from '../lib/api';
import { trackSubtitle } from '../lib/format';

interface SearchViewProps {
  files: ApiFile[];
  query: string;
  currentFile: ApiFile | null;
  isPlaying: boolean;
  likedIds: Set<string>;
  onPlay: (f: ApiFile) => void;
  onLike: (f: ApiFile) => void;
  onDelete: (f: ApiFile) => void;
  onAddToQueue: (f: ApiFile) => void;
  albums: Album[];
  artists: Artist[];
  onAlbumSelect: (a: Album) => void;
  onArtistSelect: (a: Artist) => void;
  token?: string;
  cachedFileIds?: Set<string>;
  searchHistory?: string[];
  onSearch?: (q: string) => void;
  onClearSearchHistory?: () => void;
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
  onAddToQueue,
  albums,
  artists,
  onAlbumSelect,
  onArtistSelect,
  token,
  cachedFileIds,
  searchHistory,
  onSearch,
  onClearSearchHistory,
}: SearchViewProps) {
  const hasQuery = query.trim().length > 0;

  const {
    visibleItems: visibleTracks,
    hasMore: hasMoreTracks,
    observerRef: trackObserverRef,
  } = useInfiniteScroll({ items: files, pageSize: 20 });

  // ── Derived data ──
  const topArtists = useMemo(() => {
    return [...artists]
      .sort((a, b) => b.topTracks.length - a.topTracks.length)
      .slice(0, 8);
  }, [artists]);

  const recentlyAdded = useMemo(() => {
    return [...files].slice(0, 10);
  }, [files]);

  const trendingTracks = useMemo(() => {
    return [...files].sort((a, b) => (b.playCount || 0) - (a.playCount || 0)).slice(0, 8);
  }, [files]);

  const recommendedTracks = useMemo(() => {
    const unliked = files.filter((f) => !likedIds.has(f.id));
    const shuffled = [...unliked].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 8);
  }, [files, likedIds]);

  // ── Play random track ──
  const playRandom = useCallback(() => {
    if (files.length === 0) return;
    const randomFile = files[Math.floor(Math.random() * files.length)];
    onPlay(randomFile);
  }, [files, onPlay]);

  /* ══════════════════════════════════════
     DISCOVER VIEW (no search query)
     ══════════════════════════════════════ */
  if (!hasQuery) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="search-view discover-view">
        {/* ── Hero Section ── */}
        <div className="discover-hero">
          <div className="discover-hero-content">
            <Sparkles className="discover-hero-icon" />
            <h1 className="discover-hero-title">Entdecken</h1>
            <p className="discover-hero-sub">Finde neue Musik, Stimmungen und Künstler</p>
          </div>
          <div className="discover-hero-bg" />
        </div>

        {/* ── Random Play Button ── */}
        <div className="discover-section">
          <motion.button
            className="discover-random-btn"
            whileHover={{ scale: 1.03, boxShadow: '0 12px 48px rgba(255,107,53,0.5)' }}
            whileTap={{ scale: 0.97 }}
            onClick={playRandom}
          >
            <Shuffle className="discover-random-icon" />
            <div className="discover-random-text">
              <span className="discover-random-label">Zufälliger Titel</span>
              <span className="discover-random-meta">Aus {files.length} Songs</span>
            </div>
            <PlayFab playing={false} size="sm" onClick={(e) => { e.stopPropagation(); playRandom(); }} />
          </motion.button>
        </div>

        {/* ── Search History ── */}
        {searchHistory && searchHistory.length > 0 && (
          <div className="discover-section">
            <div className="discover-section-header">
              <h2 className="discover-section-title">
                Zuletzt gesucht
              </h2>
              <button
                className="discover-history-clear"
                onClick={onClearSearchHistory}
              >
                Löschen
              </button>
            </div>
            <div className="discover-history-row">
              {searchHistory.map((q) => (
                <button
                  key={q}
                  className="discover-history-chip"
                  onClick={() => onSearch?.(q)}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Recently Added ── */}
        {recentlyAdded.length > 0 && (
          <div className="discover-section">
            <div className="discover-section-header">
              <h2 className="discover-section-title">
                <Clock className="discover-section-title-icon" />
                Neu hinzugefügt
              </h2>
            </div>
            <div className="discover-horizontal-scroll">
              {recentlyAdded.slice(0, 8).map((file) => (
                <motion.div
                  key={file.id}
                  className="discover-card"
                  whileHover={{ y: -4, scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => onPlay(file)}
                >
                  <div className="discover-card-cover">
                    <img
                      src={coverUrl(file, { token, artist: file?.artist, album: file?.album })}
                      alt={file.title}
                      loading="lazy"
                    />
                    <div className="discover-card-play">
                      <PlayFab playing={false} size="sm" onClick={(e) => { e.stopPropagation(); onPlay(file); }} />
                    </div>
                  </div>
                  <p className="discover-card-title">{file.title}</p>
                  <p className="discover-card-sub">{file.artist || 'Unbekannt'}</p>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* ── Trending ── */}
        {trendingTracks.length > 0 && (
          <div className="discover-section">
            <div className="discover-section-header">
              <h2 className="discover-section-title">
                <Flame className="discover-section-title-icon" />
                Am meisten gehört
              </h2>
            </div>
            <div className="home-track-list">
              {trendingTracks.map((file, index) => (
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
                  onAddToQueue={onAddToQueue}
                  swipeToQueue
                  isOffline={cachedFileIds?.has(file.id) ?? false}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── Recommended Tracks ── */}
        {recommendedTracks.length > 0 && (
          <div className="discover-section">
            <div className="discover-section-header">
              <h2 className="discover-section-title">
                <Sparkles className="discover-section-title-icon" />
                Für dich empfohlen
              </h2>
            </div>
            <div className="discover-scroll-row">
              {recommendedTracks.map((file, index) => (
                <motion.div
                  key={file.id}
                  className="discover-feature-card"
                  whileHover={{ y: -4, scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => onPlay(file)}
                >
                  <div className="discover-feature-cover">
                    <img
                      src={coverUrl(file, { token, artist: file?.artist, album: file?.album })}
                      alt={file.title}
                      loading="lazy"
                    />
                    <div className="discover-feature-play">
                      <PlayFab playing={false} size="sm" onClick={(e) => { e.stopPropagation(); onPlay(file); }} />
                    </div>
                  </div>
                  <p className="discover-feature-title">{file.title}</p>
                  <p className="discover-feature-sub">{trackSubtitle(file)}</p>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* ── Top Artists ── */}
        {topArtists.length > 0 && (
          <div className="discover-section">
            <div className="discover-section-header">
              <h2 className="discover-section-title">
                <Headphones className="discover-section-title-icon" />
                Top Künstler
              </h2>
            </div>
            <div className="discover-artists-row">
              {topArtists.map((artist) => (
                <motion.div
                  key={artist.id}
                  className="discover-artist-card"
                  whileHover={{ y: -4, scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => onArtistSelect(artist)}
                >
                  <div className="discover-artist-avatar">
                    <img
                      src={coverUrl(artist.topTracks[0], {
                        token,
                        artist: artist.topTracks[0]?.artist,
                        album: artist.topTracks[0]?.album,
                      })}
                      alt={artist.name}
                      loading="lazy"
                    />
                  </div>
                  <p className="discover-artist-name">{artist.name}</p>
                  <p className="discover-artist-meta">Künstler</p>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Bottom spacing */}
        <div className="discover-bottom-spacer" />
      </motion.div>
    );
  }

  /* ══════════════════════════════════════
     SEARCH RESULTS (has query)
     ══════════════════════════════════════ */
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
                  onAddToQueue={onAddToQueue}
                  swipeToQueue
                  isOffline={cachedFileIds?.has(file.id) ?? false}
                />
              ))}
              {hasMoreTracks && (
                <div ref={trackObserverRef} className="infinite-scroll-sentinel">
                  <SkeletonTrackList count={3} />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
