import * as THREE from 'three';
import {
  LIVERY_PALETTES,
  createPixelHullTexture,
  createPixelPadTexture,
  createPixelPanelBumpTexture,
  createRadialShadowTexture,
} from './textures';
import { HazardPolicy, PlumeType, RocketConfig } from './types';

export interface RocketMeshHandles {
  root: THREE.Group;
  bodyGroup: THREE.Group;
  plumeGroup: THREE.Group;
  plumeOuter: THREE.Mesh;
  plumeCore: THREE.Mesh;
  rcsLeftFlame: THREE.Mesh;
  rcsRightFlame: THREE.Mesh;
  contactShadow: THREE.Mesh;
  explodableParts: Array<{
    mesh: THREE.Object3D;
    basePos: THREE.Vector3;
    explodedOffset: THREE.Vector3;
  }>;
}

const PLUME_COLORS: Record<PlumeType, { outer: number; inner: number }> = {
  ion_cyan: { outer: 0x0ea5e9, inner: 0xe0f2fe },
  plasma_amber: { outer: 0xf59e0b, inner: 0xfef08a },
  hyper_magenta: { outer: 0xec4899, inner: 0xfce7f3 },
};

/**
 * Builds an 11-part hierarchical procedural Rocket model (`THREE.Group`) pivoted at bottom-center (y = 0).
 * Varies roughness by >= 0.25 across adjacent components (hull, glossy cockpit, metallic engine bell, matte interstage).
 */
