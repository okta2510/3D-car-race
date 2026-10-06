import * as THREE from 'three';

export interface CarOptions {
  color?: string;
  underglowColor?: string;
  modelName?: string;
  isPlayer?: boolean;
  playerName?: string;
}

export class Car3D {
  public group: THREE.Group;
  public wheels: THREE.Mesh[] = [];
  public nitroFlames: THREE.Mesh[] = [];
  public underglowLight: THREE.PointLight | null = null;
  public headLights: THREE.SpotLight[] = [];
  public headlightMeshes: THREE.Mesh[] = [];
  public headlightMat: THREE.MeshBasicMaterial;
  public headlightMode: 'high' | 'dim' = 'high';
  public bodyMesh: THREE.Mesh | null = null;
  public nameTag: THREE.Sprite | null = null;
  private nitroMaterial: THREE.MeshBasicMaterial;

  constructor(options: CarOptions = {}) {
    this.group = new THREE.Group();
    const carColor = options.color || '#ef4444';
    const underglowHex = options.underglowColor || '#06b6d4';

    this.nitroMaterial = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
    });

    this.headlightMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

    this.buildCar(carColor, underglowHex, options.modelName || 'Cyber GT');

    if (options.playerName) {
      this.createNameTag(options.playerName);
    }
  }

  private buildCar(bodyColorHex: string, underglowHex: string, modelName: string) {
    const isApex = modelName === 'Apex Phantom';
    const isHyperion = modelName === 'Hyperion Supercar';
    const isFormula = modelName === 'Velocity Formula';

    // Body Material
    const bodyMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(bodyColorHex),
      metalness: isFormula ? 0.95 : 0.85,
      roughness: isHyperion ? 0.15 : 0.2,
      clearcoat: 0.7,
      clearcoatRoughness: 0.1,
    } as any);

    const darkCarbonMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.7, metalness: 0.3 });

    if (isFormula) {
      // --- MODEL 4: VELOCITY FORMULA (Open Cockpit / Formula Style) ---
      // Narrow central monocoque
      const monoGeo = new THREE.BoxGeometry(1.4, 0.5, 4.4);
      this.bodyMesh = new THREE.Mesh(monoGeo, bodyMat);
      this.bodyMesh.position.y = 0.5;
      this.group.add(this.bodyMesh);

      // Long Needle Nose
      const needleGeo = new THREE.BoxGeometry(0.9, 0.28, 1.8);
      const needle = new THREE.Mesh(needleGeo, bodyMat);
      needle.position.set(0, 0.4, 2.6);
      needle.rotation.x = 0.05;
      this.group.add(needle);

      // Formula Front Wing
      const frontWingGeo = new THREE.BoxGeometry(2.3, 0.08, 0.8);
      const frontWing = new THREE.Mesh(frontWingGeo, darkCarbonMat);
      frontWing.position.set(0, 0.22, 3.1);
      this.group.add(frontWing);

      // Halo Bar / Cockpit Roll Hoop
      const haloGeo = new THREE.BoxGeometry(0.8, 0.45, 0.9);
      const haloMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.9 });
      const halo = new THREE.Mesh(haloGeo, haloMat);
      halo.position.set(0, 0.95, 0.1);
      this.group.add(halo);

      // High Mount Formula Rear Wing
      const fWingGeo = new THREE.BoxGeometry(2.1, 0.08, 0.7);
      const fWing = new THREE.Mesh(fWingGeo, darkCarbonMat);
      fWing.position.set(0, 1.5, -2.1);
      this.group.add(fWing);

      const fPylonGeo = new THREE.BoxGeometry(0.08, 0.65, 0.15);
      const fPylonL = new THREE.Mesh(fPylonGeo, darkCarbonMat);
      fPylonL.position.set(-0.45, 1.2, -2.1);
      const fPylonR = new THREE.Mesh(fPylonGeo, darkCarbonMat);
      fPylonR.position.set(0.45, 1.2, -2.1);
      this.group.add(fPylonL, fPylonR);
    } else if (isApex) {
      // --- MODEL 2: APEX PHANTOM (Widebody Supercar) ---
      const bodyGeo = new THREE.BoxGeometry(2.3, 0.6, 4.6);
      this.bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
      this.bodyMesh.position.y = 0.58;
      this.group.add(this.bodyMesh);

      // Aggressive Cockpit
      const cabinGeo = new THREE.BoxGeometry(1.65, 0.5, 2.2);
      const cabinMat = new THREE.MeshPhysicalMaterial({ color: 0x020617, metalness: 0.9, roughness: 0.1 });
      const cabin = new THREE.Mesh(cabinGeo, cabinMat);
      cabin.position.set(0, 1.05, -0.3);
      this.group.add(cabin);

      // Roof Air Induction Scoop
      const scoopGeo = new THREE.BoxGeometry(0.5, 0.2, 1.1);
      const scoop = new THREE.Mesh(scoopGeo, darkCarbonMat);
      scoop.position.set(0, 1.38, 0.2);
      this.group.add(scoop);

      // Wide Carbon GT Wing
      const wingGeo = new THREE.BoxGeometry(2.4, 0.08, 0.7);
      const wing = new THREE.Mesh(wingGeo, darkCarbonMat);
      wing.position.set(0, 1.4, -2.2);
      this.group.add(wing);

      // Wing endplates
      const endplateGeo = new THREE.BoxGeometry(0.06, 0.35, 0.7);
      const epL = new THREE.Mesh(endplateGeo, darkCarbonMat);
      epL.position.set(-1.2, 1.4, -2.2);
      const epR = new THREE.Mesh(endplateGeo, darkCarbonMat);
      epR.position.set(1.2, 1.4, -2.2);
      this.group.add(epL, epR);

      // Front splitter & bumper canards
      const splitter = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.1, 1.2), darkCarbonMat);
      splitter.position.set(0, 0.22, 2.3);
      this.group.add(splitter);
    } else if (isHyperion) {
      // --- MODEL 3: HYPERION SUPERCAR (Exotic Hypercar) ---
      const bodyGeo = new THREE.BoxGeometry(2.15, 0.62, 4.5);
      this.bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
      this.bodyMesh.position.y = 0.58;
      this.group.add(this.bodyMesh);

      // Smooth bubble canopy
      const cabinGeo = new THREE.BoxGeometry(1.6, 0.58, 2.4);
      const cabinMat = new THREE.MeshPhysicalMaterial({ color: 0x090d16, metalness: 0.95, roughness: 0.08 });
      const cabin = new THREE.Mesh(cabinGeo, cabinMat);
      cabin.position.set(0, 1.1, -0.15);
      this.group.add(cabin);

      // Central Dorsal Fin
      const finGeo = new THREE.BoxGeometry(0.06, 0.35, 1.8);
      const fin = new THREE.Mesh(finGeo, darkCarbonMat);
      fin.position.set(0, 1.25, -1.2);
      this.group.add(fin);

      // Low drag rear active spoiler
      const wingGeo = new THREE.BoxGeometry(2.0, 0.06, 0.5);
      const wing = new THREE.Mesh(wingGeo, darkCarbonMat);
      wing.position.set(0, 1.2, -2.15);
      this.group.add(wing);
    } else {
      // --- MODEL 1: CYBER GT (Balanced Starter Sports Coupe) ---
      const bodyGeo = new THREE.BoxGeometry(2.1, 0.65, 4.4);
      this.bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
      this.bodyMesh.position.y = 0.6;
      this.group.add(this.bodyMesh);

      const cabinGeo = new THREE.BoxGeometry(1.7, 0.55, 2.3);
      const cabinMat = new THREE.MeshPhysicalMaterial({ color: 0x0f172a, metalness: 0.9, roughness: 0.1 });
      const cabin = new THREE.Mesh(cabinGeo, cabinMat);
      cabin.position.set(0, 1.1, -0.2);
      this.group.add(cabin);

      const noseGeo = new THREE.BoxGeometry(1.9, 0.35, 1.2);
      const nose = new THREE.Mesh(noseGeo, bodyMat);
      nose.position.set(0, 0.5, 2.0);
      nose.rotation.x = 0.08;
      this.group.add(nose);

      const wing = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.08, 0.6), darkCarbonMat);
      wing.position.set(0, 1.35, -2.1);
      this.group.add(wing);
    }

    if (this.bodyMesh) {
      this.bodyMesh.castShadow = true;
      this.bodyMesh.receiveShadow = true;
    }

    // --- HEADLIGHTS (Support High Beam / Dim mode) ---
    const hlGeo = new THREE.BoxGeometry(0.4, 0.14, 0.1);
    const hlLeft = new THREE.Mesh(hlGeo, this.headlightMat);
    hlLeft.position.set(-0.75, 0.65, isFormula ? 3.0 : 2.2);
    const hlRight = new THREE.Mesh(hlGeo, this.headlightMat);
    hlRight.position.set(0.75, 0.65, isFormula ? 3.0 : 2.2);
    this.group.add(hlLeft, hlRight);
    this.headlightMeshes.push(hlLeft, hlRight);

    // Left SpotLight Projection Beam - bright illumination ahead
    const spotLeft = new THREE.SpotLight(0xffffff, 10, 55, Math.PI / 5, 0.4, 1);
    spotLeft.position.set(-0.75, 0.7, isFormula ? 3.0 : 2.2);
    spotLeft.target.position.set(-0.75, 0, 25);
    this.group.add(spotLeft, spotLeft.target);
    this.headLights.push(spotLeft);

    // Right SpotLight Projection Beam
    const spotRight = new THREE.SpotLight(0xffffff, 10, 55, Math.PI / 5, 0.4, 1);
    spotRight.position.set(0.75, 0.7, isFormula ? 3.0 : 2.2);
    spotRight.target.position.set(0.75, 0, 25);
    this.group.add(spotRight, spotRight.target);
    this.headLights.push(spotRight);

    // --- REAR TAILLIGHTS ---
    const tailMat = new THREE.MeshBasicMaterial({ color: 0xff1133 });
    const tailBar = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.12, 0.1), tailMat);
    tailBar.position.set(0, 0.65, -2.2);
    this.group.add(tailBar);

    // --- WHEELS ---
    const wheelRadius = isFormula ? 0.42 : 0.38;
    const wheelWidth = isFormula ? 0.36 : 0.28;
    const wheelGeo = new THREE.CylinderGeometry(wheelRadius, wheelRadius, wheelWidth, 16);
    wheelGeo.rotateZ(Math.PI / 2);

    const tireMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.9 });
    const rimMat = new THREE.MeshStandardMaterial({ color: 0xd1d5db, metalness: 0.9, roughness: 0.2 });

    const wheelTrackX = isFormula ? 1.25 : 1.08;
    const wheelPositions = [
      [-wheelTrackX, 0.38, 1.4],
      [wheelTrackX, 0.38, 1.4],
      [-wheelTrackX, 0.38, -1.4],
      [wheelTrackX, 0.38, -1.4],
    ];

    wheelPositions.forEach(([x, y, z]) => {
      const wheelHub = new THREE.Group();
      wheelHub.position.set(x, y, z);

      const tire = new THREE.Mesh(wheelGeo, tireMat);
      tire.castShadow = true;
      wheelHub.add(tire);

      const rim = new THREE.Mesh(
        new THREE.CylinderGeometry(wheelRadius * 0.65, wheelRadius * 0.65, wheelWidth + 0.02, 8),
        rimMat
      );
      rim.rotateZ(Math.PI / 2);
      wheelHub.add(rim);

      this.wheels.push(tire);
      this.group.add(wheelHub);
    });

    // --- DUAL OR QUAD EXHAUST WITH NITRO FLAMES ---
    const exhaustMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.9 });
    const exhaustGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.4, 8);
    exhaustGeo.rotateX(Math.PI / 2);

    const flameGeo = new THREE.ConeGeometry(0.16, 1.4, 8);
    flameGeo.rotateX(-Math.PI / 2);

    const exhaustOffsets = isHyperion ? [-0.65, -0.35, 0.35, 0.65] : [-0.5, 0.5];
    exhaustOffsets.forEach((x) => {
      const pipe = new THREE.Mesh(exhaustGeo, exhaustMat);
      pipe.position.set(x, 0.35, -2.25);
      this.group.add(pipe);

      const flame = new THREE.Mesh(flameGeo, this.nitroMaterial);
      flame.position.set(x, 0.35, -3.0);
      this.group.add(flame);
      this.nitroFlames.push(flame);
    });

    // --- UNDERGLOW NEON ---
    this.underglowLight = new THREE.PointLight(new THREE.Color(underglowHex), 3, 4, 1.5);
    this.underglowLight.position.set(0, 0.15, 0);
    this.group.add(this.underglowLight);

    const underglowPlaneMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(underglowHex),
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
    });
    const underglowPlane = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 3.6), underglowPlaneMat);
    underglowPlane.rotation.x = -Math.PI / 2;
    underglowPlane.position.y = 0.06;
    this.group.add(underglowPlane);
  }

  public setHeadlightMode(mode: 'high' | 'dim') {
    this.headlightMode = mode;
    const isHigh = mode === 'high';

    this.headLights.forEach((spot) => {
      spot.intensity = isHigh ? 10 : 3.5;
      spot.distance = isHigh ? 55 : 28;
      spot.angle = isHigh ? Math.PI / 5 : Math.PI / 7;
    });

    if (this.headlightMat) {
      this.headlightMat.color.setHex(isHigh ? 0xffffff : 0x94a3b8);
    }
  }

  public toggleHeadlights(): 'high' | 'dim' {
    const nextMode = this.headlightMode === 'high' ? 'dim' : 'high';
    this.setHeadlightMode(nextMode);
    return nextMode;
  }

  public createNameTag(name: string) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.roundRect ? ctx.roundRect(10, 8, 236, 48, 12) : ctx.rect(10, 8, 236, 48);
    ctx.fill();

    ctx.strokeStyle = '#06b6d4';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(name.slice(0, 14), 128, 32);

    const texture = new THREE.CanvasTexture(canvas);
    const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true });
    this.nameTag = new THREE.Sprite(spriteMat);
    this.nameTag.position.set(0, 2.3, 0);
    this.nameTag.scale.set(3.2, 0.8, 1);
    this.group.add(this.nameTag);
  }

  public setColor(hex: string) {
    if (this.bodyMesh && this.bodyMesh.material) {
      (this.bodyMesh.material as THREE.MeshStandardMaterial).color.set(hex);
    }
  }

  public setNitro(active: boolean) {
    const targetOpacity = active ? 0.95 : 0;
    this.nitroMaterial.opacity = targetOpacity;
    this.nitroFlames.forEach((flame) => {
      if (active) {
        flame.scale.set(
          1 + Math.random() * 0.3,
          1 + Math.random() * 0.4,
          1.2 + Math.random() * 0.6
        );
      }
    });
  }

  private damageFlashTimer: number = 0;
  private flashStrobe: boolean = false;

  public flashDamage(duration: number = 0.8) {
    this.damageFlashTimer = duration;
  }

  public update(delta: number) {
    if (this.damageFlashTimer > 0) {
      this.damageFlashTimer -= delta;
      this.flashStrobe = Math.floor(this.damageFlashTimer * 14) % 2 === 0;
      if (this.bodyMesh && this.bodyMesh.material) {
        const mat = this.bodyMesh.material as THREE.MeshStandardMaterial;
        if (this.flashStrobe) {
          mat.emissive.setHex(0xff0022);
          mat.emissiveIntensity = 1.6;
        } else {
          mat.emissive.setHex(0xffffff);
          mat.emissiveIntensity = 1.0;
        }
      }
    } else if (this.bodyMesh && this.bodyMesh.material) {
      const mat = this.bodyMesh.material as THREE.MeshStandardMaterial;
      if (mat.emissiveIntensity !== 0) {
        mat.emissive.setHex(0x000000);
        mat.emissiveIntensity = 0;
      }
    }
  }

  public updateWheels(deltaRotation: number, steerAngle: number) {
    this.wheels.forEach((w, idx) => {
      w.rotation.x += deltaRotation;
      if (idx < 2) {
        w.rotation.y = steerAngle;
      }
    });
  }
}
