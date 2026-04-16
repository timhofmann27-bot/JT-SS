/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  Lock, 
  Radio, 
  Upload, 
  FileAudio, 
  FileVideo, 
  Activity, 
  LogOut, 
  MoreVertical,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  ChevronRight,
  Wifi,
  Terminal,
  Users,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { FileEntry, Group, View } from './types';

// Mock Data
const MOCK_FILES: FileEntry[] = [
  { id: '1', name: 'Regimentsmarsch_01.mp3', type: 'mp3', size: '4.2 MB', date: '12.03.24' },
  { id: '2', name: 'Parade_Berlin_720p.mp4', type: 'mp4', size: '128.5 MB', date: '10.03.24' },
  { id: '3', name: 'Signal_A_Alpha.mp3', type: 'mp3', size: '1.1 MB', date: '08.03.24' },
  { id: '4', name: 'Marsch_der_Finnlaender.mp3', type: 'mp3', size: '3.8 MB', date: '05.03.24' },
];

const MOCK_GROUPS: Group[] = [
  { id: '1', name: 'Infanterie-Marsch', status: 'Verschlüsselt', members: 42 },
  { id: '2', name: 'Panzer-Lieder', status: 'Verschlüsselt', members: 18 },
];

export default function App() {
  const [view, setView] = useState<View>('login');
  const [token, setToken] = useState('');
  const [currentFile, setCurrentFile] = useState<FileEntry | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [signalStrength, setSignalStrength] = useState(95);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (token.trim()) {
      setView('dashboard');
    }
  };

  const handleLogout = () => {
    setView('login');
    setToken('');
  };

  return (
    <div className="min-h-screen relative overflow-hidden flex flex-col">
      <div className="scanlines" />
      <div className="grain" />

      <AnimatePresence mode="wait">
        {view === 'login' ? (
          <LoginView key="login" token={token} setToken={setToken} onLogin={handleLogin} />
        ) : (
          <div key="app" className="flex-grow flex flex-col">
            <Header onLogout={handleLogout} />
            <main className="flex-grow p-4 space-y-6 pb-32 max-w-2xl mx-auto w-full">
              {view === 'dashboard' ? (
                <DashboardView 
                  files={MOCK_FILES} 
                  onPlay={(file) => { setCurrentFile(file); setIsPlaying(true); }} 
                />
              ) : (
                <GroupsView groups={MOCK_GROUPS} signalStrength={signalStrength} />
              )}
            </main>
            <MiniPlayer 
              currentFile={currentFile} 
              isPlaying={isPlaying} 
              setIsPlaying={setIsPlaying} 
            />
            <Navigation currentView={view} setView={setView} />
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function LoginView({ token, setToken, onLogin }: { token: string, setToken: (v: string) => void, onLogin: (e: React.FormEvent) => void, key?: string }) {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex-grow flex items-center justify-center p-6"
    >
      <div className="w-full max-w-sm bg-anthrazit tactical-border p-8 space-y-8 relative">
        <div className="absolute -top-4 -left-4 bg-schwarz p-2 tactical-border">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square" strokeLinejoin="miter" className="w-12 h-8 text-feldgrau">
            <path d="M12 4 L6 12 L14 12 L8 20" />
            <path d="M28 20 V4 M22 10 L28 4 L34 10" />
          </svg>
        </div>
        
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-akzent-rot animate-pulse" />
            <span className="text-xs font-bold text-akzent-rot uppercase tracking-widest">Status: Zugriff verweigert</span>
          </div>
          <h1 className="text-4xl font-black text-feldgrau leading-none">
            444<br />
            MARSCH<br />
            MUSIK
          </h1>
          <p className="text-[10px] text-feldgrau/60 uppercase tracking-widest">Sicherheitsstufe: MAXIMUM / AES-256-TACTICAL</p>
        </div>

        <form onSubmit={onLogin} className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-widest text-feldgrau/80">Gruppenschlüssel / Token</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-feldgrau/40" />
              <input 
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="•••• •••• ••••"
                className="w-full bg-schwarz tactical-border py-4 pl-10 pr-4 text-feldgrau font-mono tracking-[0.5em] focus:outline-none focus:border-akzent-rot transition-colors"
              />
            </div>
          </div>

          <button 
            type="submit"
            className="w-full bg-feldgrau text-schwarz py-4 font-black uppercase tracking-[0.2em] hover:bg-white transition-colors flex items-center justify-center gap-2"
          >
            <Shield className="w-5 h-5" />
            IDENTIFIZIEREN
          </button>
        </form>

        <div className="pt-6 border-t border-feldgrau/20 flex justify-between items-center text-[8px] text-feldgrau/40 uppercase tracking-tighter">
          <span>System-ID: RX-444-99-B</span>
          <span>Frequenz: 44.40 MHZ</span>
        </div>
      </div>
    </motion.div>
  );
}

function Header({ onLogout }: { onLogout: () => void }) {
  return (
    <header className="bg-anthrazit tactical-border border-t-0 border-x-0 p-4 flex justify-between items-center sticky top-0 z-30">
      <div className="flex items-center gap-3">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square" strokeLinejoin="miter" className="w-9 h-6 text-feldgrau">
          <path d="M12 4 L6 12 L14 12 L8 20" />
          <path d="M28 20 V4 M22 10 L28 4 L34 10" />
        </svg>
        <h1 className="text-lg font-black tracking-widest">444-MARSCH-MUSIK</h1>
      </div>
      <button onClick={onLogout} className="p-2 hover:bg-schwarz transition-colors">
        <LogOut className="w-5 h-5 text-akzent-rot" />
      </button>
    </header>
  );
}

function DashboardView({ files, onPlay }: { files: FileEntry[], onPlay: (f: FileEntry) => void }) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      {/* Status Monitor */}
      <section className="bg-anthrazit tactical-border p-4 border-l-4 border-l-feldgrau">
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <h2 className="text-sm font-bold text-feldgrau">KOMMANDO-SCHNITTSTELLE</h2>
            <p className="text-[10px] text-feldgrau/60 uppercase tracking-widest">Sektor: 444-M / Status: Einsatzbereit</p>
          </div>
          <div className="text-right">
            <span className="text-[8px] text-akzent-rot block">VERSCHLÜSSELUNG</span>
            <span className="text-xs font-bold">AES-256 AKTIV</span>
          </div>
        </div>
      </section>

      {/* File List */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-feldgrau" />
          <h3 className="text-xs font-bold uppercase tracking-widest">Verfügbare Bestände</h3>
        </div>
        <div className="space-y-1">
          {files.map(file => (
            <div 
              key={file.id} 
              className="bg-anthrazit tactical-border p-3 flex items-center gap-4 hover:bg-schwarz transition-colors cursor-pointer group"
              onClick={() => onPlay(file)}
            >
              <div className="w-10 h-10 bg-schwarz tactical-border flex items-center justify-center text-feldgrau">
                {file.type === 'mp3' ? <FileAudio className="w-5 h-5" /> : <FileVideo className="w-5 h-5" />}
              </div>
              <div className="flex-grow min-w-0">
                <div className="flex justify-between items-center">
                  <h4 className="text-xs font-bold truncate uppercase">{file.name}</h4>
                  <span className="text-[8px] px-1 bg-feldgrau text-schwarz font-bold">{file.type.toUpperCase()}</span>
                </div>
                <div className="flex gap-4 mt-1 text-[8px] text-feldgrau/60 uppercase">
                  <span>Größe: {file.size}</span>
                  <span>Datum: {file.date}</span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-feldgrau/20 group-hover:text-feldgrau transition-colors" />
            </div>
          ))}
        </div>
      </section>

      {/* Upload Zone */}
      <section className="bg-anthrazit tactical-border p-6 border-t-2 border-t-feldgrau/20">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[10px] font-bold uppercase tracking-[0.2em]">Verschlüsselter Funkverkehr</h3>
          <div className="w-3 h-1 bg-akzent-rot" />
        </div>
        <div className="border-2 border-dashed border-feldgrau/20 h-32 flex flex-col items-center justify-center gap-2 hover:border-feldgrau transition-colors cursor-pointer">
          <Upload className="w-6 h-6 text-feldgrau/40" />
          <span className="text-[10px] uppercase text-feldgrau/40">Dateien hier ablegen</span>
        </div>
      </section>
    </motion.div>
  );
}

function GroupsView({ groups, signalStrength }: { groups: Group[], signalStrength: number }) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      <section className="bg-anthrazit tactical-border p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-feldgrau" />
          <h3 className="text-xs font-bold uppercase tracking-widest">Status-Monitor</h3>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <span className="text-[8px] text-feldgrau/60 uppercase">Signalstärke</span>
            <div className="flex items-center gap-2">
              <Wifi className="w-4 h-4 text-feldgrau" />
              <span className="text-sm font-bold">{signalStrength}%</span>
            </div>
          </div>
          <div className="space-y-1">
            <span className="text-[8px] text-feldgrau/60 uppercase">Verschlüsselung</span>
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-feldgrau" />
              <span className="text-sm font-bold">AES-256</span>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-feldgrau" />
          <h3 className="text-xs font-bold uppercase tracking-widest">Aktive Verbände</h3>
        </div>
        <div className="space-y-2">
          {groups.map(group => (
            <div key={group.id} className="bg-anthrazit tactical-border p-4 flex justify-between items-center">
              <div className="space-y-1">
                <h4 className="text-sm font-bold uppercase">{group.name}</h4>
                <div className="flex gap-3 text-[8px] text-feldgrau/60 uppercase">
                  <span className="flex items-center gap-1"><Lock className="w-2 h-2" /> {group.status}</span>
                  <span className="flex items-center gap-1"><Users className="w-2 h-2" /> {group.members} Mitglieder</span>
                </div>
              </div>
              <button className="px-3 py-1 bg-schwarz tactical-border text-[10px] font-bold hover:bg-akzent-rot hover:text-white transition-colors">
                TRENNEN
              </button>
            </div>
          ))}
        </div>
      </section>
    </motion.div>
  );
}

