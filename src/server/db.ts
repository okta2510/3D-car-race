import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { UserProfile, LeaderboardEntry } from '../types/game.js';

const DB_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DB_DIR, 'game_data.json');

interface StoredUser extends UserProfile {
  passwordHash?: string;
}

interface DatabaseSchema {
  users: Record<string, StoredUser>;
  sessions: Record<string, string>; // token -> uid
  leaderboard: LeaderboardEntry[];
}

const DEFAULT_DB: DatabaseSchema = {
  users: {},
  sessions: {},
  leaderboard: [
    {
      id: 'lb-1',
      userId: 'bot-1',
      playerName: 'ApexGhost_99',
      score: 18450,
      distance: 6200,
      carColor: '#ef4444',
      carModel: 'Apex Phantom',
      mode: 'multiplayer',
      date: new Date(Date.now() - 3600000 * 5).toISOString()
    },
    {
      id: 'lb-2',
      userId: 'bot-2',
      playerName: 'NeonViper',
      score: 15200,
      distance: 5100,
      carColor: '#06b6d4',
      carModel: 'Cyber GT',
      mode: 'multiplayer',
      date: new Date(Date.now() - 3600000 * 12).toISOString()
    },
    {
      id: 'lb-3',
      userId: 'bot-3',
      playerName: 'DriftMasterX',
      score: 13800,
      distance: 4750,
      carColor: '#a855f7',
      carModel: 'Hyperion Supercar',
      mode: 'single',
      date: new Date(Date.now() - 3600000 * 24).toISOString()
    },
    {
      id: 'lb-4',
      userId: 'bot-4',
      playerName: 'MidnightSpeed',
      score: 11400,
      distance: 3900,
      carColor: '#eab308',
      carModel: 'Velocity Formula',
      mode: 'single',
      date: new Date(Date.now() - 3600000 * 30).toISOString()
    },
    {
      id: 'lb-5',
      userId: 'bot-5',
      playerName: 'CyberRacer_ID',
      score: 9600,
      distance: 3300,
      carColor: '#10b981',
      carModel: 'Cyber GT',
      mode: 'multiplayer',
      date: new Date(Date.now() - 3600000 * 48).toISOString()
    }
  ]
};

class GameDatabase {
  private data: DatabaseSchema;

  constructor() {
    this.data = this.load();
  }

