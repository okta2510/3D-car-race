import * as THREE from 'three';
import { RoadManager } from './Road.js';
import { soundManager } from './SoundManager.js';

export type WeatherType = 'clear' | 'rain' | 'fog';

export interface WeatherInfo {
  type: WeatherType;
  displayName: string;
  gripFactor: number;
  visibilityMeters: number;
  statusText: string;
}

export class WeatherManager {
  public group: THREE.Group;
  public currentWeather: WeatherType = 'clear';
  public targetWeather: WeatherType = 'clear';

  // Environmental Parameters
  public gripFactor: number = 1.0;
  public visibilityMeters: number = 250;
  public wetness: number = 0; // 0.0 to 1.0
  public rainIntensity: number = 0; // 0.0 to 1.0
  private currentFogDensity: number = 0.0016;

  // 3D Rain Particle System - Optimized count for silky 60fps performance
  private rainCount: number = 1000;
  private rainGeo: THREE.BufferGeometry;
  private rainPoints: THREE.Points;
  private rainPositions: Float32Array;
  private rainVelocities: Float32Array;
  private rainBoxSize = { x: 50, y: 35, z: 90 };

  // Ground Rain Splashes (Zero-allocation reusable mesh pool)
  private splashGroup: THREE.Group;
  private splashPool: { mesh: THREE.Mesh; life: number; maxLife: number; active: boolean }[] = [];
  private splashGeo: THREE.RingGeometry;
  private splashMat: THREE.MeshBasicMaterial;

  // Lightning Flash System
  private lightningLight: THREE.DirectionalLight;
  private lightningTimer: number = 0;
  private nextLightningTime: number = 8 + Math.random() * 8;

  // Manual Override Flag
  private isManualOverride: boolean = false;

  constructor() {
    this.group = new THREE.Group();

    // 1. Raindrop Canvas Texture for crisp elongated rain streaks
    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const grad = ctx.createLinearGradient(8, 0, 8, 64);
      grad.addColorStop(0, 'rgba(255, 255, 255, 0)');
      grad.addColorStop(0.3, 'rgba(186, 230, 253, 0.5)');
      grad.addColorStop(0.8, 'rgba(224, 242, 254, 0.95)');
      grad.addColorStop(1, 'rgba(255, 255, 255, 1)');
      ctx.fillStyle = grad;
      ctx.fillRect(6, 0, 4, 64);
    }
    const rainTex = new THREE.CanvasTexture(canvas);

    // 2. Setup Rain Particle Geometry & Points
    this.rainPositions = new Float32Array(this.rainCount * 3);
    this.rainVelocities = new Float32Array(this.rainCount);

    for (let i = 0; i < this.rainCount; i++) {
      this.rainPositions[i * 3 + 0] = (Math.random() - 0.5) * this.rainBoxSize.x;
      this.rainPositions[i * 3 + 1] = Math.random() * this.rainBoxSize.y;
      this.rainPositions[i * 3 + 2] = (Math.random() - 0.5) * this.rainBoxSize.z;
      this.rainVelocities[i] = 48 + Math.random() * 24; // Falling speed
    }

    this.rainGeo = new THREE.BufferGeometry();
    this.rainGeo.setAttribute('position', new THREE.BufferAttribute(this.rainPositions, 3));

