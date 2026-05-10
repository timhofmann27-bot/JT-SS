import React, { useState, useRef, useEffect } from 'react';
import { X, ListMusic } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface CreatePlaylistDialogProps {
  open: boolean;
  onClose: () => void;
  onCreate: (name: string, description: string) => Promise<void>;
}

export default function CreatePlaylistDialog({ open, onClose, onCreate }: CreatePlaylistDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setName('');
      setDescription('');
      setError('');
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Bitte gib einen Namen ein.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await onCreate(name.trim(), description.trim());
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Erstellen');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="playlist-modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="playlist-modal"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="playlist-modal-header">
              <div className="playlist-modal-icon">
                <ListMusic className="h-6 w-6" />
              </div>
              <h2 className="playlist-modal-title">Neue Playlist</h2>
              <button onClick={onClose} className="playlist-modal-close" aria-label="Schliessen">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} onKeyDown={handleKeyDown}>
              <div className="playlist-modal-body">
                <div className="playlist-modal-field">
                  <label className="playlist-modal-label">Name</label>
                  <input
                    ref={inputRef}
                    type="text"
                    value={name}
                    onChange={(e) => { setName(e.target.value); setError(''); }}
                    placeholder="Meine Playlist"
                    className="playlist-modal-input"
                    maxLength={100}
                    autoComplete="off"
                  />
                </div>
                <div className="playlist-modal-field">
                  <label className="playlist-modal-label">Beschreibung (optional)</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Füge eine optionale Beschreibung hinzu"
                    className="playlist-modal-textarea"
                    rows={3}
                    maxLength={500}
                  />
                </div>
                {error && <p className="playlist-modal-error">{error}</p>}
              </div>

              <div className="playlist-modal-footer">
                <button type="button" onClick={onClose} className="playlist-modal-btn-cancel" disabled={loading}>
                  Abbrechen
                </button>
                <button type="submit" className="playlist-modal-btn-create" disabled={loading || !name.trim()}>
                  {loading ? 'Wird erstellt...' : 'Erstellen'}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
