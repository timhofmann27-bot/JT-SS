import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Sparkles, Smartphone, Bell, Music2, Youtube, Disc3,
  Heart, Download, Search, ChevronRight, X,
} from 'lucide-react';

interface ChatMessage {
  from: 'system' | 'user';
  text: string;
  icon?: React.ReactNode;
  choices?: { label: string; value: string; icon?: React.ReactNode }[];
}

interface OnboardingStep {
  id: string;
  messages: ChatMessage[];
}

export default function OnboardingWizard({
  isOpen,
  onComplete,
}: {
  isOpen: boolean;
  onComplete: () => void;
}) {
  const [step, setStep] = useState(0);
  const [revealed, setRevealed] = useState(0);
  const [typing, setTyping] = useState(true);

  useEffect(() => {
    if (revealed < steps[step].messages.length) {
      const timer = setTimeout(() => {
        setRevealed(r => r + 1);
        setTyping(true);
        setTimeout(() => setTyping(false), 600);
      }, 900);
      return () => clearTimeout(timer);
    }
  }, [revealed, step]);

  const steps: OnboardingStep[] = [
    {
      id: 'welcome',
      messages: [
        { from: 'system', text: '🎵 Hey! Willkommen bei JT-MP3.', icon: <Sparkles className="w-4 h-4" /> },
        { from: 'system', text: 'Dein Musik-Streaming ist startklar — lass mich dir kurz zeigen, was alles geht.' },
        { from: 'system', text: 'Los geht\'s?', choices: [
          { label: 'Ja, zeig her! 🎧', value: 'next' },
          { label: 'Später', value: 'skip' },
        ]},
      ],
    },
    {
      id: 'install',
      messages: [
        { from: 'system', text: '📱 Füg JT-MP3 zu deinem Startbildschirm hinzu.', icon: <Smartphone className="w-4 h-4" /> },
        { from: 'system', text: 'So hast du deine Musik immer mit einem Tap — wie Spotify.' },
        { from: 'system', text: 'Tipp im Browser auf <b>Teilen</b> → <b>„Zum Home-Bildschirm"</b>.' },
        { from: 'system', text: '', choices: [
          { label: 'Verstanden 👍', value: 'next' },
        ]},
      ],
    },
    {
      id: 'library',
      messages: [
        { from: 'system', text: '🎧 Deine <b>Bibliothek</b> ist das Herzstück.', icon: <Disc3 className="w-4 h-4" /> },
        { from: 'system', text: 'Hier findest du alle Playlists, Künstler und Alben. Sortier sie nach A–Z oder zuletzt hinzugefügt.' },
        { from: 'system', text: 'Erstelle eigene Playlists über die Seitenleiste und füge Songs per Rechtsklick hinzu.', choices: [
          { label: 'Klingt gut!', value: 'next' },
        ]},
      ],
    },
    {
      id: 'youtube',
      messages: [
        { from: 'system', text: '⬇️ Der <b>YouTube Downloader</b> holt Musik direkt zu dir.', icon: <Youtube className="w-4 h-4" /> },
        { from: 'system', text: 'Füge einen YouTube- oder YouTube-Music-Link ein — einzelne Videos oder ganze Alben.' },
        { from: 'system', text: 'Die Songs landen als MP3 direkt in deiner Bibliothek. Mit Cover und Metadaten.' },
        { from: 'system', text: 'Bereits vorhandene Titel werden automatisch übersprungen.', choices: [
          { label: 'Nice! 🎸', value: 'next' },
        ]},
      ],
    },
    {
      id: 'aistudio',
      messages: [
        { from: 'system', text: '🤖 Das <b>KI Studio</b> generiert Musik mit AI.', icon: <Sparkles className="w-4 h-4" /> },
        { from: 'system', text: 'Gib einen Prompt oder eigene Lyrics ein — die KI macht den Rest.' },
        { from: 'system', text: 'Kostenlos und unbegrenzt. Wähl Style, Tempo und Sprache.' },
        { from: 'system', text: 'Deine generierten Songs landen direkt in der Bibliothek.', choices: [
          { label: 'Ausprobieren! ✨', value: 'next' },
        ]},
      ],
    },
    {
      id: 'done',
      messages: [
        { from: 'system', text: 'Das war\'s! 🎉', icon: <Music2 className="w-4 h-4" /> },
        { from: 'system', text: 'Deine Musik wartet. Lad was hoch, such in der Bibliothek oder generier was Neues.' },
        { from: 'system', text: 'Viel Spaß mit JT-MP3! 🤘', choices: [
          { label: 'Zur App', value: 'done', icon: <ChevronRight className="w-4 h-4" /> },
        ]},
      ],
    },
  ];

  const current = steps[step];
  const visibleMessages = current.messages.slice(0, revealed);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center sm:p-4"
        >
          <div className="absolute inset-0 bg-black/80 backdrop-blur-xl" />

          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            className="relative z-10 w-full max-w-lg max-h-[85vh] sm:max-h-[90vh] bg-[#0D0D0D] border border-white/10 sm:rounded-[2rem] rounded-t-[2rem] overflow-hidden shadow-2xl flex flex-col"
          >
            {/* Chat header */}
            <div className="shrink-0 px-5 py-4 border-b border-white/10 flex items-center gap-3 bg-[#0D0D0D]">
              <div className="w-10 h-10 rounded-2xl bg-[#FF6B35] flex items-center justify-center">
                <Music2 className="w-5 h-5 text-black" />
              </div>
              <div>
                <p className="text-sm font-black text-text">JT-MP3</p>
                <p className="text-[10px] text-text-dim">Willkommens-Assistent</p>
              </div>
            </div>

            {/* Progress dots */}
            <div className="shrink-0 flex justify-center gap-1.5 py-2 bg-[#0D0D0D]">
              {steps.map((_, i) => (
                <div
                  key={i}
                  className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                    i <= step ? 'bg-[#FF6B35] scale-110' : 'bg-white/15'
                  }`}
                />
              ))}
            </div>

            {/* Chat messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3" style={{ background: '#0D0D0D' }}>
              {visibleMessages.map((msg, i) => {
                if (!msg.text && (!msg.choices || msg.choices.length === 0)) return null;
                const isLast = i === visibleMessages.length - 1;

                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 10, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.25 }}
                    className={`flex ${msg.from === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`flex gap-2.5 max-w-[85%] ${msg.from === 'user' ? 'flex-row-reverse' : ''}`}>
                      {msg.from === 'system' && msg.icon && (
                        <div className="w-8 h-8 rounded-xl bg-[#FF6B35]/10 flex items-center justify-center shrink-0 mt-0.5">
                          {msg.icon}
                        </div>
                      )}
                      {msg.from === 'system' && !msg.icon && (
                        <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center shrink-0 mt-0.5">
                          <Sparkles className="w-4 h-4 text-[#FF6B35]/40" />
                        </div>
                      )}
                      <div>
                        {msg.text && (
                          <div
                            className={`px-4 py-3 text-sm leading-relaxed ${
                              msg.from === 'user'
                                ? 'bg-[#FF6B35] text-white rounded-2xl rounded-tr-md'
                                : 'bg-white/5 text-text/90 rounded-2xl rounded-tl-md'
                            }`}
                            dangerouslySetInnerHTML={{ __html: msg.text.replace(/\n/g, '<br/>') }}
                          />
                        )}
                        {msg.choices && isLast && (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {msg.choices.map((choice) => (
                              <button
                                key={choice.value}
                                onClick={() => {
                                  if (choice.value === 'skip') onComplete();
                                  else if (choice.value === 'done') onComplete();
                                  else {
                                    setRevealed(0);
                                    setStep(s => s + 1);
                                  }
                                }}
                                className="flex items-center gap-2 px-4 py-2.5 bg-[#FF6B35] text-white rounded-xl text-sm font-semibold hover:bg-[#FF8C5A] transition-all active:scale-95"
                              >
                                {choice.icon}
                                {choice.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}

              {typing && revealed < current.messages.length && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 pl-10">
                  <div className="flex gap-1 px-4 py-3 bg-white/5 rounded-2xl rounded-tl-md">
                    <span className="w-2 h-2 rounded-full bg-[#FF6B35]/60 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 rounded-full bg-[#FF6B35]/60 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 rounded-full bg-[#FF6B35]/60 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </motion.div>
              )}
            </div>

            <div className="shrink-0 px-4 pb-4 pt-1 text-center bg-[#0D0D0D]">
              <button
                onClick={onComplete}
                className="text-[11px] text-text-dim hover:text-text-muted transition-colors font-medium"
              >
                Überspringen → Direkt zur App
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