    const rainMat = new THREE.PointsMaterial({
      size: 1.25,
      map: rainTex,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.rainPoints = new THREE.Points(this.rainGeo, rainMat);
    this.group.add(this.rainPoints);

    // 3. Ground Splashes Reusable Pool (Zero runtime allocations)
    this.splashGroup = new THREE.Group();
    this.group.add(this.splashGroup);

    this.splashGeo = new THREE.RingGeometry(0.1, 0.45, 12);
    this.splashGeo.rotateX(-Math.PI / 2);
    this.splashMat = new THREE.MeshBasicMaterial({
      color: 0x93c5fd,
      transparent: true,
      opacity: 0.4,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    for (let i = 0; i < 16; i++) {
      const mesh = new THREE.Mesh(this.splashGeo, this.splashMat);
      mesh.visible = false;
      this.splashGroup.add(mesh);
      this.splashPool.push({
        mesh,
        life: 0,
        maxLife: 0.28,
        active: false,
      });
    }

    // 4. Lightning Directional Flash Light
    this.lightningLight = new THREE.DirectionalLight(0xdbeafe, 0);
    this.lightningLight.position.set(20, 80, -20);
    this.group.add(this.lightningLight);
  }

  /**
   * Set target weather state (optional manual trigger or automatic)
   */
  public setWeather(type: WeatherType, isManual: boolean = false) {
    this.targetWeather = type;
    if (isManual) {
      this.isManualOverride = true;
    }
  }

  public cycleNextWeather(): WeatherType {
    const list: WeatherType[] = ['clear', 'rain', 'fog'];
    const nextIdx = (list.indexOf(this.targetWeather) + 1) % list.length;
    this.setWeather(list[nextIdx], true);
    return list[nextIdx];
  }

  public getWeatherInfo(): WeatherInfo {
    switch (this.currentWeather) {
      case 'rain':
        return {
          type: 'rain',
          displayName: 'CYBER RAINSTORM',
          gripFactor: Math.round(this.gripFactor * 100),
          visibilityMeters: Math.round(this.visibilityMeters),
          statusText: 'SLICK TRACK • TIRE GRIP -28%',
        };
      case 'fog':
        return {
          type: 'fog',
          displayName: 'DENSE NEON FOG',
          gripFactor: Math.round(this.gripFactor * 100),
          visibilityMeters: Math.round(this.visibilityMeters),
          statusText: 'LOW VISIBILITY • USE HIGH BEAM [F]',
        };
      case 'clear':
      default:
        return {
          type: 'clear',
          displayName: 'CLEAR HIGHWAY',
          gripFactor: 100,
          visibilityMeters: 250,
          statusText: 'OPTIMAL TRACK CONDITIONS',
        };
    }
  }

  public update(
    playerX: number,
    playerZ: number,
    playerSpeed: number,
    distanceMeters: number,
    delta: number,
    scene: THREE.Scene,
    road: RoadManager,
    ambientLight: THREE.AmbientLight,
    dirLight: THREE.DirectionalLight
  ) {
    // 1. Automatic Dynamic Weather Transitions based on Distance Traveled
    if (!this.isManualOverride) {
      const cycleLength = 6000;
      const posInCycle = distanceMeters % cycleLength;

      if (posInCycle < 2000) {
        this.targetWeather = 'clear';
      } else if (posInCycle < 4000) {
        this.targetWeather = 'rain';
      } else {
        this.targetWeather = 'fog';
      }
    }

    // 2. Smooth Transition of Environmental Parameters
    const lerpSpeed = delta * 1.2;

    // Target values depending on target weather
    let targetFogDensity = 0.0016;
    let targetGrip = 1.0;
    let targetVisibility = 250;
    let targetRainIntensity = 0;
    let targetWetness = 0;
    let targetFogColor = new THREE.Color(0x141e33);
    let targetSkyColor = new THREE.Color(0x141e33);

    if (this.targetWeather === 'rain') {
      targetFogDensity = 0.0048;
      targetGrip = 0.72; // 28% reduced tire grip on wet asphalt!
      targetVisibility = 110;
      targetRainIntensity = 1.0;
      targetWetness = 1.0;
      targetFogColor = new THREE.Color(0x0c1220);
      targetSkyColor = new THREE.Color(0x090e18);
    } else if (this.targetWeather === 'fog') {
      targetFogDensity = 0.0135; // Very dense fog!
      targetGrip = 0.88;
      targetVisibility = 42; // Low visibility challenges the driver
      targetRainIntensity = 0;
      targetWetness = 0.15;
      targetFogColor = new THREE.Color(0x1e293b);
      targetSkyColor = new THREE.Color(0x152238);
    }

    // Interpolate parameters
    this.currentFogDensity = THREE.MathUtils.lerp(this.currentFogDensity, targetFogDensity, lerpSpeed);
    this.gripFactor = THREE.MathUtils.lerp(this.gripFactor, targetGrip, lerpSpeed);
    this.visibilityMeters = THREE.MathUtils.lerp(this.visibilityMeters, targetVisibility, lerpSpeed);
    this.rainIntensity = THREE.MathUtils.lerp(this.rainIntensity, targetRainIntensity, lerpSpeed * 1.5);
    this.wetness = THREE.MathUtils.lerp(this.wetness, targetWetness, lerpSpeed * 0.8);

    // Determine current active weather label
    if (this.rainIntensity > 0.4) {
      this.currentWeather = 'rain';
    } else if (this.currentFogDensity > 0.007) {
      this.currentWeather = 'fog';
    } else {
      this.currentWeather = 'clear';
    }

    // Apply Fog to Three.js scene
    if (scene.fog && (scene.fog as THREE.FogExp2).density !== undefined) {
      (scene.fog as THREE.FogExp2).density = this.currentFogDensity;
      (scene.fog as THREE.FogExp2).color.lerp(targetFogColor, lerpSpeed);
    }
    if (scene.background && (scene.background as THREE.Color).isColor) {
      (scene.background as THREE.Color).lerp(targetSkyColor, lerpSpeed);
    }

    // Apply road wetness reflections
    road.setWetness(this.wetness);

    // 3. Update 3D Rain Particle System
    const rainMat = this.rainPoints.material as THREE.PointsMaterial;
    if (this.rainIntensity > 0.02) {
      rainMat.opacity = this.rainIntensity * 0.85;
      this.rainPoints.position.set(playerX, 0, playerZ + 15);

      const positions = this.rainPositions;
      const count = this.rainCount;
      const speedRatio = playerSpeed * 0.45;

      for (let i = 0; i < count; i++) {
        const idx = i * 3;

        // Fall downward and slant backward with vehicle velocity
        positions[idx + 1] -= this.rainVelocities[i] * delta;
        positions[idx + 2] -= speedRatio * delta * 0.8;

        // Wrap around vertically & along Z
        if (positions[idx + 1] < 0.1) {
          // Spawn occasional splash on ground
          if (Math.random() < 0.08) {
            this.spawnGroundSplash(
              playerX + positions[idx + 0],
              playerZ + 15 + positions[idx + 2]
            );
          }
          positions[idx + 1] = this.rainBoxSize.y;
        }

        if (positions[idx + 2] < -this.rainBoxSize.z / 2) {
          positions[idx + 2] += this.rainBoxSize.z;
        } else if (positions[idx + 2] > this.rainBoxSize.z / 2) {
          positions[idx + 2] -= this.rainBoxSize.z;
        }
      }

      this.rainGeo.attributes.position.needsUpdate = true;
    } else {
      rainMat.opacity = 0;
    }

    // 4. Update Ground Splash Ripples (Pooled, zero allocations)
    for (let i = 0; i < this.splashPool.length; i++) {
      const s = this.splashPool[i];
      if (!s.active) continue;
      s.life -= delta;
      if (s.life <= 0) {
        s.active = false;
        s.mesh.visible = false;
      } else {
        const prog = 1 - s.life / s.maxLife;
        const scale = 0.5 + prog * 1.8;
        s.mesh.scale.set(scale, scale, 1);
      }
    }

    // 5. Lightning and Thunder during Rain
    if (this.currentWeather === 'rain' && this.rainIntensity > 0.6) {
      this.nextLightningTime -= delta;
      if (this.nextLightningTime <= 0) {
        this.triggerLightning(ambientLight, dirLight);
        this.nextLightningTime = 9 + Math.random() * 11;
      }
    }

    // Update lightning flash decay
    if (this.lightningTimer > 0) {
      this.lightningTimer -= delta;
      if (this.lightningTimer <= 0) {
        this.lightningLight.intensity = 0;
        ambientLight.intensity = 2.4;
      }
    }
  }

  private spawnGroundSplash(x: number, z: number) {
    const splash = this.splashPool.find(s => !s.active);
    if (!splash) return;
    splash.active = true;
    splash.life = 0.28;
    splash.maxLife = 0.28;
    splash.mesh.position.set(x, 0.04, z);
    splash.mesh.scale.set(0.5, 0.5, 1);
    splash.mesh.visible = true;
  }

  private triggerLightning(ambientLight: THREE.AmbientLight, dirLight: THREE.DirectionalLight) {
    this.lightningLight.intensity = 18.0;
    this.lightningTimer = 0.09;
    ambientLight.intensity = 4.5;
    soundManager.playThunder();
  }

  public reset() {
    this.splashPool.forEach(s => {
      s.active = false;
      s.mesh.visible = false;
    });
    this.lightningLight.intensity = 0;
    this.lightningTimer = 0;
    this.currentWeather = 'clear';
    this.targetWeather = 'clear';
    this.gripFactor = 1.0;
    this.visibilityMeters = 250;
    this.rainIntensity = 0;
    this.wetness = 0;
    this.currentFogDensity = 0.0016;
    this.isManualOverride = false;
  }
}
