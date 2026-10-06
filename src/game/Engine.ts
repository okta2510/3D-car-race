import * as THREE from 'three';
import { Car3D } from './CarModel.js';
import { RoadManager } from './Road.js';
import { ObstacleManager, CollisionEvent } from './ObstacleManager.js';
import { ParticleManager } from './ParticleManager.js';
import { WeatherManager, WeatherType, WeatherInfo } from './WeatherManager.js';
import { soundManager } from './SoundManager.js';
import { MultiplayerPlayer } from '../types/game.js';

export interface GameStats {
  speedKmh: number;
  distanceMeters: number;
  score: number;
  health: number;
  nitro: number; // 0 - 100
  isNitroActive: boolean;
  headlightMode: 'high' | 'dim';
  weather: WeatherType;
  weatherInfo: WeatherInfo;
  rank: number;
  totalRacers: number;
  isFinished: boolean;
  isCrashed: boolean;
}

export type EngineCallback = (stats: GameStats) => void;

export class RacingEngine {
  private container: HTMLElement;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private animFrameId: number | null = null;
  private isRunning: boolean = false;

  // Road, Obstacles & Weather
  private road: RoadManager;
  private obstacles: ObstacleManager;
  public particles: ParticleManager;
  public weather: WeatherManager;
  private ambientLight!: THREE.AmbientLight;
  private dirLight!: THREE.DirectionalLight;

  // Player Car & Physics
  public playerCar: Car3D;
  private playerX: number = 0;
  private playerZ: number = 0;
  private currentSpeed: number = 0; // units/sec (speed in km/h = currentSpeed * 2.8)
  private maxSpeed: number = 46.43; // Basic car (Cyber GT) default speed: 130 km/h (46.43 * 2.8 = 130)
  private nitroMaxSpeed: number = 67.85; // ~190 km/h on nitro
  private acceleration: number = 28;
  private braking: number = 55;
  private lateralSpeed: number = 18;
  private steeringAngle: number = 0;
  private health: number = 100;
  private nitro: number = 100;
  private isNitroPressed: boolean = false;
  private score: number = 0;
  private distanceTraveled: number = 0;
  private trackLength: number = Infinity; // Endless sprint has no distance limit
  private isFinished: boolean = false;
  private isGameOver: boolean = false;
  private oilSlickTimer: number = 0;
  private oilSwerveVelocity: number = 0;
  private oilSpinAngle: number = 0;

  // Opponent Cars (Multiplayer)
  private opponents: Map<string, { car: Car3D; targetX: number; targetZ: number; currentX: number; currentZ: number; speed: number }> = new Map();

  // Camera Settings
  private cameraMode: 'chase' | 'hood' | 'overhead' = 'chase';
  private targetCameraPos = new THREE.Vector3();
  private targetCameraLook = new THREE.Vector3();
  private cameraShakeIntensity: number = 0;

  // Input states
  private keys: Record<string, boolean> = {};
  private virtualSteer: number = 0;
  private virtualThrottle: number = 0;
  private virtualBrake: boolean = false;
  private virtualNitro: boolean = false;

  // Callbacks
  private onStatsUpdate: EngineCallback | null = null;
  private onRaceComplete: ((won: boolean, rank: number, score: number, distance: number) => void) | null = null;
  private onCrashGameOver: ((stats: GameStats) => void) | null = null;

  private clock = new THREE.Clock();

