import React, { useState } from 'react';
import { User, LogOut, ChevronRight, Shield, ShieldCheck, Mail, Calendar, Key, X, CheckCircle2, Heart, Copy } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { AuthUser } from '../types';
import { AppHeader, ProfileMenuRow } from '../components/layout';
import { Dialog, ImmersiveInput, ImmersiveButton } from '../components/ui';
import { apiFetch } from '../lib/api';

interface ProfileViewProps {
  user: AuthUser | null;
  token: string;
  likedCount: number;
  onLikedSongs: () => void;
  onLogout: () => void;
}

const API_BASE = import.meta.env.VITE_API_BASE ?? '';
function apiUrl(path: string) { return `${API_BASE}${path}`; }

export default function ProfileView({ user, token, likedCount, onLikedSongs, onLogout }: ProfileViewProps) {
  const [modal, setModal] = useState<'password' | 'email' | 'mfa' | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  // MFA states
  const [mfaData, setMfaData] = useState<{ qrCodeUrl: string; secret: string } | null>(null);
  const [mfaToken, setMfaToken] = useState('');

  // Form states
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [newEmail, setNewEmail] = useState('');

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (modal === 'password' && newPassword !== confirmPassword) {
      setError('Passwörter stimmen nicht überein');
      setLoading(false);
      return;
    }

    try {
      await apiFetch('/api/auth/update-profile', {
        method: 'POST',
        token,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          currentPassword,
          newPassword: modal === 'password' ? newPassword : undefined,
          newEmail: modal === 'email' ? newEmail : undefined,
        }),
      });

      setSuccess(true);
      setTimeout(() => {
        setModal(null);
        setSuccess(false);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setNewEmail('');
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ein Fehler ist aufgetreten');
    } finally {
      setLoading(false);
    }
  };

  const setupMfa = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiFetch<{ qrCodeUrl: string; secret: string }>('/api/auth/mfa/setup', {
        method: 'POST', token
      });
      setMfaData(data);
      setModal('mfa');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'MFA Setup fehlgeschlagen');
    } finally {
      setLoading(false);
    }
  };

  const verifyMfa = async () => {
    setLoading(true);
    setError('');
    try {
      await apiFetch('/api/auth/mfa/verify', {
        method: 'POST',
        token,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token: mfaToken })
      });
      setSuccess(true);
      setTimeout(() => {
        setModal(null);
        setSuccess(false);
        setMfaToken('');
        setMfaData(null);
        window.location.reload(); // Refresh to update user state
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verifizierung fehlgeschlagen');
    } finally {
      setLoading(false);
    }
  };

  const disableMfa = async () => {
    if (!confirm('Möchtest du die Zwei-Faktor-Authentisierung wirklich deaktivieren?')) return;
    setLoading(true);
    try {
      await apiFetch('/api/auth/mfa/disable', { method: 'POST', token });
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Deaktivieren');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="view-container pb-32">
      <AppHeader title="Profil" />
      
      <div className="px-6 pt-4">
        {/* Profile Hero */}
        <div className="flex items-center gap-5 mb-10">
          <div className="h-20 w-20 rounded-full bg-brand-glow flex items-center justify-center border-2 border-brand/20 shadow-xl shadow-brand/10">
            <User className="h-10 w-10 text-brand" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-white">{user?.username || 'Gereist'}</h2>
            <div className="flex items-center gap-1.5 mt-1 text-sm font-bold text-white/50 bg-white/5 py-1 px-2.5 rounded-full w-fit">
              {user?.role === 'admin' ? (
                <ShieldCheck className="h-4 w-4 text-brand" />
              ) : (
                <Shield className="h-4 w-4" />
              )}
              <span className="capitalize">{user?.role || 'Mitglied'}</span>
            </div>
          </div>
        </div>

        {/* Action Group */}
        <div className="space-y-4">
          <Section title="Deine Aktivitäten">
             <button 
              onClick={onLikedSongs}
              className="card-hover flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-4 text-left glass-effect border border-white/5 bg-white/5"
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-brand/10 flex items-center justify-center">
                  <Heart className="h-5 w-5 text-brand fill-brand" />
                </div>
                <div>
                  <p className="font-bold text-white">Lieblingstitel</p>
                  <p className="text-xs text-white/40">{likedCount} Titel gespeichert</p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-white/20" />
            </button>
          </Section>

          <Section title="Konto & Sicherheit">
             <div className="grid gap-2">
                <ProfileMenuRow 
                  icon={<Mail className="h-5 w-5" />} 
                  label="E-Mail ändern" 
                  onClick={() => setModal('email')} 
                />
                <ProfileMenuRow 
                  icon={<Key className="h-5 w-5" />} 
                  label="Passwort ändern" 
                  onClick={() => setModal('password')} 
                />
                <ProfileMenuRow 
                  icon={user?.twoFactorEnabled ? <ShieldCheck className="h-5 w-5 text-green-500" /> : <Shield className="h-5 w-5" />} 
                  label={user?.twoFactorEnabled ? "2FA aktiv (Deaktivieren)" : "2FA einrichten"} 
                  onClick={user?.twoFactorEnabled ? disableMfa : setupMfa} 
                />
             </div>
          </Section>

          <Section title="Sitzung">
            <button
              onClick={onLogout}
              className="flex w-full items-center gap-3 rounded-2xl px-5 py-4 text-left bg-red-500/10 text-red-500 font-bold border border-red-500/20 active:scale-95 transition-all"
            >
              <LogOut className="h-5 w-5" />
              <span>Abmelden</span>
            </button>
          </Section>
        </div>

        {/* Footer info */}
        <div className="mt-12 text-center">
          <p className="text-[10px] font-black uppercase tracking-widest text-white/20">JT-MP3 v1.2.0 • Build 2026.04</p>
        </div>
      </div>

      <AnimatePresence>
        <Dialog 
          isOpen={!!modal} 
          onClose={() => !loading && setModal(null)}
          title={modal === 'password' ? 'Passwort ändern' : modal === 'email' ? 'E-Mail ändern' : '2FA einrichten'}
          footer={
            !success && modal !== 'mfa' ? (
              <ImmersiveButton 
                onClick={handleUpdate} 
                isLoading={loading}
              >
                Änderungen speichern
              </ImmersiveButton>
            ) : !success && modal === 'mfa' ? (
              <ImmersiveButton 
                onClick={verifyMfa} 
                isLoading={loading}
              >
                Code verifizieren
              </ImmersiveButton>
            ) : null
          }
        >
          {success ? (
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-center py-12"
            >
               <div className="h-24 w-24 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl shadow-green-500/10">
                  <CheckCircle2 className="h-12 w-12 text-green-500" />
               </div>
               <p className="text-xl font-black">{modal === 'mfa' ? '2FA erfolgreich aktiviert!' : 'Erfolgreich aktualisiert!'}</p>
            </motion.div>
          ) : modal === 'mfa' ? (
            <div className="space-y-6 text-center">
              <p className="text-white/60 text-sm">Scan den QR-Code mit einer Authenticator-App oder gib den Code manuell ein.</p>
              {mfaData && (
                <div className="flex flex-col items-center gap-4">
                  <div className="mx-auto bg-white p-4 rounded-3xl w-fit shadow-2xl">
                    <img src={mfaData.qrCodeUrl} alt="MFA QR Code" className="w-48 h-48" />
                  </div>
                  <div className="w-full max-w-[200px]">
                    <p className="text-[10px] text-white/30 uppercase tracking-widest mb-1">Manueller Code</p>
                    <div className="flex items-center gap-2 p-2 rounded-xl bg-white/5 border border-white/10">
                      <span className="flex-1 font-mono text-xs text-brand font-bold truncate">{mfaData.secret}</span>
                      <button 
                        onClick={() => {
                          navigator.clipboard.writeText(mfaData.secret);
                          alert('Code kopiert!');
                        }}
                        className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 active:scale-95 transition-all"
                      >
                        <Copy className="h-4 w-4 text-white/40" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
              <ImmersiveInput 
                label="6-stelliger Code"
                type="text" 
                required
                value={mfaToken}
                onChange={(e) => setMfaToken(e.target.value)}
                placeholder="000 000"
                className="text-center text-2xl tracking-[0.5em] font-black"
              />
              {error && (
                <p className="text-red-500 text-sm font-bold">{error}</p>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              <ImmersiveInput 
                label="Aktuelles Passwort"
                type="password" 
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••"
              />

              {modal === 'email' ? (
                <ImmersiveInput 
                  label="Neue E-Mail Adresse"
                  type="email" 
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="beispiel@mail.de"
                />
              ) : (
                <>
                  <ImmersiveInput 
                    label="Neues Passwort"
                    type="password" 
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min. 8 Zeichen"
                  />
                  <ImmersiveInput 
                    label="Bestätigen"
                    type="password" 
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                </>
              )}

              {error && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-red-500/10 border border-red-500/20 rounded-2xl p-5 text-red-500 text-sm font-bold flex items-center gap-4"
                >
                  <X className="h-5 w-5 shrink-0" />
                  {error}
                </motion.div>
              )}
            </div>
          )}
        </Dialog>
      </AnimatePresence>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h3 className="text-[11px] font-black uppercase tracking-widest text-white/30 mb-3 ml-1">{title}</h3>
      <div className="space-y-2">
        {children}
      </div>
    </div>
  );
}
