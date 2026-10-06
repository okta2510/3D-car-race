import React from 'react';
import { GameStats } from '../game/Engine.js';
import {
  Flame,
  Shield,
  Camera,
  ChevronLeft,
  ChevronRight,
  ArrowDown,
  ArrowUp,
  Award,
  Sun,
  Milestone,
  CloudRain,
  CloudFog,
  Moon
} from 'lucide-react';

interface GameHUDProps {
  stats: GameStats;
  trackLength: number;
  mode: 'single' | 'multiplayer';
  onToggleCamera: () => void;
  onToggleHeadlights?: () => void;
  onCycleWeather?: () => void;
  onVirtualControl: (controls: {
    steer?: number;
    throttle?: number;
    brake?: boolean;
    nitro?: boolean;
  }) => void;
}

export const GameHUD: React.FC<GameHUDProps> = ({
  stats,
  trackLength,
  mode,
  onToggleCamera,
  onToggleHeadlights,
  onCycleWeather,
  onVirtualControl,
}) => {
  // Track completion percentage
  const progressPct = Math.min(100, Math.max(0, (stats.distanceMeters / trackLength) * 100));

  // Red screen flash on collision damage
  const [damageFlash, setDamageFlash] = React.useState(false);
  const prevHealthRef = React.useRef(stats.health);

  React.useEffect(() => {
    if (stats.health < prevHealthRef.current) {
      setDamageFlash(true);
      const timer = setTimeout(() => setDamageFlash(false), 400);
      return () => clearTimeout(timer);
    }
    prevHealthRef.current = stats.health;
  }, [stats.health]);

  return (
    <div className="absolute inset-0 pointer-events-none z-30 flex flex-col justify-between pt-20 sm:pt-24 pb-4 sm:pb-6 px-3 sm:px-6 select-none font-sans overflow-hidden">
      {/* Booster Speed Ramp Warp Optical Glow (Clean, no border lines) */}
      {((stats.speedRampFactor && stats.speedRampFactor > 0.04) || stats.isNitroActive) && (
        <div
          className="absolute inset-0 pointer-events-none z-20 transition-opacity duration-200 overflow-hidden"
          style={{ opacity: Math.min(1.0, Math.max(0.2, (stats.speedRampFactor || 0.7) * 0.9)) }}
        >
          {/* Soft Atmospheric Optical Vignette (No hard border lines) */}
          <div className="absolute inset-0 shadow-[inset_0_0_100px_rgba(6,182,212,0.3)]" />
        </div>
      )}

      {/* Damage Screen Flash Overlay */}
      {damageFlash && (
        <div className="absolute inset-0 pointer-events-none bg-rose-600/25 border-4 border-rose-500 z-50 animate-pulse" />
      )}

      {/* Critical Health Warning Perimeter */}
      {stats.health <= 25 && stats.health > 0 && (
        <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_80px_rgba(244,63,94,0.4)] z-40 animate-pulse" />
      )}

      {/* Top Bar: Progress, Rank, Score */}
      <div className="flex items-start justify-between gap-4">
        {/* Left: Rank & Status */}
        <div className="flex flex-col gap-2">
          {mode === 'multiplayer' ? (
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-950/80 backdrop-blur-md border border-cyan-500/40 text-white shadow-[0_0_15px_rgba(6,182,212,0.25)]">
              <Award className="w-4 h-4 text-amber-400" />
              <div className="flex items-baseline gap-1">
                <span className="text-xl font-black italic tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-amber-500">
                  {stats.rank === 1 ? '1st' : stats.rank === 2 ? '2nd' : stats.rank === 3 ? '3rd' : `${stats.rank}th`}
                </span>
                <span className="text-xs text-slate-400 font-bold">
                  / {stats.totalRacers}
                </span>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-950/80 backdrop-blur-md border border-slate-800 text-slate-300 text-xs font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>ENDLESS SPRINT</span>
            </div>
          )}

          <div className="flex items-center gap-2">
            {/* Camera View Switch */}
            <button
              onClick={onToggleCamera}
              className="pointer-events-auto w-fit flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-950/80 backdrop-blur-md border border-slate-800 hover:border-cyan-500/50 text-slate-300 text-xs font-semibold transition-colors"
            >
              <Camera className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden sm:inline">Cam (C)</span>
            </button>

            {/* Headlights High/Dim Toggle (F key) */}
            <button
              onClick={onToggleHeadlights}
              className={`pointer-events-auto flex items-center gap-1.5 px-3 py-1.5 rounded-xl backdrop-blur-md border text-xs font-semibold transition-all ${
                stats.headlightMode === 'high'
                  ? 'bg-amber-950/70 border-amber-500/50 text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.4)]'
                  : 'bg-slate-950/80 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
              title="Toggle Flash / High Beam (F key)"
            >
              <Sun className={`w-3.5 h-3.5 ${stats.headlightMode === 'high' ? 'text-amber-400 animate-pulse' : 'text-slate-500'}`} />
              <span className="hidden sm:inline">
                {stats.headlightMode === 'high' ? 'Flash Beam (F)' : 'Dim Beam (F)'}
              </span>
              <span className="sm:hidden font-mono text-[10px]">
                {stats.headlightMode === 'high' ? 'FLASH' : 'DIM'}
              </span>
            </button>

            {/* Weather Condition Badge & Toggle */}
            <button
              onClick={onCycleWeather}
              className={`pointer-events-auto flex items-center gap-1.5 px-3 py-1.5 rounded-xl backdrop-blur-md border text-xs font-semibold transition-all ${
                stats.weather === 'rain'
                  ? 'bg-blue-950/80 border-blue-500/50 text-blue-300 shadow-[0_0_12px_rgba(59,130,246,0.3)]'
                  : stats.weather === 'fog'
                  ? 'bg-slate-900/90 border-cyan-500/50 text-cyan-200 shadow-[0_0_12px_rgba(6,182,212,0.3)]'
                  : 'bg-slate-950/80 border-slate-800 text-slate-300 hover:text-white'
              }`}
              title="Weather Condition (Auto changes by distance or click to cycle)"
            >
              {stats.weather === 'rain' ? (
                <CloudRain className="w-3.5 h-3.5 text-blue-400 animate-bounce" />
              ) : stats.weather === 'fog' ? (
                <CloudFog className="w-3.5 h-3.5 text-cyan-300 animate-pulse" />
              ) : (
                <Moon className="w-3.5 h-3.5 text-indigo-300" />
              )}
              <span className="hidden md:inline font-mono text-[11px] uppercase">
                {stats.weatherInfo?.displayName || stats.weather}
              </span>
              <span className="md:hidden font-mono text-[10px] uppercase">
                {stats.weather}
              </span>
            </button>
          </div>
        </div>

        {/* Center: Highway Track Distance Progress (Only shown in multiplayer PvP races) */}
        {mode === 'multiplayer' && (
          <div className="flex-1 max-w-sm mx-auto hidden lg:block">
            <div className="p-2.5 rounded-2xl bg-slate-950/85 backdrop-blur-md border border-slate-800 shadow-md">
              <div className="flex justify-between text-[11px] font-bold text-slate-400 mb-1 px-1">
                <span>START</span>
                <span className="text-cyan-400 font-mono">
                  {stats.distanceMeters.toLocaleString()}m / {trackLength.toLocaleString()}m
                </span>
                <span>FINISH</span>
              </div>
              <div className="relative w-full h-3 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                <div
                  className="h-full bg-gradient-to-r from-cyan-500 via-sky-400 to-rose-500 rounded-full transition-all duration-100 shadow-[0_0_10px_rgba(6,182,212,0.8)]"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Right: Highly Visible, Unobstructed Realtime Distance & Realtime Score Dashboard */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Realtime Distance Card - Always clearly visible */}
          <div className="flex items-center gap-2 sm:gap-2.5 px-3 sm:px-4 py-1.5 sm:py-2 rounded-2xl bg-slate-950/95 backdrop-blur-md border border-cyan-500/50 shadow-[0_0_20px_rgba(6,182,212,0.3)]">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-cyan-950/80 border border-cyan-500/50 flex items-center justify-center text-cyan-400 shrink-0">
              <Milestone className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
            <div className="flex flex-col text-left">
              <span className="text-[9px] sm:text-[10px] uppercase font-bold tracking-wider text-cyan-400 leading-tight">
                DISTANCE
              </span>
              <div className="flex items-baseline gap-1">
                <span className="font-mono text-sm sm:text-lg font-black text-white leading-tight">
                  {stats.distanceMeters.toLocaleString()}
                </span>
                <span className="text-[10px] sm:text-[11px] font-bold text-cyan-300">m</span>
                <span className="text-[10px] text-slate-400 font-mono hidden sm:inline ml-0.5">
                  ({(stats.distanceMeters / 1000).toFixed(2)}km)
                </span>
              </div>
            </div>
          </div>

          {/* Realtime Score Card - Always clearly visible */}
          <div className="flex items-center gap-2 sm:gap-2.5 px-3 sm:px-4 py-1.5 sm:py-2 rounded-2xl bg-slate-950/95 backdrop-blur-md border border-amber-500/50 shadow-[0_0_20px_rgba(245,158,11,0.3)]">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-amber-950/80 border border-amber-500/50 flex items-center justify-center text-amber-400 shrink-0">
              <Flame className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-rose-500 fill-rose-500/20" />
            </div>
            <div className="flex flex-col text-left">
              <span className="text-[9px] sm:text-[10px] uppercase font-bold tracking-wider text-amber-400 leading-tight">
                SCORE
              </span>
              <div className="flex items-baseline gap-1">
                <span className="font-mono text-sm sm:text-lg font-black text-amber-300 leading-tight">
                  {stats.score.toLocaleString()}
                </span>
                <span className="text-[10px] font-bold text-amber-500">PTS</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Bar: Speedometer, Gauges, Health & Mobile Virtual Controls */}
      <div className="flex flex-col gap-4">
        {/* Main Dashboard Dials */}
        <div className="flex items-end justify-between">
          {/* Left: Health / Integrity */}
          <div className="w-36 sm:w-48 p-3 rounded-2xl bg-slate-950/85 backdrop-blur-md border border-slate-800 shadow-lg">
            <div className="flex items-center justify-between text-xs font-bold mb-1.5">
              <span className="flex items-center gap-1 text-slate-300">
                <Shield className="w-3.5 h-3.5 text-cyan-400" />
                HULL
              </span>
              <span
                className={`font-mono ${
                  stats.health < 30 ? 'text-rose-400 animate-pulse' : 'text-slate-200'
                }`}
              >
                {stats.health}%
              </span>
            </div>
            <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-150 ${
                  stats.health < 30
                    ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]'
                    : stats.health < 60
                    ? 'bg-amber-400'
                    : 'bg-emerald-400'
                }`}
                style={{ width: `${stats.health}%` }}
              />
            </div>
          </div>

          {/* Center: Digital Speedometer */}
          <div className="flex flex-col items-center">
            {((stats.speedRampFactor && stats.speedRampFactor > 0.08) || stats.isNitroActive) && (
              <div className="mb-1 px-2.5 py-0.5 rounded-full bg-cyan-950/90 text-[10px] font-black uppercase tracking-wider text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.8)] animate-pulse flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                <span>SPEED RAMP OVERDRIVE</span>
              </div>
            )}
            <div
              className={`p-3 sm:p-4 rounded-2xl bg-slate-950/90 backdrop-blur-md transition-all duration-150 text-center min-w-[130px] sm:min-w-[160px] ${
                (stats.speedRampFactor && stats.speedRampFactor > 0.1) || stats.isNitroActive
                  ? 'border border-transparent shadow-[0_0_35px_rgba(6,182,212,0.65)] scale-105'
                  : 'border border-cyan-500/40 shadow-[0_0_25px_rgba(6,182,212,0.3)]'
              }`}
            >
              <div className={`text-4xl sm:text-5xl font-black italic tracking-tighter font-mono leading-none ${
                (stats.speedRampFactor && stats.speedRampFactor > 0.1) || stats.isNitroActive
                  ? 'text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-white to-sky-300 drop-shadow-[0_0_12px_rgba(6,182,212,0.8)]'
                  : 'text-white'
              }`}>
                {stats.speedKmh}
              </div>
              <div className="flex items-center justify-center gap-1 mt-1 text-[11px] font-black uppercase tracking-widest text-cyan-400">
                <span>KM/H</span>
                <span className="text-slate-600">•</span>
                <span className="text-slate-400 text-[10px]">
                  {Math.round(stats.speedKmh * 0.62)} MPH
                </span>
              </div>
            </div>
          </div>

          {/* Right: Nitro Boost Gauge */}
          <div className="w-36 sm:w-48 p-3 rounded-2xl bg-slate-950/85 backdrop-blur-md border border-slate-800 shadow-lg">
            <div className="flex items-center justify-between text-xs font-bold mb-1.5">
              <span className="flex items-center gap-1 text-cyan-400">
                <Flame className={`w-3.5 h-3.5 ${stats.isNitroActive ? 'animate-bounce text-cyan-300' : ''}`} />
                NITRO
              </span>
              <span className="font-mono text-cyan-300">{stats.nitro}%</span>
            </div>
            <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full transition-all duration-100 shadow-[0_0_10px_rgba(6,182,212,0.9)]"
                style={{ width: `${stats.nitro}%` }}
              />
            </div>
          </div>
        </div>

        {/* Mobile On-Screen Touch Controls (Visible on touch devices / small screens) */}
        <div className="pointer-events-auto flex items-center justify-between gap-4 pt-2 md:hidden">
          {/* Steer Left & Right */}
          <div className="flex gap-2">
            <button
              onTouchStart={() => onVirtualControl({ steer: -1 })}
              onTouchEnd={() => onVirtualControl({ steer: 0 })}
              onMouseDown={() => onVirtualControl({ steer: -1 })}
              onMouseUp={() => onVirtualControl({ steer: 0 })}
              className="w-14 h-14 rounded-2xl bg-slate-900/90 border border-slate-700 active:bg-cyan-600 text-white flex items-center justify-center text-xl shadow-lg active:scale-95 transition-transform"
            >
              <ChevronLeft className="w-7 h-7" />
            </button>
            <button
              onTouchStart={() => onVirtualControl({ steer: 1 })}
              onTouchEnd={() => onVirtualControl({ steer: 0 })}
              onMouseDown={() => onVirtualControl({ steer: 1 })}
              onMouseUp={() => onVirtualControl({ steer: 0 })}
              className="w-14 h-14 rounded-2xl bg-slate-900/90 border border-slate-700 active:bg-cyan-600 text-white flex items-center justify-center text-xl shadow-lg active:scale-95 transition-transform"
            >
              <ChevronRight className="w-7 h-7" />
            </button>
          </div>

          {/* Nitro, Throttle & Brake */}
          <div className="flex items-center gap-2">
            <button
              onTouchStart={() => onVirtualControl({ brake: true })}
              onTouchEnd={() => onVirtualControl({ brake: false })}
              onMouseDown={() => onVirtualControl({ brake: true })}
              onMouseUp={() => onVirtualControl({ brake: false })}
              className="w-13 h-13 rounded-2xl bg-rose-950/70 border border-rose-500/40 text-rose-300 flex items-center justify-center font-bold text-xs shadow-lg active:scale-95 transition-transform"
            >
              <ArrowDown className="w-5 h-5" />
            </button>

            <button
              onTouchStart={() => onVirtualControl({ nitro: true, throttle: 1 })}
              onTouchEnd={() => onVirtualControl({ nitro: false })}
              onMouseDown={() => onVirtualControl({ nitro: true, throttle: 1 })}
              onMouseUp={() => onVirtualControl({ nitro: false })}
              className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-cyan-600 to-blue-600 border border-cyan-400 text-white flex flex-col items-center justify-center shadow-[0_0_15px_rgba(6,182,212,0.5)] active:scale-95 transition-transform"
            >
              <Flame className="w-5 h-5" />
              <span className="text-[9px] font-black uppercase">NITRO</span>
            </button>

            <button
              onTouchStart={() => onVirtualControl({ throttle: 1 })}
              onTouchEnd={() => onVirtualControl({ throttle: 0 })}
              onMouseDown={() => onVirtualControl({ throttle: 1 })}
              onMouseUp={() => onVirtualControl({ throttle: 0 })}
              className="w-14 h-14 rounded-2xl bg-emerald-600/90 border border-emerald-400 text-white flex items-center justify-center shadow-lg active:scale-95 transition-transform"
            >
              <ArrowUp className="w-6 h-6" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