  constructor(container: HTMLElement, options: {
    carColor?: string;
    carModel?: string;
    underglowColor?: string;
    upgrades?: { topSpeed: number; acceleration: number; handling: number; nitroCapacity: number };
    seed?: number;
    trackLength?: number;
    mode?: 'single' | 'multiplayer';
  } = {}) {
    this.container = container;
    // Endless mode runs indefinitely without distance limits; Multiplayer has target finish track
    const isEndless = options.mode === 'single' || options.trackLength === Infinity;
    this.trackLength = isEndless ? Infinity : (options.trackLength || 4000);

    // Speed Limits by Car Model (USER REQUIREMENT: basic car speed limit changed to 130 km/h)
    const carModel = options.carModel || 'Cyber GT';
    let baseSpeedKmh = 130; // Basic Car (Cyber GT): 130 km/h
    let baseNitroKmh = 190;
    let baseAccel = 28;
    let baseHandling = 16;

    if (carModel === 'Apex Phantom') {
      baseSpeedKmh = 210;
      baseNitroKmh = 270;
      baseAccel = 34;
      baseHandling = 19;
    } else if (carModel === 'Hyperion Supercar') {
      baseSpeedKmh = 250;
      baseNitroKmh = 310;
      baseAccel = 40;
      baseHandling = 21;
    } else if (carModel === 'Velocity Formula') {
      baseSpeedKmh = 290;
      baseNitroKmh = 350;
      baseAccel = 46;
      baseHandling = 24;
    }

    // Apply performance upgrades
    const topUpgrade = options.upgrades?.topSpeed || 0;
    const accelUpgrade = options.upgrades?.acceleration || 0;
    const handUpgrade = options.upgrades?.handling || 0;

    const finalTopKmh = baseSpeedKmh + topUpgrade * 6;
    const finalNitroKmh = baseNitroKmh + topUpgrade * 8;

    this.maxSpeed = finalTopKmh / 2.8;
    this.nitroMaxSpeed = finalNitroKmh / 2.8;
    this.acceleration = baseAccel + accelUpgrade * 5;
    this.lateralSpeed = baseHandling + handUpgrade * 3;

    // Three.js Scene Setup - Brightened ambiance for clear road & obstacle visibility
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x141e33);
    this.scene.fog = new THREE.FogExp2(0x141e33, 0.0016);

    // Camera
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(65, width / height, 0.1, 1000);

    // Renderer - PCFShadowMap for smooth, glitch-free 60fps rendering
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.6;
    container.appendChild(this.renderer.domElement);

    // Lighting
    this.setupLighting();

    // Road & Environment
    this.road = new RoadManager();
    this.scene.add(this.road.group);

    // Obstacles
    this.obstacles = new ObstacleManager(options.seed || 12345, this.trackLength);
    this.scene.add(this.obstacles.group);

    // Particle Effects System (Sparks, Debris, Smoke, Shockwaves)
    this.particles = new ParticleManager();
    this.scene.add(this.particles.group);

    // Dynamic Weather System (Rain, Fog, Lightning, Wet Road)
    this.weather = new WeatherManager();
    this.scene.add(this.weather.group);

    // Player Car
    this.playerCar = new Car3D({
      color: options.carColor || '#ef4444',
      underglowColor: options.underglowColor || '#06b6d4',
      modelName: options.carModel || 'Cyber GT',
      isPlayer: true
    });
    this.scene.add(this.playerCar.group);

    // Distant Cyber Skyline & Stars
    this.createSkyline();

