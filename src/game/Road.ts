import * as THREE from 'three';

export class RoadManager {
  public group: THREE.Group;
  public roadWidth: number = 22; // 5 lanes
  public chunkLength: number = 200;
  private numChunks: number = 6;
  private chunks: THREE.Group[] = [];
  private roadMaterials: THREE.MeshStandardMaterial[] = [];
  public currentZOffset: number = 0;

  constructor() {
    this.group = new THREE.Group();
    this.buildRoadNetwork();
  }

  private buildRoadNetwork() {
    for (let i = 0; i < this.numChunks; i++) {
      const chunk = this.createRoadChunk(i * this.chunkLength);
      this.chunks.push(chunk);
      this.group.add(chunk);
    }
  }

  private createRoadChunk(zPos: number): THREE.Group {
    const chunk = new THREE.Group();
    chunk.position.z = zPos;

    // Asphalt Main Deck - adapts to weather wetness
    const roadGeo = new THREE.PlaneGeometry(this.roadWidth, this.chunkLength);
    const roadMat = new THREE.MeshStandardMaterial({
      color: 0x222c42,
      roughness: 0.8,
      metalness: 0.15
    });
    this.roadMaterials.push(roadMat);
    const road = new THREE.Mesh(roadGeo, roadMat);
    road.rotation.x = -Math.PI / 2;
    road.receiveShadow = true;
    chunk.add(road);

    // Glowing Neon Lane Markings (4 divider lines for 5 lanes)
    const laneOffsets = [-6.6, -2.2, 2.2, 6.6];
    const dashLength = 6;
    const dashGap = 6;
    const numDashes = Math.floor(this.chunkLength / (dashLength + dashGap));

    const lineMat = new THREE.MeshBasicMaterial({
      color: 0x06b6d4,
      transparent: true,
      opacity: 0.85
    });
    const lineGeo = new THREE.PlaneGeometry(0.25, dashLength);

    laneOffsets.forEach(laneX => {
      for (let d = 0; d < numDashes; d++) {
        const dash = new THREE.Mesh(lineGeo, lineMat);
        dash.rotation.x = -Math.PI / 2;
        dash.position.set(laneX, 0.02, -this.chunkLength / 2 + d * (dashLength + dashGap) + dashLength / 2);
        chunk.add(dash);
      }
    });

    // Outer Shoulder Solid Glow Lines
    const shoulderGeo = new THREE.PlaneGeometry(0.4, this.chunkLength);
    const shoulderMat = new THREE.MeshBasicMaterial({ color: 0xf43f5e });
    const shoulderLeft = new THREE.Mesh(shoulderGeo, shoulderMat);
    shoulderLeft.rotation.x = -Math.PI / 2;
    shoulderLeft.position.set(-this.roadWidth / 2 + 0.3, 0.02, 0);

    const shoulderRight = new THREE.Mesh(shoulderGeo, shoulderMat);
    shoulderRight.rotation.x = -Math.PI / 2;
    shoulderRight.position.set(this.roadWidth / 2 - 0.3, 0.02, 0);

    chunk.add(shoulderLeft, shoulderRight);

    // Guard Rails (Metallic barriers along both sides)
    const railGeo = new THREE.BoxGeometry(0.5, 1.0, this.chunkLength);
    const railMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.7, roughness: 0.3 });

    const railLeft = new THREE.Mesh(railGeo, railMat);
    railLeft.position.set(-this.roadWidth / 2 - 0.25, 0.5, 0);
    const railRight = new THREE.Mesh(railGeo, railMat);
    railRight.position.set(this.roadWidth / 2 + 0.25, 0.5, 0);
    chunk.add(railLeft, railRight);

    // Street Lights along the highway
    const numLights = 5;
    const lightInterval = this.chunkLength / numLights;
    const poleGeo = new THREE.CylinderGeometry(0.12, 0.15, 6, 8);
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8 });
    const lampBulbGeo = new THREE.BoxGeometry(0.6, 0.2, 0.8);
    const bulbMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });

    for (let l = 0; l < numLights; l++) {
      const zLight = -this.chunkLength / 2 + l * lightInterval;

      // Left pole
      const poleLeft = new THREE.Mesh(poleGeo, poleMat);
      poleLeft.position.set(-this.roadWidth / 2 - 1.5, 3, zLight);
      chunk.add(poleLeft);

      const lampLeft = new THREE.Mesh(lampBulbGeo, bulbMat);
      lampLeft.position.set(-this.roadWidth / 2 - 0.8, 5.8, zLight);
      chunk.add(lampLeft);

      // Right pole
      const poleRight = new THREE.Mesh(poleGeo, poleMat);
      poleRight.position.set(this.roadWidth / 2 + 1.5, 3, zLight);
      chunk.add(poleRight);

      const lampRight = new THREE.Mesh(lampBulbGeo, bulbMat);
      lampRight.position.set(this.roadWidth / 2 + 0.8, 5.8, zLight);
      chunk.add(lampRight);

      // Street lamp downward illumination glow on the highway
      if (l % 2 === 0) {
        const glowGeo = new THREE.PlaneGeometry(12, 12);
        const glowMat = new THREE.MeshBasicMaterial({
          color: 0x38bdf8,
          transparent: true,
          opacity: 0.12,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        });
        const glow = new THREE.Mesh(glowGeo, glowMat);
        glow.rotation.x = -Math.PI / 2;
        glow.position.set(0, 0.03, zLight);
        chunk.add(glow);
      }
    }

    return chunk;
  }

  public update(playerZ: number) {
    // Check if chunks need to wrap around forward
    this.chunks.forEach(chunk => {
      // If chunk is too far behind player, shift it forward
      if (chunk.position.z < playerZ - this.chunkLength * 1.5) {
        chunk.position.z += this.numChunks * this.chunkLength;
      }
    });
  }

  public setWetness(wetness: number) {
    const roughness = THREE.MathUtils.lerp(0.8, 0.2, wetness);
    const metalness = THREE.MathUtils.lerp(0.15, 0.75, wetness);
    this.roadMaterials.forEach(m => {
      m.roughness = roughness;
      m.metalness = metalness;
    });
  }
}
