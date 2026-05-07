import React, { useState, useCallback } from 'react';
import { Sparkles, Music2, Clock, Gauge, KeyRound, Dice5, Languages, FileText, Play, Loader2, Type, PartyPopper } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { apiUrl } from '../lib/api';
import { toast } from '../lib/toast';

interface AIStudioViewProps {
  token: string;
}

export default function AIStudioView({ token }: AIStudioViewProps) {
  const [prompt, setPrompt] = useState('');
  const [songTitle, setSongTitle] = useState('');
  const [lyrics, setLyrics] = useState('');
  const [duration, setDuration] = useState('30');
  const [language, setLanguage] = useState('de');
  const [instrumental, setInstrumental] = useState(false);
  const [bpm, setBpm] = useState('');
  const [key, setKey] = useState('');
  const [seed, setSeed] = useState('');
  const [sampleMode, setSampleMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string[] | null>(null);

  const handleGenerate = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() && !lyrics.trim() && !sampleMode) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(apiUrl('/api/generate'), {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-share-token': token },
        body: JSON.stringify({
          prompt: prompt.trim() || (lyrics.trim() ? 'Generate music for lyrics' : undefined),
          title: songTitle.trim() || undefined,
          lyrics: lyrics.trim() || undefined,
          duration: duration || undefined,
          language,
          instrumental: instrumental || undefined,
          bpm: bpm || undefined,
          key: key || undefined,
          seed: seed || undefined,
          sampleMode: sampleMode || undefined,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setResult(data.titles);
        toast.downloadDone(songTitle.trim() || 'KI-Song generiert');
      } else {
        toast.removed(data.error || 'Fehler');
      }
    } catch {
      toast.removed('Netzwerkfehler');
    } finally {
      setLoading(false);
    }
  }, [prompt, songTitle, lyrics, duration, language, instrumental, bpm, key, seed, sampleMode, token]);

  const languages = [
    { code: 'de', name: 'Deutsch' },
    { code: 'en', name: 'Englisch' },
    { code: 'ja', name: 'Japanisch' },
    { code: 'ko', name: 'Koreanisch' },
    { code: 'zh', name: 'Chinesisch' },
    { code: 'fr', name: 'Französisch' },
    { code: 'es', name: 'Spanisch' },
    { code: 'it', name: 'Italienisch' },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="yt-view" style={{ padding: '1.5rem', maxWidth: 680, margin: '0 auto' }}>
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-full bg-[#FF6B35] flex items-center justify-center">
            <Sparkles className="h-5 w-5 text-black" />
          </div>
          <h1 className="text-2xl font-black" style={{ letterSpacing: '-0.03em' }}>KI Studio</h1>
        </div>
        <p className="text-sm text-muted">Generiere Musik mit KI — kostenlos, unbegrenzt.</p>
      </div>

      {/* Success banner */}
      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -5 }}
            className="mb-5 p-4 rounded-2xl bg-success/10 border border-success/30 flex items-center gap-3"
          >
            <div className="w-10 h-10 rounded-xl bg-success/20 flex items-center justify-center">
              <PartyPopper className="w-5 h-5 text-success" />
            </div>
            <div>
              <p className="font-black text-success text-sm">Song generiert! 🎉</p>
              <p className="text-xs text-success/70">In deiner Bibliothek verfügbar.</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <form onSubmit={handleGenerate} className="space-y-5">
        {/* Song Title */}
        <div>
          <label className="flex items-center gap-2 text-sm font-bold text-muted mb-2">
            <Type className="h-4 w-4" /> Song-Titel (optional)
          </label>
          <input
            type="text"
            value={songTitle}
            onChange={(e) => setSongTitle(e.target.value)}
            placeholder="z.B. Mein neuer Hit"
            className="w-full h-12 px-4 rounded-xl bg-[#282828] border border-white/10 text-white placeholder:text-muted outline-none focus:border-[#FF6B35] transition-colors text-sm font-semibold"
            maxLength={100}
          />
        </div>

        {/* Prompt */}
        <div>
          <label className="flex items-center gap-2 text-sm font-bold text-muted mb-2">
            <FileText className="h-4 w-4" /> Prompt
          </label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="z.B. epischer Rock-Song über Freiheit mit Gitarrensolo"
            className="w-full h-24 px-4 py-3 rounded-xl bg-[#282828] border border-white/10 text-white placeholder:text-muted outline-none focus:border-[#FF6B35] transition-colors resize-none text-sm"
          />
        </div>

        {/* Lyrics */}
        <div>
          <label className="flex items-center gap-2 text-sm font-bold text-muted mb-2">
            <Music2 className="h-4 w-4" /> Lyrics (optional)
          </label>
          <textarea
            value={lyrics}
            onChange={(e) => setLyrics(e.target.value)}
            placeholder="[Verse 1]&#10;Dein Text hier...&#10;&#10;[Chorus]&#10;Dein Refrain..."
            className="w-full h-28 px-4 py-3 rounded-xl bg-[#282828] border border-white/10 text-white placeholder:text-muted outline-none focus:border-[#FF6B35] transition-colors resize-none text-sm font-mono"
          />
        </div>

        {/* Settings Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="flex items-center gap-2 text-xs font-bold text-muted mb-1.5">
              <Clock className="h-3.5 w-3.5" /> Dauer (Sek.)
            </label>
            <input type="number" value={duration} onChange={(e) => setDuration(e.target.value)}
              className="w-full h-10 px-3 rounded-lg bg-[#282828] border border-white/10 text-white text-sm outline-none focus:border-[#FF6B35]" />
          </div>
          <div>
            <label className="flex items-center gap-2 text-xs font-bold text-muted mb-1.5">
              <Languages className="h-3.5 w-3.5" /> Sprache
            </label>
            <select value={language} onChange={(e) => setLanguage(e.target.value)}
              className="w-full h-10 px-3 rounded-lg bg-[#282828] border border-white/10 text-white text-sm outline-none focus:border-[#FF6B35]">
              {languages.map(l => <option key={l.code} value={l.code}>{l.name}</option>)}
            </select>
          </div>
          <div>
            <label className="flex items-center gap-2 text-xs font-bold text-muted mb-1.5">
              <Gauge className="h-3.5 w-3.5" /> BPM
            </label>
            <input type="number" value={bpm} onChange={(e) => setBpm(e.target.value)} placeholder="z.B. 140"
              className="w-full h-10 px-3 rounded-lg bg-[#282828] border border-white/10 text-white text-sm outline-none focus:border-[#FF6B35] placeholder:text-muted" />
          </div>
          <div>
            <label className="flex items-center gap-2 text-xs font-bold text-muted mb-1.5">
              <KeyRound className="h-3.5 w-3.5" /> Tonart
            </label>
            <input type="text" value={key} onChange={(e) => setKey(e.target.value)} placeholder="z.B. C major"
              className="w-full h-10 px-3 rounded-lg bg-[#282828] border border-white/10 text-white text-sm outline-none focus:border-[#FF6B35] placeholder:text-muted" />
          </div>
          <div>
            <label className="flex items-center gap-2 text-xs font-bold text-muted mb-1.5">
              <Dice5 className="h-3.5 w-3.5" /> Seed
            </label>
            <input type="number" value={seed} onChange={(e) => setSeed(e.target.value)} placeholder="z.B. 42"
              className="w-full h-10 px-3 rounded-lg bg-[#282828] border border-white/10 text-white text-sm outline-none focus:border-[#FF6B35] placeholder:text-muted" />
          </div>
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={instrumental} onChange={(e) => setInstrumental(e.target.checked)}
                className="accent-[#FF6B35] w-4 h-4" />
              <span className="text-sm text-muted">Instrumental</span>
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={sampleMode} onChange={(e) => setSampleMode(e.target.checked)}
                className="accent-[#FF6B35] w-4 h-4" />
              <span className="text-sm text-muted">AI schreibt alles</span>
            </label>
          </div>
        </div>

        {/* Generate Button */}
        <button
          type="submit"
          disabled={loading || (!prompt.trim() && !lyrics.trim() && !sampleMode)}
          className="w-full h-14 rounded-full bg-[#FF6B35] text-black font-black text-lg flex items-center justify-center gap-2 hover:bg-[#FF8C5A] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? (
            <><Loader2 className="h-5 w-5 animate-spin" /> Generiere...</>
          ) : (
            <><Sparkles className="h-5 w-5" /> Musik generieren</>
          )}
        </button>
      </form>

      {/* Result */}
      {result && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mt-6 p-4 rounded-xl bg-[#1DB954]/10 border border-[#1DB954]/30">
          <div className="flex items-center gap-2 text-[#1DB954] mb-2">
            <Play className="h-4 w-4 fill-current" />
            <span className="font-bold text-sm">Generiert!</span>
          </div>
          <p className="text-sm text-muted">{songTitle.trim() || result.length} Song{!songTitle && result.length !== 1 ? 's' : ''} zur Bibliothek hinzugefügt.</p>
        </motion.div>
      )}
    </motion.div>
  );
}
