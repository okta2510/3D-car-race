import * as THREE from 'three';

interface SparkParticle {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
  size: number;
  color: THREE.Color;
}

interface DebrisChunk {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  rotVelocity: THREE.Vector3;
  life: number;
  maxLife: number;
  isBounced: boolean;
}

interface ShockwaveRing {
  mesh: THREE.Mesh;
  life: number;
  maxLife: number;
  startScale: number;
  endScale: number;
}

interface SmokePuff {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
  baseScale: number;
}

export class ParticleManager {
  public group: THREE.Group;

  // Sparks System (using Points for high-performance rendering)
  private maxSparks: number = 400;
  private sparks: SparkParticle[] = [];
  private sparkPoints: THREE.Points;
  private sparkGeo: THREE.BufferGeometry;
  private sparkPositions: Float32Array;
  private sparkColors: Float32Array;
  private sparkSizes: Float32Array;

  // Physical 3D Debris Chunks
  private debrisList: DebrisChunk[] = [];
  private debrisGeometries: THREE.BufferGeometry[] = [];
  private debrisMaterials: Record<string, THREE.Material> = {};

  // Expanding Impact Shockwaves
  private shockwaves: ShockwaveRing[] = [];
  private shockwaveGeo: THREE.RingGeometry;

  // Impact Flash Point Light
  private flashLight: THREE.PointLight;
  private flashTimer: number = 0;

  // Smoke Puffs
  private smokeList: SmokePuff[] = [];
  private smokeGeo: THREE.SphereGeometry;
  private smokeMat: THREE.MeshBasicMaterial;

