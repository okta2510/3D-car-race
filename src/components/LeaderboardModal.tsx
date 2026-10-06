import React, { useEffect, useState } from 'react';
import { LeaderboardEntry, UserProfile } from '../types/game.js';
import { api } from '../lib/api.js';
import { X, Trophy, Medal, Crown, Flame, RefreshCw } from 'lucide-react';

interface LeaderboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile | null;
}

export const LeaderboardModal: React.FC<LeaderboardModalProps> = ({
  isOpen,
  onClose,
  currentUser
}) => {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [filter, setFilter] = useState<'all' | 'multiplayer' | 'single'>('all');
  const [loading, setLoading] = useState(false);

  const fetchLeaderboard = async () => {
    setLoading(true);
    try {
      const data = await api.getLeaderboard();
      setEntries(data);
    } catch (err) {
      console.warn('Failed to fetch leaderboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchLeaderboard();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const filteredEntries = entries.filter((e) => {
    if (filter === 'all') return true;
    return e.mode === filter;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-cyan-500/30 rounded-2xl p-6 sm:p-7 shadow-[0_0_40px_rgba(6,182,212,0.2)] flex flex-col max-h-[90vh]">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center justify-between mb-5 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center shadow-[0_0_15px_rgba(245,158,11,0.2)]">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-black italic text-white tracking-wide">
                GLOBAL LEADERBOARD
              </h2>
              <p className="text-xs text-slate-400">
                Top highway speed demons & obstacle dodge masters
              </p>
            </div>
          </div>

          <button
            onClick={fetchLeaderboard}
            disabled={loading}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
            title="Refresh Leaderboard"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Filter Tabs */}
        <div className="flex p-1 bg-slate-950 rounded-xl mb-4 border border-slate-800">
          <button
            onClick={() => setFilter('all')}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
              filter === 'all' ? 'bg-cyan-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            All Modes
          </button>
          <button
            onClick={() => setFilter('multiplayer')}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
              filter === 'multiplayer' ? 'bg-cyan-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Multiplayer PvP
          </button>
          <button
            onClick={() => setFilter('single')}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
              filter === 'single' ? 'bg-cyan-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Endless Solo
          </button>
        </div>

        {/* Leaderboard Table */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {filteredEntries.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-sm">
              {loading ? 'Loading rankings...' : 'No race records in this category yet. Be the first!'}
            </div>
          ) : (
            filteredEntries.map((entry, index) => {
              const rank = index + 1;
              const isCurrentUser = currentUser && (entry.userId === currentUser.uid || entry.playerName === currentUser.username);

              return (
                <div
                  key={entry.id || index}
                  className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                    isCurrentUser
                      ? 'bg-cyan-950/40 border-cyan-500/60 shadow-[0_0_12px_rgba(6,182,212,0.25)]'
                      : rank === 1
                      ? 'bg-amber-950/20 border-amber-500/40'
                      : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {/* Left: Rank & Player info */}
                  <div className="flex items-center gap-3">
                    <div className="w-8 flex items-center justify-center font-black">
                      {rank === 1 ? (
                        <Crown className="w-5 h-5 text-amber-400 drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]" />
                      ) : rank === 2 ? (
                        <Medal className="w-5 h-5 text-slate-300 drop-shadow" />
                      ) : rank === 3 ? (
                        <Medal className="w-5 h-5 text-amber-600" />
                      ) : (
                        <span className="text-sm text-slate-400">#{rank}</span>
                      )}
                    </div>

                    <div
                      className="w-4 h-4 rounded-full border border-white/20 shrink-0"
                      style={{ backgroundColor: entry.carColor || '#ef4444' }}
                    />

                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-bold ${isCurrentUser ? 'text-cyan-300' : 'text-white'}`}>
                          {entry.playerName}
                        </span>
                        {isCurrentUser && (
                          <span className="text-[9px] uppercase font-bold px-1.5 py-0.2 rounded bg-cyan-900/60 text-cyan-300 border border-cyan-500/40">
                            YOU
                          </span>
                        )}
                        <span className="text-[10px] text-slate-500 hidden sm:inline">
                          ({entry.carModel})
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Distance: <span className="text-slate-300 font-semibold">{entry.distance}m</span> • Mode: <span className="capitalize">{entry.mode}</span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Score */}
                  <div className="text-right">
                    <div className="flex items-center gap-1 justify-end font-black text-sm text-amber-400">
                      <Flame className="w-3.5 h-3.5 text-rose-500" />
                      <span>{entry.score.toLocaleString()} pts</span>
                    </div>
                    <div className="text-[10px] text-slate-500">
                      {entry.date ? new Date(entry.date).toLocaleDateString() : ''}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
