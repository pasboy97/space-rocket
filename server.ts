import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import {
  DEFAULT_ROCKET_CONFIG,
  filterAndRankLeaderboard,
  validatePilotSubmission,
} from './src/game/rules';
import { LeaderboardEntry } from './src/game/types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, 'data');
const LEADERBOARD_FILE = path.join(DATA_DIR, 'leaderboard.json');

const SEED_LEADERBOARD: LeaderboardEntry[] = [
  {
    id: 'seed-1',
    callsign: 'CMDR_AZAR',
    squadCode: 'SPACENET',
    score: 6420,
    peakAltitude: 360,
    padsLanded: 4,
    ringsCollected: 9,
    outcome: 'victory',
    rocketConfig: {
      noseCone: 'aerospike',
      livery: 'spacenet_cyan',
      fins: 'grid_fins',
      plume: 'ion_cyan',
      callsignTag: 'SN-01',
    },
    createdAt: '2026-10-21T18:10:00.000Z',
  },
  {
    id: 'seed-2',
    callsign: 'MEDIATAMA_HQ',
    squadCode: 'SPACENET',
    score: 5890,
    peakAltitude: 360,
    padsLanded: 3,
    ringsCollected: 8,
    outcome: 'victory',
    rocketConfig: {
      noseCone: 'capsule',
      livery: 'solar_gold',
      fins: 'twin_boosters',
      plume: 'plasma_amber',
      callsignTag: 'SN-HQ',
    },
    createdAt: '2026-10-21T19:45:00.000Z',
  },
  {
    id: 'seed-3',
    callsign: 'VOXEL_VALKYRIE',
    squadCode: 'ORBIT-88',
    score: 5140,
    peakAltitude: 360,
    padsLanded: 3,
    ringsCollected: 7,
    outcome: 'victory',
    rocketConfig: {
      noseCone: 'voxel_command',
      livery: 'retro_arcade',
      fins: 'delta_swept',
      plume: 'hyper_magenta',
      callsignTag: 'VX-88',
    },
    createdAt: '2026-10-21T20:15:00.000Z',
  },
  {
    id: 'seed-4',
    callsign: 'GARUDA_NOZZLE',
    squadCode: 'SPACENET',
    score: 4320,
    peakAltitude: 315,
    padsLanded: 2,
    ringsCollected: 6,
    outcome: 'defeat',
    rocketConfig: {
      noseCone: 'aerospike',
      livery: 'stealth_obsidian',
      fins: 'grid_fins',
      plume: 'ion_cyan',
      callsignTag: 'GR-07',
    },
    createdAt: '2026-10-21T21:00:00.000Z',
  },
  {
    id: 'seed-5',
    callsign: 'KEPLER_DRIFT',
    squadCode: 'ORBIT-88',
    score: 3680,
    peakAltitude: 245,
    padsLanded: 2,
    ringsCollected: 5,
    outcome: 'defeat',
    rocketConfig: DEFAULT_ROCKET_CONFIG,
    createdAt: '2026-10-21T22:05:00.000Z',
  },
];

function loadLeaderboard(): LeaderboardEntry[] {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(LEADERBOARD_FILE)) {
      fs.writeFileSync(LEADERBOARD_FILE, JSON.stringify(SEED_LEADERBOARD, null, 2), 'utf-8');
      return [...SEED_LEADERBOARD];
    }
    const raw = fs.readFileSync(LEADERBOARD_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
    return [...SEED_LEADERBOARD];
  } catch {
    return [...SEED_LEADERBOARD];
  }
}

function saveLeaderboard(entries: LeaderboardEntry[]): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(LEADERBOARD_FILE, JSON.stringify(entries.slice(0, 100), null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to persist leaderboard:', err);
  }
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.status(200).json({ status: 'ok', service: 'spacenet-orbital-rocket' });
  });

  app.get('/api/leaderboard', (req, res) => {
    const squad = typeof req.query.squad === 'string' ? req.query.squad : 'ALL';
    const entries = loadLeaderboard();
    const ranked = filterAndRankLeaderboard(entries, squad);
    const squads = Array.from(new Set(entries.map((e) => e.squadCode.toUpperCase())));
    res.json({
      entries: ranked.slice(0, 50),
      squads,
      totalCount: ranked.length,
    });
  });

  app.post('/api/leaderboard', (req, res) => {
    const {
      callsign = '',
      squadCode = 'SPACENET',
      score = 0,
      peakAltitude = 0,
      padsLanded = 1,
      ringsCollected = 0,
      outcome = 'defeat',
      rocketConfig = DEFAULT_ROCKET_CONFIG,
    } = req.body || {};

    const validation = validatePilotSubmission(String(callsign), String(squadCode));
    if (!validation.valid) {
      res.status(400).json({ error: validation.error });
      return;
    }

    const numericScore = Math.max(0, Math.min(99999, Math.round(Number(score) || 0)));
    const numericAlt = Math.max(0, Math.min(2000, Math.round(Number(peakAltitude) || 0)));

    const newEntry: LeaderboardEntry = {
      id: `pilot-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      callsign: validation.normalizedCallsign,
      squadCode: validation.normalizedSquad,
      score: numericScore,
      peakAltitude: numericAlt,
      padsLanded: Math.max(1, Math.min(10, Math.round(Number(padsLanded) || 1))),
      ringsCollected: Math.max(0, Math.min(30, Math.round(Number(ringsCollected) || 0))),
      outcome: outcome === 'victory' ? 'victory' : 'defeat',
      rocketConfig: {
        noseCone: rocketConfig?.noseCone || DEFAULT_ROCKET_CONFIG.noseCone,
        livery: rocketConfig?.livery || DEFAULT_ROCKET_CONFIG.livery,
        fins: rocketConfig?.fins || DEFAULT_ROCKET_CONFIG.fins,
        plume: rocketConfig?.plume || DEFAULT_ROCKET_CONFIG.plume,
        callsignTag: validation.normalizedCallsign.slice(0, 6),
      },
      createdAt: new Date().toISOString(),
    };

    const existing = loadLeaderboard();
    const updated = filterAndRankLeaderboard([newEntry, ...existing], 'ALL');
    saveLeaderboard(updated);

    const rank = updated.findIndex((e) => e.id === newEntry.id) + 1;

    res.status(201).json({
      entry: newEntry,
      rank,
      entries: updated.slice(0, 50),
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SpaceNet Orbital Server running on http://localhost:${PORT}`);
  });
}

startServer();