  constructor() {
    this.group = new THREE.Group();

    // 1. Initialize Sparks Point System
    this.sparkPositions = new Float32Array(this.maxSparks * 3);
    this.sparkColors = new Float32Array(this.maxSparks * 3);
    this.sparkSizes = new Float32Array(this.maxSparks);

    this.sparkGeo = new THREE.BufferGeometry();
    this.sparkGeo.setAttribute('position', new THREE.BufferAttribute(this.sparkPositions, 3));
    this.sparkGeo.setAttribute('color', new THREE.BufferAttribute(this.sparkColors, 3));
    this.sparkGeo.setAttribute('size', new THREE.BufferAttribute(this.sparkSizes, 1));

    // Custom shader or particle canvas texture for crisp incandescent glowing sparks
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
      grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
      grad.addColorStop(0.3, 'rgba(255, 220, 120, 0.9)');
      grad.addColorStop(0.7, 'rgba(255, 120, 30, 0.4)');
      grad.addColorStop(1, 'rgba(255, 60, 0, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 32, 32);
    }
    const sparkTex = new THREE.CanvasTexture(canvas);

    const sparkMat = new THREE.PointsMaterial({
      size: 0.55,
      map: sparkTex,
      vertexColors: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.sparkPoints = new THREE.Points(this.sparkGeo, sparkMat);
    this.group.add(this.sparkPoints);

    // 2. Pre-generate Debris Geometries & Materials
    this.debrisGeometries.push(
      new THREE.BoxGeometry(0.35, 0.08, 0.25),
      new THREE.BoxGeometry(0.2, 0.2, 0.2),
      new THREE.TetrahedronGeometry(0.22),
      new THREE.CylinderGeometry(0.06, 0.09, 0.35, 5)
    );

    this.debrisMaterials = {
      metalCar: new THREE.MeshStandardMaterial({ color: 0xef4444, metalness: 0.8, roughness: 0.3 }),
      carbonFiber: new THREE.MeshStandardMaterial({ color: 0x18181b, metalness: 0.9, roughness: 0.4 }),
      chromeSilver: new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.95, roughness: 0.1 }),
      hazardOrange: new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.6 }),
      concreteChunk: new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.9 }),
      glassShard: new THREE.MeshPhysicalMaterial({ color: 0xbae6fd, transmission: 0.9, opacity: 0.85, transparent: true }),
    };

    // 3. Shockwave Ring Setup
    this.shockwaveGeo = new THREE.RingGeometry(0.4, 0.9, 32);
    this.shockwaveGeo.rotateX(-Math.PI / 2);

    // 4. Impact Flash Light Setup
    this.flashLight = new THREE.PointLight(0xffedd5, 0, 25, 1.2);
    this.group.add(this.flashLight);

    // 5. Smoke Puff Setup
    this.smokeGeo = new THREE.SphereGeometry(0.45, 8, 8);
    this.smokeMat = new THREE.MeshBasicMaterial({
      color: 0xcbd5e1,
      transparent: true,
      opacity: 0.4,
      depthWrite: false,
    });
  }

  /**
   * Spawns complete cinematic impact particle effect (Sparks + 3D Debris + Flash + Shockwave)
   */
  public spawnCollisionEffect(
    impactPoint: THREE.Vector3,
    options: {
      obstacleType?: string;
      severity?: number;
      carSpeed?: number;
    } = {}
  ) {
    const isHeavy = options.obstacleType === 'traffic_truck';
    const isBarrier = options.obstacleType === 'barrier';
    const numSparks = isHeavy ? 65 : 45;
    const numDebris = isHeavy ? 24 : isBarrier ? 18 : 15;

    // Trigger Impact Flash Light
    this.flashLight.position.copy(impactPoint);
    this.flashLight.position.y += 0.8;
    this.flashLight.color.setHex(isBarrier ? 0xffaa44 : 0xffffff);
    this.flashLight.intensity = isHeavy ? 16.0 : 12.0;
    this.flashTimer = 0.12;

    // 1. Spawn Sparks Spray
    const sparkBaseColors = [
      new THREE.Color(0xffffff), // Incandescent pure white
      new THREE.Color(0xfef08a), // Hot electric yellow
      new THREE.Color(0xfb923c), // Intense orange spark
      new THREE.Color(0xf87171), // Fiery red ember
    ];

    for (let i = 0; i < numSparks; i++) {
      if (this.sparks.length >= this.maxSparks) {
        this.sparks.shift(); // Evict oldest
      }

      // Conical / hemisphere explosive spray
      const angle = Math.random() * Math.PI * 2;
      const elevation = (Math.random() - 0.2) * Math.PI * 0.45;
      const speed = 14 + Math.random() * 26 + (options.carSpeed || 0) * 0.2;

      const vel = new THREE.Vector3(
        Math.cos(angle) * Math.cos(elevation) * speed,
        Math.sin(elevation) * speed + 5,
        Math.sin(angle) * Math.cos(elevation) * speed * 0.7 + 6
      );

      const color = sparkBaseColors[Math.floor(Math.random() * sparkBaseColors.length)].clone();

      this.sparks.push({
        position: impactPoint.clone().add(new THREE.Vector3(
          (Math.random() - 0.5) * 0.6,
          (Math.random() - 0.5) * 0.4 + 0.3,
          (Math.random() - 0.5) * 0.6
        )),
        velocity: vel,
        life: 0.35 + Math.random() * 0.55,
        maxLife: 0.35 + Math.random() * 0.55,
        size: 0.35 + Math.random() * 0.4,
        color,
      });
    }

    // 2. Spawn 3D Physical Tumbling Debris
    const matKeys = isBarrier
      ? ['hazardOrange', 'concreteChunk', 'metalCar']
      : isHeavy
      ? ['carbonFiber', 'metalCar', 'chromeSilver', 'glassShard']
      : ['metalCar', 'carbonFiber', 'glassShard', 'chromeSilver'];

    for (let i = 0; i < numDebris; i++) {
      const geo = this.debrisGeometries[Math.floor(Math.random() * this.debrisGeometries.length)];
      const matKey = matKeys[Math.floor(Math.random() * matKeys.length)];
      const mat = this.debrisMaterials[matKey];

      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(impactPoint);
      mesh.position.x += (Math.random() - 0.5) * 1.0;
      mesh.position.y += Math.random() * 0.8 + 0.2;
      mesh.position.z += (Math.random() - 0.5) * 1.0;
      mesh.castShadow = true;

      // Random initial orientation
      mesh.rotation.set(
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2
      );

      const scale = 0.6 + Math.random() * 0.8;
      mesh.scale.set(scale, scale, scale);

      // Explosive outward tumble velocity
      const angle = Math.random() * Math.PI * 2;
      const ejectSpeed = 9 + Math.random() * 18;
      const vel = new THREE.Vector3(
        Math.cos(angle) * ejectSpeed,
        6 + Math.random() * 12,
        Math.sin(angle) * ejectSpeed + 8
      );

      const rotVel = new THREE.Vector3(
        (Math.random() - 0.5) * 20,
        (Math.random() - 0.5) * 20,
        (Math.random() - 0.5) * 20
      );

      this.group.add(mesh);

      this.debrisList.push({
        mesh,
        velocity: vel,
        rotVelocity: rotVel,
        life: 1.8 + Math.random() * 1.0,
        maxLife: 1.8 + Math.random() * 1.0,
        isBounced: false,
      });
    }

    // 3. Spawn Expanding Shockwave Ring
    const shockMat = new THREE.MeshBasicMaterial({
      color: isBarrier ? 0xf97316 : 0x38bdf8,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    const shockMesh = new THREE.Mesh(this.shockwaveGeo, shockMat);
    shockMesh.position.set(impactPoint.x, 0.08, impactPoint.z);
    this.group.add(shockMesh);

    this.shockwaves.push({
      mesh: shockMesh,
      life: 0.35,
      maxLife: 0.35,
      startScale: 0.5,
      endScale: 4.8,
    });

    // 4. Spawn Smoke Clouds at impact site
    for (let i = 0; i < 4; i++) {
      const smokeMesh = new THREE.Mesh(this.smokeGeo, this.smokeMat.clone());
      smokeMesh.position.copy(impactPoint);
      smokeMesh.position.x += (Math.random() - 0.5) * 0.8;
      smokeMesh.position.y += Math.random() * 0.6 + 0.2;
      smokeMesh.position.z += (Math.random() - 0.5) * 0.8;

      const smokeVel = new THREE.Vector3(
        (Math.random() - 0.5) * 4,
        2 + Math.random() * 4,
        (Math.random() - 0.5) * 4 + 3
      );

      this.group.add(smokeMesh);
      this.smokeList.push({
        mesh: smokeMesh,
        velocity: smokeVel,
        life: 0.65 + Math.random() * 0.3,
        maxLife: 0.65 + Math.random() * 0.3,
        baseScale: 0.7 + Math.random() * 0.6,
      });
    }
  }

  /**
   * Spawns tire skid smoke and light friction sparks (e.g. during heavy drift or oil slick)
   */
  public spawnSkidSmoke(x: number, z: number) {
    if (this.smokeList.length > 25) return;

    [-0.8, 0.8].forEach((wheelOffset) => {
      const smokeMesh = new THREE.Mesh(this.smokeGeo, this.smokeMat.clone());
      smokeMesh.position.set(x + wheelOffset, 0.15, z - 1.2);
      this.group.add(smokeMesh);

      this.smokeList.push({
        mesh: smokeMesh,
        velocity: new THREE.Vector3((Math.random() - 0.5) * 1.5, 1.2, -1.0),
        life: 0.45,
        maxLife: 0.45,
        baseScale: 0.5,
      });
    });
  }

  public update(delta: number) {
    // 1. Update Flash Light
    if (this.flashTimer > 0) {
      this.flashTimer -= delta;
      if (this.flashTimer <= 0) {
        this.flashLight.intensity = 0;
      }
    }

    // 2. Update Sparks
    const gravity = -32;
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const spark = this.sparks[i];
      spark.life -= delta;

      if (spark.life <= 0) {
        this.sparks.splice(i, 1);
        continue;
      }

      // Physics & Drag
      spark.velocity.y += gravity * delta;
      spark.velocity.x *= 0.97;
      spark.velocity.z *= 0.97;
      spark.position.addScaledVector(spark.velocity, delta);

      // Bounce off road asphalt
      if (spark.position.y < 0.05) {
        spark.position.y = 0.05;
        spark.velocity.y = -spark.velocity.y * 0.45;
        spark.velocity.x *= 0.7;
        spark.velocity.z *= 0.7;
      }
    }

    // Update Spark Buffers
    let pIdx = 0;
    let cIdx = 0;
    let sIdx = 0;

    for (let i = 0; i < this.maxSparks; i++) {
      if (i < this.sparks.length) {
        const spark = this.sparks[i];
        const lifeRatio = spark.life / spark.maxLife;

        this.sparkPositions[pIdx++] = spark.position.x;
        this.sparkPositions[pIdx++] = spark.position.y;
        this.sparkPositions[pIdx++] = spark.position.z;

        this.sparkColors[cIdx++] = spark.color.r * lifeRatio;
        this.sparkColors[cIdx++] = spark.color.g * lifeRatio;
        this.sparkColors[cIdx++] = spark.color.b * lifeRatio;

        this.sparkSizes[sIdx++] = spark.size * lifeRatio;
      } else {
        // Inactive points placed far away
        this.sparkPositions[pIdx++] = 0;
        this.sparkPositions[pIdx++] = -100;
        this.sparkPositions[pIdx++] = 0;

        this.sparkColors[cIdx++] = 0;
        this.sparkColors[cIdx++] = 0;
        this.sparkColors[cIdx++] = 0;

        this.sparkSizes[sIdx++] = 0;
      }
    }

    this.sparkGeo.attributes.position.needsUpdate = true;
    this.sparkGeo.attributes.color.needsUpdate = true;
    this.sparkGeo.attributes.size.needsUpdate = true;

    // 3. Update 3D Physical Debris Chunks
    const debrisGravity = -24;
    for (let i = this.debrisList.length - 1; i >= 0; i--) {
      const debris = this.debrisList[i];
      debris.life -= delta;

      if (debris.life <= 0) {
        this.group.remove(debris.mesh);
        debris.mesh.geometry.dispose();
        this.debrisList.splice(i, 1);
        continue;
      }

      // Physics
      debris.velocity.y += debrisGravity * delta;
      debris.velocity.x *= 0.98;
      debris.velocity.z *= 0.98;
      debris.mesh.position.addScaledVector(debris.velocity, delta);

      // Rotational Tumble
      debris.mesh.rotation.x += debris.rotVelocity.x * delta;
      debris.mesh.rotation.y += debris.rotVelocity.y * delta;
      debris.mesh.rotation.z += debris.rotVelocity.z * delta;

      // Road Surface Bounce & Slide
      if (debris.mesh.position.y < 0.1) {
        debris.mesh.position.y = 0.1;
        debris.velocity.y = -debris.velocity.y * 0.4;
        debris.velocity.x *= 0.65;
        debris.velocity.z *= 0.65;
        debris.rotVelocity.multiplyScalar(0.7);
        debris.isBounced = true;
      }

      // Shrink/fade at end of life
      if (debris.life < 0.5) {
        const shrink = debris.life / 0.5;
        debris.mesh.scale.set(shrink, shrink, shrink);
      }
    }

    // 4. Update Shockwaves
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const shock = this.shockwaves[i];
      shock.life -= delta;

      if (shock.life <= 0) {
        this.group.remove(shock.mesh);
        this.shockwaves.splice(i, 1);
        continue;
      }

      const progress = 1 - shock.life / shock.maxLife;
      const currentScale = THREE.MathUtils.lerp(shock.startScale, shock.endScale, Math.sqrt(progress));
      shock.mesh.scale.set(currentScale, currentScale, 1);

      const mat = shock.mesh.material as THREE.MeshBasicMaterial;
      if (mat) {
        mat.opacity = (1 - progress) * 0.85;
      }
    }

    // 5. Update Smoke Puffs
    for (let i = this.smokeList.length - 1; i >= 0; i--) {
      const smoke = this.smokeList[i];
      smoke.life -= delta;

      if (smoke.life <= 0) {
        this.group.remove(smoke.mesh);
        this.smokeList.splice(i, 1);
        continue;
      }

      const progress = 1 - smoke.life / smoke.maxLife;
      smoke.mesh.position.addScaledVector(smoke.velocity, delta);
      const curScale = smoke.baseScale * (1 + progress * 2.2);
      smoke.mesh.scale.set(curScale, curScale, curScale);

      const mat = smoke.mesh.material as THREE.MeshBasicMaterial;
      if (mat) {
        mat.opacity = (1 - progress) * 0.45;
      }
    }
  }

  public reset() {
    this.sparks = [];
    this.debrisList.forEach((d) => this.group.remove(d.mesh));
    this.debrisList = [];
    this.shockwaves.forEach((s) => this.group.remove(s.mesh));
    this.shockwaves = [];
    this.smokeList.forEach((sm) => this.group.remove(sm.mesh));
    this.smokeList = [];
    this.flashLight.intensity = 0;
  }
}
