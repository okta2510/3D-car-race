import { WebSocket } from 'ws';
import { MultiplayerPlayer, RaceRoomInfo } from '../types/game.js';
import { db } from './db.js';

interface ConnectedClient {
  ws: WebSocket;
  userId: string;
  displayName: string;
  roomId?: string;
  lastPing: number;
}

export class RoomManager {
  private rooms: Map<string, RaceRoomInfo> = new Map();
  private clients: Map<WebSocket, ConnectedClient> = new Map();
  private matchmakingQueue: WebSocket[] = new Map<WebSocket, ConnectedClient>() as any;

  constructor() {
    // Clean up idle rooms every 30 seconds
    setInterval(() => {
      this.cleanupEmptyRooms();
    }, 30000);
  }

  public registerClient(ws: WebSocket): void {
    this.clients.set(ws, {
      ws,
      userId: 'usr_' + Math.random().toString(36).substring(2, 8),
      displayName: 'Racer',
      lastPing: Date.now()
    });

    ws.on('message', (data: string) => {
      try {
        const message = JSON.parse(data.toString());
        this.handleMessage(ws, message);
      } catch (err) {
        console.error('Failed to parse WS message:', err);
      }
    });

    ws.on('close', () => {
      this.handleDisconnect(ws);
    });

    ws.on('error', (err) => {
      console.warn('WS Client error:', err);
      this.handleDisconnect(ws);
    });

    // Send connected welcome
    this.send(ws, {
      type: 'connected',
      timestamp: Date.now()
    });
  }

  private handleDisconnect(ws: WebSocket): void {
    const client = this.clients.get(ws);
    if (!client) return;

    if (client.roomId) {
      this.leaveRoom(ws, client.roomId);
    }

    this.clients.delete(ws);
  }

  private handleMessage(ws: WebSocket, msg: any): void {
    const client = this.clients.get(ws);
    if (!client) return;

    switch (msg.type) {
      case 'ping':
        client.lastPing = Date.now();
        this.send(ws, { type: 'pong' });
        break;

      case 'auth':
        if (msg.token) {
          const user = db.getUserByToken(msg.token);
          if (user) {
            client.userId = user.uid;
            client.displayName = user.username;
          }
        } else if (msg.displayName) {
          client.displayName = msg.displayName.slice(0, 30);
          if (msg.userId) client.userId = msg.userId;
        }
        this.send(ws, {
          type: 'auth_success',
          userId: client.userId,
          displayName: client.displayName
        });
        break;

      case 'create_room':
        this.createRoom(ws, msg);
        break;

      case 'join_room':
        this.joinRoom(ws, msg.roomCode || msg.roomId);
        break;

      case 'quick_match':
        this.quickMatch(ws, msg);
        break;

      case 'leave_room':
        if (client.roomId) {
          this.leaveRoom(ws, client.roomId);
        }
        break;

      case 'toggle_ready':
        this.toggleReady(ws, msg.isReady);
        break;

      case 'start_race':
        this.startRace(ws);
        break;

      case 'player_update':
        this.handlePlayerUpdate(ws, msg);
        break;

      case 'chat':
        this.handleChat(ws, msg.text);
        break;

      case 'list_rooms':
        this.sendRoomList(ws);
        break;
    }
  }

  private createRoom(ws: WebSocket, options: any): void {
    const client = this.clients.get(ws);
    if (!client) return;

    if (client.roomId) {
      this.leaveRoom(ws, client.roomId);
    }

    const roomId = 'rm_' + Math.random().toString(36).substring(2, 9);
    const roomCode = Math.random().toString(36).substring(2, 6).toUpperCase();
    const trackLength = options.trackLength || 4000;
    const seed = Math.floor(Math.random() * 1000000);

    const hostPlayer: MultiplayerPlayer = {
      id: client.userId,
      userId: client.userId,
      displayName: client.displayName,
      carColor: options.carColor || '#ef4444',
      carModel: options.carModel || 'Cyber GT',
      isReady: true,
      posX: 0,
      posZ: 0,
      speed: 0,
      steering: 0,
      isNitro: false,
      isCrashed: false,
      isFinished: false,
      health: 100,
      score: 0
    };

    const room: RaceRoomInfo = {
      roomId,
      roomCode,
      hostId: client.userId,
      status: 'waiting',
      trackLength,
      seed,
      countdown: 3,
      players: [hostPlayer]
    };

    this.rooms.set(roomId, room);
    client.roomId = roomId;

    this.send(ws, {
      type: 'room_joined',
      room,
      isHost: true
    });
  }