function MiniPlayer({ currentFile, isPlaying, setIsPlaying }: { currentFile: FileEntry | null, isPlaying: boolean, setIsPlaying: (v: boolean) => void }) {
  if (!currentFile) return null;

  return (
    <div className="fixed bottom-16 left-0 w-full bg-anthrazit tactical-border border-x-0 border-b-0 z-40 p-4 flex items-center justify-between">
      <div className="flex items-center gap-3 overflow-hidden">
        <div className="w-10 h-10 bg-schwarz tactical-border flex items-center justify-center shrink-0">
          <Radio className={`w-5 h-5 text-feldgrau ${isPlaying ? 'animate-pulse' : ''}`} />
        </div>
        <div className="min-w-0">
          <p className="text-[8px] text-feldgrau/60 uppercase leading-none">Aktive Wiedergabe:</p>
          <p className="text-xs font-bold truncate uppercase">{currentFile.name}</p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="hidden sm:flex items-center gap-1 h-4">
          {[...Array(5)].map((_, i) => (
            <motion.div 
              key={i}
              animate={{ height: isPlaying ? [4, 16, 8, 12, 4] : 4 }}
              transition={{ repeat: Infinity, duration: 0.5, delay: i * 0.1, ease: "linear" }}
              className="w-1 bg-feldgrau"
            />
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button className="p-1 hover:text-white transition-colors"><SkipBack className="w-4 h-4" /></button>
          <button 
            onClick={() => setIsPlaying(!isPlaying)}
            className="w-8 h-8 bg-feldgrau text-schwarz flex items-center justify-center hover:bg-white transition-colors"
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
          </button>
          <button className="p-1 hover:text-white transition-colors"><SkipForward className="w-4 h-4" /></button>
        </div>
      </div>
    </div>
  );
}

function Navigation({ currentView, setView }: { currentView: View, setView: (v: View) => void }) {
  return (
    <nav className="fixed bottom-0 left-0 w-full h-16 bg-anthrazit tactical-border border-x-0 border-b-0 flex z-50">
      <button 
        onClick={() => setView('dashboard')}
        className={`flex-1 flex flex-col items-center justify-center gap-1 transition-colors ${currentView === 'dashboard' ? 'bg-feldgrau text-schwarz' : 'hover:bg-schwarz'}`}
      >
        <Radio className="w-5 h-5" />
        <span className="text-[8px] font-bold uppercase tracking-widest">Station</span>
      </button>
      <button 
        onClick={() => setView('groups')}
        className={`flex-1 flex flex-col items-center justify-center gap-1 transition-colors ${currentView === 'groups' ? 'bg-feldgrau text-schwarz' : 'hover:bg-schwarz'}`}
      >
        <Users className="w-5 h-5" />
        <span className="text-[8px] font-bold uppercase tracking-widest">Verbände</span>
      </button>
    </nav>
  );
}
