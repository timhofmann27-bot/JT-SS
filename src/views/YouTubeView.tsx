import React, { useState, useCallback } from 'react';
import { Youtube, Download, Loader2, CheckCircle2, AlertCircle, Music2, XCircle } from 'lucide-react';
import { motion } from 'motion/react';
import { apiUrl } from '../lib/api';

interface YouTubeViewProps {
  token: string;
}

export default function YouTubeView({ token }: YouTubeViewProps) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [downloadId, setDownloadId] = useState('');
  const [status, setStatus] = useState('');
  const [title, setTitle] = useState('');
  const [progress, setProgress] = useState(0);
  const [totalTracks, setTotalTracks] = useState(0);
  const [downloadedCount, setDownloadedCount] = useState(0);

  const cancelDownload = useCallback(async () => {
    if (!downloadId) return;
    try {
      await fetch(apiUrl(`/api/download/${downloadId}`), {
        method: 'DELETE',
        headers: { 'x-share-token': token },
      });
    } catch {}
    setLoading(false);
    setStatus('');
    setDownloadId('');
    setProgress(0);
  }, [downloadId, token]);

  const startDownload = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    setError('');
    setLoading(true);
    setStatus('starting');
    try {
      const res = await fetch(apiUrl('/api/download'), {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-share-token': token },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Download fehlgeschlagen');
      setDownloadId(data.id);
      pollStatus(data.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Download');
      setLoading(false);
      setStatus('');
    }
  }, [url, token]);

  const pollStatus = useCallback((id: string) => {
    let failCount = 0;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(apiUrl(`/api/download/${id}`), {
          headers: { 'x-share-token': token },
        });
        if (!res.ok) throw new Error('Status nicht verfuegbar');
        const data = await res.json();
        failCount = 0;
        setStatus(data.status);
        setTitle(data.title || '');
        setProgress(data.progress || 0);
        if (data.totalTracks) setTotalTracks(data.totalTracks);
        if (data.downloadedCount) setDownloadedCount(data.downloadedCount);

        if (data.status === 'done') {
          clearInterval(interval);
          setLoading(false);
          setUrl('');
          // Clear file cache so next page visit shows new files
          try { localStorage.removeItem('jt-files'); } catch {}
        }
        if (data.status === 'error') {
          clearInterval(interval);
          setLoading(false);
          setError(data.error || 'Download fehlgeschlagen');
        }
      } catch {
        failCount++;
        if (failCount >= 5) {
          clearInterval(interval);
          setLoading(false);
          setError('Server nicht erreichbar. Download laeuft evtl. im Hintergrund weiter.');
        }
      }
    }, 2000);
  }, [token]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="yt-view">
      <div className="yt-container">
        <div className="yt-hero">
          <div className="yt-hero-icon">
            <Youtube className="h-10 w-10" />
          </div>
          <h1 className="yt-hero-title">YouTube Downloader</h1>
          <p className="yt-hero-subtitle">
            Füge einen YouTube- oder YouTube-Music-Link ein — einzelne Videos oder ganze Alben.
          </p>
        </div>

        <form onSubmit={startDownload} className="yt-form">
          <div className="yt-input-wrapper">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
              className="yt-input"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !url.trim()}
              className="yt-submit-btn"
            >
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Download className="h-5 w-5" />
              )}
              <span>Download</span>
            </button>
          </div>
        </form>

        {status && (
          <div className="yt-status">
            {status === 'downloading' && (
              <div className="yt-status-card">
                <Loader2 className="h-6 w-6 animate-spin text-brand" />
                <div className="yt-status-info">
                  <p className="yt-status-title">{title || 'Download läuft...'}</p>
                  {totalTracks > 0 && (
                    <p className="yt-status-track-count">{Math.min(downloadedCount + 1, totalTracks)} / {totalTracks} Titel</p>
                  )}
                  <div className="yt-progress-bar">
                    <div
                      className="yt-progress-fill"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <p className="yt-status-pct">{progress}%</p>
                </div>
                <button onClick={cancelDownload} className="yt-cancel-btn" title="Abbrechen">
                  <XCircle className="h-5 w-5" />
                </button>
              </div>
            )}

            {status === 'starting' && (
              <div className="yt-status-card">
                <Loader2 className="h-6 w-6 animate-spin text-brand" />
                <div className="yt-status-info">
                  <p className="yt-status-title">Download wird gestartet...</p>
                </div>
                <button onClick={cancelDownload} className="yt-cancel-btn" title="Abbrechen">
                  <XCircle className="h-5 w-5" />
                </button>
              </div>
            )}

            {status === 'done' && (
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="yt-status-card yt-status-done"
              >
                <CheckCircle2 className="h-6 w-6 text-green-500" />
                <div className="yt-status-info">
                  <p className="yt-status-title">{title || 'Download abgeschlossen'}</p>
                  <p className="yt-status-pct text-green-500">100% — Bereit in deiner Bibliothek!</p>
                </div>
              </motion.div>
            )}
          </div>
        )}

        {error && (
          <div className="yt-error">
            <AlertCircle className="h-5 w-5" />
            <span>{error}</span>
          </div>
        )}

        <div className="yt-info-box">
          <h3 className="yt-info-title">So funktioniert's</h3>
          <div className="yt-info-steps">
            <div className="yt-info-step">
              <span className="yt-step-num">1</span>
              <span>YouTube-Video-Link einfügen</span>
            </div>
            <div className="yt-info-step">
              <span className="yt-step-num">2</span>
              <span>Auf „Download" klicken</span>
            </div>
            <div className="yt-info-step">
              <span className="yt-step-num">3</span>
              <span>Der Track erscheint automatisch in deiner Bibliothek</span>
            </div>
          </div>
          <div className="yt-note">
            <Music2 className="h-4 w-4" />
            <span>Einzelne Videos oder ganze Alben/Playlists werden als MP3 gespeichert</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
