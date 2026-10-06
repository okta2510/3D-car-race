import React, { useState, useEffect } from 'react';
import { RaceRoomInfo, UserProfile } from '../types/game.js';
import { multiplayerClient } from '../game/MultiplayerClient.js';
import {
  X,
  Users,
  Copy,
  Check,
  Play,
  Zap,
  CheckCircle2,
  Clock,
  MessageSquare,
  Flame,
  Crown
} from 'lucide-react';

interface MultiplayerLobbyModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile | null;
  onStartRace: (room: RaceRoomInfo) => void;
}

export const MultiplayerLobbyModal: React.FC<MultiplayerLobbyModalProps> = ({
  isOpen,
  onClose,
  user,
  onStartRace
}) => {
  const [room, setRoom] = useState<RaceRoomInfo | null>(multiplayerClient.currentRoom);
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [trackDistance, setTrackDistance] = useState<number>(4000);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [chatMessages, setChatMessages] = useState<Array<{ sender: string; text: string }>>([]);

  useEffect(() => {
    const unsubscribe = multiplayerClient.subscribe((event) => {
      if (event.type === 'room_joined') {
        setRoom(event.data.room);
        setError(null);
      } else if (event.type === 'player_joined' || event.type === 'player_left' || event.type === 'room_updated') {
        setRoom({ ...event.data });
      } else if (event.type === 'countdown') {
        setCountdown(event.data);
      } else if (event.type === 'race_started') {
        setCountdown(null);
        onStartRace(event.data);
      } else if (event.type === 'chat_message') {
        setChatMessages((prev) => [...prev.slice(-15), event.data]);
      } else if (event.type === 'error') {
        setError(event.data);
      }
    });

    return () => unsubscribe();
  }, [onStartRace]);

  if (!isOpen) return null;

  const handleQuickMatch = () => {
    setError(null);
    multiplayerClient.quickMatch({
      carColor: user?.carColor || '#ef4444',
      carModel: user?.carModel || 'Cyber GT',
    });
  };

  const handleCreateRoom = () => {
    setError(null);
    multiplayerClient.createRoom({
      trackLength: trackDistance,
      carColor: user?.carColor || '#ef4444',
      carModel: user?.carModel || 'Cyber GT',
    });
  };

  const handleJoinByCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomCodeInput.trim()) return;
    setError(null);
    multiplayerClient.joinRoom(roomCodeInput.trim().toUpperCase());
  };

  const handleCopyCode = () => {
    if (room?.roomCode) {
      navigator.clipboard.writeText(room.roomCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleToggleReady = () => {
    multiplayerClient.toggleReady();
  };

  const handleHostStart = () => {
    multiplayerClient.startRace();
  };

  const handleLeaveRoom = () => {
    multiplayerClient.leaveRoom();
    setRoom(null);
    setCountdown(null);
  };

  const sendEmojiReaction = (emoji: string) => {
    multiplayerClient.sendChat(emoji);
  };

  const isHost = room?.hostId === multiplayerClient.myId;
  const myPlayer = room?.players.find((p) => p.id === multiplayerClient.myId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-cyan-500/30 rounded-2xl p-6 sm:p-7 shadow-[0_0_40px_rgba(6,182,212,0.2)]">
        {/* Close Button */}
        <button
          onClick={() => {
            if (room) handleLeaveRoom();
            onClose();
          }}
          className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Countdown Overlay */}
        {countdown !== null && (
          <div className="absolute inset-0 bg-slate-950/90 rounded-2xl z-20 flex flex-col items-center justify-center backdrop-blur-sm animate-fade-in">
            <span className="text-xs font-bold uppercase tracking-widest text-cyan-400 mb-2">
              RACERS ON STARTING GRID
            </span>
            <div className="text-8xl font-black italic text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-rose-500 animate-pulse">
              {countdown}
            </div>
            <p className="text-sm font-semibold text-slate-300 mt-4">
              Get ready to accelerate!
            </p>
          </div>
        )}

        {/* Room Header */}
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-800">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-600 text-white flex items-center justify-center shadow-[0_0_15px_rgba(6,182,212,0.3)]">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-black italic text-white tracking-wide">
              {room ? `MULTIPLAYER LOBBY: ${room.roomCode}` : 'ONLINE MULTIPLAYER ARENA'}
            </h2>
            <p className="text-xs text-slate-400">
              {room
                ? 'Wait for racers to ready up, then launch the race'
                : 'Compete in real-time highway battles against live opponents'}
            </p>
          </div>
        </div>

        {error && (
          <div className="p-3 mb-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
            {error}
          </div>
        )}

        {!room ? (
          /* Matchmaking / Join / Create Screen */
          <div className="space-y-6">
            {/* Quick Match 1-Click */}
            <div className="p-5 bg-gradient-to-r from-cyan-950/50 to-blue-950/50 border border-cyan-500/30 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Zap className="w-4 h-4 text-cyan-400" />
                  Quick Matchmaking
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Instantly jump into an active highway match or open room
                </p>
              </div>
              <button
                onClick={handleQuickMatch}
                className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold rounded-xl shadow-[0_0_15px_rgba(6,182,212,0.4)] transition-all hover:scale-[1.02] text-sm shrink-0"
              >
                Find Match Now
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Create Custom Room */}
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl flex flex-col justify-between">
                <div>
                  <h4 className="text-sm font-bold text-white mb-1">Create Private Room</h4>
                  <p className="text-xs text-slate-400 mb-3">Host a custom race and invite friends with code</p>

                  <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Track Distance
                  </label>
                  <select
                    value={trackDistance}
                    onChange={(e) => setTrackDistance(Number(e.target.value))}
                    className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white mb-4 focus:outline-none focus:border-cyan-500"
                  >
                    <option value={3000}>3,000m - Quick Sprint</option>
                    <option value={5000}>5,000m - Grand Prix</option>
                    <option value={8000}>8,000m - Endurance Marathon</option>
                  </select>
                </div>

                <button
                  onClick={handleCreateRoom}
                  className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-cyan-500/40 text-white font-bold rounded-lg text-xs transition-colors"
                >
                  Create Room
                </button>
              </div>

              {/* Join by Code */}
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl flex flex-col justify-between">
                <div>
                  <h4 className="text-sm font-bold text-white mb-1">Join via Room Code</h4>
                  <p className="text-xs text-slate-400 mb-3">Enter the 4-character code shared by host</p>

                  <form onSubmit={handleJoinByCode}>
                    <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                      Room Code
                    </label>
                    <input
                      type="text"
                      maxLength={6}
                      value={roomCodeInput}
                      onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
                      placeholder="e.g. RACE"
                      className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono font-bold tracking-widest text-center text-white mb-4 focus:outline-none focus:border-cyan-500 uppercase"
                    />
                    <button
                      type="submit"
                      className="w-full py-2.5 bg-cyan-700 hover:bg-cyan-600 text-white font-bold rounded-lg text-xs transition-colors"
                    >
                      Join Match
                    </button>
                  </form>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Inside Room Lobby */
          <div className="space-y-5">
            {/* Room Info Bar */}
            <div className="flex flex-wrap items-center justify-between p-3 bg-slate-950 border border-slate-800 rounded-xl gap-2">
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-400">Room Code:</span>
                <span className="font-mono text-base font-black text-cyan-400 tracking-wider">
                  {room.roomCode}
                </span>
                <button
                  onClick={handleCopyCode}
                  className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors"
                  title="Copy Code"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>

              <div className="flex items-center gap-3 text-xs text-slate-400">
                <span>Distance: <strong className="text-slate-200">{room.trackLength}m</strong></span>
                <span>Racers: <strong className="text-cyan-400">{room.players.length}/6</strong></span>
              </div>
            </div>

            {/* Players in Room */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-400 mb-2">
                Grid Lineup
              </h4>
              <div className="space-y-2">
                {room.players.map((p, idx) => {
                  const isHostPlayer = p.id === room.hostId;
                  const isMe = p.id === multiplayerClient.myId;

                  return (
                    <div
                      key={p.id}
                      className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                        isMe
                          ? 'bg-cyan-950/40 border-cyan-500/50'
                          : 'bg-slate-950 border-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-mono font-bold text-slate-500">
                          #{idx + 1}
                        </span>
                        <div
                          className="w-4 h-4 rounded-full border border-white/20"
                          style={{ backgroundColor: p.carColor }}
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-white">
                              {p.displayName}
                            </span>
                            {isHostPlayer && (
                              <span title="Host">
                                <Crown className="w-3.5 h-3.5 text-amber-400" />
                              </span>
                            )}
                            {isMe && (
                              <span className="text-[9px] uppercase font-bold px-1 rounded bg-cyan-900 text-cyan-300">
                                YOU
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-400">
                            {p.carModel}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {p.isReady ? (
                          <span className="flex items-center gap-1 text-xs font-bold text-emerald-400 bg-emerald-950/40 px-2.5 py-1 rounded-lg border border-emerald-500/30">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            READY
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs font-semibold text-slate-400 bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-800">
                            <Clock className="w-3.5 h-3.5" />
                            WAITING
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Quick Reactions */}
            <div className="flex items-center gap-2 pt-2">
              <span className="text-xs text-slate-500 flex items-center gap-1">
                <MessageSquare className="w-3.5 h-3.5" />
                Quick:
              </span>
              {['🚀', '🔥', '💨', '💥', '🏆', '👋'].map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => sendEmojiReaction(emoji)}
                  className="px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded text-sm transition-transform active:scale-90"
                >
                  {emoji}
                </button>
              ))}
            </div>

            {/* Chat ticker */}
            {chatMessages.length > 0 && (
              <div className="p-2 bg-slate-950/60 rounded-lg border border-slate-800/80 max-h-20 overflow-y-auto space-y-1 text-xs text-slate-400">
                {chatMessages.map((m, i) => (
                  <div key={i}>
                    <strong className="text-cyan-400">{m.sender}:</strong> {m.text}
                  </div>
                ))}
              </div>
            )}

            {/* Actions Bar */}
            <div className="flex items-center gap-3 pt-3 border-t border-slate-800">
              <button
                onClick={handleLeaveRoom}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-xs transition-colors"
              >
                Leave Lobby
              </button>

              <button
                onClick={handleToggleReady}
                className={`flex-1 py-2.5 font-bold rounded-xl text-xs transition-all ${
                  myPlayer?.isReady
                    ? 'bg-amber-600 hover:bg-amber-500 text-white'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                }`}
              >
                {myPlayer?.isReady ? 'Cancel Ready' : 'Ready Up!'}
              </button>

              {isHost && (
                <button
                  onClick={handleHostStart}
                  className="flex-1 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-[0_0_15px_rgba(6,182,212,0.4)]"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>START RACE</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
