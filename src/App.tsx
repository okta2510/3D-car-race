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
import {
  Play,
  Users,
  Trophy,
  Wrench,
  Flame,
  Zap,
  ShieldCheck,
  Globe
} from 'lucide-react';

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [activeScreen, setActiveScreen] = useState<'menu' | 'racing'>('menu');
  const [gameMode, setGameMode] = useState<'single' | 'multiplayer'>('single');
  const [currentRoom, setCurrentRoom] = useState<RaceRoomInfo | null>(null);

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
    rank: 1,
    totalRacers: 1,
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

  // Start single-player race
  const startSinglePlayer = () => {
    setGameMode('single');
    setCurrentRoom(null);
    setActiveScreen('racing');
    setIsGameOverOpen(false);
    initEngine(12345 + Math.floor(Math.random() * 10000), 8000, 'single');
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
          trackLength={currentRoom?.trackLength || 8000}
          mode={gameMode}
          onToggleCamera={() => engineRef.current?.toggleCamera()}
          onToggleHeadlights={() => engineRef.current?.toggleHeadlights()}
          onVirtualControl={(ctrl) => engineRef.current?.setVirtualControls(ctrl)}
        />
      )}

      {/* Main Menu / Hero Screen */}
      {activeScreen === 'menu' && (
        <div className="relative z-20 w-full h-full flex flex-col justify-between pt-16 sm:pt-20 pb-8 px-4 sm:px-8 max-w-7xl mx-auto overflow-y-auto">
          {/* Hero Centerpiece */}
          <div className="flex-1 flex flex-col items-center justify-center text-center max-w-3xl mx-auto my-auto py-8">
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
                className="w-full sm:flex-1 py-4 px-6 rounded-2xl bg-gradient-to-r from-cyan-600 via-blue-600 to-cyan-500 hover:from-cyan-500 hover:to-blue-500 text-white font-black text-sm tracking-wide shadow-[0_0_25px_rgba(6,182,212,0.45)] flex items-center justify-center gap-2.5 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                <Play className="w-5 h-5 fill-current" />
                <span>SOLO ENDLESS SPRINT</span>
              </button>

              <button
                onClick={() => setIsMultiplayerOpen(true)}
                className="w-full sm:flex-1 py-4 px-6 rounded-2xl bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-black text-sm tracking-wide shadow-[0_0_25px_rgba(244,63,94,0.45)] flex items-center justify-center gap-2.5 transition-all hover:scale-[1.02] active:scale-[0.98]"
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
          <div className="p-3 bg-slate-900/70 backdrop-blur-md border border-slate-800 rounded-2xl flex flex-wrap items-center justify-between text-xs text-slate-400 gap-3 max-w-4xl mx-auto w-full">
            <span className="font-bold text-slate-300">KEYBOARD CONTROLS:</span>
            <div className="flex flex-wrap items-center gap-3">
              <span><kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-200 border border-slate-700">W / ↑</kbd> Gas</span>
              <span><kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-200 border border-slate-700">S / ↓</kbd> Brake</span>
              <span><kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-200 border border-slate-700">A / D / ← / →</kbd> Steer Lanes</span>
              <span><kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-200 border border-slate-700">Space / Shift</kbd> Nitro</span>
              <span><kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-200 border border-slate-700">C</kbd> Camera</span>
              <span><kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-200 border border-slate-700">F</kbd> Headlights Dim/High</span>
            </div>
            <span className="text-[11px] text-cyan-400 font-semibold hidden lg:inline">Mobile Touch Controls Supported</span>
          </div>
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
