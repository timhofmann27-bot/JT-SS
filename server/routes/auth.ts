import { Router } from 'express';
import crypto from 'node:crypto';
import { getDb } from '../db.ts';
import {
  hashPassword, verifyPassword, generateSessionToken,
  generateInviteCode, auditLog, adminSecret,
} from '../utils.ts';
import {
  authLimiter, uploadLimiter,
  requireUserAuth, requireAdmin,
} from '../middleware.ts';
import type { User } from '../utils.ts';

const router = Router();

// POST /api/auth/login
router.post('/api/auth/login', authLimiter, async (req, res) => {
  const { username, password } = req.body;

  if (typeof username !== 'string' || typeof password !== 'string') {
    res.status(400).json({ error: 'username and password required' });
    return;
  }
  if (username.length < 1 || username.length > 64) {
    res.status(400).json({ error: 'invalid username length' });
    return;
  }
  if (password.length < 1) {
    res.status(400).json({ error: 'password required' });
    return;
  }

  const db = getDb();
  const row = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as any;
  if (!row) {
    auditLog('LOGIN_FAILED', { username, reason: 'user_not_found' });
    res.status(401).json({ error: 'invalid credentials' });
    return;
  }

  const valid = await verifyPassword(password, row.password_hash);
  if (!valid) {
    auditLog('LOGIN_FAILED', { username, reason: 'wrong_password' });
    res.status(401).json({ error: 'invalid credentials' });
    return;
  }

  const user: User = {
    id: row.id,
    username: row.username,
    passwordHash: row.password_hash,
    role: row.role,
    createdAt: row.created_at,
    lastLogin: row.last_login,
  };

  db.prepare('UPDATE users SET last_login = ? WHERE id = ?').run(new Date().toISOString(), row.id);
  const token = generateSessionToken(user);
  auditLog('LOGIN_SUCCESS', { username, userId: row.id });

  res.json({
    token,
    user: { id: user.id, username: user.username, role: user.role },
  });
});

// POST /api/auth/register
router.post('/api/auth/register', authLimiter, async (req, res) => {
  const { username, password, inviteCode } = req.body;

  if (typeof username !== 'string' || typeof password !== 'string' || typeof inviteCode !== 'string') {
    res.status(400).json({ error: 'username, password and invite code required' });
    return;
  }
  if (username.length < 3 || username.length > 32) {
    res.status(400).json({ error: 'username must be 3-32 characters' });
    return;
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
    res.status(400).json({ error: 'username contains invalid characters' });
    return;
  }
  if (password.length < 8) {
    res.status(400).json({ error: 'password must be at least 8 characters' });
    return;
  }
  if (password.length > 128) {
    res.status(400).json({ error: 'password too long' });
    return;
  }

  const db = getDb();
  const invite = db.prepare('SELECT * FROM invites WHERE code = ? AND used_count < max_uses').get(inviteCode.toUpperCase()) as any;

  if (!invite) {
    auditLog('REGISTER_FAILED', { username, reason: 'invalid_invite' });
    res.status(400).json({ error: 'invalid or expired invite code' });
    return;
  }

  if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
    auditLog('REGISTER_FAILED', { username, reason: 'expired_invite' });
    res.status(400).json({ error: 'invite code expired' });
    return;
  }

  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) {
    res.status(400).json({ error: 'username already taken' });
    return;
  }

  const passwordHash = await hashPassword(password);
  const newUser: User = {
    id: crypto.randomUUID(),
    username,
    passwordHash,
    role: invite.role,
    createdAt: new Date().toISOString(),
    lastLogin: new Date().toISOString(),
  };

  const tx = db.transaction(() => {
    db.prepare('INSERT INTO users (id, username, password_hash, role, created_at, last_login) VALUES (?, ?, ?, ?, ?, ?)')
      .run(newUser.id, newUser.username, newUser.passwordHash, newUser.role, newUser.createdAt, newUser.lastLogin);
    db.prepare('UPDATE invites SET used_count = used_count + 1 WHERE id = ?').run(invite.id);
    db.prepare('INSERT INTO invite_uses (invite_id, username) VALUES (?, ?)').run(invite.id, username);
  });
  tx();

  const token = generateSessionToken(newUser);
  auditLog('REGISTER_SUCCESS', { username, userId: newUser.id });

  res.json({
    token,
    user: { id: newUser.id, username: newUser.username, role: newUser.role },
  });
});

// GET /api/auth/me
router.get('/api/auth/me', requireUserAuth, (req, res) => {
  const user = req.user;
  if (!user) { res.status(401).json({ error: 'auth required' }); return; }
  res.json({ id: user.id, username: user.username, role: user.role });
});

