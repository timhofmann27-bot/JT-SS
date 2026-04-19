import React from 'react';
import { motion } from 'motion/react';
import {
  Heart,
  Play,
} from 'lucide-react';
import type { ApiFile } from '../types';
import { EmptyState } from '../components/ui';
import { formatTime } from '../lib/format';
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

interface LikedSongsViewProps {
  likedFiles: ApiFile[];
  currentFile: ApiFile | null;
  isPlaying: boolean;
  likedIds: Set<string>;
  onPlay: (f: ApiFile) => void;
  onLike: (f: ApiFile) => void;
}

export default function LikedSongsView({
  likedFiles,
  currentFile,
  isPlaying,
  likedIds,
  onPlay,
  onLike,
}: LikedSongsViewProps) {
  const totalDuration = likedFiles.reduce((acc, f) => acc + (f.duration || 0), 0);

  const {
    visibleItems: visibleTracks,
    hasMore: hasMoreTracks,
    observerRef: trackObserverRef,
  } = useInfiniteScroll({ items: likedFiles, pageSize: 20 });

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="detail-hero liked-hero-bg">
        <div className="detail-hero-cover liked-hero-cover">
          <Heart className="h-20 w-20" fill="white" />
        </div>
        <div className="detail-hero-info">
          <p className="detail-hero-type">Playlist</p>
          <h1 className="detail-hero-title">Lieblingstitel</h1>
          <p className="detail-hero-meta">{likedFiles.length} Titel{likedFiles.length > 0 ? ` • ${formatTime(totalDuration)}` : ''}</p>
          <div className="detail-hero-actions">
            <button onClick={() => likedFiles[0] && onPlay(likedFiles[0])} className="detail-play-btn">
              <Play className="h-6 w-6 fill-current" />
            </button>
          </div>
        </div>
      </div>

      <div className="detail-content">
        {likedFiles.length === 0 ? (
          <EmptyState icon={<Heart className="h-12 w-12" />} title="Noch keine Lieblingstitel" message="Like songs to save them here." />
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
