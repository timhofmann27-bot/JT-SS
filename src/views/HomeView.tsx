import React, { useRef, useMemo, useState, useEffect } from 'react';
import { motion, useMotionValue, useTransform } from 'motion/react';
import {
  Heart,
  Play,
  Disc3,
  Upload,
  ListPlus,
  Share2,
  Trash2,
  Clock,
} from 'lucide-react';
import type { ApiFile, Album, Artist } from '../types';
import { useContextMenu, type ContextMenuItem } from '../components/ui';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';
import { coverUrl } from '../lib/api';


function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Guten Morgen';
  if (hour < 18) return 'Guten Tag';
  return 'Guten Abend';
}

/** Touch-only swipeable track row wrapper */
function SwipeableTrackRow({
  file,
  currentId,
  isPlaying,
  liked,
  index,
  token,
  onPlay,
  onLike,
  onDelete,
  onAddToQueue,
  isTouch,
  onContextMenu,
}: {
  file: ApiFile;
  currentId: string | null;
  isPlaying: boolean;
  liked: boolean;
  index: number;
  token?: string;
  onPlay: (f: ApiFile) => void;
  onLike: (f: ApiFile) => void;
  onDelete: (f: ApiFile) => void;
  onAddToQueue: (f: ApiFile) => void;
  isTouch: boolean;
  onContextMenu: (e: React.MouseEvent, f: ApiFile) => void;
}) {
  const dragX = useMotionValue(0);
  const leftOpacity = useTransform(dragX, [-120, -40, 0], [1, 0, 0]);
  const rightOpacity = useTransform(dragX, [0, 40, 120], [0, 0, 1]);

  return (
    <div style={{ position: 'relative', overflow: 'hidden' }}>
      {/* Swipe-hintergrund */}
      {isTouch && (
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          pointerEvents: 'none',
        }}>
          <motion.div style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            paddingLeft: 20,
            background: '#E91429',
            opacity: leftOpacity,
          }}>
            <Trash2 className="h-5 w-5 text-white" />
          </motion.div>
          <motion.div style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            paddingRight: 20,
            background: '#FF6B35',
            opacity: rightOpacity,
          }}>
            <ListPlus className="h-5 w-5 text-white" />
          </motion.div>
        </div>
      )}

      {/* Track row */}
      <motion.div
        drag={isTouch ? 'x' : false}
        dragConstraints={{ left: -120, right: 120 }}
        dragElastic={0.1}
        dragSnapToOrigin
        style={{
          x: dragX,
          position: 'relative',
          zIndex: 1,
          background: '#121212',
          touchAction: isTouch ? 'pan-y' : 'auto',
        }}
        onDragEnd={(_, info) => {
          if (info.offset.x < -80) onDelete(file);
          else if (info.offset.x > 80) onAddToQueue(file);
        }}
        onClick={() => onPlay(file)}
        onContextMenu={(e: React.MouseEvent) => onContextMenu(e, file)}
      >
        <div className={`home-track-item ${currentId === file.id ? 'is-playing' : ''}`} style={{ pointerEvents: 'none' }}>
          <div className="home-track-index">
            {currentId === file.id && isPlaying ? (
              <div className="home-eq-bars">
                <span /><span /><span />
              </div>
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
            className={`home-track-like ${liked ? 'is-liked' : ''}`}
            onClick={(e) => { e.stopPropagation(); onLike(file); }}
            style={{ pointerEvents: 'auto' }}
          >
            <Heart className={`h-5 w-5 ${liked ? 'fill-current' : ''}`} />
          </button>
          <span className="home-track-duration">{file.durationLabel || '0:00'}</span>
        </div>
      </motion.div>
    </div>
  );
}

interface HomeViewProps {
  files: ApiFile[];
  filteredFiles: ApiFile[];
  currentFile: ApiFile | null;
  isPlaying: boolean;
  likedIds: Set<string>;
  onPlay: (f: ApiFile) => void;
  onLike: (f: ApiFile) => void;
  onOpenUpload: () => void;
  likedFiles: ApiFile[];
  albums: Album[];
  onAlbumSelect: (a: Album) => void;
  onArtistSelect: (a: Artist) => void;
  onPlayAlbum: (a: Album) => void;
  onAddToQueue: (f: ApiFile) => void;
  onDelete: (f: ApiFile) => void;
  token?: string;
}