// POST /api/auth/logout
router.post('/api/auth/logout', requireUserAuth, (req, res) => {
  auditLog('LOGOUT', { userId: req.user?.id || 'unknown' });
  res.json({ ok: true });
});

// POST /api/auth/invite (admin)
router.post('/api/auth/invite', requireAdmin, uploadLimiter, (req, res) => {
  const { role = 'member', maxUses = 1, expiresInHours = 168 } = req.body;
  const user = req.user;
  if (!user) { res.status(401).json({ error: 'auth required' }); return; }

  const db = getDb();
  const newInvite = {
    id: crypto.randomUUID(),
    code: generateInviteCode(),
    role,
    maxUses,
    usedCount: 0,
    expiresAt: new Date(Date.now() + expiresInHours * 3600000).toISOString(),
    createdAt: new Date().toISOString(),
    createdBy: user.username,
  };

  db.prepare('INSERT INTO invites (id, code, role, max_uses, used_count, expires_at, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(newInvite.id, newInvite.code, newInvite.role, newInvite.maxUses, newInvite.usedCount, newInvite.expiresAt, newInvite.createdAt, newInvite.createdBy);

  auditLog('INVITE_CREATED', { code: newInvite.code, role, createdBy: user.username });
  res.json(newInvite);
});

// GET /api/auth/invites (admin)
router.get('/api/auth/invites', requireAdmin, (_req, res) => {
  const db = getDb();
  const invites = db.prepare('SELECT i.*, GROUP_CONCAT(iu.username) as used_by_raw FROM invites i LEFT JOIN invite_uses iu ON iu.invite_id = i.id GROUP BY i.id').all() as any[];
  const result = invites.map((inv: any) => ({
    id: inv.id,
    code: inv.code,
    role: inv.role,
    maxUses: inv.max_uses,
    usedCount: inv.used_count,
    usedBy: inv.used_by_raw ? inv.used_by_raw.split(',') : [],
    expiresAt: inv.expires_at,
    createdAt: inv.created_at,
    createdBy: inv.created_by,
  }));
  res.json(result);
});

// GET /api/auth/users (admin)
router.get('/api/auth/users', requireAdmin, (_req, res) => {
  const db = getDb();
  const users = db.prepare('SELECT id, username, role, created_at, last_login FROM users').all() as any[];
  res.json(users.map((u: any) => ({
    id: u.id,
    username: u.username,
    role: u.role,
    createdAt: u.created_at,
    lastLogin: u.last_login,
  })));
});

// DELETE /api/auth/user/:id (admin)
router.delete('/api/auth/user/:id', requireAdmin, (req, res) => {
  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id) as User | undefined;
  if (!user) {
    res.status(404).json({ error: 'user not found' });
    return;
  }
  if (user.role === 'admin') {
    res.status(403).json({ error: 'cannot delete admin users' });
    return;
  }
  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  auditLog('USER_DELETED', { username: user.username, deletedBy: req.user?.username || 'unknown' });
  res.json({ ok: true });
});

// DELETE /api/auth/invite/:id (admin)
router.delete('/api/auth/invite/:id', requireAdmin, (req, res) => {
  const db = getDb();
  const invite = db.prepare('SELECT id FROM invites WHERE id = ?').get(req.params.id);
  if (!invite) {
    res.status(404).json({ error: 'invite not found' });
    return;
  }
  db.prepare('DELETE FROM invites WHERE id = ?').run(req.params.id);
  auditLog('INVITE_DELETED', { id: req.params.id, deletedBy: req.user?.username || 'unknown' });
  res.json({ ok: true });
});

// POST /api/auth/admin-secret
router.post('/api/auth/admin-secret', authLimiter, async (req, res) => {
  const { secret } = req.body;
  if (typeof secret !== 'string') {
    res.status(400).json({ error: 'secret required' });
    return;
  }
  if (secret !== adminSecret) {
    auditLog('ADMIN_SECRET_FAILED', { ip: req.ip || 'unknown' });
    res.status(403).json({ error: 'invalid secret' });
    return;
  }
  const db = getDb();
  const userCount = (db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number }).count;
  if (userCount === 0) {
    const adminUser: User = {
      id: crypto.randomUUID(),
      username: 'admin',
      passwordHash: await hashPassword('admin'),
      role: 'admin',
      createdAt: new Date().toISOString(),
      lastLogin: new Date().toISOString(),
    };
    db.prepare('INSERT INTO users (id, username, password_hash, role, created_at, last_login) VALUES (?, ?, ?, ?, ?, ?)')
      .run(adminUser.id, adminUser.username, adminUser.passwordHash, adminUser.role, adminUser.createdAt, adminUser.lastLogin);
    auditLog('ADMIN_INITIALIZED', {});
  }
  res.json({ ok: true, message: 'admin initialized' });
});

// GET /api/health
router.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

export default router;