  private joinRoom(ws: WebSocket, codeOrId: string): void {
    const client = this.clients.get(ws);
    if (!client || !codeOrId) return;

    const query = codeOrId.trim().toUpperCase();
    let targetRoom: RaceRoomInfo | undefined;

    for (const r of this.rooms.values()) {
      if (r.roomId === codeOrId || r.roomCode === query) {
        targetRoom = r;
        break;
      }
    }

    if (!targetRoom) {
      this.send(ws, { type: 'error', message: 'Room not found. Check code.' });
      return;
    }

    if (targetRoom.status !== 'waiting' && targetRoom.status !== 'countdown') {
      this.send(ws, { type: 'error', message: 'Race already in progress' });
      return;
    }

    if (targetRoom.players.length >= 6) {
      this.send(ws, { type: 'error', message: 'Room is full (max 6 racers)' });
      return;
    }

    // Leave any prior room
    if (client.roomId) {
      this.leaveRoom(ws, client.roomId);
    }

    const newPlayer: MultiplayerPlayer = {
      id: client.userId,
      userId: client.userId,
      displayName: client.displayName,
      carColor: '#06b6d4',
      carModel: 'Cyber GT',
      isReady: false,
      posX: (targetRoom.players.length % 2 === 0 ? 1 : -1) * 2.5,
      posZ: 0,
      speed: 0,
      steering: 0,
      isNitro: false,
      isCrashed: false,
      isFinished: false,
      health: 100,
      score: 0
    };

    targetRoom.players.push(newPlayer);
    client.roomId = targetRoom.roomId;

    this.send(ws, {
      type: 'room_joined',
      room: targetRoom,
      isHost: targetRoom.hostId === client.userId
    });

    this.broadcastToRoom(targetRoom.roomId, {
      type: 'player_joined',
      player: newPlayer,
      room: targetRoom
    }, ws);
  }

  private quickMatch(ws: WebSocket, options: any): void {
    // Find an open room waiting for players
    for (const room of this.rooms.values()) {
      if (room.status === 'waiting' && room.players.length < 4) {
        this.joinRoom(ws, room.roomCode);
        return;
      }
    }

    // Otherwise create a new public room
    this.createRoom(ws, options);
  }

  private leaveRoom(ws: WebSocket, roomId: string): void {
    const client = this.clients.get(ws);
    const room = this.rooms.get(roomId);
    if (!client || !room) return;

    room.players = room.players.filter(p => p.id !== client.userId);
    client.roomId = undefined;

    if (room.players.length === 0) {
      this.rooms.delete(roomId);
    } else {
      // If host left, assign new host
      if (room.hostId === client.userId) {
        room.hostId = room.players[0].id;
      }
      this.broadcastToRoom(roomId, {
        type: 'player_left',
        userId: client.userId,
        room
      });
    }

    this.send(ws, { type: 'left_room' });
  }

  private toggleReady(ws: WebSocket, isReady?: boolean): void {
    const client = this.clients.get(ws);
    if (!client || !client.roomId) return;
    const room = this.rooms.get(client.roomId);
    if (!room || room.status !== 'waiting') return;

    const player = room.players.find(p => p.id === client.userId);
    if (player) {
      player.isReady = typeof isReady === 'boolean' ? isReady : !player.isReady;
      this.broadcastToRoom(room.roomId, {
        type: 'room_updated',
        room
      });
    }
  }

  private startRace(ws: WebSocket): void {
    const client = this.clients.get(ws);
    if (!client || !client.roomId) return;
    const room = this.rooms.get(client.roomId);
    if (!room) return;

    if (room.hostId !== client.userId) {
      this.send(ws, { type: 'error', message: 'Only host can start the race' });
      return;
    }

    if (room.status !== 'waiting') return;

    room.status = 'countdown';
    room.countdown = 3;

    this.broadcastToRoom(room.roomId, {
      type: 'countdown_started',
      countdown: room.countdown,
      room
    });

    const timer = setInterval(() => {
      room.countdown -= 1;
      if (room.countdown <= 0) {
        clearInterval(timer);
        room.status = 'racing';
        this.broadcastToRoom(room.roomId, {
          type: 'race_started',
          room
        });
      } else {
        this.broadcastToRoom(room.roomId, {
          type: 'countdown_tick',
          countdown: room.countdown
        });
      }
    }, 1000);
  }

