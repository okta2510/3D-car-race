import React, { useEffect, useRef, useState } from 'react';
import { RacingEngine, GameStats } from './game/Engine.js';
import { multiplayerClient } from './game/MultiplayerClient.js';
import { api } from './lib/api.js';
import { UserProfile, RaceRoomInfo } from './types/game.js';
import { Navbar } from './components/Navbar.js';
import { AuthModal } from './components/AuthModal.js';
import { GarageModal } from './components/GarageModal.js';
import { LeaderboardModal } from './components/LeaderboardModal.js';
import { MultiplayerLobbyModal } from './components/MultiplayerLobbyModal.js';
import { GameHUD } from './components/GameHUD.js';
import { GameOverModal } from './components/GameOverModal.js';
import { soundManager } from './game/SoundManager.js';
import {
  Play,
  Users,
  Trophy,
  Wrench,
  Flame,
  Zap,
  ShieldCheck,
  Globe,
  Sparkles,
  ExternalLink,
  ChevronRight
} from 'lucide-react';

const WALLPAPERS = [
  '/cyberpunk_supercar_1.jpg',
  '/cyberpunk_supercar_2.jpg'
];

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [activeScreen, setActiveScreen] = useState<'menu' | 'racing'>('menu');
  const [gameMode, setGameMode] = useState<'single' | 'multiplayer'>('single');
  const [currentRoom, setCurrentRoom] = useState<RaceRoomInfo | null>(null);

  // Splash Intro & Dynamic Homepage Backgrounds
  const [showSplash, setShowSplash] = useState(true);
  const [activeWallpaper, setActiveWallpaper] = useState(0);

  // Secret Keyboard Cheat Code (Type '+' 10 times for 10,000 coins)
  const [cheatToast, setCheatToast] = useState<string | null>(null);
  const cheatCountRef = useRef(0);
  const cheatTimeoutRef = useRef<any>(null);

  // Modals
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isGarageOpen, setIsGarageOpen] = useState(false);
  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false);
  const [isMultiplayerOpen, setIsMultiplayerOpen] = useState(false);
  const [isGameOverOpen, setIsGameOverOpen] = useState(false);

  // In-Game Stats
  const [gameStats, setGameStats] = useState<GameStats>({
    speedKmh: 0,
    distanceMeters: 0,
    score: 0,
    health: 100,
    nitro: 100,
    isNitroActive: false,
    headlightMode: 'high',
    weather: 'clear' as const,
    weatherInfo: {
      type: 'clear' as const,
      displayName: 'CLEAR HIGHWAY',
      gripFactor: 100,
      visibilityMeters: 250,
      statusText: 'OPTIMAL TRACK CONDITIONS',
    },
    rank: 1,
    totalRacers: 1,
    speedRampFactor: 0,
    isFinished: false,
    isCrashed: false,
  });

  const [gameOverData, setGameOverData] = useState({
    isWon: false,
    isCrashed: false,
    score: 0,
    distance: 0,
    rank: 1,
    totalRacers: 1,
    coinsEarned: 0,
    isNewHighScore: false,
  });

  const canvasContainerRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<RacingEngine | null>(null);

  // Initialize or fetch user
  useEffect(() => {
    async function loadUser() {
      try {
        let me = await api.getMe();
        if (!me) {
          // Create starter guest session
          const guest = await api.guestLogin();
          me = guest.user;
        }
        setUser(me);
        multiplayerClient.sendAuth(api.getToken() || undefined, me.username, me.uid);
      } catch (err) {
        console.warn('Initial auth load error:', err);
      }
    }
    loadUser();
  }, []);

  // Set up Multiplayer Client Listeners
  useEffect(() => {
    const unsub = multiplayerClient.subscribe((event) => {
      if (event.type === 'player_moved' && engineRef.current) {
        engineRef.current.updateOpponent(event.data);
      } else if (event.type === 'player_left' && engineRef.current) {
        engineRef.current.removeOpponent(event.data.userId);
      }
    });
    return () => unsub();
  }, []);

  // USER REQUIREMENT:
  // Secret Cheat Code 10.000 Koin (Tekan tombol '+' 10 Kali pada keyboard)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Dismiss splash if active on any keypress (except modifier keys)
      if (showSplash && !['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) {
        setShowSplash(false);
      }

      // Ignore cheat if user is actively typing in a form input or textarea
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }

      // Detect '+' or '=' or NumpadAdd
      if (e.key === '+' || e.key === '=' || e.code === 'NumpadAdd') {
        if (cheatTimeoutRef.current) clearTimeout(cheatTimeoutRef.current);
        cheatCountRef.current += 1;

        // Reset if inactive for 3.5 seconds
        cheatTimeoutRef.current = setTimeout(() => {
          cheatCountRef.current = 0;
        }, 3500);

        if (cheatCountRef.current >= 10) {
          cheatCountRef.current = 0;
          api.claimCheatCoins().then((res) => {
            setUser(res.user);
            soundManager.playVictory();
            setCheatToast('🎉 SECRET KEYBOARD CHEAT UNLOCKED: +10,000 COINS ADDED!');
            setTimeout(() => setCheatToast(null), 4500);
          }).catch((err) => {
            setCheatToast(err.message || 'Cheat failed');
            setTimeout(() => setCheatToast(null), 3000);
          });
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [showSplash]);

  // Start single-player race (Unlimited Endless Sprint)
  const startSinglePlayer = () => {
    setGameMode('single');
    setCurrentRoom(null);
    setActiveScreen('racing');
    setIsGameOverOpen(false);
    initEngine(12345 + Math.floor(Math.random() * 10000), Infinity, 'single');
  };

  // Start multiplayer race from lobby
  const startMultiplayerRace = (room: RaceRoomInfo) => {
    setCurrentRoom(room);
    setGameMode('multiplayer');
    setIsMultiplayerOpen(false);
    setActiveScreen('racing');
    setIsGameOverOpen(false);
    initEngine(room.seed, room.trackLength, 'multiplayer');
  };

  // Instantiate or reset 3D Engine
  const initEngine = (seed: number, trackLength: number, mode: 'single' | 'multiplayer') => {
    // If engine already exists, reset
    if (engineRef.current && canvasContainerRef.current) {
      engineRef.current.destroy();
      engineRef.current = null;
    }

    if (!canvasContainerRef.current) return;

    const engine = new RacingEngine(canvasContainerRef.current, {
      carColor: user?.carColor || '#ef4444',
      carModel: user?.carModel || 'Cyber GT',
      underglowColor: user?.underglowColor || '#06b6d4',
      upgrades: user?.upgrades,
      seed,
      trackLength,
      mode,
    });

    engine.setCallbacks(
      (stats) => {
        setGameStats(stats);
        // Sync position to multiplayer room
        if (mode === 'multiplayer') {
          const playerState = engine.getPlayerState();
          multiplayerClient.sendPlayerUpdate({
            posX: playerState.posX,
            posZ: playerState.posZ,
            speed: playerState.speed,
            steering: playerState.steering,
            isNitro: playerState.isNitro,
            isCrashed: playerState.isCrashed,
            health: playerState.health,
            score: playerState.score,
          });
        }
      },
      async (won, rank, score, distance) => {
        handleRaceFinish(won, rank, score, distance, false, mode);
      },
      async (stats) => {
        handleRaceFinish(false, stats.rank, stats.score, stats.distanceMeters, true, mode);
      }
    );

    engine.start();
    engineRef.current = engine;
  };

  const handleRaceFinish = async (
    won: boolean,
    rank: number,
    score: number,
    distance: number,
    crashed: boolean,
    mode: 'single' | 'multiplayer'
  ) => {
    const coins = crashed ? 30 : won ? 350 : Math.round(score / 40);
    let newBest = false;

    try {
      const res = await api.submitRaceResult({
        score,
        distance,
        won,
        coinsEarned: coins,
        mode,
      });
      setUser(res.profile);
      newBest = res.newHighScore;
    } catch (err) {
      console.warn('Failed to record result:', err);
    }

    setGameOverData({
      isWon: won,
      isCrashed: crashed,
      score,
      distance,
      rank,
      totalRacers: gameStats.totalRacers,
      coinsEarned: coins,
      isNewHighScore: newBest,
    });

    setIsGameOverOpen(true);
  };

  const restartRace = () => {
    setIsGameOverOpen(false);
    if (gameMode === 'multiplayer' && currentRoom) {
      initEngine(currentRoom.seed, currentRoom.trackLength, 'multiplayer');
    } else {
      startSinglePlayer();
    }
  };

  const returnToMenu = () => {
    if (engineRef.current) {
      engineRef.current.destroy();
      engineRef.current = null;
    }
    setActiveScreen('menu');
    setIsGameOverOpen(false);
    multiplayerClient.leaveRoom();
  };

  return (
    <div className="relative w-full h-screen overflow-hidden bg-slate-950 text-slate-100 font-sans select-none">
      {/* Secret Keyboard Cheat Toast Alert */}
      {cheatToast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-6 py-3.5 rounded-2xl bg-slate-950/95 border-2 border-amber-400 text-amber-300 font-black text-sm shadow-[0_0_40px_rgba(245,158,11,0.9)] animate-bounce backdrop-blur-md">
          <span className="w-3.5 h-3.5 rounded-full bg-amber-400 animate-ping" />
          <span>{cheatToast}</span>
        </div>
      )}

      {/* Cinematic Opening Splash Intro (USER REQUIREMENT) */}
      {showSplash && (
        <div
          onClick={() => setShowSplash(false)}
          className="fixed inset-0 z-50 flex flex-col justify-between items-center bg-slate-950 text-white p-6 sm:p-10 select-none animate-fade-in overflow-hidden cursor-pointer"
        >
          {/* High-Resolution Background Artwork with cinematic vignette */}
          <div
            className="absolute inset-0 bg-cover bg-center transition-all duration-1000 scale-105 filter brightness-90 contrast-115"
            style={{ backgroundImage: `url(${WALLPAPERS[activeWallpaper]})` }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/75 to-slate-950/60" />
          <div className="absolute inset-0 shadow-[inset_0_0_120px_rgba(0,0,0,0.85)]" />

          {/* Top Presented By Header */}
          <div className="relative z-10 flex items-center gap-3 px-5 py-2.5 rounded-2xl bg-slate-950/80 backdrop-blur-md border border-cyan-500/40 shadow-[0_0_25px_rgba(0,125,252,0.4)]">
            <img
              src="/yib.svg"
              alt="yanginibeda.com"
              className="w-9 h-9 drop-shadow-[0_0_12px_rgba(0,125,252,0.8)]"
            />
            <div className="flex flex-col text-left">
              <span className="text-[10px] uppercase font-bold tracking-widest text-cyan-400">
                PRESENTED BY
              </span>
              <a
                href="https://yanginibeda.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm sm:text-base font-black tracking-wide text-white hover:text-cyan-300 transition-colors flex items-center gap-1"
                onClick={(e) => e.stopPropagation()}
              >
                yanginibeda.com
                <ExternalLink className="w-3 h-3 text-cyan-400" />
              </a>
            </div>
          </div>

          {/* Centerpiece Hero Title */}
          <div className="relative z-10 flex flex-col items-center text-center max-w-2xl my-auto">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-cyan-950/90 border border-cyan-400/50 text-cyan-300 text-xs font-bold mb-4 shadow-[0_0_20px_rgba(6,182,212,0.5)] animate-pulse">
              <Sparkles className="w-4 h-4 text-cyan-400" />
              <span>OFFICIAL 3D HIGHWAY OVERDRIVE</span>
            </div>

            <h1 className="text-5xl sm:text-8xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-sky-200 to-rose-400 drop-shadow-[0_0_45px_rgba(6,182,212,0.6)]">
              APEX NITRO
            </h1>
            <p className="text-base sm:text-xl text-cyan-100 font-semibold italic mt-2 tracking-wide drop-shadow">
              NIGHT HIGHWAY DRIFT
            </p>

            <p className="text-xs sm:text-sm text-slate-300 mt-4 max-w-lg leading-relaxed font-medium">
              Survive the Asphalt. Master the Storm. Outrun the Neon Metropolis.
            </p>

            {/* Launch Action Button */}
            <div className="mt-8 flex flex-col items-center gap-3">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowSplash(false);
                }}
                className="px-8 py-4 rounded-2xl bg-gradient-to-r from-cyan-500 via-blue-600 to-rose-600 hover:from-cyan-400 hover:to-rose-500 text-white font-black text-base sm:text-lg tracking-wider shadow-[0_0_35px_rgba(6,182,212,0.6)] flex items-center gap-3 transition-all hover:scale-105 active:scale-95 cursor-pointer"
              >
                <Play className="w-6 h-6 fill-current" />
                <span>ENTER THE HIGHWAY</span>
                <ChevronRight className="w-5 h-5" />
              </button>

              <span className="text-[11px] font-mono text-cyan-300/80 animate-pulse">
                [ PRESS ANY KEY OR TAP TO START ]
              </span>
            </div>
          </div>

          {/* Bottom Intro Footer */}
          <div className="relative z-10 flex flex-wrap items-center justify-between gap-4 w-full max-w-4xl pt-4 border-t border-slate-800/60 text-xs text-slate-400">
            <span className="font-mono text-[11px]">
              Multiplayer Synchronization • Three.js 3D Engine • Real-time Physics
            </span>
            <span className="text-slate-400 text-[11px]">
              Powered by <span className="text-cyan-400 font-bold">yanginibeda.com</span>
            </span>
          </div>
        </div>
      )}

      {/* 3D Game Canvas Viewport */}
      <div
        ref={canvasContainerRef}
        className={`absolute inset-0 w-full h-full transition-opacity duration-500 ${
          activeScreen === 'racing' ? 'opacity-100 z-10' : 'opacity-0 pointer-events-none z-0'
        }`}
      />

      {/* Top Navbar */}
      <Navbar
        user={user}
        onOpenAuth={() => setIsAuthOpen(true)}
        onOpenGarage={() => setIsGarageOpen(true)}
        onOpenLeaderboard={() => setIsLeaderboardOpen(true)}
        onOpenMultiplayer={() => setIsMultiplayerOpen(true)}
        onProfileUpdated={(updated) => setUser(updated)}
        onLogout={() => {
          api.clearToken();
          setUser(null);
          api.guestLogin().then((res) => setUser(res.user));
        }}
        activeMode={activeScreen}
        onReturnToMenu={returnToMenu}
      />

      {/* In-Game Heads-Up Display (HUD) */}
      {activeScreen === 'racing' && (
        <GameHUD
          stats={gameStats}
          trackLength={currentRoom?.trackLength || (gameMode === 'single' ? Infinity : 4000)}
          mode={gameMode}
          onToggleCamera={() => engineRef.current?.toggleCamera()}
          onToggleHeadlights={() => engineRef.current?.toggleHeadlights()}
          onCycleWeather={() => engineRef.current?.cycleWeather()}
          onVirtualControl={(ctrl) => engineRef.current?.setVirtualControls(ctrl)}
        />
      )}

      {/* Main Menu / Hero Screen */}
      {activeScreen === 'menu' && (
        <div className="relative z-20 w-full h-full flex flex-col justify-between pt-16 sm:pt-20 pb-6 px-4 sm:px-8 max-w-7xl mx-auto overflow-y-auto">
          {/* Background Superhero Artwork Fade-in on Homepage (USER REQUIREMENT) */}
          <div
            className="absolute inset-0 z-0 bg-cover bg-center transition-all duration-1000 opacity-40 mix-blend-screen scale-100 filter brightness-90 contrast-110 pointer-events-none"
            style={{ backgroundImage: `url(${WALLPAPERS[activeWallpaper]})` }}
          />
          <div className="absolute inset-0 z-0 bg-gradient-to-t from-slate-950 via-slate-950/80 to-slate-950/50 pointer-events-none" />

          {/* Hero Centerpiece */}
          <div className="relative z-10 flex-1 flex flex-col items-center justify-center text-center max-w-3xl mx-auto my-auto py-6">
            {/* Wallpaper Switcher Pill */}
            <div className="flex items-center gap-2 mb-3">
              <button
                onClick={() => setActiveWallpaper(0)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                  activeWallpaper === 0
                    ? 'bg-cyan-600 text-white shadow-md'
                    : 'bg-slate-900/80 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                Artwork 1
              </button>
              <button
                onClick={() => setActiveWallpaper(1)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                  activeWallpaper === 1
                    ? 'bg-cyan-600 text-white shadow-md'
                    : 'bg-slate-900/80 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                Artwork 2
              </button>
            </div>

            {/* Live Status Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan-950/80 border border-cyan-500/30 text-cyan-400 text-xs font-bold mb-4 shadow-[0_0_15px_rgba(6,182,212,0.3)]">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              <span>FIREBASE SYNCHRONIZED MULTIPLAYER</span>
              <span className="text-slate-600">•</span>
              <span className="text-slate-400">HIGH-PRECISION 3D RACING</span>
            </div>

            {/* Title */}
            <h1 className="text-5xl sm:text-7xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-sky-200 to-rose-400 drop-shadow-[0_0_35px_rgba(6,182,212,0.35)]">
              APEX NITRO
            </h1>
            <p className="text-sm sm:text-base text-slate-300 mt-3 font-medium max-w-xl">
              High-speed 3D highway obstacle evasion with real-time multiplayer position synchronization, garage tuning, and global leaderboards.
            </p>

            {/* Primary Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center gap-3.5 mt-8 w-full max-w-md">
              <button
                onClick={startSinglePlayer}
                className="w-full sm:flex-1 py-4 px-6 rounded-2xl bg-gradient-to-r from-cyan-600 via-blue-600 to-cyan-500 hover:from-cyan-500 hover:to-blue-500 text-white font-black text-sm tracking-wide shadow-[0_0_25px_rgba(6,182,212,0.45)] flex items-center justify-center gap-2.5 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
              >
                <Play className="w-5 h-5 fill-current" />
                <span>SOLO ENDLESS SPRINT</span>
              </button>

              <button
                onClick={() => setIsMultiplayerOpen(true)}
                className="w-full sm:flex-1 py-4 px-6 rounded-2xl bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-black text-sm tracking-wide shadow-[0_0_25px_rgba(244,63,94,0.45)] flex items-center justify-center gap-2.5 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
              >
                <Users className="w-5 h-5" />
                <span>ONLINE MULTIPLAYER</span>
              </button>
            </div>

            {/* Quick Feature Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-8 w-full">
              <div 
                onClick={() => setIsGarageOpen(true)}
                className="p-3.5 bg-slate-900/80 hover:bg-slate-800/80 border border-slate-800 hover:border-cyan-500/40 rounded-xl cursor-pointer text-left transition-all"
              >
                <Wrench className="w-4 h-4 text-cyan-400 mb-1.5" />
                <div className="text-xs font-bold text-white">Custom Garage</div>
                <div className="text-[10px] text-slate-400">Paints & Performance</div>
              </div>

              <div 
                onClick={() => setIsLeaderboardOpen(true)}
                className="p-3.5 bg-slate-900/80 hover:bg-slate-800/80 border border-slate-800 hover:border-amber-500/40 rounded-xl cursor-pointer text-left transition-all"
              >
                <Trophy className="w-4 h-4 text-amber-400 mb-1.5" />
                <div className="text-xs font-bold text-white">Leaderboards</div>
                <div className="text-[10px] text-slate-400">Global Champions</div>
              </div>

              <div 
                onClick={() => setIsMultiplayerOpen(true)}
                className="p-3.5 bg-slate-900/80 hover:bg-slate-800/80 border border-slate-800 hover:border-blue-500/40 rounded-xl cursor-pointer text-left transition-all"
              >
                <Globe className="w-4 h-4 text-blue-400 mb-1.5" />
                <div className="text-xs font-bold text-white">Room Matchmaking</div>
                <div className="text-[10px] text-slate-400">Live 6-Player PvP</div>
              </div>

              <div 
                onClick={() => setIsAuthOpen(true)}
                className="p-3.5 bg-slate-900/80 hover:bg-slate-800/80 border border-slate-800 hover:border-emerald-500/40 rounded-xl cursor-pointer text-left transition-all"
              >
                <ShieldCheck className="w-4 h-4 text-emerald-400 mb-1.5" />
                <div className="text-xs font-bold text-white">Profile Security</div>
                <div className="text-[10px] text-slate-400">Cloud Sync & Stats</div>
              </div>
            </div>
          </div>

          {/* Controls Bar */}
          <div className="relative z-10 p-3 bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-2xl flex flex-wrap items-center justify-between text-xs text-slate-400 gap-3 max-w-4xl mx-auto w-full">
            <span className="font-bold text-slate-300">KEYBOARD CONTROLS:</span>
            <div className="flex flex-wrap items-center gap-3">
              <span><kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-200 border border-slate-700">W / ↑</kbd> Gas</span>
              <span><kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-200 border border-slate-700">S / ↓</kbd> Brake</span>
              <span><kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-200 border border-slate-700">A / D / ← / →</kbd> Steer</span>
              <span><kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-200 border border-slate-700">Space / Shift</kbd> Nitro</span>
              <span><kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-200 border border-slate-700">C</kbd> Cam</span>
              <span><kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-200 border border-slate-700">F</kbd> Lights</span>
            </div>
            <span className="text-[11px] text-cyan-400 font-semibold hidden lg:inline">Mobile Touch Controls Supported</span>
          </div>

          {/* Branded Footer (USER REQUIREMENT: Logo + Present by yanginibeda.com) */}
          <footer className="relative z-10 mt-6 pt-4 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400 w-full max-w-4xl mx-auto">
            <div className="flex items-center gap-3">
              <a
                href="https://yanginibeda.com"
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center gap-2.5 transition-transform hover:scale-105"
                title="Visit yanginibeda.com"
              >
                <img
                  src="/yib.svg"
                  alt="yanginibeda.com logo"
                  className="w-7 h-7 rounded-lg shadow-[0_0_12px_rgba(0,125,252,0.6)] group-hover:shadow-[0_0_20px_rgba(0,125,252,0.9)] transition-shadow"
                />
                <div className="flex flex-col text-left">
                  <span className="text-[9px] uppercase font-bold tracking-widest text-cyan-400 leading-tight">
                    PRESENTED BY
                  </span>
                  <span className="text-xs font-black text-white group-hover:text-cyan-300 transition-colors leading-tight">
                    yanginibeda.com
                  </span>
                </div>
              </a>
              <span className="hidden md:inline text-slate-600">|</span>
              <span className="hidden md:inline text-[11px] text-slate-400">
                Solusi Rekayasa Software &amp; Transformasi Digital
              </span>
            </div>

            <div className="flex items-center gap-4 text-[11px]">
              <a
                href="https://yanginibeda.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-slate-400 hover:text-cyan-400 transition-colors font-medium flex items-center gap-1"
              >
                <span>About Developer</span>
                <ExternalLink className="w-3 h-3" />
              </a>
              <span className="text-slate-700">•</span>
              <button
                onClick={() => setShowSplash(true)}
                className="text-slate-400 hover:text-cyan-400 transition-colors font-medium cursor-pointer"
              >
                Replay Splash
              </button>
              <span className="text-slate-700">•</span>
              <span className="text-slate-500 font-mono">v2.4.0</span>
            </div>
          </footer>
        </div>
      )}

      {/* Modals */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onSuccess={(loggedUser) => {
          setUser(loggedUser);
          multiplayerClient.sendAuth(api.getToken() || undefined, loggedUser.username, loggedUser.uid);
        }}
      />

      <GarageModal
        isOpen={isGarageOpen}
        onClose={() => setIsGarageOpen(false)}
        user={user}
        onProfileUpdated={(updated) => {
          setUser(updated);
          if (engineRef.current) {
            engineRef.current.playerCar.setColor(updated.carColor);
          }
        }}
      />

      <LeaderboardModal
        isOpen={isLeaderboardOpen}
        onClose={() => setIsLeaderboardOpen(false)}
        currentUser={user}
      />

      <MultiplayerLobbyModal
        isOpen={isMultiplayerOpen}
        onClose={() => setIsMultiplayerOpen(false)}
        user={user}
        onStartRace={startMultiplayerRace}
      />

      <GameOverModal
        isOpen={isGameOverOpen}
        isWon={gameOverData.isWon}
        isCrashed={gameOverData.isCrashed}
        score={gameOverData.score}
        distance={gameOverData.distance}
        rank={gameOverData.rank}
        totalRacers={gameOverData.totalRacers}
        coinsEarned={gameOverData.coinsEarned}
        isNewHighScore={gameOverData.isNewHighScore}
        onRestart={restartRace}
        onOpenGarage={() => {
          setIsGameOverOpen(false);
          setIsGarageOpen(true);
        }}
        onOpenLeaderboard={() => {
          setIsGameOverOpen(false);
          setIsLeaderboardOpen(true);
        }}
        onOpenMultiplayer={() => {
          setIsGameOverOpen(false);
          setIsMultiplayerOpen(true);
        }}
      />
    </div>
  );
}
