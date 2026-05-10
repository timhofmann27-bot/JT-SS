# JT-MP3 (StreamSync)

Persönlicher Musik-Streaming-Server mit YouTube-Download, KI-Musikgenerierung und Web-Player. Lade deine eigene Musik hoch, streame sie von überall und lade Songs direkt von YouTube herunter.

## Tech Stack

| Layer | Technologie |
|-------|-------------|
| Frontend | React 19, TypeScript, Tailwind CSS v4, Vite |
| Backend | Express.js, Node.js (mit `--experimental-strip-types`) |
| Daten | JSON-Dateien (`data/state.json`, `data/users.json`) |
| Auth | JWT (x-auth-token / x-share-token), bcryptjs |
| Downloads | yt-dlp (YouTube) |
| KI-Musik | ACE Music API |
| Container | Docker, Caddy Reverse Proxy |

## Features

- **Musik-Streaming:** Eigene MP3/FLAC/WAV/AAC/M4A/OGG-Dateien streamen
- **Album- & Artist-Ansichten:** Automatische Gruppierung aus ID3-Tags
- **YouTube-Downloader:** Songs/Playlists direkt von YouTube in die Library laden (via yt-dlp)
- **KI-Musikgenerierung:** Songs per Text-Prompt mit ACE Music API erstellen
- **Cover-Art:** Automatisch aus ID3-Tags oder iTunes API (gecached)
- **Queue & Likes:** Warteschlange verwalten, Favoriten markieren
- **Upload:** Dateien per Web-UI hochladen
- **Auth-System:** Einladungscodes, Admin/Member-Rollen
- **PWA:** Installierbar auf dem Handy, Media Session API, Wake Lock
- **SSE:** Echtzeit-Updates an alle verbundenen Clients

## Lokale Entwicklung

```bash
# 1. Dependencies installieren
npm install

# 2. .env konfigurieren
cp .env.example .env
# Pflichfelder ausfüllen:
#   ADMIN_SECRET, SHARE_TOKEN, JWT_SECRET

# 3. Dev-Server starten
npm run dev
# Server läuft auf http://localhost:3001
```

## Docker Deployment

```bash
docker compose up -d --build
```

Läuft auf Port 3001, via Caddy (externes Netzwerk `caddy`) unter `jt-mp3.pro`.

### Umgebungsvariablen

| Variable | Pflicht | Beschreibung |
|----------|---------|--------------|
| `ADMIN_SECRET` | Ja | Master-Secret für initiale Admin-Erstellung |
| `SHARE_TOKEN` | Ja | Statischer Token für API-Zugriff |
| `JWT_SECRET` | Nein | JWT-Signing-Key (wird sonst zufällig generiert) |
| `JWT_EXPIRY` | Nein | Token-Gültigkeit (Default: `24h`) |
| `PORT` | Nein | Server-Port (Default: `3001`) |
| `MEDIA_DIR` | Nein | Musik-Verzeichnis (Default: `./media`) |
| `DATA_DIR` | Nein | Daten-Verzeichnis (Default: `./data`) |
| `MAX_UPLOAD_SIZE` | Nein | Upload-Limit (Default: `100MB`) |
| `ROOM_NAME` | Nein | Anzeigename (Default: `StreamSync`) |

## Projektstruktur

```
server/
  index.ts          # Express-Server (API, Auth, Streaming, Upload)
src/
  App.tsx           # Haupt-App-Komponente (Player, State, Routing)
  views/            # Views: Home, Search, Library, YouTube, AI Studio
  components/       # UI-Komponenten: Player, Layout, Queue
  hooks/            # Custom Hooks: PWA, MediaSession, WakeLock, Swipe
  lib/              # Utilities: API, Format, Theme, IndexedDB
data/
  media/            # Musikdateien (gemountet im Container)
  state/            # Runtime-Daten (state.json, users.json, filecache.json)
```

## API-Endpunkte

| Pfad | Auth | Beschreibung |
|------|------|--------------|
| `/api/status` | Token | Server-Status |
| `/api/files` | Token | Dateiliste |
| `/api/state` | Token | Liked-Queue-State |
| `/api/stream/:id` | Token | Audio-Streaming (Range-Support) |
| `/api/cover/:id` | Token | Cover-Art (ID3-Tag oder generiert) |
| `/api/album-cover` | Token | iTunes Cover-Art Fetcher |
| `/api/upload` | Token | Datei-Upload |
| `/api/likes/:id` | Token | Like/Unlike |
| `/api/queue` | Token | Queue CRUD |
| `/api/events` | Token | SSE Event-Stream |
| `/api/download` | Token | YouTube-Download |
| `/api/download/:id` | Token | Download-Status |
| `/api/generate` | Token | KI-Musikgenerierung |
| `/api/auth/login` | - | Login |
| `/api/auth/register` | - | Registrierung (Invite-Code) |
| `/api/auth/me` | User | Eigenes Profil |
| `/api/auth/invite` | Admin | Einladungscode erstellen |
| `/api/health` | - | Healthcheck |