  private handlePlayerUpdate(ws: WebSocket, update: any): void {
    const client = this.clients.get(ws);
    if (!client || !client.roomId) return;
    const room = this.rooms.get(client.roomId);
    if (!room || room.status !== 'racing') return;

    const player = room.players.find(p => p.id === client.userId);
    if (!player) return;

    // Apply movement updates
    player.posX = update.posX ?? player.posX;
    player.posZ = update.posZ ?? player.posZ;
    player.speed = update.speed ?? player.speed;
    player.steering = update.steering ?? player.steering;
    player.isNitro = update.isNitro ?? player.isNitro;
    player.isCrashed = update.isCrashed ?? player.isCrashed;
    player.health = update.health ?? player.health;
    player.score = update.score ?? player.score;

    // Check finish line
    if (!player.isFinished && player.posZ >= room.trackLength) {
      player.isFinished = true;
      const finishedCount = room.players.filter(p => p.isFinished).length;
      player.finishRank = finishedCount;
      player.finishTime = Date.now();

      this.broadcastToRoom(room.roomId, {
        type: 'player_finished',
        userId: player.id,
        displayName: player.displayName,
        finishRank: player.finishRank,
        room
      });

      // Record in leaderboard & rewards
      db.recordRaceResult(player.userId, {
        score: player.score + (finishedCount === 1 ? 5000 : 2500),
        distance: room.trackLength,
        won: finishedCount === 1,
        coinsEarned: finishedCount === 1 ? 300 : 150,
        mode: 'multiplayer'
      });

      // Check if all finished
      const allDone = room.players.every(p => p.isFinished || p.health <= 0);
      if (allDone) {
        this.finishRoomRace(room);
      }
    }

    // Broadcast position update to other players in the room
    this.broadcastToRoom(room.roomId, {
      type: 'player_moved',
      player: {
        id: player.id,
        posX: player.posX,
        posZ: player.posZ,
        speed: player.speed,
        steering: player.steering,
        isNitro: player.isNitro,
        isCrashed: player.isCrashed,
        health: player.health,
        score: player.score,
        isFinished: player.isFinished,
        finishRank: player.finishRank
      }
    }, ws);
  }

  private finishRoomRace(room: RaceRoomInfo): void {
    room.status = 'finished';
    const winner = room.players.find(p => p.finishRank === 1);
    room.winnerName = winner?.displayName || 'Unknown';

    this.broadcastToRoom(room.roomId, {
      type: 'race_ended',
      winnerName: room.winnerName,
      room
    });
  }

  private handleChat(ws: WebSocket, text: string): void {
    const client = this.clients.get(ws);
    if (!client || !client.roomId || !text) return;

    this.broadcastToRoom(client.roomId, {
      type: 'chat_message',
      sender: client.displayName,
      text: text.slice(0, 100),
      timestamp: Date.now()
    });
  }

  private sendRoomList(ws: WebSocket): void {
    const list = Array.from(this.rooms.values())
      .filter(r => r.status === 'waiting')
      .map(r => ({
        roomId: r.roomId,
        roomCode: r.roomCode,
        playerCount: r.players.length,
        trackLength: r.trackLength,
        hostName: r.players.find(p => p.id === r.hostId)?.displayName || 'Host'
      }));

    this.send(ws, {
      type: 'room_list',
      rooms: list
    });
  }

  private broadcastToRoom(roomId: string, message: any, excludeWs?: WebSocket): void {
    const json = JSON.stringify(message);
    for (const [ws, client] of this.clients.entries()) {
      if (client.roomId === roomId && ws !== excludeWs && ws.readyState === WebSocket.OPEN) {
        ws.send(json);
      }
    }
  }

  private send(ws: WebSocket, message: any): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  private cleanupEmptyRooms(): void {
    for (const [id, room] of this.rooms.entries()) {
      if (room.players.length === 0) {
        this.rooms.delete(id);
      }
    }
  }
}

export const roomManager = new RoomManager();
