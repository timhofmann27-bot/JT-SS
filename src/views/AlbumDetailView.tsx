import React from 'react';
import { motion } from 'motion/react';
import {
  Play,
  ChevronLeft,
} from 'lucide-react';
import type { ApiFile, Album } from '../types';
import { hueFromString } from '../lib/format';

const API_BASE = import.meta.env.VITE_API_BASE ?? '';

function apiUrl(path: string) {
  return `${API_BASE}${path}`;
}

function getCoverUrl(file: ApiFile | null, token?: string) {
  if (!file) return '/icon.svg';
  if (file.hasArtwork) return apiUrl(`/api/cover/${file.id}${token ? `?token=${token}` : ''}`);
  return '/icon.svg';
}

interface AlbumDetailViewProps {
  album: Album;
  currentFile: ApiFile | null;
  isPlaying: boolean;
  onPlay: (f: ApiFile) => void;
  onLike: (f: ApiFile) => void;
  onBack: () => void;
  onAddToQueue: (f: ApiFile) => void;
}

export default function AlbumDetailView({
  album,
  currentFile,
  isPlaying,
  onPlay,
  onLike,
  onBack,
  onAddToQueue,
}: AlbumDetailViewProps) {
  const hue = hueFromString(album.name);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="detail-hero" style={{ background: `linear-gradient(${hue}80 0%, var(--color-bg) 100%)` }}>
        <button onClick={onBack} className="detail-back-btn">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="detail-hero-cover">
          <img src={getCoverUrl(album.tracks[0])} alt={album.name} />
        </div>
        <div className="detail-hero-info">
          <p className="detail-hero-type">Album</p>
          <h1 className="detail-hero-title">{album.name}</h1>
          <p className="detail-hero-meta">{album.artist || 'Unbekannt'} • {album.trackCount} Titel</p>
          <div className="detail-hero-actions">
            <button onClick={() => album.tracks[0] && onPlay(album.tracks[0])} className="detail-play-btn">
              <Play className="h-6 w-6 fill-current" />
            </button>
          </div>
        </div>
      </div>

      <div className="detail-content">
        <div className="home-track-list">
          {album.tracks.map((file, index) => (
            <div key={file.id} className={`home-track-item ${currentFile?.id === file.id ? 'is-playing' : ''}`} onClick={() => onPlay(file)}>
              <div className="home-track-index">
                {currentFile?.id === file.id && isPlaying ? (
                  <div className="home-eq-bars"><span /><span /><span /></div>
                ) : (
                  <span className="home-track-number">{index + 1}</span>
                )}
              </div>
              <div className="home-track-info">
                <p className="home-track-title">{file.title}</p>
                <p className="home-track-artist">{file.artist || 'Unbekannt'}</p>
              </div>
              <span className="home-track-duration">{file.durationLabel || '0:00'}</span>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
