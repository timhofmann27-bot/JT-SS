import React from 'react';
import { motion } from 'motion/react';
import {
  Heart,
  Play,
  HardDriveDownload,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import type { ApiFile } from '../types';
import { EmptyState, TrackRow } from '../components/ui';
import { SkeletonTrackList } from '../components/Skeleton';
import { formatTime } from '../lib/format';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';


interface LikedSongsViewProps {
  likedFiles: ApiFile[];
  currentFile: ApiFile | null;
  isPlaying: boolean;
  likedIds: Set<string>;
  onPlay: (f: ApiFile) => void;
  onLike: (f: ApiFile) => void;
  onDelete: (f: ApiFile) => void;
  onAddToQueue: (f: ApiFile) => void;
  token?: string;
  cachedFileIds?: Set<string>;
  onDownloadAllOffline?: () => void;
  batchDownloading?: boolean;
  batchDownloadDone?: boolean;
}

export default function LikedSongsView({
  likedFiles,
  currentFile,
  isPlaying,
  likedIds,
  onPlay,
  onLike,
  onDelete,
  onAddToQueue,
  token,
  cachedFileIds,
  onDownloadAllOffline,
  batchDownloading,
  batchDownloadDone,
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
            {onDownloadAllOffline && likedFiles.length > 0 && (
              <button
                onClick={onDownloadAllOffline}
                disabled={batchDownloading}
                className={`detail-secondary-btn ${batchDownloadDone ? 'is-done' : ''}`}
                title="Alle Lieblingstitel offline speichern"
              >
                {batchDownloading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : batchDownloadDone ? (
                  <CheckCircle2 className="h-5 w-5 text-green-400" />
                ) : (
                  <HardDriveDownload className="h-5 w-5" />
                )}
                <span className="detail-secondary-label">
                  {batchDownloading ? 'Speichere...' : batchDownloadDone ? 'Fertig!' : 'Alle offline'}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="detail-content">
        {likedFiles.length === 0 ? (
          <EmptyState icon={<Heart className="h-12 w-12" />} title="Noch keine Lieblingstitel" message="Like songs to save them here." />
        ) : (
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
        )}
      </div>
    </motion.div>
  );
}