export function buildCompositeRocket(
  config: RocketConfig,
  maxAnisotropy: number,
  isSoftwareGl: boolean,
): RocketMeshHandles {
  const root = new THREE.Group();
  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  const palette = LIVERY_PALETTES[config.livery];
  const hullTexture = createPixelHullTexture(config.livery, maxAnisotropy);
  const bumpTexture = createPixelPanelBumpTexture(maxAnisotropy);

  const hullMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: hullTexture,
    bumpMap: bumpTexture,
    bumpScale: 0.04,
    roughness: palette.roughness,
    metalness: palette.metalness,
  });

  const darkTrimMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(palette.secondaryHex),
    bumpMap: bumpTexture,
    bumpScale: 0.03,
    roughness: 0.76, // Matte structural collar (>= 0.25 contrast against hull & glass)
    metalness: 0.22,
  });

  const accentTrimMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(palette.trimHex),
    roughness: 0.28,
    metalness: 0.65,
  });

  const titaniumEngineMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.24,
    metalness: 0.88,
  });

  const cockpitGlassMat = new THREE.MeshPhysicalMaterial({
    color: 0x38bdf8,
    emissive: 0x0284c7,
    emissiveIntensity: 0.35,
    roughness: 0.08,
    metalness: 0.1,
    clearcoat: isSoftwareGl ? 0 : 1.0,
  });

  const explodableParts: RocketMeshHandles['explodableParts'] = [];
  const registerPart = (mesh: THREE.Object3D, ox: number, oy: number, oz: number) => {
    mesh.castShadow = !isSoftwareGl;
    mesh.receiveShadow = !isSoftwareGl;
    bodyGroup.add(mesh);
    explodableParts.push({
      mesh,
      basePos: mesh.position.clone(),
      explodedOffset: new THREE.Vector3(ox, oy, oz),
    });
  };

  // 1. Primary Silhouette: Sculpted Fuselage Tank (LatheGeometry)
  const lathePoints = [
    new THREE.Vector2(0.52, 0.75),
    new THREE.Vector2(0.72, 1.15),
    new THREE.Vector2(0.76, 2.35),
    new THREE.Vector2(0.72, 3.45),
    new THREE.Vector2(0.58, 3.85),
  ];
  const fuselageGeo = new THREE.LatheGeometry(lathePoints, 16);
  const fuselageMesh = new THREE.Mesh(fuselageGeo, hullMat);
  registerPart(fuselageMesh, 0, 0, 0);

  // 2. Secondary Read: Upper Interstage Avionics Collar
  const interstageGeo = new THREE.CylinderGeometry(0.62, 0.66, 0.42, 16);
  const interstageMesh = new THREE.Mesh(interstageGeo, darkTrimMat);
  interstageMesh.position.set(0, 3.88, 0);
  registerPart(interstageMesh, 0, 0.65, 0);

  // 3. Modular Nose Cone Assembly (3 user-selectable silhouettes)
  const noseGroup = new THREE.Group();
  noseGroup.position.set(0, 4.1, 0);
  if (config.noseCone === 'aerospike') {
    const coneGeo = new THREE.ConeGeometry(0.62, 1.45, 16);
    coneGeo.translate(0, 0.72, 0);
    const cone = new THREE.Mesh(coneGeo, accentTrimMat);
    const spikeGeo = new THREE.CylinderGeometry(0.03, 0.08, 0.75, 8);
    spikeGeo.translate(0, 1.68, 0);
    const spike = new THREE.Mesh(spikeGeo, titaniumEngineMat);
    const tipRingGeo = new THREE.TorusGeometry(0.11, 0.03, 8, 12);
    tipRingGeo.rotateX(Math.PI / 2);
    tipRingGeo.translate(0, 1.55, 0);
    const tipRing = new THREE.Mesh(tipRingGeo, accentTrimMat);
    noseGroup.add(cone, spike, tipRing);
  } else if (config.noseCone === 'capsule') {
    const capPoints = [
      new THREE.Vector2(0.62, 0),
      new THREE.Vector2(0.66, 0.35),
      new THREE.Vector2(0.46, 0.95),
      new THREE.Vector2(0.22, 1.25),
      new THREE.Vector2(0.01, 1.32),
    ];
    const capGeo = new THREE.LatheGeometry(capPoints, 16);
    const capMesh = new THREE.Mesh(capGeo, hullMat);
    const towerGeo = new THREE.CylinderGeometry(0.06, 0.16, 0.55, 8);
    towerGeo.translate(0, 1.52, 0);
    const towerMesh = new THREE.Mesh(towerGeo, accentTrimMat);
    noseGroup.add(capMesh, towerMesh);
  } else {
    // Voxel Command stepped retro blocks
    const tier1 = new THREE.Mesh(new THREE.BoxGeometry(1.06, 0.45, 1.06), accentTrimMat);
    tier1.position.y = 0.22;
    const tier2 = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.45, 0.78), hullMat);
    tier2.position.y = 0.67;
    const tier3 = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.42, 0.46), darkTrimMat);
    tier3.position.y = 1.1;
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.18, 0.12), cockpitGlassMat);
    visor.position.set(0, 0.68, 0.4);
    noseGroup.add(tier1, tier2, tier3, visor);
  }
  registerPart(noseGroup, 0, 1.45, 0);

  // 4. Accent Detail: Pressurized Cockpit Porthole & Bezel Frame
  const portholeGroup = new THREE.Group();
  portholeGroup.position.set(0, 2.85, 0.72);
  const bezelGeo = new THREE.TorusGeometry(0.28, 0.06, 10, 16);
  const bezelMesh = new THREE.Mesh(bezelGeo, titaniumEngineMat);
  const windowGeo = new THREE.SphereGeometry(0.25, 14, 14);
  windowGeo.scale(1, 1, 0.45);
  const windowMesh = new THREE.Mesh(windowGeo, cockpitGlassMat);
  portholeGroup.add(bezelMesh, windowMesh);
  registerPart(portholeGroup, 0, 0.2, 0.85);

  // 5. Accent Detail: SpaceNet Dorsal Spine Conduit (TubeGeometry / Box)
  const spineGeo = new THREE.BoxGeometry(0.16, 2.3, 0.18);
  const spineMesh = new THREE.Mesh(spineGeo, accentTrimMat);
  spineMesh.position.set(0, 2.25, -0.74);
  registerPart(spineMesh, 0, 0, -0.8);

  // 6. Secondary Read: 4x Modular Fin / Booster Assemblies (ExtrudeGeometry with bevels)
  const finShape = new THREE.Shape();
  if (config.fins === 'delta_swept') {
    finShape.moveTo(0, 0);
    finShape.lineTo(0.95, -0.55);
    finShape.lineTo(0.95, -1.15);
    finShape.lineTo(0, -0.85);
    finShape.closePath();
  } else if (config.fins === 'grid_fins') {
    finShape.moveTo(0, 0);
    finShape.lineTo(0.82, 0.1);
    finShape.lineTo(0.82, -0.55);
    finShape.lineTo(0, -0.55);
    finShape.closePath();
  } else {
    finShape.moveTo(0, 0);
    finShape.lineTo(0.65, -0.2);
    finShape.lineTo(0.65, -1.0);
    finShape.lineTo(0, -0.9);
    finShape.closePath();
  }

  const finExtrudeGeo = new THREE.ExtrudeGeometry(finShape, {
    depth: 0.08,
    bevelEnabled: true,
    bevelThickness: 0.02,
    bevelSize: 0.02,
    bevelSegments: 2,
  });
  finExtrudeGeo.translate(0, 0, -0.04);

  for (let i = 0; i < 4; i++) {
    const angle = (i * Math.PI) / 2 + Math.PI / 4;
    const finGroup = new THREE.Group();
    const finY = config.fins === 'grid_fins' ? 3.55 : 1.75;
    finGroup.position.set(Math.cos(angle) * 0.66, finY, Math.sin(angle) * 0.66);
    finGroup.rotation.y = -angle;

    const finMesh = new THREE.Mesh(finExtrudeGeo, i % 2 === 0 ? accentTrimMat : darkTrimMat);
    finGroup.add(finMesh);

    if (config.fins === 'twin_boosters' && (i === 0 || i === 2)) {
      const podGeo = new THREE.CylinderGeometry(0.24, 0.28, 1.85, 12);
      const podMesh = new THREE.Mesh(podGeo, hullMat);
      podMesh.position.set(0.52, -0.45, 0);
      const podCone = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.45, 12), accentTrimMat);
      podCone.position.set(0.52, 0.7, 0);
      finGroup.add(podMesh, podCone);
    }

    registerPart(finGroup, Math.cos(angle) * 1.1, 0, Math.sin(angle) * 1.1);
  }

  // 7. Gimbaled Parabolic Main Engine Bell (LatheGeometry)
  const nozzlePoints = [
    new THREE.Vector2(0.28, 0.78),
    new THREE.Vector2(0.36, 0.55),
    new THREE.Vector2(0.48, 0.25),
    new THREE.Vector2(0.54, 0.08),
  ];
  const nozzleGeo = new THREE.LatheGeometry(nozzlePoints, 16);
  const nozzleMesh = new THREE.Mesh(nozzleGeo, titaniumEngineMat);
  registerPart(nozzleMesh, 0, -0.75, 0);

  // 8. 4x Landing Gear Struts & Pixel Footpads (flush at y = 0)
  for (let i = 0; i < 4; i++) {
    const angle = (i * Math.PI) / 2;
    const legGroup = new THREE.Group();
    const strutGeo = new THREE.BoxGeometry(0.1, 0.92, 0.1);
    const strut = new THREE.Mesh(strutGeo, titaniumEngineMat);
    strut.position.set(Math.cos(angle) * 0.78, 0.42, Math.sin(angle) * 0.78);
    strut.rotation.z = -Math.cos(angle) * 0.36;
    strut.rotation.x = Math.sin(angle) * 0.36;

    const padGeo = new THREE.BoxGeometry(0.34, 0.08, 0.34);
    const footpad = new THREE.Mesh(padGeo, darkTrimMat);
    footpad.position.set(Math.cos(angle) * 0.96, 0.04, Math.sin(angle) * 0.96);

    legGroup.add(strut, footpad);
    registerPart(legGroup, Math.cos(angle) * 0.65, -0.45, Math.sin(angle) * 0.65);
  }

  // 9. Quad Vernier RCS Thruster Pods + Side Flame Cones
  const rcsMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.9 });
  const rcsLeftGeo = new THREE.ConeGeometry(0.14, 0.65, 8);
  rcsLeftGeo.rotateZ(-Math.PI / 2);
  const rcsLeftFlame = new THREE.Mesh(rcsLeftGeo, rcsMat);
  rcsLeftFlame.position.set(0.95, 3.85, 0);
  rcsLeftFlame.visible = false;
  bodyGroup.add(rcsLeftFlame);

  const rcsRightGeo = new THREE.ConeGeometry(0.14, 0.65, 8);
  rcsRightGeo.rotateZ(Math.PI / 2);
  const rcsRightFlame = new THREE.Mesh(rcsRightGeo, rcsMat);
  rcsRightFlame.position.set(-0.95, 3.85, 0);
  rcsRightFlame.visible = false;
  bodyGroup.add(rcsRightFlame);

  // 10. Volumetric Retro-Pixel Main Thruster Plume
  const plumeColors = PLUME_COLORS[config.plume];
  const plumeGroup = new THREE.Group();
  plumeGroup.position.set(0, 0.08, 0);

  const outerPlumeGeo = new THREE.ConeGeometry(0.46, 2.2, 10);
  outerPlumeGeo.rotateX(Math.PI);
  outerPlumeGeo.translate(0, -1.1, 0);
  const outerPlumeMat = new THREE.MeshBasicMaterial({
    color: plumeColors.outer,
    transparent: true,
    opacity: 0.85,
  });
  const plumeOuter = new THREE.Mesh(outerPlumeGeo, outerPlumeMat);

  const innerPlumeGeo = new THREE.ConeGeometry(0.25, 1.35, 8);
  innerPlumeGeo.rotateX(Math.PI);
  innerPlumeGeo.translate(0, -0.68, 0);
  const innerPlumeMat = new THREE.MeshBasicMaterial({
    color: plumeColors.inner,
  });
  const plumeCore = new THREE.Mesh(innerPlumeGeo, innerPlumeMat);

  plumeGroup.add(plumeOuter, plumeCore);
  plumeGroup.scale.set(1, 0.01, 1);
  plumeGroup.visible = false;
  bodyGroup.add(plumeGroup);

  // 11. Ground Contact Shadow Disc (y = 0.02 to prevent Z-fighting)
  const shadowGeo = new THREE.CircleGeometry(1.75, 24);
  shadowGeo.rotateX(-Math.PI / 2);
  const shadowMat = new THREE.MeshBasicMaterial({
    map: createRadialShadowTexture(),
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
  });
  const contactShadow = new THREE.Mesh(shadowGeo, shadowMat);
  contactShadow.position.set(0, 0.02, 0);
  root.add(contactShadow);

  return {
    root,
    bodyGroup,
    plumeGroup,
    plumeOuter,
    plumeCore,
    rcsLeftFlame,
    rcsRightFlame,
    contactShadow,
    explodableParts,
  };
}

