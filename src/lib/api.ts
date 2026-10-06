import { UserProfile, LeaderboardEntry } from '../types/game.js';

const TOKEN_KEY = 'apex_nitro_token';

export const api = {
  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  },

  setToken(token: string) {
    localStorage.setItem(TOKEN_KEY, token);
  },

  clearToken() {
    localStorage.removeItem(TOKEN_KEY);
  },

  async register(username: string, email: string, password: string): Promise<{ user: UserProfile; token: string }> {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Registration failed');
    this.setToken(data.token);
    return data;
  },

  async login(identifier: string, password: string): Promise<{ user: UserProfile; token: string }> {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed');
    this.setToken(data.token);
    return data;
  },

  async guestLogin(desiredName?: string): Promise<{ user: UserProfile; token: string }> {
    const res = await fetch('/api/auth/guest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: desiredName }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Guest login failed');
    this.setToken(data.token);
    return data;
  },

  async getMe(): Promise<UserProfile | null> {
    const token = this.getToken();
    if (!token) return null;
    try {
      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        this.clearToken();
        return null;
      }
      const data = await res.json();
      return data.user;
    } catch {
      return null;
    }
  },

  async updateProfile(updates: Partial<UserProfile>): Promise<UserProfile> {
    const token = this.getToken();
    const res = await fetch('/api/profile/update', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token || ''}`,
      },
      body: JSON.stringify(updates),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to update profile');
    return data.user;
  },

  async upgradeStat(stat: string): Promise<{ user: UserProfile; costPaid: number }> {
    const token = this.getToken();
    const res = await fetch('/api/profile/upgrade', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token || ''}`,
      },
      body: JSON.stringify({ stat }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Upgrade failed');
    return data;
  },

  async buyCar(carModel: string, price: number): Promise<UserProfile> {
    const token = this.getToken();
    const res = await fetch('/api/profile/buy-car', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token || ''}`,
      },
      body: JSON.stringify({ carModel, price }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Car purchase failed');
    return data.user;
  },

  async getLeaderboard(): Promise<LeaderboardEntry[]> {
    const res = await fetch('/api/leaderboard');
    const data = await res.json();
    return data.leaderboard || [];
  },

  async submitRaceResult(result: {
    score: number;
    distance: number;
    won: boolean;
    coinsEarned: number;
    mode: 'single' | 'multiplayer';
  }): Promise<{ profile: UserProfile; newHighScore: boolean; leaderboardRank: number }> {
    const token = this.getToken();
    const res = await fetch('/api/stats/submit-race', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token || ''}`,
      },
      body: JSON.stringify(result),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to submit race result');
    return data;
  },

  async verifyAccountForReset(identifier: string): Promise<{ success: boolean; username: string; emailMasked?: string }> {
    const res = await fetch('/api/auth/forgot-password/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Account not found');
    return data;
  },

  async resetPassword(identifier: string, newPassword: string): Promise<{ user: UserProfile; token: string; message: string }> {
    const res = await fetch('/api/auth/forgot-password/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, newPassword }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to reset password');
    if (data.token) {
      this.setToken(data.token);
    }
    return data;
  },

  async claimCheatCoins(): Promise<{ user: UserProfile; addedAmount: number; message: string }> {
    const token = this.getToken();
    const res = await fetch('/api/profile/cheat-coins', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token || ''}`,
      },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to claim coins');
    return data;
  },
};
