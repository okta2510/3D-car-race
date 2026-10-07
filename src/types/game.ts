export interface UserProfile {
  uid: string;
  username: string;
  email?: string;
  avatarId?: number;
  carColor: string;
  carModel: string;
  underglowColor: string;
  highScore: number;
  totalDistance: number;
  racesWon: number;
  totalRaces: number;
  coins: number;
  unlockedCars: string[];
  upgrades: {
    topSpeed: number; // Level 1-5
    acceleration: number; // Level 1-5
    handling: number; // Level 1-5
    nitroCapacity: number; // Level 1-5
  };
}

export interface LeaderboardEntry {
  id: string;
  userId: string;
  playerName: string;
  score: number;
  distance: number;
  carColor: string;
  carModel: string;
  mode: 'single' | 'multiplayer';
  date: string;
}

export interface MultiplayerPlayer {
  id: string;
  userId: string;
  displayName: string;
  carColor: string;
  carModel: string;
  isReady: boolean;
  posX: number;
  posZ: number;
  speed: number;
  steering: number;
  isNitro: boolean;
  isCrashed: boolean;
  isFinished: boolean;
  finishRank?: number;
  finishTime?: number;
  health: number;
  score: number;
}

export interface RaceRoomInfo {
  roomId: string;
  roomCode: string;
  hostId: string;
  status: 'waiting' | 'countdown' | 'racing' | 'finished';
  trackLength: number; // in meters, e.g. 4000
  seed: number;
  countdown: number;
  players: MultiplayerPlayer[];
  winnerName?: string;
}

export type ObstacleType = 
  | 'traffic_car' 
  | 'traffic_truck' 
  | 'long_vehicle'
  | 'ambulance'
  | 'barrier' 
  | 'oil_slick' 
  | 'nitro_pickup' 
  | 'coin_pickup';

export interface ObstacleData {
  id: number;
  type: ObstacleType;
  lane: number; // 0 to 4
  x: number;
  z: number;
  speed?: number; // for moving traffic
  color?: string;
  collected?: boolean;
  targetLane?: number;
  targetX?: number;
  isChangingLane?: boolean;
  laneChangeTimer?: number;
  sirenPhase?: number;
}