/**
 * Builds the 7-part SpaceNet Launch Complex & Gantry Tower (`THREE.Group`) at (x, y).
 */
export function buildLaunchComplexGroup(
  width: number,
  maxAnisotropy: number,
  isSoftwareGl: boolean,
  isOriginPad: boolean,
): THREE.Group {
  const group = new THREE.Group();
  const padTex = createPixelPadTexture(maxAnisotropy);

  const deckMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: padTex,
    roughness: 0.65,
    metalness: 0.25,
  });
  const steelMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.42,
    metalness: 0.72,
  });
  const cyanMat = new THREE.MeshStandardMaterial({
    color: 0x1488b8,
    emissive: 0x0ea5e9,
    emissiveIntensity: 0.35,
    roughness: 0.25,
    metalness: 0.5,
  });

  // 1. Primary Blast Deck Platform (top flush at y = 0)
  const deckGeo = new THREE.BoxGeometry(width, 0.9, 6.2);
  const deckMesh = new THREE.Mesh(deckGeo, deckMat);
  deckMesh.position.set(0, -0.45, 0);
  deckMesh.receiveShadow = !isSoftwareGl;
  group.add(deckMesh);

  // 2. Underside Tapered Support Trusses
  const supportGeo = new THREE.CylinderGeometry(width * 0.42, width * 0.22, 1.8, 8);
  const supportMesh = new THREE.Mesh(supportGeo, steelMat);
  supportMesh.position.set(0, -1.8, 0);
  group.add(supportMesh);

  // 3. 4x Corner Safety Beacons
  const beaconGeo = new THREE.BoxGeometry(0.32, 0.45, 0.32);
  const halfW = width * 0.46;
  [
    [-halfW, 0.22, 2.6],
    [halfW, 0.22, 2.6],
    [-halfW, 0.22, -2.6],
    [halfW, 0.22, -2.6],
  ].forEach(([bx, by, bz]) => {
    const b = new THREE.Mesh(beaconGeo, cyanMat);
    b.position.set(bx, by, bz);
    group.add(b);
  });

  if (isOriginPad) {
    // 4. Tall Gantry Umbilical Tower on the left flank (Spawn Landmark Vista)
    const towerGeo = new THREE.BoxGeometry(1.4, 8.8, 1.4);
    const towerMesh = new THREE.Mesh(towerGeo, steelMat);
    towerMesh.position.set(-width * 0.42, 4.4, -1.8);
    towerMesh.castShadow = !isSoftwareGl;
    group.add(towerMesh);

    // 5. Gantry Crane Arm & Umbilical Clamp
    const armGeo = new THREE.BoxGeometry(3.4, 0.45, 0.65);
    const armMesh = new THREE.Mesh(armGeo, cyanMat);
    armMesh.position.set(-width * 0.42 + 1.5, 4.2, -1.8);
    group.add(armMesh);

    // 6. Rotating SpaceNet Dish on top of Gantry
    const dishGeo = new THREE.ConeGeometry(0.95, 0.5, 12, 1, true);
    dishGeo.rotateX(Math.PI / 3);
    const dishMesh = new THREE.Mesh(dishGeo, cyanMat);
    dishMesh.position.set(-width * 0.42, 9.2, -1.8);
    group.add(dishMesh);

    // 7. Twin LOX Cryo Spheres on the right flank
    const sphereGeo = new THREE.SphereGeometry(0.95, 14, 14);
    const sphereMat = new THREE.MeshStandardMaterial({
      color: 0xf1f5f9,
      roughness: 0.3,
      metalness: 0.4,
    });
    const tank1 = new THREE.Mesh(sphereGeo, sphereMat);
    tank1.position.set(width * 0.38, 0.95, -1.8);
    const tank2 = new THREE.Mesh(sphereGeo, sphereMat);
    tank2.position.set(width * 0.38 + 1.8, 0.95, -1.8);
    group.add(tank1, tank2);
  }

  return group;
}