    // Event Listeners
    this.setupInputs();
    window.addEventListener('resize', this.onResize);
  }

  private setupLighting() {
    // Ambient light - significantly brightened for clear road & obstacle visibility
    const ambient = new THREE.AmbientLight(0xdbeafe, 2.4);
    this.ambientLight = ambient;
    this.scene.add(ambient);

    // Sky/Ground hemisphere fill for rich contrast and depth
    const hemiLight = new THREE.HemisphereLight(0xbae6fd, 0x334155, 1.8);
    this.scene.add(hemiLight);

    // Key Directional Light - bright moonlight/sunlight illuminating the highway
    const dirLight = new THREE.DirectionalLight(0xffffff, 3.2);
    dirLight.position.set(30, 60, 20);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    this.dirLight = dirLight;
    this.scene.add(dirLight);

    // Cyan/Violet city horizon rim light
    const rimLight = new THREE.DirectionalLight(0xc4b5fd, 2.2);
    rimLight.position.set(-40, 20, -50);
    this.scene.add(rimLight);
  }

  private createSkyline() {
    const cityGroup = new THREE.Group();
    const buildingGeo = new THREE.BoxGeometry(15, 60, 15);
    const buildingColors = [0x0f172a, 0x1e1b4b, 0x172554, 0x030712];

    for (let i = 0; i < 35; i++) {
      const col = buildingColors[i % buildingColors.length];
      const mat = new THREE.MeshStandardMaterial({
        color: col,
        roughness: 0.8,
        emissive: 0x0284c7,
        emissiveIntensity: 0.15
      });
      const b = new THREE.Mesh(buildingGeo, mat);
      const side = i % 2 === 0 ? 1 : -1;
      b.position.set(
        side * (35 + Math.random() * 45),
        25 + Math.random() * 20,
        i * 45 - 200
      );
      b.scale.y = 0.5 + Math.random() * 1.5;
      cityGroup.add(b);
    }
    this.scene.add(cityGroup);

    // Distant Cyber Grid & Horizon Glow
    const starsGeo = new THREE.BufferGeometry();
    const starCount = 800;
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount * 3; i += 3) {
      starPositions[i] = (Math.random() - 0.5) * 800;
      starPositions[i + 1] = 40 + Math.random() * 200;
      starPositions[i + 2] = (Math.random() - 0.5) * 800;
    }
    starsGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    const starMat = new THREE.PointsMaterial({ color: 0x38bdf8, size: 1.5, transparent: true, opacity: 0.7 });
    const stars = new THREE.Points(starsGeo, starMat);
    this.scene.add(stars);
  }

  private setupInputs() {
    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
      if (e.code === 'KeyC') {
        this.toggleCamera();
      }
      if (e.code === 'KeyF') {
        this.toggleHeadlights();
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });
  }

  public setVirtualControls(controls: {
    steer?: number; // -1 to 1
    throttle?: number; // 0 to 1
    brake?: boolean;
    nitro?: boolean;
  }) {
    if (controls.steer !== undefined) this.virtualSteer = controls.steer;
    if (controls.throttle !== undefined) this.virtualThrottle = controls.throttle;
    if (controls.brake !== undefined) this.virtualBrake = controls.brake;
    if (controls.nitro !== undefined) this.virtualNitro = controls.nitro;
  }

  public toggleCamera() {
    if (this.cameraMode === 'chase') this.cameraMode = 'hood';
    else if (this.cameraMode === 'hood') this.cameraMode = 'overhead';
    else this.cameraMode = 'chase';
  }

  public toggleHeadlights(): 'high' | 'dim' {
    return this.playerCar.toggleHeadlights();
  }

  public setCallbacks(
    onStats: EngineCallback,
    onComplete: (won: boolean, rank: number, score: number, distance: number) => void,
    onCrash: (stats: GameStats) => void
  ) {
    this.onStatsUpdate = onStats;
    this.onRaceComplete = onComplete;
    this.onCrashGameOver = onCrash;
  }

  public start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.clock.start();
    soundManager.startEngine();
    soundManager.startMusic();
    this.animate();
  }

  public pause() {
    this.isRunning = false;
    soundManager.stopEngine();
    soundManager.stopNitroSound();
    soundManager.stopMusic();
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  public setSeed(seed: number, trackLength?: number) {
    if (trackLength) this.trackLength = trackLength;
    this.obstacles.setSeed(seed, this.trackLength);
  }

  public resetRace() {
    this.playerX = 0;
    this.playerZ = 0;
    this.currentSpeed = 0;
    this.health = 100;
    this.nitro = 100;
    this.score = 0;
    this.distanceTraveled = 0;
    this.isFinished = false;
    this.isGameOver = false;
    this.oilSlickTimer = 0;
    this.oilSwerveVelocity = 0;
    this.oilSpinAngle = 0;
    this.playerCar.group.position.set(0, 0, 0);
    this.playerCar.group.rotation.set(0, 0, 0);
    this.obstacles.reset();
  }

  public updateOpponent(player: Partial<MultiplayerPlayer> & { id: string }) {
    let opponent = this.opponents.get(player.id);
    if (!opponent) {
      const car = new Car3D({
        color: player.carColor || '#06b6d4',
        modelName: player.carModel || 'Cyber GT',
        playerName: player.displayName || 'Racer'
      });
      this.scene.add(car.group);
      opponent = {
        car,
        targetX: player.posX || 0,
        targetZ: player.posZ || 0,
        currentX: player.posX || 0,
        currentZ: player.posZ || 0,
        speed: player.speed || 0
      };
      this.opponents.set(player.id, opponent);
    }

    if (player.posX !== undefined) opponent.targetX = player.posX;
    if (player.posZ !== undefined) opponent.targetZ = player.posZ;
    if (player.speed !== undefined) opponent.speed = player.speed;
    if (player.isNitro !== undefined) opponent.car.setNitro(player.isNitro);
  }

  public removeOpponent(id: string) {
    const opp = this.opponents.get(id);
    if (opp) {
      this.scene.remove(opp.car.group);
      this.opponents.delete(id);
    }
  }

  private animate = () => {
    if (!this.isRunning) return;
    this.animFrameId = requestAnimationFrame(this.animate);

    const delta = Math.min(this.clock.getDelta(), 0.1);
    this.updatePhysics(delta);
    this.updateCamera(delta);
    this.renderer.render(this.scene, this.camera);
  };

  private updatePhysics(delta: number) {
    if (this.isGameOver) return;

    // Determine Throttle / Brake
    const isAccelerating = this.keys['ArrowUp'] || this.keys['KeyW'] || this.virtualThrottle > 0.1;
    const isBraking = this.keys['ArrowDown'] || this.keys['KeyS'] || this.virtualBrake;
    const isSteeringLeft = this.keys['ArrowLeft'] || this.keys['KeyA'] || this.virtualSteer < -0.2;
    const isSteeringRight = this.keys['ArrowRight'] || this.keys['KeyD'] || this.virtualSteer > 0.2;
    this.isNitroPressed = (this.keys['Space'] || this.keys['ShiftLeft'] || this.virtualNitro) && this.nitro > 5 && isAccelerating;

    // Oil Slick Skid & Lane Swerve Check
    if (this.oilSlickTimer > 0) {
      this.oilSlickTimer -= delta;
      // Physical swerve 1 to 2 lanes across highway
      this.playerX -= this.oilSwerveVelocity * delta;
      this.cameraShakeIntensity = Math.max(this.cameraShakeIntensity, 0.45);
    }

    // Nitro consumption (USER REQUEST: nitro does NOT refill automatically)
    let effectiveMaxSpeed = this.maxSpeed;
    if (this.isNitroPressed && this.nitro > 0) {
      effectiveMaxSpeed = this.nitroMaxSpeed;
      this.nitro = Math.max(0, this.nitro - delta * 30);
      this.playerCar.setNitro(true);
      soundManager.startNitroSound();
    } else {
      soundManager.stopNitroSound();
      this.playerCar.setNitro(false);
      // NOTE: Automatic regeneration removed as requested. Nitro is only gained from pickups!
    }

    // Speed calculation
    if (isAccelerating) {
      const accelRate = this.isNitroPressed ? this.acceleration * 1.8 : this.acceleration;
      this.currentSpeed = Math.min(effectiveMaxSpeed, this.currentSpeed + accelRate * delta);
    } else if (isBraking) {
      this.currentSpeed = Math.max(0, this.currentSpeed - this.braking * delta);
    } else {
      // Natural drag / friction
      this.currentSpeed = Math.max(0, this.currentSpeed - 12 * delta);
    }

    // Steering & Lateral Movement
    // screenSteer: -1 = LEFT on screen, +1 = RIGHT on screen
    let screenSteer = 0;
    if (isSteeringLeft) screenSteer -= 1;
    if (isSteeringRight) screenSteer += 1;
    if (this.virtualSteer !== 0) screenSteer = this.virtualSteer;

    // USER REQUIREMENT:
    // Turning/lane shifting is determined by forward speed. When stationary (diam, speed = 0),
    // controls only turn the front wheels without moving the car laterally!
    const speedRatio = Math.min(1.0, this.currentSpeed / 25);

    // In camera view looking forward along +Z, world +X is on the LEFT of the screen, world -X is on the RIGHT.
    // Moving to screen LEFT (-1) increases playerX (+X).
    // Moving to screen RIGHT (+1) decreases playerX (-X).
    this.playerX -= screenSteer * this.lateralSpeed * speedRatio * delta;

    // Road boundaries (-10.5m to 10.5m)
    const maxRoadX = 9.8;
    if (Math.abs(this.playerX) > maxRoadX) {
      this.playerX = Math.sign(this.playerX) * maxRoadX;
      // Guardrail scrape penalty
      this.currentSpeed = Math.max(15, this.currentSpeed - 20 * delta);
      this.cameraShakeIntensity = Math.max(this.cameraShakeIntensity, 0.2);
    }

    // Car rotation: Nose angles towards turn direction on screen proportional to speed
    // Turning to screen LEFT (-1) requires positive rotation.y (angles nose to world +X / screen left)
    // Turning to screen RIGHT (+1) requires negative rotation.y (angles nose to world -X / screen right)
    let targetAngle = -screenSteer * 0.18 * Math.min(1.0, this.currentSpeed / 15);
    if (this.oilSlickTimer > 0) {
      targetAngle = this.oilSpinAngle;
    }
    this.steeringAngle = THREE.MathUtils.lerp(
      this.steeringAngle,
      targetAngle,
      delta * (this.oilSlickTimer > 0 ? 6 : 12)
    );

    // Forward advancement
    this.playerZ += this.currentSpeed * delta;
    this.distanceTraveled = Math.round(this.playerZ * 1.5);

    // Score accumulation
    if (this.currentSpeed > 10) {
      this.score += Math.round(this.currentSpeed * delta * (this.isNitroPressed ? 2.5 : 1.2));
    }

    // Update Player Car Mesh
    this.playerCar.group.position.set(this.playerX, 0, this.playerZ);
    this.playerCar.group.rotation.y = this.steeringAngle;
    this.playerCar.group.rotation.z = screenSteer * 0.08 * speedRatio; // Realistic centrifugal chassis lean
    // Front wheels visibly turn in place (-screenSteer * 0.5) even when stationary!
    this.playerCar.updateWheels(this.currentSpeed * delta * 2, -screenSteer * 0.5);
    this.playerCar.update(delta); // Updates damage flash if hit

    // Update Road chunks & Obstacles
    this.road.update(this.playerZ);
    this.obstacles.update(this.playerZ, delta);
    this.particles.update(delta);

    // Dynamic Weather Update (Rain, Fog, Wet Road, Lightning)
    this.weather.update(
      this.playerX,
      this.playerZ,
      this.currentSpeed,
      this.distanceTraveled,
      delta,
      this.scene,
      this.road,
      this.ambientLight,
      this.dirLight
    );

    // Effect Ban Roda Saat Berbelok (Tire smoke & cornering friction when steering)
    if (Math.abs(screenSteer) > 0.12 && this.currentSpeed > 14) {
      this.particles.spawnTireSteerEffect(this.playerX, this.playerZ, screenSteer, this.currentSpeed);
    }

    // Dynamic Tire Skid Smoke while slipping on oil
    if (this.oilSlickTimer > 0 && Math.random() < 0.45) {
      this.particles.spawnSkidSmoke(this.playerX, this.playerZ);
    }

    // Check Obstacle Collisions
    const playerBox = new THREE.Box3().setFromObject(this.playerCar.group);
    const collision = this.obstacles.checkPlayerCollision(playerBox, this.playerZ);
    if (collision) {
      this.handleCollision(collision);
    }

    // Update Opponent interpolation
    this.opponents.forEach((opp) => {
      opp.currentX = THREE.MathUtils.lerp(opp.currentX, opp.targetX, delta * 12);
      opp.currentZ = THREE.MathUtils.lerp(opp.currentZ, opp.targetZ, delta * 12);
      opp.car.group.position.set(opp.currentX, 0, opp.currentZ);
      opp.car.updateWheels(opp.speed * delta * 2, 0);
    });

    // Sound engine throttle update
    soundManager.updateEnginePitch(this.currentSpeed / this.maxSpeed, this.isNitroPressed);

    // Check Finish Line (Only in finite tracks / multiplayer races; endless runs never end by distance)
    if (!this.isFinished && isFinite(this.trackLength) && this.playerZ >= this.trackLength) {
      this.isFinished = true;
      soundManager.stopNitroSound();
      soundManager.playVictory();
      const currentRank = this.computeRank();
      if (this.onRaceComplete) {
        this.onRaceComplete(currentRank === 1, currentRank, this.score, this.distanceTraveled);
      }
    }

    // Broadcast HUD stats
    if (this.onStatsUpdate) {
      const speedKmh = Math.round(this.currentSpeed * 2.8);
      this.onStatsUpdate({
        speedKmh,
        distanceMeters: this.distanceTraveled,
        score: this.score,
        health: Math.max(0, Math.round(this.health)),
        nitro: Math.round(this.nitro),
        isNitroActive: this.isNitroPressed,
        headlightMode: this.playerCar.headlightMode,
        weather: this.weather.currentWeather,
        weatherInfo: this.weather.getWeatherInfo(),
        rank: this.computeRank(),
        totalRacers: this.opponents.size + 1,
        isFinished: this.isFinished,
        isCrashed: this.health <= 0
      });
    }
  }

  private handleCollision(evt: CollisionEvent) {
    if (evt.type === 'coin') {
      this.score += evt.scoreBonus || 150;
    } else if (evt.type === 'nitro_boost') {
      this.nitro = 100;
      this.currentSpeed = Math.min(this.nitroMaxSpeed + 15, this.currentSpeed + 25);
      this.score += evt.scoreBonus || 250;
    } else if (evt.type === 'oil_slick') {
      this.oilSlickTimer = 1.4;
      this.currentSpeed *= 0.88;
      soundManager.playTireSkid();

      // Swerve 1 to 2 lanes (4.4m to 8.8m) depending on speed and current car direction
      // In our coordinate space: -1 = LEFT, +1 = RIGHT
      const isSteeringLeft = this.keys['ArrowLeft'] || this.keys['KeyA'] || this.virtualSteer < -0.2;
      const isSteeringRight = this.keys['ArrowRight'] || this.keys['KeyD'] || this.virtualSteer > 0.2;
      let swerveDir = 0;
      if (isSteeringLeft) swerveDir = -1;
      else if (isSteeringRight) swerveDir = 1;
      else swerveDir = this.playerX > 0 ? 1 : -1; // If moving straight, swerve towards the road center/other lane

      const speedFactor = Math.min(1.0, Math.max(0.3, this.currentSpeed / 55));
      const numLanes = 1.0 + speedFactor * 1.0; // 1.0 to 2.0 lanes!
      const totalSwerveDistance = numLanes * 4.4; // 4.4m to 8.8m

      this.oilSwerveVelocity = swerveDir * (totalSwerveDistance / 1.3);
      this.oilSpinAngle = -swerveDir * 0.42; // Aggressive drift/skid yaw
      this.cameraShakeIntensity = 0.7;
      this.particles.spawnOilSplash(this.playerX, this.playerZ);
      this.particles.spawnSkidSmoke(this.playerX, this.playerZ);
    } else if (evt.type === 'damage') {
      const dmg = evt.damage || 25;
      this.health = Math.max(0, this.health - dmg);
      this.playerCar.flashDamage(1.0);
      this.currentSpeed = Math.max(10, this.currentSpeed - 25);
      this.cameraShakeIntensity = 1.0;

      // Spawn cinematic sparks, tumbling physical debris, shockwave ring, and impact flash
      const impactPos = evt.point ? evt.point.clone() : new THREE.Vector3(this.playerX, 0.8, this.playerZ + 2.2);
      this.particles.spawnCollisionEffect(impactPos, {
        obstacleType: evt.obstacleType,
        severity: dmg,
        carSpeed: this.currentSpeed,
      });

      if (this.health <= 0) {
        this.health = 0;
        this.isGameOver = true;
        soundManager.stopNitroSound();
        soundManager.stopMusic();
        soundManager.playCrash();
        soundManager.stopEngine();
        if (this.onCrashGameOver) {
          this.onCrashGameOver({
            speedKmh: 0,
            distanceMeters: this.distanceTraveled,
            score: this.score,
            health: 0,
            nitro: Math.round(this.nitro),
            isNitroActive: false,
            headlightMode: this.playerCar.headlightMode,
            weather: this.weather.currentWeather,
            weatherInfo: this.weather.getWeatherInfo(),
            rank: this.computeRank(),
            totalRacers: this.opponents.size + 1,
            isFinished: false,
            isCrashed: true
          });
        }
      }
    }
  }

  public cycleWeather(): WeatherType {
    return this.weather.cycleNextWeather();
  }

  private computeRank(): number {
    let rank = 1;
    this.opponents.forEach((opp) => {
      if (opp.currentZ > this.playerZ) {
        rank++;
      }
    });
    return rank;
  }

  private updateCamera(delta: number) {
    // Dynamic Camera FOV (Widening during Nitro boost)
    const targetFOV = this.isNitroPressed ? 78 : 65;
    this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFOV, delta * 6);
    this.camera.updateProjectionMatrix();

    if (this.cameraMode === 'chase') {
      // 3rd Person behind car
      this.targetCameraPos.set(
        this.playerX * 0.7,
        4.2,
        this.playerZ - 8.5
      );
      this.targetCameraLook.set(
        this.playerX * 0.9,
        1.2,
        this.playerZ + 18
      );
    } else if (this.cameraMode === 'hood') {
      // Bumper / Hood cam
      this.targetCameraPos.set(
        this.playerX,
        1.4,
        this.playerZ + 1.2
      );
      this.targetCameraLook.set(
        this.playerX,
        1.2,
        this.playerZ + 30
      );
    } else {
      // Overhead top-down cam
      this.targetCameraPos.set(
        this.playerX * 0.4,
        18,
        this.playerZ - 12
      );
      this.targetCameraLook.set(
        this.playerX,
        0,
        this.playerZ + 15
      );
    }

    // Apply Camera Shake on collision or high speed
    if (this.cameraShakeIntensity > 0) {
      this.targetCameraPos.x += (Math.random() - 0.5) * this.cameraShakeIntensity;
      this.targetCameraPos.y += (Math.random() - 0.5) * this.cameraShakeIntensity;
      this.cameraShakeIntensity = Math.max(0, this.cameraShakeIntensity - delta * 2.5);
    }

    this.camera.position.lerp(this.targetCameraPos, delta * 10);
    this.camera.lookAt(this.targetCameraLook);
  }

  public getPlayerState() {
    return {
      posX: this.playerX,
      posZ: this.playerZ,
      speed: this.currentSpeed,
      steering: this.steeringAngle,
      isNitro: this.isNitroPressed,
      isCrashed: this.health <= 0,
      health: this.health,
      score: this.score
    };
  }

  private onResize = () => {
    if (!this.container) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  };

  public destroy() {
    this.pause();
    this.particles.reset();
    window.removeEventListener('resize', this.onResize);
    if (this.renderer.domElement && this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
    this.renderer.dispose();
  }
}
