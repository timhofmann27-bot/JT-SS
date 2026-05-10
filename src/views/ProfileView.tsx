import React, { useState, useEffect } from 'react';
import { User, LogOut, ChevronRight, Shield, ShieldCheck, Mail, Calendar, Key, X, CheckCircle2, Heart, Copy, UserPlus, Users, RefreshCw, Trash2, Ticket } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { AuthUser, InviteAPI } from '../types';
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

interface MemberInfo {
  id: string;
  username: string;
  role: 'admin' | 'member';
  createdAt: string;
  lastLogin: string;
}

export default function ProfileView({ user, token, likedCount, onLikedSongs, onLogout }: ProfileViewProps) {
  const [modal, setModal] = useState<'password' | 'email' | 'mfa' | 'invite' | null>(null);
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

  // Invite states
  const [inviteCode, setInviteCode] = useState('');
  const [inviteLink, setInviteLink] = useState('');
  const [invites, setInvites] = useState<InviteAPI[]>([]);
  const [members, setMembers] = useState<MemberInfo[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [loadingInvites, setLoadingInvites] = useState(false);

  const isAdmin = user?.role === 'admin';

  const loadMembers = async () => {
    if (!isAdmin) return;
    setLoadingMembers(true);
    try {
      const data = await apiFetch<MemberInfo[]>('/api/auth/users', {
        token,
        headers: { 'x-auth-token': token },
      });
      setMembers(data);
    } catch {
      // silent
    } finally {
      setLoadingMembers(false);
    }
  };

  const loadInvites = async () => {
    if (!isAdmin) return;
    setLoadingInvites(true);
    try {
      const data = await apiFetch<InviteAPI[]>('/api/auth/invites', {
        token,
        headers: { 'x-auth-token': token },
      });
      setInvites(data);
    } catch {
      // silent
    } finally {
      setLoadingInvites(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      loadMembers();
      loadInvites();
    }
  }, [isAdmin]);

  const generateInvite = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiFetch<InviteAPI>('/api/auth/invite', {
        method: 'POST',
        token,
        headers: {
          'content-type': 'application/json',
          'x-auth-token': token,
        },
        body: JSON.stringify({ role: 'member', maxUses: 1, expiresInHours: 168 }),
      });
      setInviteCode(data.code);
      setInviteLink(`${window.location.origin}/#/register?invite=${data.code}`);
      setModal('invite');
      loadInvites();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Einladung konnte nicht erstellt werden');
    } finally {
      setLoading(false);
    }
  };

  const deleteInvite = async (id: string) => {
    if (!confirm('Diese Einladung wirklich löschen?')) return;
    try {
      await apiFetch(`/api/auth/invite/${id}`, {
        method: 'DELETE',
        token,
        headers: { 'x-auth-token': token },
      });
      loadInvites();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Löschen fehlgeschlagen');
    }
  };

  const deleteMember = async (userId: string, username: string) => {
    if (!confirm(`Mitglied "${username}" wirklich entfernen? Alle Daten gehen verloren.`)) return;
    try {
      await apiFetch(`/api/auth/user/${userId}`, {
        method: 'DELETE',
        token,
        headers: { 'x-auth-token': token },
      });
      loadMembers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Löschen fehlgeschlagen');
    }
  };

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
        window.location.reload();
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
    <div className="profile-container">
      <AppHeader title="Profil" />
      
      <div className="profile-content">
        {/* Profile Hero */}
        <div className="profile-hero">
          <div className="profile-avatar">
            <User className="h-10 w-10 text-brand" />
          </div>
          <div className="profile-hero-info">
            <h2 className="profile-hero-name">{user?.username || 'Mitglied'}</h2>
            <div className={`profile-hero-role ${user?.role === 'admin' ? 'is-admin' : ''}`}>
              {user?.role === 'admin' ? (
                <ShieldCheck className="h-4 w-4" />
              ) : (
                <Shield className="h-4 w-4" />
              )}
              <span className="capitalize">{user?.role || 'Mitglied'}</span>
            </div>
          </div>
        </div>

        {/* Activity Group */}
        <div className="profile-section">
          <h3 className="profile-section-title">Deine Aktivitäten</h3>
          <button
            onClick={onLikedSongs}
            className="profile-row"
          >
            <div className="profile-row-icon bg-brand/10">
              <Heart className="h-5 w-5 text-brand" fill="currentColor" />
            </div>
            <div className="profile-row-text">
              <p className="profile-row-label">Lieblingstitel</p>
              <p className="profile-row-sub">{likedCount} Titel gespeichert</p>
            </div>
            <ChevronRight className="h-5 w-5 text-white/20" />
          </button>
        </div>

        {/* Account & Security */}
        <div className="profile-section">
          <h3 className="profile-section-title">Konto & Sicherheit</h3>
          <div className="profile-actions-grid">
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
        </div>

        {/* Team / Mitglieder (Admin only) */}
        {isAdmin && (
          <div className="profile-section">
            <div className="profile-section-header">
              <h3 className="profile-section-title">Team</h3>
              <button
                onClick={generateInvite}
                disabled={loading}
                className="profile-invite-btn"
              >
                <UserPlus className="h-4 w-4" />
                <span>Mitglied einladen</span>
              </button>
            </div>

            {/* Mitgliederliste */}
            <div className="profile-members-card">
              <div className="profile-members-header">
                <Users className="h-4 w-4 text-white/40" />
                <span className="profile-members-count">{members.length} Mitglieder</span>
                <button
                  onClick={() => { loadMembers(); loadInvites(); }}
                  className="profile-refresh-btn"
                  disabled={loadingMembers}
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${loadingMembers ? 'animate-spin' : ''}`} />
                </button>
              </div>
              <div className="profile-members-list">
                {members.map((m) => (
                  <div key={m.id} className="profile-member-item">
                    <div className="profile-member-avatar">
                      <User className="h-4 w-4" />
                    </div>
                    <div className="profile-member-info">
                      <span className="profile-member-name">{m.username}</span>
                      <span className={`profile-member-role ${m.role === 'admin' ? 'is-admin' : ''}`}>
                        {m.role}
                      </span>
                    </div>
                    {m.role !== 'admin' && (
                      <button
                        onClick={() => deleteMember(m.id, m.username)}
                        className="profile-invite-delete"
                        title="Mitglied entfernen"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
                {members.length === 0 && !loadingMembers && (
                  <p className="profile-empty-text">Keine Mitglieder gefunden</p>
                )}
              </div>
            </div>

            {/* Invite Codes */}
            {invites.length > 0 && (
              <div className="profile-invites-card">
                <div className="profile-members-header">
                  <Ticket className="h-4 w-4 text-white/40" />
                  <span className="profile-members-count">{invites.length} aktive Einladungen</span>
                </div>
                <div className="profile-invites-list">
                  {invites.map((inv) => (
                    <div key={inv.id} className="profile-invite-item">
                      <div className="profile-invite-code-wrapper">
                        <code className="profile-invite-code">{inv.code}</code>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(`${window.location.origin}/#/register?invite=${inv.code}`);
                          }}
                          className="profile-copy-btn"
                          title="Einladungslink kopieren"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="profile-invite-meta">
                        <span>{inv.usedCount}/{inv.maxUses} verwendet</span>
                        {inv.expiresAt && (
                          <span>· Läuft ab {new Date(inv.expiresAt).toLocaleDateString()}</span>
                        )}
                      </div>
                      <button
                        onClick={() => deleteInvite(inv.id)}
                        className="profile-invite-delete"
                        title="Einladung löschen"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Logout */}
        <div className="profile-section">
          <button
            onClick={onLogout}
            className="profile-logout-btn"
          >
            <LogOut className="h-5 w-5" />
            <span>Abmelden</span>
          </button>
        </div>

        {/* Footer */}
        <div className="profile-footer">
          <p>JT-MP3 v1.3.0 · Build 2026.05</p>
        </div>
      </div>

      <AnimatePresence>
        <Dialog 
          isOpen={!!modal && modal !== 'invite'} 
          onClose={() => !loading && setModal(null)}
          title={modal === 'password' ? 'Passwort ändern' : modal === 'email' ? 'E-Mail ändern' : '2FA einrichten'}
          footer={
            !success && modal === 'mfa' ? (
              <ImmersiveButton 
                onClick={verifyMfa} 
                isLoading={loading}
              >
                Code verifizieren
              </ImmersiveButton>
            ) : !success ? (
              <ImmersiveButton 
                onClick={handleUpdate} 
                isLoading={loading}
              >
                Änderungen speichern
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

      {/* Invite Dialog */}
      <AnimatePresence>
        {modal === 'invite' && (
          <div className="dialog-backdrop" onClick={() => !loading && setModal(null)}>
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="dialog-content"
            >
              <div className="dialog-header">
                <h2 className="dialog-title">Einladung erstellt</h2>
                <button onClick={() => setModal(null)} className="dialog-close">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="dialog-body">
                <div className="invite-code-display">
                  <span className="invite-code-label">Einladungscode</span>
                  <div className="invite-code-box">
                    <code className="invite-code-value">{inviteCode}</code>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(inviteLink);
                      }}
                      className="invite-copy-btn"
                    >
                      <Copy className="h-4 w-4" />
                      <span>Link kopieren</span>
                    </button>
                  </div>
                </div>
                <p className="invite-hint">
                  Teile diesen Code mit der Person, die du einladen möchtest. Der Code ist 7 Tage gültig und kann einmal verwendet werden.
                </p>
              </div>
              <div className="dialog-footer">
                <ImmersiveButton onClick={() => setModal(null)}>
                  Fertig
                </ImmersiveButton>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
