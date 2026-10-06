import React from 'react';
import { UserProfile } from '../types/game.js';
import { soundManager } from '../game/SoundManager.js';
import {
  Trophy,
  Wrench,
  Users,
  Volume2,
  VolumeX,
  User,
  LogOut,
  Flame,
  Coins
} from 'lucide-react';

interface NavbarProps {
  user: UserProfile | null;
  onOpenAuth: () => void;
  onOpenGarage: () => void;
  onOpenLeaderboard: () => void;
  onOpenMultiplayer: () => void;
  onLogout: () => void;
  activeMode: 'menu' | 'racing' | 'multiplayer';
  onReturnToMenu?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  user,
  onOpenAuth,
  onOpenGarage,
  onOpenLeaderboard,
  onOpenMultiplayer,
  onLogout,
  activeMode,
  onReturnToMenu
}) => {
  const [isMuted, setIsMuted] = React.useState(soundManager.getMuted());

  const handleToggleSound = () => {
    const muted = soundManager.toggleMute();
    setIsMuted(muted);
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-40 bg-slate-950/80 backdrop-blur-md border-b border-cyan-500/20 px-4 py-2.5">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Brand Logo */}
        <div 
          onClick={onReturnToMenu}
          className="flex items-center gap-2.5 cursor-pointer group select-none"
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 via-blue-500 to-rose-500 p-0.5 shadow-[0_0_15px_rgba(6,182,212,0.4)] group-hover:shadow-[0_0_25px_rgba(6,182,212,0.7)] transition-all">
            <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
              <Flame className="w-5 h-5 text-cyan-400 group-hover:scale-110 transition-transform" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-black italic tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-sky-300 to-rose-400 text-lg">
                APEX NITRO
              </span>
              <span className="text-[10px] uppercase font-bold tracking-widest px-1.5 py-0.5 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-500/40">
                3D ONLINE
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-medium hidden sm:block">
              Multiplayer Real-time Highway Racing
            </p>
          </div>
        </div>

        {/* Center / Right Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Sound Toggle */}
          <button
            onClick={handleToggleSound}
            title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
            className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-cyan-400 hover:border-cyan-500/40 transition-colors"
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4" />}
          </button>

          {/* Leaderboard Button */}
          <button
            onClick={onOpenLeaderboard}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900/90 hover:bg-slate-800 border border-slate-700/60 hover:border-amber-500/40 text-xs font-semibold text-slate-200 transition-all shadow-sm"
          >
            <Trophy className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden md:inline">Leaderboard</span>
          </button>

          {/* Garage Button */}
          <button
            onClick={onOpenGarage}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900/90 hover:bg-slate-800 border border-slate-700/60 hover:border-cyan-500/40 text-xs font-semibold text-slate-200 transition-all shadow-sm"
          >
            <Wrench className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden md:inline">Garage</span>
          </button>

          {/* Multiplayer Button */}
          <button
            onClick={onOpenMultiplayer}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold shadow-[0_0_12px_rgba(6,182,212,0.35)] transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <Users className="w-3.5 h-3.5" />
            <span>Multiplayer</span>
          </button>

          {/* User Account / Profile */}
          {user ? (
            <div className="flex items-center gap-2 pl-1 sm:pl-2 border-l border-slate-800">
              {/* Coins badge */}
              <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold">
                <Coins className="w-3.5 h-3.5 text-amber-400" />
                <span>{user.coins.toLocaleString()}</span>
              </div>

              {/* User Chip */}
              <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1">
                <div 
                  className="w-3.5 h-3.5 rounded-full border border-white/40 shadow-sm"
                  style={{ backgroundColor: user.carColor }}
                  title={`Car Color: ${user.carColor}`}
                />
                <span className="text-xs font-bold text-slate-100 max-w-[90px] sm:max-w-[120px] truncate">
                  {user.username}
                </span>
                <button
                  onClick={onLogout}
                  title="Logout"
                  className="text-slate-400 hover:text-rose-400 p-0.5 rounded transition-colors ml-0.5"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={onOpenAuth}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-semibold border border-slate-700 hover:border-cyan-500/40 transition-colors"
            >
              <User className="w-3.5 h-3.5 text-cyan-400" />
              <span>Sign In</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
