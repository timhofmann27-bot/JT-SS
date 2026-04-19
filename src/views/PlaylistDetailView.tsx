import React from 'react';
import { motion } from 'motion/react';
import {
  Heart,
  Play,
  ListMusic,
  ChevronLeft,
} from 'lucide-react';
import type { ApiFile, Playlist } from '../types';
import { EmptyState } from '../components/ui';
import { formatTime } from '../lib/format';

const API_BASE = import.meta.env.VITE_API_BASE ?? '';

function apiUrl(path: string) {
  return `${API_BASE}${path}`;
}

function getCoverUrl(file: ApiFile | null, token?: string) {
  if (!file) return '/icon.svg';
  if (file.hasArtwork) return apiUrl(`/api/cover/${file.id}${token ? `?token=${token}` : ''}`);
  return '/icon.svg';
}

interface PlaylistDetailViewProps {
  playlist: Playlist;
  files: ApiFile[];
  currentFile: ApiFile | null;
  isPlaying: boolean;
  likedIds: Set<string>;
  onPlay: (f: ApiFile) => void;
  onLike: (f: ApiFile) => void;
  onBack: () => void;
  onAddToQueue: (f: ApiFile) => void;
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
  onAddToQueue,
}: PlaylistDetailViewProps) {
  const playlistFiles = playlist.trackIds.map((id) => files.find((f) => f.id === id)).filter(Boolean) as ApiFile[];
  const totalDuration = playlistFiles.reduce((acc, f) => acc + (f.duration || 0), 0);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="detail-hero">
        <button onClick={onBack} className="detail-back-btn">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="detail-hero-cover">
          <div className="home-card-placeholder">
            <ListMusic className="h-12 w-12" />
          </div>
        </div>
        <div className="detail-hero-info">
          <p className="detail-hero-type">Playlist</p>
          <h1 className="detail-hero-title">{playlist.name}</h1>
          <p className="detail-hero-meta">{playlistFiles.length} Titel{playlistFiles.length > 0 ? ` • ${formatTime(totalDuration)}` : ''}</p>
          <div className="detail-hero-actions">
            <button onClick={() => playlistFiles[0] && onPlay(playlistFiles[0])} className="detail-play-btn">
              <Play className="h-6 w-6 fill-current" />
            </button>
          </div>
        </div>
      </div>

      <div className="detail-content">
        {playlistFiles.length === 0 ? (
          <EmptyState icon={<ListMusic className="h-12 w-12" />} title="Playlist ist leer" message="Fuege Titel hinzu." />
        ) : (
          <div className="home-track-list">
            {playlistFiles.map((file, index) => (
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
          </div>
        )}
      </div>
    </motion.div>
  );
}
