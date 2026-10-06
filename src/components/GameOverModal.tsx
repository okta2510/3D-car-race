import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Trophy, Flame, Coins, RotateCcw, Wrench, Users, AlertOctagon, Milestone } from 'lucide-react';

interface GameOverModalProps {
  isOpen: boolean;
  isWon: boolean;
  isCrashed: boolean;
  score: number;
  distance: number;
  rank: number;
  totalRacers: number;
  coinsEarned: number;
  isNewHighScore?: boolean;
  onRestart: () => void;
  onOpenGarage: () => void;
  onOpenLeaderboard: () => void;
  onOpenMultiplayer: () => void;
}

export const GameOverModal: React.FC<GameOverModalProps> = ({
  isOpen,
  isWon,
  isCrashed,
  score,
  distance,
  rank,
  totalRacers,
  coinsEarned,
  isNewHighScore,
  onRestart,
  onOpenGarage,
  onOpenLeaderboard,
  onOpenMultiplayer,
}) => {
  useEffect(() => {
    if (isOpen && isWon) {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 }
      });
    }
  }, [isOpen, isWon]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-md bg-slate-900 border border-cyan-500/30 rounded-3xl p-6 sm:p-8 shadow-[0_0_50px_rgba(6,182,212,0.25)] text-center">
        {/* Outcome Header Icon */}
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4 shadow-xl">
          {isWon ? (
            <div className="w-full h-full rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-300 text-slate-950 flex items-center justify-center shadow-[0_0_25px_rgba(245,158,11,0.5)]">
              <Trophy className="w-8 h-8 fill-current" />
            </div>
          ) : isCrashed ? (
            <div className="w-full h-full rounded-2xl bg-gradient-to-tr from-rose-600 to-red-400 text-white flex items-center justify-center shadow-[0_0_25px_rgba(244,63,94,0.5)]">
              <AlertOctagon className="w-8 h-8" />
            </div>
          ) : (
            <div className="w-full h-full rounded-2xl bg-gradient-to-tr from-cyan-600 to-blue-500 text-white flex items-center justify-center shadow-[0_0_25px_rgba(6,182,212,0.5)]">
              <Flame className="w-8 h-8" />
            </div>
          )}
        </div>

        {/* Title & Subtitle */}
        <h2 className="text-2xl font-black italic tracking-wide text-white mb-1">
          {isWon
            ? 'CHAMPION! 1ST PLACE'
            : isCrashed
            ? 'CAR TOTALED / CRASHED'
            : `RACE FINISHED - RANK #${rank}`}
        </h2>
        <p className="text-xs text-slate-400 mb-6">
          {isWon
            ? 'Flawless driving! You outpaced all opponents across the finish line.'
            : isCrashed
            ? 'Severe collision with highway obstacles. Upgrade handling in garage!'
            : `Completed the course against ${totalRacers} competitors.`}
        </p>

        {/* Highlighted Results Grid: Tempat Final Score & Final Distance */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          {/* Final Score Card */}
          <div className="p-3.5 bg-slate-950 border border-amber-500/30 rounded-2xl text-left shadow-[0_0_15px_rgba(245,158,11,0.15)]">
            <span className="text-[10px] uppercase font-bold text-amber-400 flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5 text-rose-500 fill-rose-500/20" />
              Final Score
            </span>
            <div className="text-2xl font-black italic text-amber-400 font-mono mt-0.5 tracking-tight">
              {score.toLocaleString()}
            </div>
            {isNewHighScore ? (
              <span className="inline-block mt-1 text-[9px] uppercase font-black px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse">
                ★ NEW HIGH SCORE!
              </span>
            ) : (
              <span className="text-[9px] text-slate-500 font-semibold mt-1 block">
                Points Accumulated
              </span>
            )}
          </div>

          {/* Final Distance Card */}
          <div className="p-3.5 bg-slate-950 border border-cyan-500/30 rounded-2xl text-left shadow-[0_0_15px_rgba(6,182,212,0.15)]">
            <span className="text-[10px] uppercase font-bold text-cyan-400 flex items-center gap-1.5">
              <Milestone className="w-3.5 h-3.5 text-cyan-400" />
              Final Distance
            </span>
            <div className="text-2xl font-black italic text-cyan-300 font-mono mt-0.5 tracking-tight">
              {distance.toLocaleString()}<span className="text-sm font-bold text-cyan-400 ml-0.5">m</span>
            </div>
            <span className="text-[9px] text-slate-400 font-mono mt-1 block">
              {(distance / 1000).toFixed(2)} km Total Sprint
            </span>
          </div>

          {/* Rank Position */}
          <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-2xl text-left">
            <span className="text-[10px] uppercase font-bold text-slate-400">Position</span>
            <div className="text-xl font-black italic text-white font-mono mt-0.5">
              #{rank} <span className="text-xs font-normal text-slate-500">of {totalRacers}</span>
            </div>
          </div>

          {/* Coins Earned */}
          <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-2xl text-left">
            <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
              <Coins className="w-3 h-3 text-amber-400" />
              Reward
            </span>
            <div className="text-xl font-black italic text-emerald-400 font-mono mt-0.5">
              +{coinsEarned}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2.5">
          <button
            onClick={onRestart}
            className="w-full py-3 px-4 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold rounded-xl shadow-[0_0_20px_rgba(6,182,212,0.4)] flex items-center justify-center gap-2 text-sm transition-all hover:scale-[1.01] active:scale-[0.99]"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Race Again</span>
          </button>

          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={onOpenGarage}
              className="py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-xl text-xs flex flex-col items-center gap-1 transition-colors border border-slate-700"
            >
              <Wrench className="w-4 h-4 text-cyan-400" />
              <span>Garage</span>
            </button>

            <button
              onClick={onOpenLeaderboard}
              className="py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-xl text-xs flex flex-col items-center gap-1 transition-colors border border-slate-700"
            >
              <Trophy className="w-4 h-4 text-amber-400" />
              <span>Rankings</span>
            </button>

            <button
              onClick={onOpenMultiplayer}
              className="py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-xl text-xs flex flex-col items-center gap-1 transition-colors border border-slate-700"
            >
              <Users className="w-4 h-4 text-blue-400" />
              <span>PvP Lobby</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
