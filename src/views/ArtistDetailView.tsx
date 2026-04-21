import React from 'react';
import { motion } from 'motion/react';
import {
  Play,
  ChevronLeft,
} from 'lucide-react';
import type { ApiFile, Artist } from '../types';
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

interface ArtistDetailViewProps {
  artist: Artist;
  currentFile: ApiFile | null;
  isPlaying: boolean;
  onPlay: (f: ApiFile) => void;
  onLike: (f: ApiFile) => void;
  onBack: () => void;
  onAddToQueue: (f: ApiFile) => void;
}

export default function ArtistDetailView({
  artist,
  currentFile,
  isPlaying,
  onPlay,
  onLike,
  onBack,
  onAddToQueue,
}: ArtistDetailViewProps) {
  const hue = hueFromString(artist.name);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="detail-hero" style={{ background: `linear-gradient(${hue}40 0%, var(--color-bg) 100%)` }}>
        <button onClick={onBack} className="detail-back-btn">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="detail-hero-cover is-circle">
          <img src={getCoverUrl(artist.topTracks[0])} alt={artist.name} />
        </div>
        <div className="detail-hero-info">
          <p className="detail-hero-type">Künstler</p>
          <h1 className="detail-hero-title">{artist.name}</h1>
          <p className="detail-hero-meta">{artist.albums.length} Alben • {artist.topTracks.length} Titel</p>
          <div className="detail-hero-actions">
            <button onClick={() => artist.topTracks[0] && onPlay(artist.topTracks[0])} className="detail-play-btn">
              <Play className="h-6 w-6 fill-current" />
            </button>
          </div>
        </div>
      </div>

      <div className="detail-content">
        <h2 className="detail-section-title">Beliebte Titel</h2>
        <div className="home-track-list">
          {artist.topTracks.map((file, index) => (
            <div key={file.id} className={`home-track-item ${currentFile?.id === file.id ? 'is-playing' : ''}`} onClick={() => onPlay(file)}>
              <div className="home-track-index">
                {currentFile?.id === file.id && isPlaying ? (
                  <div className="home-eq-bars"><span /><span /><span /></div>
                ) : (
                  <span className="home-track-number retro-mono">{index + 1}</span>
                )}
              </div>
              <div className="home-track-info">
                <p className="home-track-title">{file.title}</p>
                <p className="home-track-artist">{file.album || 'Unbekannt'}</p>
              </div>
              <span className="home-track-duration">{file.durationLabel || '0:00'}</span>
            </div>
          ))}
        </div>

        {artist.albums.length > 0 && (
          <>
            <h2 className="detail-section-title">Alben</h2>
            <div className="home-scroll-row">
              {artist.albums.map((alb) => (
                <div key={alb.id} className="home-card" onClick={() => onPlay(alb.tracks[0])}>
                  <div className="home-card-cover">
                    <img src={getCoverUrl(alb.tracks[0])} alt={alb.name} className="home-card-img" />
                    <div className="home-card-play">
                      <div className="home-card-play-btn">
                        <Play className="h-5 w-5 fill-current" />
                      </div>
                    </div>
                  </div>
                  <p className="home-card-title">{alb.name}</p>
                  <p className="home-card-subtitle">{alb.trackCount} Titel</p>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </motion.div>
  );
}
