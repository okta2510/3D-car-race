import express from 'express';
import http from 'http';
import { WebSocketServer } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import { db } from './src/server/db.js';
import { roomManager } from './src/server/roomManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const PORT = 3000;

app.use(express.json());

// API Routes
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !password || username.trim().length < 3 || password.length < 6) {
      return res.status(400).json({ error: 'Username must be >= 3 chars and password >= 6 chars' });
    }
    const result = await db.register(username.trim(), (email || '').trim(), password);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Registration failed' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { identifier, password } = req.body;
    if (!identifier || !password) {
      return res.status(400).json({ error: 'Identifier and password required' });
    }
    const result = await db.login(identifier.trim(), password);
    res.json(result);
  } catch (err: any) {
    res.status(401).json({ error: err.message || 'Login failed' });
  }
});

app.post('/api/auth/guest', (req, res) => {
  try {
    const { username } = req.body;
    const result = db.createGuest(username);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to create guest' });
  }
});

app.get('/api/auth/me', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No token provided' });
  const user = db.getUserByToken(token);
  if (!user) return res.status(401).json({ error: 'Invalid or expired session' });
  res.json({ user });
});

app.post('/api/profile/update', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  const user = db.getUserByToken(token);
  if (!user) return res.status(401).json({ error: 'Invalid session' });

  try {
    const updated = db.updateProfile(user.uid, req.body);
    res.json({ user: updated });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to update profile' });
  }
});

app.post('/api/profile/upgrade', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  const user = db.getUserByToken(token);
  if (!user) return res.status(401).json({ error: 'Invalid session' });

  const { stat } = req.body;
  if (!stat || !['topSpeed', 'acceleration', 'handling', 'nitroCapacity'].includes(stat)) {
    return res.status(400).json({ error: 'Invalid stat upgrade' });
  }

  const currentLevel = (user.upgrades as any)[stat] || 1;
  if (currentLevel >= 5) {
    return res.status(400).json({ error: 'Stat already at maximum level' });
  }

  const cost = currentLevel * 150;
  if (user.coins < cost) {
    return res.status(400).json({ error: `Not enough coins. Need ${cost} coins.` });
  }

  const newUpgrades = {
    ...user.upgrades,
    [stat]: currentLevel + 1
  };

  const updated = db.updateProfile(user.uid, {
    coins: user.coins - cost,
    upgrades: newUpgrades
  });

  res.json({ user: updated, costPaid: cost });
});

app.post('/api/profile/buy-car', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  const user = db.getUserByToken(token);
  if (!user) return res.status(401).json({ error: 'Invalid session' });

  const { carModel, price } = req.body;
  if (!carModel || typeof price !== 'number') {
    return res.status(400).json({ error: 'Car model and price required' });
  }

  try {
    const updated = db.buyCar(user.uid, carModel, price);
    res.json({ user: updated });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Purchase failed' });
  }
});

app.get('/api/leaderboard', (_req, res) => {
  const list = db.getLeaderboard();
  res.json({ leaderboard: list });
});

app.post('/api/stats/submit-race', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  const user = db.getUserByToken(token);
  if (!user) return res.status(401).json({ error: 'Invalid session' });

  const { score, distance, won, coinsEarned, mode } = req.body;
  const result = db.recordRaceResult(user.uid, {
    score: Number(score) || 0,
    distance: Number(distance) || 0,
    won: Boolean(won),
    coinsEarned: Number(coinsEarned) || 0,
    mode: mode === 'multiplayer' ? 'multiplayer' : 'single'
  });

  res.json(result);
});

// Setup WebSocket server
const wss = new WebSocketServer({ server, path: '/ws' });
wss.on('connection', (ws) => {
  roomManager.registerClient(ws);
});

// Development or Production static serving
async function setupApp() {
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
  });
}

setupApp().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
