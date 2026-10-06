import * as THREE from 'three';
import { ObstacleData, ObstacleType } from '../types/game.js';
import { soundManager } from './SoundManager.js';

// Seeded PRNG for multiplayer synchronization
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface CollisionEvent {
  type: 'damage' | 'nitro_boost' | 'coin' | 'oil_slick';
  damage?: number;
  scoreBonus?: number;
  obstacleType?: ObstacleType;
  point?: THREE.Vector3;
}

export class ObstacleManager {
  public group: THREE.Group;
  private seed: number;
  private random: () => number;
  private spawnedObstacles: Map<number, { mesh: THREE.Group; data: ObstacleData }> = new Map();
  private maxSpawnDistance: number = 320;
  private laneXMap = [-8.8, -4.4, 0, 4.4, 8.8]; // 5 lanes
  private nextObstacleIndex: number = 0;
  private nextCheckZ: number = 60;
  private maxZTrack: number;
  private blinkingObstacles: Map<number, {
    mesh: THREE.Group;
    timer: number;
    materials: THREE.MeshStandardMaterial[];
    knockbackVel: THREE.Vector3;
  }> = new Map();

  constructor(seed: number = 12345, trackLength: number = 10000) {
    this.group = new THREE.Group();
    this.seed = seed;
    this.random = mulberry32(seed);
    this.maxZTrack = trackLength;
  }

  public setSeed(seed: number, trackLength: number = 10000) {
    this.seed = seed;
    this.random = mulberry32(seed);
    this.maxZTrack = trackLength;
    this.reset();
  }

  public reset() {
    this.random = mulberry32(this.seed);
    this.spawnedObstacles.forEach(({ mesh }) => {
      this.group.remove(mesh);
    });
    this.spawnedObstacles.clear();
    this.blinkingObstacles.clear();
    this.nextObstacleIndex = 0;
    this.nextCheckZ = 60;
  }

  public update(playerZ: number, delta: number): CollisionEvent | null {
    // Generate ahead up to playerZ + maxSpawnDistance (Infinity for endless sprint)
    const targetZLimit = isFinite(this.maxZTrack) ? Math.min(this.maxZTrack - 50, playerZ + this.maxSpawnDistance) : playerZ + this.maxSpawnDistance;
    while (this.nextCheckZ < targetZLimit) {
      this.generateObstacleAtZ(this.nextCheckZ);
      // Interval between obstacles: 35m to 65m
      const spacing = 35 + this.random() * 30;
      this.nextCheckZ += spacing;
    }

    // Update moving traffic
    this.spawnedObstacles.forEach(({ mesh, data }) => {
      if (data.type === 'traffic_car' || data.type === 'traffic_truck') {
        const trafficSpeed = data.speed || 30;
        data.z += trafficSpeed * delta;
        mesh.position.z = data.z;
      }

      // Rotate coins and boosters
      if (data.type === 'coin_pickup') {
        mesh.rotation.y += delta * 3;
      }
    });

    // Update Blinking & Tumbling Hit Obstacles
    for (const [id, blink] of this.blinkingObstacles.entries()) {
      blink.timer -= delta;
      if (blink.timer <= 0) {
        this.group.remove(blink.mesh);
        this.blinkingObstacles.delete(id);
      } else {
        // High frequency strobe flash between neon red and white
        const flash = Math.floor(blink.timer * 16) % 2 === 0;
        blink.materials.forEach((mat) => {
          if (mat.emissive) {
            mat.emissive.setHex(flash ? 0xff0022 : 0xffffff);
            mat.emissiveIntensity = flash ? 2.5 : 1.5;
          }
        });

        // Knockback physics: bounce forward/sideways and spin
        blink.mesh.position.addScaledVector(blink.knockbackVel, delta);
        blink.mesh.rotation.y += delta * 6;
        blink.mesh.rotation.x += delta * 4;
        blink.mesh.rotation.z += delta * 3;
        blink.mesh.position.y = Math.max(0.1, blink.mesh.position.y);
      }
    }

    // Clean up passed obstacles (more than 40m behind player)
    for (const [id, { mesh, data }] of this.spawnedObstacles.entries()) {
      if (data.z < playerZ - 40 && !this.blinkingObstacles.has(id)) {
        this.group.remove(mesh);
        this.spawnedObstacles.delete(id);
      }
    }

    return null;
  }