  private load(): DatabaseSchema {
    try {
      if (!fs.existsSync(DB_DIR)) {
        fs.mkdirSync(DB_DIR, { recursive: true });
      }
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        return {
          ...DEFAULT_DB,
          ...parsed,
          users: { ...DEFAULT_DB.users, ...(parsed.users || {}) },
          sessions: { ...DEFAULT_DB.sessions, ...(parsed.sessions || {}) },
          leaderboard: parsed.leaderboard?.length ? parsed.leaderboard : DEFAULT_DB.leaderboard
        };
      }
    } catch (err) {
      console.warn('Error loading database, using default:', err);
    }
    this.save(DEFAULT_DB);
    return JSON.parse(JSON.stringify(DEFAULT_DB));
  }

  private save(dataToSave: DatabaseSchema = this.data): void {
    try {
      if (!fs.existsSync(DB_DIR)) {
        fs.mkdirSync(DB_DIR, { recursive: true });
      }
      fs.writeFileSync(DB_FILE, JSON.stringify(dataToSave, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to save database to disk:', err);
    }
  }

  public async register(username: string, email: string, password: string): Promise<{ user: UserProfile; token: string }> {
    const existing = Object.values(this.data.users).find(
      u => u.username.toLowerCase() === username.toLowerCase() || (u.email && u.email.toLowerCase() === email.toLowerCase())
    );
    if (existing) {
      throw new Error('Username or email already exists');
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    const uid = 'usr_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
    const token = 'tok_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

    const newUser: StoredUser = {
      uid,
      username,
      email,
      carColor: '#ef4444',
      carModel: 'Cyber GT',
      underglowColor: '#06b6d4',
      highScore: 0,
      totalDistance: 0,
      racesWon: 0,
      totalRaces: 0,
      coins: 200,
      unlockedCars: ['Cyber GT'],
      upgrades: {
        topSpeed: 1,
        acceleration: 1,
        handling: 1,
        nitroCapacity: 1
      },
      passwordHash
    };

    this.data.users[uid] = newUser;
    this.data.sessions[token] = uid;
    this.save();

    const { passwordHash: _, ...publicProfile } = newUser;
    return { user: publicProfile, token };
  }

  public async login(identifier: string, password: string): Promise<{ user: UserProfile; token: string }> {
    const user = Object.values(this.data.users).find(
      u => u.username.toLowerCase() === identifier.toLowerCase() || (u.email && u.email.toLowerCase() === identifier.toLowerCase())
    );

    if (!user || !user.passwordHash) {
      throw new Error('Invalid username or password');
    }

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) {
      throw new Error('Invalid username or password');
    }

    const token = 'tok_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    this.data.sessions[token] = user.uid;
    this.save();

    const { passwordHash: _, ...publicProfile } = user;
    return { user: publicProfile, token };
  }

  public createGuest(desiredName?: string): { user: UserProfile; token: string } {
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const username = desiredName?.trim() || `Racer_${randomSuffix}`;
    const uid = 'gst_' + Math.random().toString(36).substring(2, 9);
    const token = 'tok_gst_' + Math.random().toString(36).substring(2, 15);

    const colors = ['#ef4444', '#06b6d4', '#a855f7', '#eab308', '#10b981', '#3b82f6'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];

    const guestUser: StoredUser = {
      uid,
      username,
      carColor: randomColor,
      carModel: 'Cyber GT',
      underglowColor: '#06b6d4',
      highScore: 0,
      totalDistance: 0,
      racesWon: 0,
      totalRaces: 0,
      coins: 150,
      unlockedCars: ['Cyber GT'],
      upgrades: {
        topSpeed: 1,
        acceleration: 1,
        handling: 1,
        nitroCapacity: 1
      }
    };

    this.data.users[uid] = guestUser;
    this.data.sessions[token] = uid;
    this.save();

    return { user: guestUser, token };
  }

  public getUserByToken(token: string): UserProfile | null {
    const uid = this.data.sessions[token];
    if (!uid) return null;
    const user = this.data.users[uid];
    if (!user) return null;
    if (!user.unlockedCars || !user.unlockedCars.length) {
      user.unlockedCars = ['Cyber GT'];
    }
    const { passwordHash: _, ...publicProfile } = user;
    return publicProfile;
  }

  public buyCar(uid: string, carModel: string, cost: number): UserProfile {
    const user = this.data.users[uid];
    if (!user) throw new Error('User not found');

    if (!user.unlockedCars) {
      user.unlockedCars = ['Cyber GT'];
    }

    if (user.unlockedCars.includes(carModel)) {
      throw new Error('Car already owned');
    }

    if (user.coins < cost) {
      throw new Error(`Insufficient credits. Requires ${cost} coins.`);
    }

    user.coins -= cost;
    user.unlockedCars.push(carModel);
    user.carModel = carModel; // Automatically equip upon purchase
    this.save();

    const { passwordHash: _, ...publicProfile } = user;
    return publicProfile;
  }

  public updateProfile(uid: string, updates: Partial<UserProfile>): UserProfile {
    const user = this.data.users[uid];
    if (!user) throw new Error('User not found');

    if (updates.carColor) user.carColor = updates.carColor;
    if (updates.carModel) user.carModel = updates.carModel;
    if (updates.underglowColor) user.underglowColor = updates.underglowColor;
    if (updates.username && updates.username.trim().length >= 3) user.username = updates.username.trim();
    if (updates.upgrades) user.upgrades = { ...user.upgrades, ...updates.upgrades };
    if (typeof updates.coins === 'number') user.coins = updates.coins;

    this.save();
    const { passwordHash: _, ...publicProfile } = user;
    return publicProfile;
  }

  public recordRaceResult(uid: string, result: {
    score: number;
    distance: number;
    won: boolean;
    coinsEarned: number;
    mode: 'single' | 'multiplayer';
  }): { profile: UserProfile; newHighScore: boolean; leaderboardRank: number } {
    const user = this.data.users[uid];
    if (!user) throw new Error('User not found');

    user.totalRaces += 1;
    if (result.won) user.racesWon += 1;
    user.totalDistance += Math.round(result.distance);
    user.coins += Math.round(result.coinsEarned);

    let newHighScore = false;
    if (result.score > user.highScore) {
      user.highScore = Math.round(result.score);
      newHighScore = true;
    }

    // Add or update in leaderboard
    const existingEntryIndex = this.data.leaderboard.findIndex(e => e.userId === uid);
    if (existingEntryIndex >= 0) {
      if (result.score > this.data.leaderboard[existingEntryIndex].score) {
        this.data.leaderboard[existingEntryIndex] = {
          id: this.data.leaderboard[existingEntryIndex].id,
          userId: uid,
          playerName: user.username,
          score: Math.round(result.score),
          distance: Math.round(result.distance),
          carColor: user.carColor,
          carModel: user.carModel,
          mode: result.mode,
          date: new Date().toISOString()
        };
      }
    } else {
      this.data.leaderboard.push({
        id: 'lb_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 5),
        userId: uid,
        playerName: user.username,
        score: Math.round(result.score),
        distance: Math.round(result.distance),
        carColor: user.carColor,
        carModel: user.carModel,
        mode: result.mode,
        date: new Date().toISOString()
      });
    }

    // Sort leaderboard desc by score
    this.data.leaderboard.sort((a, b) => b.score - a.score);
    // Keep top 100
    if (this.data.leaderboard.length > 100) {
      this.data.leaderboard = this.data.leaderboard.slice(0, 100);
    }

    this.save();
    const rank = this.data.leaderboard.findIndex(e => e.userId === uid) + 1;

    const { passwordHash: _, ...publicProfile } = user;
    return {
      profile: publicProfile,
      newHighScore,
      leaderboardRank: rank > 0 ? rank : this.data.leaderboard.length + 1
    };
  }

  public addCoins(uid: string, amount: number): UserProfile {
    const user = this.data.users[uid];
    if (!user) throw new Error('User not found');
    user.coins = Math.max(0, (user.coins || 0) + amount);
    this.save();
    const { passwordHash: _, ...publicProfile } = user;
    return publicProfile;
  }

  public findUserByIdentifier(identifier: string): { exists: boolean; username?: string; emailMasked?: string } {
    const term = identifier.trim().toLowerCase();
    const user = Object.values(this.data.users).find(
      u => u.username.toLowerCase() === term || (u.email && u.email.toLowerCase() === term)
    );
    if (!user) {
      return { exists: false };
    }
    let emailMasked: string | undefined = undefined;
    if (user.email) {
      const parts = user.email.split('@');
      if (parts.length === 2) {
        const namePart = parts[0];
        const maskedName = namePart.length <= 2 ? namePart[0] + '***' : namePart.slice(0, 2) + '***' + namePart.slice(-1);
        emailMasked = `${maskedName}@${parts[1]}`;
      }
    }
    return {
      exists: true,
      username: user.username,
      emailMasked
    };
  }

  public async resetPassword(identifier: string, newPassword: string): Promise<{ user: UserProfile; token: string }> {
    const term = identifier.trim().toLowerCase();
    const user = Object.values(this.data.users).find(
      u => u.username.toLowerCase() === term || (u.email && u.email.toLowerCase() === term)
    );

    if (!user) {
      throw new Error('Account not found for this username or email');
    }

    if (!newPassword || newPassword.length < 6) {
      throw new Error('New password must be at least 6 characters');
    }

    const salt = await bcrypt.genSalt(10);
    user.passwordHash = await bcrypt.hash(newPassword, salt);

    const token = 'tok_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    this.data.sessions[token] = user.uid;
    this.save();

    const { passwordHash: _, ...publicProfile } = user;
    return { user: publicProfile, token };
  }

  public getLeaderboard(): LeaderboardEntry[] {
    return [...this.data.leaderboard].sort((a, b) => b.score - a.score);
  }
}

export const db = new GameDatabase();