/**
 * Builds a 4-part SpaceNet Orbital Data Ring (`THREE.Group`).
 */
export function buildDataRingGroup(radius: number): THREE.Group {
  const group = new THREE.Group();

  const outerMat = new THREE.MeshStandardMaterial({
    color: 0x1488b8,
    emissive: 0x0ea5e9,
    emissiveIntensity: 0.55,
    roughness: 0.2,
    metalness: 0.75,
  });

  const nodeMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    emissive: 0x38bdf8,
    emissiveIntensity: 0.8,
    roughness: 0.15,
    metalness: 0.3,
  });

  // 1. Primary Torus Gate
  const torusGeo = new THREE.TorusGeometry(radius, 0.22, 10, 24);
  const torus = new THREE.Mesh(torusGeo, outerMat);
  group.add(torus);

  // 2. 4x Cardinal Telemetry Nodes
  const nodeGeo = new THREE.BoxGeometry(0.55, 0.55, 0.55);
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2;
    const node = new THREE.Mesh(nodeGeo, nodeMat);
    node.position.set(Math.cos(a) * radius, Math.sin(a) * radius, 0);
    group.add(node);
  }

  // 3. Inner Holographic Beacon Core
  const coreGeo = new THREE.OctahedronGeometry(0.65, 0);
  const core = new THREE.Mesh(coreGeo, nodeMat);
  group.add(core);

  return group;
}

