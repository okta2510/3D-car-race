import { MultiplayerPlayer, RaceRoomInfo } from '../types/game.js';

export type MultiplayerEventCallback = (event: {
  type: string;
  data?: any;
}) => void;

export class MultiplayerClient {
  private ws: WebSocket | null = null;
  private listeners: Set<MultiplayerEventCallback> = new Set();
  public currentRoom: RaceRoomInfo | null = null;
  public myId: string = '';
  public isHost: boolean = false;
  private pingInterval: any = null;
  private lastUpdateSentTime: number = 0;

  constructor() {
    this.connect();
  }

  public connect() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        // Heartbeat ping
        this.pingInterval = setInterval(() => {
          if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, 15000);

        this.emit({ type: 'connected' });
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          this.handleServerMessage(msg);
        } catch (err) {
          console.error('Failed to parse WS msg:', err);
        }
      };

      this.ws.onclose = () => {
        if (this.pingInterval) clearInterval(this.pingInterval);
        this.emit({ type: 'disconnected' });
        // Auto reconnect after 3s
        setTimeout(() => this.connect(), 3000);
      };

      this.ws.onerror = (err) => {
        console.warn('WS error:', err);
      };
    } catch (err) {
      console.warn('WS connection init error:', err);
    }
  }

  public subscribe(cb: MultiplayerEventCallback): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private emit(event: { type: string; data?: any }) {
    this.listeners.forEach((cb) => cb(event));
  }

  private handleServerMessage(msg: any) {
    switch (msg.type) {
      case 'auth_success':
        this.myId = msg.userId;
        break;

      case 'room_joined':
        this.currentRoom = msg.room;
        this.isHost = msg.isHost;
        this.emit({ type: 'room_joined', data: msg });
        break;

      case 'player_joined':
        if (this.currentRoom) {
          this.currentRoom = msg.room;
        }
        this.emit({ type: 'player_joined', data: msg });
        break;

      case 'player_left':
        if (this.currentRoom) {
          this.currentRoom = msg.room;
        }
        this.emit({ type: 'player_left', data: msg });
        break;

      case 'room_updated':
        this.currentRoom = msg.room;
        this.emit({ type: 'room_updated', data: msg.room });
        break;

      case 'countdown_started':
      case 'countdown_tick':
        if (this.currentRoom) {
          this.currentRoom.countdown = msg.countdown;
          this.currentRoom.status = 'countdown';
        }
        this.emit({ type: 'countdown', data: msg.countdown });
        break;

      case 'race_started':
        if (msg.room) {
          this.currentRoom = { ...msg.room, status: 'racing' };
        }
        this.emit({ type: 'race_started', data: msg.room });
        break;

      case 'player_moved':
        this.emit({ type: 'player_moved', data: msg.player });
        break;

      case 'player_finished':
        this.emit({ type: 'player_finished', data: msg });
        break;

      case 'race_ended':
        if (msg.room) {
          this.currentRoom = { ...msg.room, status: 'finished' };
        }
        this.emit({ type: 'race_ended', data: msg });
        break;

      case 'chat_message':
        this.emit({ type: 'chat_message', data: msg });
        break;

      case 'error':
        this.emit({ type: 'error', data: msg.message });
        break;
    }
  }

  public sendAuth(token?: string, displayName?: string, userId?: string) {
    this.send({ type: 'auth', token, displayName, userId });
  }

  public createRoom(options: { trackLength: number; carColor: string; carModel: string }) {
    this.send({ type: 'create_room', ...options });
  }

  public joinRoom(roomCode: string) {
    this.send({ type: 'join_room', roomCode });
  }

  public quickMatch(options: { carColor: string; carModel: string }) {
    this.send({ type: 'quick_match', ...options });
  }

  public toggleReady(isReady?: boolean) {
    this.send({ type: 'toggle_ready', isReady });
  }

  public startRace() {
    this.send({ type: 'start_race' });
  }

  public leaveRoom() {
    this.send({ type: 'leave_room' });
    this.currentRoom = null;
    this.isHost = false;
  }

  public sendPlayerUpdate(state: {
    posX: number;
    posZ: number;
    speed: number;
    steering: number;
    isNitro: boolean;
    isCrashed: boolean;
    health: number;
    score: number;
  }) {
    // Limit to max 30Hz to optimize bandwidth
    const now = performance.now();
    if (now - this.lastUpdateSentTime < 33) return;
    this.lastUpdateSentTime = now;

    this.send({
      type: 'player_update',
      ...state,
    });
  }

  public sendChat(text: string) {
    this.send({ type: 'chat', text });
  }

  private send(msg: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }
}

export const multiplayerClient = new MultiplayerClient();