  public checkPlayerCollision(playerBox: THREE.Box3, playerZ: number): CollisionEvent | null {
    for (const [id, { mesh, data }] of this.spawnedObstacles.entries()) {
      if (data.collected) continue;

      // Only check objects within 10 meters of player Z
      if (Math.abs(data.z - playerZ) > 10) continue;

      const objBox = new THREE.Box3().setFromObject(mesh);
      if (playerBox.intersectsBox(objBox)) {
        if (data.type === 'coin_pickup') {
          data.collected = true;
          this.group.remove(mesh);
          this.spawnedObstacles.delete(id);
          soundManager.playCoin();
          return { type: 'coin', scoreBonus: 150 };
        } else if (data.type === 'nitro_pickup') {
          data.collected = true;
          this.group.remove(mesh);
          this.spawnedObstacles.delete(id);
          soundManager.playNitroPickup();
          return { type: 'nitro_boost', scoreBonus: 250 };
        } else if (data.type === 'oil_slick') {
          data.collected = true;
          return { type: 'oil_slick' };
        } else if (data.type === 'barrier' || data.type === 'traffic_car' || data.type === 'traffic_truck') {
          data.collected = true;
          soundManager.playCrash();

          // Extract standard materials from mesh for blinking strobe effect
          const materials: THREE.MeshStandardMaterial[] = [];
          mesh.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
              const m = (child as THREE.Mesh).material;
              if (Array.isArray(m)) {
                materials.push(...(m as THREE.MeshStandardMaterial[]));
              } else if (m) {
                materials.push(m as THREE.MeshStandardMaterial);
              }
            }
          });

          // Knockback velocity
          const sideDir = (Math.random() > 0.5 ? 1 : -1) * (8 + Math.random() * 8);
          const knockbackVel = new THREE.Vector3(sideDir, 6 + Math.random() * 5, 20 + Math.random() * 15);

          this.blinkingObstacles.set(id, {
            mesh,
            timer: 1.2,
            materials,
            knockbackVel,
          });

          const damageAmount = data.type === 'traffic_truck' ? 45 : data.type === 'traffic_car' ? 30 : 25;
          const impactPoint = new THREE.Vector3(
            (mesh.position.x + (playerBox.min.x + playerBox.max.x) * 0.5) * 0.5,
            0.8,
            (mesh.position.z + playerZ) * 0.5
          );

          return {
            type: 'damage',
            damage: damageAmount,
            scoreBonus: -100,
            obstacleType: data.type,
            point: impactPoint,
          };
        }
      }
    }
    return null;
  }

  private generateObstacleAtZ(z: number) {
    const id = this.nextObstacleIndex++;
    const laneIndex = Math.floor(this.random() * this.laneXMap.length);
    const laneX = this.laneXMap[laneIndex];

    const roll = this.random();
    let type: ObstacleType = 'traffic_car';

    if (roll < 0.22) {
      type = 'coin_pickup';
    } else if (roll < 0.35) {
      type = 'nitro_pickup';
    } else if (roll < 0.48) {
      type = 'oil_slick';
    } else if (roll < 0.62) {
      type = 'barrier';
    } else if (roll < 0.82) {
      type = 'traffic_car';
    } else {
      type = 'traffic_truck';
    }

    const data: ObstacleData = {
      id,
      type,
      lane: laneIndex,
      x: laneX,
      z,
      speed: type === 'traffic_car' ? 25 + this.random() * 20 : type === 'traffic_truck' ? 18 + this.random() * 12 : 0,
      color: ['#3b82f6', '#eab308', '#ec4899', '#6366f1', '#14b8a6'][Math.floor(this.random() * 5)]
    };

    const mesh = this.createObstacleMesh(data);
    mesh.position.set(laneX, 0, z);

    this.spawnedObstacles.set(id, { mesh, data });
    this.group.add(mesh);
  }

  private createObstacleMesh(data: ObstacleData): THREE.Group {
    const group = new THREE.Group();

    if (data.type === 'coin_pickup') {
      const coinGeo = new THREE.CylinderGeometry(0.8, 0.8, 0.18, 16);
      coinGeo.rotateZ(Math.PI / 2);
      const coinMat = new THREE.MeshStandardMaterial({
        color: 0xfbbf24,
        metalness: 0.9,
        roughness: 0.2,
        emissive: 0xf59e0b,
        emissiveIntensity: 0.85
      });
      const coin = new THREE.Mesh(coinGeo, coinMat);
      coin.position.y = 1.0;
      group.add(coin);

      // Glowing outer halo ring
      const haloGeo = new THREE.RingGeometry(0.8, 0.95, 16);
      const haloMat = new THREE.MeshBasicMaterial({
        color: 0xfbbf24,
        transparent: true,
        opacity: 0.7,
        side: THREE.DoubleSide
      });
      const halo = new THREE.Mesh(haloGeo, haloMat);
      halo.position.y = 1.0;
      group.add(halo);
      return group;
    }

    if (data.type === 'nitro_pickup') {
      const cylinderGeo = new THREE.CylinderGeometry(0.4, 0.4, 1.4, 12);
      const nitroMat = new THREE.MeshStandardMaterial({
        color: 0x06b6d4,
        metalness: 0.8,
        emissive: 0x00f0ff,
        emissiveIntensity: 0.95
      });
      const cylinder = new THREE.Mesh(cylinderGeo, nitroMat);
      cylinder.position.y = 0.9;
      cylinder.rotation.z = Math.PI / 4;
      group.add(cylinder);

      // Glowing pulse ring
      const auraGeo = new THREE.RingGeometry(0.5, 0.7, 16);
      const auraMat = new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.8,
        side: THREE.DoubleSide
      });
      const aura = new THREE.Mesh(auraGeo, auraMat);
      aura.position.y = 0.9;
      group.add(aura);
      return group;
    }

    if (data.type === 'oil_slick') {
      // Genangan Oli Murni Warna Hitam Pekat (Jet Black Wet Oil Puddle)
      const slickGeo = new THREE.CircleGeometry(2.5, 32);
      slickGeo.rotateX(-Math.PI / 2);
      const slickMat = new THREE.MeshStandardMaterial({
        color: 0x050505, // Hitam pekat murni
        roughness: 0.08,
        metalness: 0.92,
      });
      const slick = new THREE.Mesh(slickGeo, slickMat);
      slick.position.y = 0.05;
      group.add(slick);

      // Cincin basah tipis di tepian aspal
      const rimGeo = new THREE.RingGeometry(2.4, 2.58, 32);
      rimGeo.rotateX(-Math.PI / 2);
      const rimMat = new THREE.MeshBasicMaterial({
        color: 0x1e293b,
        transparent: true,
        opacity: 0.65,
        side: THREE.DoubleSide,
      });
      const rim = new THREE.Mesh(rimGeo, rimMat);
      rim.position.y = 0.055;
      group.add(rim);

      return group;
    }

    if (data.type === 'barrier') {
      const barGeo = new THREE.BoxGeometry(3.6, 1.0, 0.6);
      const barMat = new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.5 });
      const bar = new THREE.Mesh(barGeo, barMat);
      bar.position.y = 0.5;
      group.add(bar);

      // Hazard stripe warning signs
      const stripeGeo = new THREE.BoxGeometry(3.65, 0.3, 0.65);
      const stripeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const stripe = new THREE.Mesh(stripeGeo, stripeMat);
      stripe.position.y = 0.5;
      group.add(stripe);

      // Warning amber lights on edges
      const amberLightGeo = new THREE.SphereGeometry(0.18, 8, 8);
      const amberMat = new THREE.MeshBasicMaterial({ color: 0xfbbf24 });
      const l1 = new THREE.Mesh(amberLightGeo, amberMat);
      l1.position.set(-1.6, 1.1, 0);
      const l2 = new THREE.Mesh(amberLightGeo, amberMat);
      l2.position.set(1.6, 1.1, 0);
      group.add(l1, l2);

      return group;
    }

    if (data.type === 'traffic_truck') {
      // Semi-truck tractor + long trailer
      const cabGeo = new THREE.BoxGeometry(2.4, 2.8, 3.2);
      const cabMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.4 });
      const cab = new THREE.Mesh(cabGeo, cabMat);
      cab.position.set(0, 1.6, 4.0);
      group.add(cab);

      const trailerGeo = new THREE.BoxGeometry(2.5, 3.2, 8.5);
      const trailerMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.3, metalness: 0.4 });
      const trailer = new THREE.Mesh(trailerGeo, trailerMat);
      trailer.position.set(0, 2.0, -1.8);
      group.add(trailer);

      // Red tail markers
      const tailGeo = new THREE.BoxGeometry(2.2, 0.2, 0.1);
      const tailMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
      const tail = new THREE.Mesh(tailGeo, tailMat);
      tail.position.set(0, 1.0, -6.1);
      group.add(tail);

      return group;
    }

    // Default: Traffic civilian sedan
    const carColor = data.color || '#3b82f6';
    const bodyGeo = new THREE.BoxGeometry(2.0, 0.8, 4.0);
    const bodyMat = new THREE.MeshStandardMaterial({ color: carColor, roughness: 0.3, metalness: 0.5 });
    const carBody = new THREE.Mesh(bodyGeo, bodyMat);
    carBody.position.y = 0.6;
    group.add(carBody);

    const roofGeo = new THREE.BoxGeometry(1.6, 0.6, 2.0);
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.1, metalness: 0.8 });
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.position.set(0, 1.25, -0.2);
    group.add(roof);

    // Taillights for traffic
    const tailGeo = new THREE.BoxGeometry(1.6, 0.15, 0.1);
    const tailMat = new THREE.MeshBasicMaterial({ color: 0xff0033 });
    const tail = new THREE.Mesh(tailGeo, tailMat);
    tail.position.set(0, 0.65, -2.05);
    group.add(tail);

    return group;
  }
}
