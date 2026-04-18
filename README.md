# JT-MP3

Private Musik-PWA fuer kleine Gruppen. Die App besteht aus einem modernen React-Frontend und einem Express-Server, der lokale Medien listet, Uploads annimmt und Audio/Video per Range-Streaming ausliefert.

## Lokal entwickeln

```bash
npm install
npm run server
npm run dev
```

Web-App:

```text
http://localhost:3000
```

Der Devserver leitet `/api` automatisch an `http://localhost:3001` weiter.

## Konfiguration

`.env.example` nach `.env` kopieren und anpassen:

```bash
SHARE_TOKEN="change-me-local-room-key"
ROOM_NAME="JT-MP3 Privat"
PORT="3001"
MAX_PEERS="50"
MEDIA_DIR="./media"
DATA_DIR="./data"
```

## Produktion ohne Docker

```bash
npm run build
npm start
```

Danach liefert der Express-Server die PWA und API auf demselben Port aus.

## Produktion mit Docker

```bash
docker compose up -d --build
```

Der Container nutzt `/data/media` als Medienordner und `/data/state` fuer privaten Raumzustand wie Likes und Queue. Im mitgelieferten `docker-compose.yml` werden diese Ordner auf `./media` und `./data` gemappt.

Healthcheck:

```text
http://localhost:3001/api/health
```

## Domain und HTTPS

Fuer eine echte Domain sollte JT-MP3 hinter einem Reverse Proxy mit TLS laufen, zum Beispiel Caddy, Traefik oder Nginx Proxy Manager. Ein Caddy-Beispiel liegt unter `deploy/Caddyfile.example`.

Browser installieren PWAs auf Smartphones zuverlaessig nur in sicheren Kontexten. Fuer eine Domain bedeutet das: HTTPS aktivieren.

## Medien

Unterstuetzt werden `mp3`, `m4a`, `aac`, `wav`, `flac`, `ogg`, `mp4`, `webm` und `mov`. Dateien koennen direkt in den Medienordner gelegt oder ueber die App hochgeladen werden.

JT-MP3 liest Audio-Metadaten wie Titel, Artist, Album, Dauer und eingebettete Cover aus. Wenn keine Covergrafik vorhanden ist, erzeugt der Server automatisch ein privates JT-MP3-Cover pro Datei.

## Private Spotify-Features

- Gemeinsame Queue fuer alle verbundenen Geraete.
- Live-Updates per Server-Sent Events.
- Private Likes pro Raum.
- Fullscreen-Player mit System-Mediensteuerung, soweit der Browser das unterstuetzt.
- Persistenter Raumzustand in `DATA_DIR/state.json`.

## Sicherheit

- API, Uploads, Cover und Streams verlangen den `SHARE_TOKEN`.
- Dateien werden lokal gespeichert und nicht an externe Dienste gesendet.
- Der Server setzt Sicherheitsheader und nutzt zeitkonstanten Token-Vergleich.
- Fuer Zugriff ausserhalb des privaten LANs sollte ein Reverse Proxy mit HTTPS, Rate Limits und starken Tokens genutzt werden.