/**
 * Builds distinct 4-5 part 3D models for each of the 3 Hazard Archetypes:
 * - 'drifter': Voxel Cratered Asteroid cluster with glowing mineral veins
 * - 'seeker': Interceptor Drone with swept wings and red scanner eye
 * - 'solar_turret': Orbital Defense Satellite with twin solar wings and emitter ring
 */
export function buildHazardGroup(policy: HazardPolicy, radius: number): {
  group: THREE.Group;
  telegraphRing: THREE.Mesh;
} {
  const group = new THREE.Group();

  if (policy === 'drifter') {
    const rockMat = new THREE.MeshStandardMaterial({
      color: 0x64748b,
      roughness: 0.88,
      metalness: 0.12,
    });
    const crystalMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xd97706,
      emissiveIntensity: 0.45,
      roughness: 0.25,
      metalness: 0.6,
    });

    const core = new THREE.Mesh(new THREE.DodecahedronGeometry(radius * 0.85, 0), rockMat);
    const sub1 = new THREE.Mesh(new THREE.BoxGeometry(radius * 0.9, radius * 0.9, radius * 0.9), rockMat);
    sub1.position.set(0.5, 0.3, -0.2);
    sub1.rotation.set(0.5, 0.8, 0.2);
    const crystal1 = new THREE.Mesh(new THREE.OctahedronGeometry(radius * 0.45, 0), crystalMat);
    crystal1.position.set(-0.6, 0.5, 0.5);
    const crystal2 = new THREE.Mesh(new THREE.OctahedronGeometry(radius * 0.35, 0), crystalMat);
    crystal2.position.set(0.6, -0.5, 0.4);
    group.add(core, sub1, crystal1, crystal2);
  } else if (policy === 'seeker') {
    const hullMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.35,
      metalness: 0.8,
    });
    const eyeMat = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      emissive: 0xef4444,
      emissiveIntensity: 0.9,
      roughness: 0.15,
    });
    const body = new THREE.Mesh(new THREE.OctahedronGeometry(radius * 0.72, 0), hullMat);
    const wingGeo = new THREE.BoxGeometry(radius * 1.9, 0.18, 0.65);
    const wing = new THREE.Mesh(wingGeo, hullMat);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(radius * 0.32, 10, 10), eyeMat);
    eye.position.set(0, 0, radius * 0.55);
    const fin = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.9, 4), eyeMat);
    fin.position.set(0, radius * 0.65, 0);
    group.add(body, wing, eye, fin);
  } else {
    // 'solar_turret'
    const chassisMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      roughness: 0.4,
      metalness: 0.65,
    });
    const panelMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      roughness: 0.2,
      metalness: 0.85,
    });
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0xf43f5e,
      emissive: 0xe11d48,
      emissiveIntensity: 0.75,
      roughness: 0.2,
    });

    const hub = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.55, radius * 0.55, 1.4, 12), chassisMat);
    hub.rotation.x = Math.PI / 2;
    const leftPanel = new THREE.Mesh(new THREE.BoxGeometry(radius * 1.6, 0.95, 0.12), panelMat);
    leftPanel.position.set(-radius * 1.25, 0, 0);
    const rightPanel = new THREE.Mesh(new THREE.BoxGeometry(radius * 1.6, 0.95, 0.12), panelMat);
    rightPanel.position.set(radius * 1.25, 0, 0);
    const emitter = new THREE.Mesh(new THREE.SphereGeometry(radius * 0.42, 12, 12), coreMat);
    emitter.position.set(0, 0, 0.75);
    group.add(hub, leftPanel, rightPanel, emitter);
  }

  // Visible Telegraph Warning Ring (scales/flashes during 0.45-0.65s windup before attack)
  const teleGeo = new THREE.RingGeometry(radius * 1.15, radius * 1.45, 24);
  const teleMat = new THREE.MeshBasicMaterial({
    color: 0xf43f5e,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.85,
  });
  const telegraphRing = new THREE.Mesh(teleGeo, teleMat);
  telegraphRing.visible = false;
  group.add(telegraphRing);

  return { group, telegraphRing };
}
