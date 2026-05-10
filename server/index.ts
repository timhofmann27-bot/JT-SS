import dotenv from 'dotenv';
import express from 'express';
import compression from 'compression';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { initDb, migrateFromJson } from './db.ts';
import { securityHeaders, corsMiddleware, httpRequestLogger } from './middleware.ts';
import authRoutes from './routes/auth.ts';
import filesRoutes from './routes/files.ts';
import stateRoutes from './routes/state.ts';
import playlistRoutes from './routes/playlists.ts';
import generateRoutes from './routes/generate.ts';
import downloadRoutes from './routes/download.ts';
import { distDir, port } from './utils.ts';

dotenv.config();

// Validate required env vars
if (!process.env.ADMIN_SECRET) {
  console.error('FATAL: ADMIN_SECRET environment variable is not set.');
  process.exit(1);
}
if (!process.env.SHARE_TOKEN) {
  console.error('FATAL: SHARE_TOKEN environment variable is not set.');
  process.exit(1);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

// Create media/data dirs
const mediaDir = path.resolve(process.env.MEDIA_DIR ?? path.join(rootDir, 'media'));
const dataDir = path.resolve(process.env.DATA_DIR ?? path.join(rootDir, 'data'));
fs.mkdirSync(mediaDir, { recursive: true });
fs.mkdirSync(dataDir, { recursive: true });

// Initialize database
initDb();
migrateFromJson();

const app = express();

// Security
app.disable('x-powered-by');
app.use(compression());
app.use(securityHeaders);
app.use(express.json({ limit: '64kb' }));
app.use(httpRequestLogger);
app.use(corsMiddleware);

// API routes
app.use(authRoutes);
app.use(filesRoutes);
app.use(stateRoutes);
app.use(playlistRoutes);
app.use(generateRoutes);
app.use(downloadRoutes);

// Static files (SPA)
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get('*', (_req, res) => res.sendFile(path.join(distDir, 'index.html')));
}

// Error handler
app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[ERROR] ${message}`);
  if (!res.headersSent) {
    res.status(500).json({ error: 'internal server error' });
  }
});

// Start server
const bindHost = process.env.BIND_HOST ?? '127.0.0.1';
app.listen(port, bindHost, () => {
  console.log(`StreamSync server running on http://${bindHost}:${port}`);
  console.log(`Media folder: ${mediaDir}`);
  if (bindHost === '127.0.0.1') {
    console.log('Note: Server is bound to localhost. Use a reverse proxy (Caddy/Nginx) for external access.');
  }
});