export default function HomeView({
  files,
  filteredFiles,
  currentFile,
  isPlaying,
  likedIds,
  onPlay,
  onLike,
  onOpenUpload,
  likedFiles,
  albums,
  onAlbumSelect,
  onArtistSelect,
  onPlayAlbum,
  onAddToQueue,
  onDelete,
  token,
}: HomeViewProps) {
  const { open: openCtx, menu: CtxMenu } = useContextMenu();
  const listContainerRef = useRef<HTMLDivElement>(null);
  const [isTouch, setIsTouch] = useState(false);

  useEffect(() => {
    setIsTouch(window.matchMedia('(hover: none) and (pointer: coarse)').matches);
  }, []);

  const {
    visibleItems: visibleTracks,
    hasMore: hasMoreTracks,
    observerRef: trackObserverRef,
  } = useInfiniteScroll({ items: filteredFiles, pageSize: 20 });

  function handleTrackContext(e: React.MouseEvent, file: ApiFile) {
    const items: ContextMenuItem[] = [
      { icon: <Play className="h-4 w-4" />, label: 'Abspielen', onClick: () => onPlay(file) },
      { icon: <ListPlus className="h-4 w-4" />, label: 'Zu Warteschlange', onClick: () => onAddToQueue(file) },
      { divider: true, label: '', onClick: () => {} },
      { icon: <Heart className="h-4 w-4" />, label: likedIds.has(file.id) ? 'Aus Lieblingstiteln entfernen' : 'Zu Lieblingstiteln', onClick: () => onLike(file) },
      { divider: true, label: '', onClick: () => {} },
      { icon: <Share2 className="h-4 w-4" />, label: 'Teilen', onClick: () => {} },
      { icon: <Trash2 className="h-4 w-4" />, label: 'Entfernen', onClick: () => onDelete(file), danger: true },
    ];
    openCtx(e, items, file);
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="home-view">
      <div className="home-content">
        {files.length === 0 ? (
          <div className="home-empty">
            <div className="mb-6 w-24 h-24 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto">
              <Disc3 className="h-14 w-14 opacity-30" />
            </div>
            <h2 className="home-empty-title">Deine Musik wartet</h2>
            <p className="home-empty-text">Lade Musik hoch oder nutze den YouTube-Downloader.</p>
            <button onClick={onOpenUpload} className="home-upload-btn">
              <Upload className="h-5 w-5" />
              Dateien hochladen
            </button>
          </div>
        ) : (
          <>
            {/* Greeting */}
            <h1 className="home-greeting">{getGreeting()}</h1>

            {/* Liked Songs Hero Tile */}
            {likedFiles.length > 0 && (
              <div className="home-section">
                <div className="liked-hero-tile" onClick={() => likedFiles[0] && onPlay(likedFiles[0])}>
                  <div className="liked-hero-icon">
                    <Heart className="h-10 w-10" fill="white" />
                  </div>
                  <div className="liked-hero-text">
                    <span className="liked-hero-label">Playlist</span>
                    <span className="liked-hero-title">Lieblingstitel</span>
                    <span className="liked-hero-count">{likedFiles.length} Titel</span>
                  </div>
                  <button className="liked-hero-play" onClick={(e) => { e.stopPropagation(); likedFiles[0] && onPlay(likedFiles[0]); }}>
                    <Play className="h-6 w-6 fill-current" />
                  </button>
                </div>
              </div>
            )}

            {/* Kürzlich gehört */}
            {files.length > 0 && (
              <div className="home-section">
                <div className="home-section-header">
                  <h2 className="home-section-title">Kürzlich gehört</h2>
                </div>
                <div className="home-scroll-row">
                  {files.slice(0, 8).map((file) => (
                    <div key={file.id} className="home-card" onClick={() => onPlay(file)}>
                      <div className="home-card-cover">
                        {file.hasArtwork ? (
                          <img src={coverUrl(file, { token, artist: file?.artist, album: file?.album })} alt={file.title} className="home-card-img" />
                        ) : (
                          <div className="home-card-placeholder">
                            <Disc3 className="h-10 w-10" />
                          </div>
                        )}
                        <div className="home-card-play">
                          <button
                            className="home-card-play-btn"
                            onClick={(e) => { e.stopPropagation(); onPlay(file); }}
                          >
                            <Play className="h-5 w-5 fill-current translate-x-0.5" />
                          </button>
                        </div>
                      </div>
                      <p className="home-card-title">{file.title}</p>
                      <p className="home-card-subtitle">{file.artist || file.album || 'Unbekannt'}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Deine Alben */}
            {albums.length > 0 && (
              <div className="home-section">
                <div className="home-section-header">
                  <h2 className="home-section-title">Deine Alben</h2>
                  <span className="home-section-link">Alle anzeigen</span>
                </div>
                <div className="home-scroll-row">
                  {albums.slice(0, 8).map((album) => (
                    <div key={album.id} className="home-card" onClick={() => onAlbumSelect(album)}>
                      <div className="home-card-cover">
                        {album.tracks[0]?.hasArtwork ? (
                          <img src={coverUrl(album.tracks[0], { token, artist: album.artist, album: album.name })} alt={album.name} className="home-card-img" />
                        ) : (
                          <div className="home-card-placeholder">
                            <Disc3 className="h-10 w-10" />
                          </div>
                        )}
                        <div className="home-card-play">
                          <button
                            className="home-card-play-btn"
                            onClick={(e) => { e.stopPropagation(); onPlayAlbum(album); }}
                          >
                            <Play className="h-5 w-5 fill-current translate-x-0.5" />
                          </button>
                        </div>
                      </div>
                      <p className="home-card-title">{album.name}</p>
                      <p className="home-card-subtitle">{album.artist || `${album.trackCount} Titel`}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Alle Titel */}
            <div className="home-section">
              <div className="home-section-header">
                <h2 className="home-section-title">Alle Titel</h2>
              </div>
              <div className="home-track-list" ref={listContainerRef}>
                {visibleTracks.map((file, index) => (
                  <SwipeableTrackRow
                    key={file.id}
                    file={file}
                    currentId={currentFile?.id ?? null}
                    isPlaying={isPlaying}
                    liked={likedIds.has(file.id)}
                    index={index}
                    token={token}
                    onPlay={onPlay}
                    onLike={onLike}
                    onDelete={onDelete}
                    onAddToQueue={onAddToQueue}
                    isTouch={isTouch}
                    onContextMenu={handleTrackContext}
                  />
                ))}
                {hasMoreTracks && (
                  <div ref={trackObserverRef} className="infinite-scroll-sentinel">
                    <div className="loading-spinner" />
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
      {CtxMenu}
    </motion.div>
  );
}
