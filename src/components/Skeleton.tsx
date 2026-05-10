import React from 'react';

/** Pulsing skeleton placeholder for text lines */
export function Skeleton({ className = '', width, height = 16 }: { className?: string; width?: number | string; height?: number }) {
  return (
    <div
      className={`skeleton ${className}`}
      style={{
        width: width ?? '100%',
        height,
        borderRadius: 4,
      }}
    />
  );
}

/** Skeleton placeholder for a round element (avatar, cover art) */
export function SkeletonCircle({ size = 48 }: { size?: number }) {
  return <div className="skeleton skeleton-circle" style={{ width: size, height: size, borderRadius: '50%' }} />;
}

/** Skeleton placeholder for a track row */
export function SkeletonTrackRow() {
  return (
    <div className="skeleton-track-row">
      <div className="skeleton skeleton-circle" style={{ width: 40, height: 40, borderRadius: '50%' }} />
      <div className="skeleton-track-text">
        <Skeleton width="60%" height={14} />
        <Skeleton width="40%" height={11} />
      </div>
      <Skeleton width={36} height={14} />
    </div>
  );
}

/** Renders N skeleton track rows */
export function SkeletonTrackList({ count = 5 }: { count?: number }) {
  return (
    <div className="skeleton-list">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonTrackRow key={i} />
      ))}
    </div>
  );
}

/** Grid of skeleton cards (for albums/artists) */
export function SkeletonCardGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="skeleton-card-grid">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton-card">
          <Skeleton width="100%" height={0} className="skeleton-cover" />
          <Skeleton width="75%" height={13} />
          <Skeleton width="50%" height={11} />
        </div>
      ))}
    </div>
  );
}
