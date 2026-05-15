# game-server-manager

A self-hosted Docker-based game server control panel. Register, start, stop, and monitor game servers through a web UI — each server runs in an isolated Docker container managed by the control plane.

Built as a personal alternative to Pterodactyl, designed to be simple, hackable, and free of multi-tenant overhead.

---

## Screenshots

<!-- TODO: Add screenshots/GIFs -->

---

## Features

- Register and manage multiple game servers with persistent definitions
- Full container lifecycle management — start, stop, restart, deregister, with automatic stale container cleanup
- Per-server tabbed UI: Overview, Console, File Manager, Settings
- Live CPU and memory graphs via Docker stats API
- WebSocket log streaming with command input per server
- File manager with Monaco editor, upload, download, rename, delete, and new folder support
- Minecraft support via `itzg/minecraft-server` — vanilla, Paper, Fabric, Forge, all driven by environment variables
- Steam Dedicated Server support via `cm2network/steamcmd` — per-App ID profiles with built-in support for CS2 and Valheim
- SQLite persistence — no external database required

---

## Supported Server Types

### Minecraft (`itzg/minecraft-server`)

| Field | Description |
|---|---|
| `serverType` | `VANILLA`, `PAPER`, `FABRIC`, `FORGE` |
| `version` | Minecraft version, e.g. `1.21.1` or `LATEST` |
| `memory` | JVM heap size, e.g. `2G` |
| `motd` | Server message of the day |
| `maxPlayers` | Player slot limit |

### Steam Dedicated Servers (`cm2network/steamcmd`)

| Game | App ID | Ports |
|---|---|---|
| Counter-Strike 2 | `730` | `27015/tcp+udp`, `27020/udp` |
| Valheim | `896660` | `2456/udp`, `2457/udp` |

Any other Steam App ID falls back to a generic profile on `27015/udp`. New games can be added by extending `STEAM_GAME_PROFILES` in `src/adapters/SteamAdapter.ts`.

---

## Prerequisites

- Node.js 20+
- Docker Desktop (Windows/macOS) or Docker Engine (Linux)
- **WSL2:** Enable Docker Desktop WSL integration under **Settings → Resources → WSL Integration** for your distro

---

## Quick Start

```bash
git clone https://github.com/your-username/game-server-manager.git
cd game-server-manager

npm install
cd client && npm install && cd ..
```

## Development

Run both dev servers in separate terminals.

### Backend

```bash
# http://localhost:3000
npm run dev
```

### Frontend

```bash
# http://localhost:5173
cd client && npm run dev
```

### Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | Port the API server listens on |
| `HOST` | `0.0.0.0` | Bind address |
| `DB_PATH` | `gscp.db` | Path to the SQLite database file |

### Project Structure

```
src/
  api/          # Fastify route handlers
  adapters/     # Game-type adapters (Minecraft, Steam)
  core/         # Types and ServerManager orchestration
  db/           # Schema and repository
  docker/       # DockerClient abstraction
client/src/
  pages/        # React pages and per-server tabs
  components/   # Shared UI components
  api/          # Frontend fetch and WebSocket client
data/           # Runtime game server data (gitignored)
```

### Security Notes

Authentication is not yet implemented. All API endpoints are publicly accessible on the bound host/port. Do not expose the API to the internet without a reverse proxy and external auth in the meantime.

## Roadmap

- [ ] Authentication — API key middleware for all routes
- [ ] Jest unit tests — `ServerManager`, adapters, and repository
- [ ] CS2 plugin/mod support — SourceMod/MetaMod integration and workshop map management
- [ ] Additional Steam profiles — ARK, Assetto Corsa, SCP:SL
- [ ] Electron packaging — cross-platform desktop app with OS-aware Docker socket detection