import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { soundEngine } from '../game/audio';
import {
  RocketMeshHandles,
  buildCompositeRocket,
  buildDataRingGroup,
  buildHazardGroup,
  buildLaunchComplexGroup,
} from '../game/models';
import {
  WORLD_BOUNDS,
  calculateMissionScore,
  computeRocketStats,
  createInitialPhysicsState,
  createMissionDataRings,
  createMissionHazards,
  createMissionPads,
  stepHazards,
  stepRocketPhysics,
} from '../game/rules';
import {
  CameraPreset,
  DataRing,
  GameState,
  HazardEntity,
  RelayPad,
  RocketConfig,
  RocketPhysicsState,
  RunSnapshot,
} from '../game/types';

// Pre-allocated scratch math helpers at module scope (Zero GC in render loop)
const _camTargetPos = new THREE.Vector3();
const _camLookTarget = new THREE.Vector3();
const _currentLook = new THREE.Vector3(0, 3, 0);
const _dummyObj = new THREE.Object3D();
const _partTarget = new THREE.Vector3();
const _particleColor = new THREE.Color();

const PARTICLE_POOL_SIZE = 140;

interface ParticleSlot {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  scale: number;
  colorHex: number;
}

export interface HudTelemetryPayload {
  physics: RocketPhysicsState;
  score: number;
  combo: number;
  sector: number;
  ringsCollected: number;
  totalRings: number;
  padsLanded: number;
  nearestPad: { name: string; dist: number; dy: number; safeSpeed: boolean } | null;
  statusBanner: string | null;
}

interface RocketViewport3DProps {
  gameState: GameState;
  rocketConfig: RocketConfig;
  cameraPreset: CameraPreset;
  explodedRatio: number;
  bestScore: number;
  touchInputRef: React.MutableRefObject<{
    thrust: boolean;
    retro: boolean;
    left: boolean;
    right: boolean;
    boost: boolean;
  }>;
  resetSignal: number;
  onTelemetryUpdate: (payload: HudTelemetryPayload) => void;
  onRunFinished: (snapshot: RunSnapshot) => void;
}

export const RocketViewport3D: React.FC<RocketViewport3DProps> = ({
  gameState,
  rocketConfig,
  cameraPreset,
  explodedRatio,
  bestScore,
  touchInputRef,
  resetSignal,
  onTelemetryUpdate,
  onRunFinished,
}) => {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);

  // Store latest props & callbacks in refs so React HUD updates never tear down WebGL
  const gameStateRef = useRef<GameState>(gameState);
  gameStateRef.current = gameState;

  const rocketConfigRef = useRef<RocketConfig>(rocketConfig);
  rocketConfigRef.current = rocketConfig;

  const cameraPresetRef = useRef<CameraPreset>(cameraPreset);
  cameraPresetRef.current = cameraPreset;

  const explodedTargetRef = useRef<number>(explodedRatio);
  explodedTargetRef.current = explodedRatio;

  const bestScoreRef = useRef<number>(bestScore);
  bestScoreRef.current = bestScore;

  const onTelemetryRef = useRef(onTelemetryUpdate);
  onTelemetryRef.current = onTelemetryUpdate;

  const onRunFinishedRef = useRef(onRunFinished);
  onRunFinishedRef.current = onRunFinished;

  // Ref for rebuilding the 3D rocket model when customization changes
  const rebuildRocketFnRef = useRef<((cfg: RocketConfig) => void) | null>(null);
  const resetMissionFnRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (rebuildRocketFnRef.current) {
      rebuildRocketFnRef.current(rocketConfig);
    }
  }, [rocketConfig]);

  useEffect(() => {
    if (resetSignal > 0 && resetMissionFnRef.current) {
      resetMissionFnRef.current();
    }
  }, [resetSignal]);

  useEffect(() => {
    const mountEl = canvasMountRef.current;
    if (!mountEl) return;

    // 1. Software-WebGL Guard per Three.js skill
    const isSoftwareGl = (() => {
      const probeCanvas = document.createElement('canvas');
      const gl = probeCanvas.getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mountEl.clientWidth || window.innerWidth, mountEl.clientHeight || window.innerHeight);
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    mountEl.innerHTML = '';
    mountEl.appendChild(renderer.domElement);

    const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();

    // 2. Scene, Horizon Fog & Studio Environment Reflection (RoomEnvironment)
    const scene = new THREE.Scene();
    const skyHorizonColor = new THREE.Color(0x060b14);
    scene.background = skyHorizonColor;
    scene.fog = new THREE.FogExp2(0x060b14, 0.0055);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(
      52,
      (mountEl.clientWidth || window.innerWidth) / (mountEl.clientHeight || window.innerHeight),
      0.2,
      500,
    );
    camera.position.set(0, 5.5, 16);

    // 3. Balanced 3-Point Studio Lighting Rig (Warm Key + Cool Hemisphere Fill + Cyan Rim)
    const hemiLight = new THREE.HemisphereLight(0x38bdf8, 0x0f172a, 0.85);
    hemiLight.position.set(0, 120, 0);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff1d6, 2.2);
    keyLight.position.set(18, 36, 24);
    keyLight.castShadow = !isSoftwareGl;
    if (!isSoftwareGl) {
      keyLight.shadow.mapSize.width = 1024;
      keyLight.shadow.mapSize.height = 1024;
      const d = 18;
      keyLight.shadow.camera.left = -d;
      keyLight.shadow.camera.right = d;
      keyLight.shadow.camera.top = d;
      keyLight.shadow.camera.bottom = -d;
      keyLight.shadow.camera.near = 1;
      keyLight.shadow.camera.far = 90;
      keyLight.shadow.bias = -0.0005;
      keyLight.shadow.normalBias = 0.02;
    }
    scene.add(keyLight);
    scene.add(keyLight.target);

    const rimLight = new THREE.DirectionalLight(0x0ea5e9, 1.15);
    rimLight.position.set(-16, 14, -18);
    scene.add(rimLight);

    // 4. Natural Outdoor Launch Valley Terrain & Craggy Perimeter Cliffs (No indoor box walls)
    const groundGeo = new THREE.PlaneGeometry(340, 220);
    groundGeo.rotateX(-Math.PI / 2);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x0b1324,
      roughness: 0.92,
      metalness: 0.08,
    });
    const groundPlane = new THREE.Mesh(groundGeo, groundMat);
    groundPlane.position.y = -0.9;
    groundPlane.receiveShadow = !isSoftwareGl;
    scene.add(groundPlane);

    // Instanced Voxel Cliff Outcrops framing the launch valley perimeter (> 20 instances)
    const cliffCount = 48;
    const cliffGeo = new THREE.BoxGeometry(4, 10, 4);
    const cliffMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.88,
      metalness: 0.12,
    });
    const cliffInstanced = new THREE.InstancedMesh(cliffGeo, cliffMat, cliffCount);
    for (let i = 0; i < cliffCount; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const xPos = side * (22 + (i % 6) * 6.5) + (Math.sin(i * 3.1) * 3);
      const zPos = -10 - (i % 8) * 6 + Math.cos(i * 1.7) * 4;
      const scaleY = 0.65 + (i % 5) * 0.35;
      _dummyObj.position.set(xPos, scaleY * 5 - 1.2, zPos);
      _dummyObj.rotation.set(0, (i % 4) * (Math.PI / 4), 0);
      _dummyObj.scale.set(0.85 + (i % 3) * 0.25, scaleY, 0.85 + (i % 4) * 0.2);
      _dummyObj.updateMatrix();
      cliffInstanced.setMatrixAt(i, _dummyObj.matrix);

      const shade = 0.12 + (i % 4) * 0.03;
      _particleColor.setRGB(shade * 0.8, shade, shade * 1.45);
      cliffInstanced.setColorAt(i, _particleColor);
    }
    cliffInstanced.instanceMatrix.needsUpdate = true;
    if (cliffInstanced.instanceColor) cliffInstanced.instanceColor.needsUpdate = true;
    cliffInstanced.computeBoundingSphere();
    scene.add(cliffInstanced);

    // Instanced Retro Pixel Starfield & Orbital Dust (360 instances)
    const starCount = 360;
    const starGeo = new THREE.BoxGeometry(0.42, 0.42, 0.42);
    const starMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const starInstanced = new THREE.InstancedMesh(starGeo, starMat, starCount);
    for (let i = 0; i < starCount; i++) {
      const sx = ((i * 73) % 180) - 90;
      const sy = ((i * 137) % 440) + 4;
      const sz = -14 - ((i * 29) % 55);
      const sScale = 0.55 + (i % 5) * 0.25;
      _dummyObj.position.set(sx, sy, sz);
      _dummyObj.rotation.set(0, 0, 0);
      _dummyObj.scale.setScalar(sScale);
      _dummyObj.updateMatrix();
      starInstanced.setMatrixAt(i, _dummyObj.matrix);

      if (i % 7 === 0) _particleColor.setHex(0x38bdf8);
      else if (i % 11 === 0) _particleColor.setHex(0xfef08a);
      else _particleColor.setHex(0xe2e8f0);
      starInstanced.setColorAt(i, _particleColor);
    }
    starInstanced.instanceMatrix.needsUpdate = true;
    if (starInstanced.instanceColor) starInstanced.instanceColor.needsUpdate = true;
    starInstanced.computeBoundingSphere();
    scene.add(starInstanced);

    // 5. Zero-GC Pooled Particle Ring Buffer (InstancedMesh)
    const particleGeo = new THREE.BoxGeometry(0.32, 0.32, 0.32);
    const particleMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const particleMesh = new THREE.InstancedMesh(particleGeo, particleMat, PARTICLE_POOL_SIZE);
    particleMesh.frustumCulled = false;
    const particlePool: ParticleSlot[] = Array.from({ length: PARTICLE_POOL_SIZE }, () => ({
      active: false,
      x: 0,
      y: -100,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      life: 0,
      maxLife: 1,
      scale: 0,
      colorHex: 0x38bdf8,
    }));
    let particleCursor = 0;

    const spawnParticles = (
      count: number,
      ox: number,
      oy: number,
      oz: number,
      baseVx: number,
      baseVy: number,
      spread: number,
      colorHex: number,
      maxLife: number,
    ) => {
      for (let i = 0; i < count; i++) {
        const slot = particlePool[particleCursor];
        particleCursor = (particleCursor + 1) % PARTICLE_POOL_SIZE;
        slot.active = true;
        slot.x = ox + (Math.random() - 0.5) * 0.4;
        slot.y = oy + (Math.random() - 0.5) * 0.4;
        slot.z = oz + (Math.random() - 0.5) * 0.4;
        slot.vx = baseVx + (Math.random() - 0.5) * spread;
        slot.vy = baseVy + (Math.random() - 0.5) * spread;
        slot.vz = (Math.random() - 0.5) * spread * 0.5;
        slot.life = maxLife;
        slot.maxLife = maxLife;
        slot.scale = 0.7 + Math.random() * 0.8;
        slot.colorHex = colorHex;
      }
    };
    scene.add(particleMesh);

    // 6. World Entities: Relay Pads, Data Rings, Hazards, and Rocket
    const worldGroup = new THREE.Group();
    scene.add(worldGroup);

    let pads: RelayPad[] = [];
    let rings: DataRing[] = [];
    let hazards: HazardEntity[] = [];
    const ringMeshes = new Map<string, THREE.Group>();
    const hazardMeshes = new Map<string, { group: THREE.Group; telegraphRing: THREE.Mesh }>();

    let rocketHandles: RocketMeshHandles = buildCompositeRocket(
      rocketConfigRef.current,
      maxAnisotropy,
      isSoftwareGl,
    );
    scene.add(rocketHandles.root);

    let currentStats = computeRocketStats(rocketConfigRef.current);
    let physics: RocketPhysicsState = createInitialPhysicsState(currentStats);

    let ringsScore = 0;
    let padsScore = 0;
    let combo = 1;
    let perfectLandings = 0;
    let runStartTime = performance.now();
    let hitstopTimer = 0;
    let cameraTrauma = 0;
    let statusBanner: string | null = null;
    let statusBannerTimer = 0;
    let outcomeTriggered = false;
    let currentExploded = 0;

    const populateWorldObjects = () => {
      while (worldGroup.children.length > 0) {
        worldGroup.remove(worldGroup.children[0]);
      }
      ringMeshes.clear();
      hazardMeshes.clear();

      pads = createMissionPads();
      rings = createMissionDataRings();
      hazards = createMissionHazards();

      for (const pad of pads) {
        const padGroup = buildLaunchComplexGroup(
          pad.width,
          maxAnisotropy,
          isSoftwareGl,
          pad.id === 'pad-origin',
        );
        padGroup.position.set(pad.x, pad.y, 0);
        worldGroup.add(padGroup);
      }

      for (const ring of rings) {
        const rg = buildDataRingGroup(ring.radius);
        rg.position.set(ring.x, ring.y, 0);
        worldGroup.add(rg);
        ringMeshes.set(ring.id, rg);
      }

      for (const haz of hazards) {
        const hg = buildHazardGroup(haz.policy, haz.radius);
        hg.group.position.set(haz.x, haz.y, 0);
        worldGroup.add(hg.group);
        hazardMeshes.set(haz.id, hg);
      }
    };

    const resetMission = () => {
      currentStats = computeRocketStats(rocketConfigRef.current);
      physics = createInitialPhysicsState(currentStats);
      ringsScore = 0;
      padsScore = 0;
      combo = 1;
      perfectLandings = 0;
      runStartTime = performance.now();
      hitstopTimer = 0;
      cameraTrauma = 0;
      statusBanner = 'LAUNCH COMPLEX CLEAR FOR LIFTOFF';
      statusBannerTimer = 2.5;
      outcomeTriggered = false;
      populateWorldObjects();
    };

    resetMission();
    resetMissionFnRef.current = resetMission;

    rebuildRocketFnRef.current = (newConfig: RocketConfig) => {
      const prevPos = rocketHandles.root.position.clone();
      const prevRot = rocketHandles.bodyGroup.rotation.clone();
      scene.remove(rocketHandles.root);
      rocketHandles = buildCompositeRocket(newConfig, maxAnisotropy, isSoftwareGl);
      rocketHandles.root.position.copy(prevPos);
      rocketHandles.bodyGroup.rotation.copy(prevRot);
      scene.add(rocketHandles.root);

      currentStats = computeRocketStats(newConfig);
      if (gameStateRef.current === 'title' || physics.groundedPadId === 'pad-origin') {
        physics.maxFuel = currentStats.fuelCapacity;
        physics.fuel = currentStats.fuelCapacity;
        physics.maxHp = currentStats.maxHullHp;
        physics.hp = currentStats.maxHullHp;
      }
    };

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // 7. Unified Keyboard & Pointer Input Listeners
    const keysPressed = new Set<string>();
    const keysJustPressed = new Set<string>();
    let pointerNormX = 0;
    let pointerNormY = 0;

    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }
      const code = e.code;
      if (!keysPressed.has(code)) {
        keysJustPressed.add(code);
      }
      keysPressed.add(code);
    };

    const onKeyUp = (e: KeyboardEvent) => {
      keysPressed.delete(e.code);
    };

    const clearInputs = () => {
      keysPressed.clear();
      keysJustPressed.clear();
    };

    const onPointerMove = (e: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        pointerNormX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        pointerNormY = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', clearInputs);
    window.addEventListener('pointermove', onPointerMove, { passive: true });

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = Math.max(1, entry.contentRect.width);
        const h = Math.max(1, entry.contentRect.height);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      }
    });
    resizeObserver.observe(mountEl);

    // 8. Software-WebGL Paced Game Loop (`afterDraw`) vs GPU `requestAnimationFrame`
    let frameId = 0;
    let disposed = false;
    const clock = new THREE.Clock();
    let elapsedTotal = 0;
    let lastHudSyncTime = 0;

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl && gl.fenceSync ? gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0) : null;
      if (gl && gl.flush) gl.flush();
      const poll = () => {
        if (disposed) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function triggerOutcome(victory: boolean, reason: string) {
      if (outcomeTriggered) return;
      outcomeTriggered = true;
      soundEngine.playOutcomeSting(victory);
      const padsVisitedCount = pads.filter((p) => p.visited).length;
      const ringsCollectedCount = rings.filter((r) => r.collected).length;
      const finalScore = calculateMissionScore({
        peakAltitude: physics.peakAltitude,
        ringsPoints: ringsScore,
        padsPoints: padsScore,
        perfectLandings,
        fuelRemaining: physics.fuel,
        victory,
      });

      const snapshot: RunSnapshot = {
        outcome: victory ? 'victory' : 'defeat',
        reason,
        score: finalScore,
        bestScore: Math.max(bestScoreRef.current, finalScore),
        peakAltitude: Math.round(physics.peakAltitude),
        sectorReached: Math.min(4, Math.floor(physics.peakAltitude / 100) + 1),
        ringsCollected: ringsCollectedCount,
        totalRings: rings.length,
        padsLanded: padsVisitedCount,
        perfectLandings,
        clearTimeSeconds: Number(((performance.now() - runStartTime) / 1000).toFixed(1)),
        rocketConfig: { ...rocketConfigRef.current },
      };

      window.setTimeout(() => {
        if (!disposed) {
          onRunFinishedRef.current(snapshot);
        }
      }, victory ? 380 : 480);
    }

    function tick() {
      if (disposed) return;
      const rawDt = clock.getDelta();
      const dt = Math.min(Math.max(rawDt, 0.001), 0.05);
      elapsedTotal += dt;

      const state = gameStateRef.current;

      // Smoothly damp Exploded View separation
      currentExploded = THREE.MathUtils.damp(
        currentExploded,
        explodedTargetRef.current,
        8,
        dt,
      );
      for (const item of rocketHandles.explodableParts) {
        _partTarget
          .copy(item.basePos)
          .addScaledVector(item.explodedOffset, currentExploded);
        item.mesh.position.copy(_partTarget);
      }

      if (state === 'title') {
        // Title Screen Stage: Interactive Centerpiece Turntable + Cursor Tilt
        rocketHandles.root.position.set(0, 0, 0);
        rocketHandles.bodyGroup.rotation.y = elapsedTotal * 0.55 + pointerNormX * 0.45;
        rocketHandles.bodyGroup.rotation.z = -pointerNormX * 0.12;
        rocketHandles.bodyGroup.rotation.x = pointerNormY * 0.1;

        rocketHandles.plumeGroup.visible = true;
        const idlePulse = 0.55 + Math.sin(elapsedTotal * 18) * 0.12;
        rocketHandles.plumeGroup.scale.set(0.75, idlePulse, 0.75);
        rocketHandles.contactShadow.position.set(0, 0.02, 0);
        (rocketHandles.contactShadow.material as THREE.MeshBasicMaterial).opacity = 0.55;
        soundEngine.stopThrusterLoop();

        _camTargetPos.set(
          Math.sin(elapsedTotal * 0.25) * 3.5 + pointerNormX * 1.5,
          4.2 + pointerNormY * 0.8,
          12.5,
        );
        _camLookTarget.set(-1.6, 2.7, 0);
      } else if (state === 'playing') {
        if (hitstopTimer > 0) {
          hitstopTimer = Math.max(0, hitstopTimer - dt);
        } else {
          // Read held & edge-triggered flight controls
          const touch = touchInputRef.current;
          const thrustHeld =
            keysPressed.has('KeyW') ||
            keysPressed.has('ArrowUp') ||
            keysPressed.has('Space') ||
            touch.thrust;
          const retroHeld =
            keysPressed.has('KeyS') || keysPressed.has('ArrowDown') || touch.retro;
          const leftHeld =
            keysPressed.has('KeyA') || keysPressed.has('ArrowLeft') || touch.left;
          const rightHeld =
            keysPressed.has('KeyD') || keysPressed.has('ArrowRight') || touch.right;
          const boostJustPressed =
            keysJustPressed.has('ShiftLeft') ||
            keysJustPressed.has('ShiftRight') ||
            keysJustPressed.has('KeyE') ||
            touch.boost;
          touch.boost = false;
          keysJustPressed.clear();

          const stepRes = stepRocketPhysics(
            physics,
            { thrustHeld, retroHeld, leftHeld, rightHeld, boostJustPressed },
            currentStats,
            dt,
            pads,
          );
          physics = stepRes.state;

          soundEngine.updateThruster(physics.throttle);

          if (stepRes.usedBoost) {
            soundEngine.playBoostBurst();
            cameraTrauma = Math.min(1, cameraTrauma + 0.32);
            spawnParticles(16, physics.x, physics.y + 1.2, 0, 0, -9, 7, 0x38bdf8, 0.45);
          }

          // Emit thruster exhaust particles when burning
          if (physics.throttle > 0.08 && physics.fuel > 0) {
            const exhaustVx = Math.sin(physics.angle) * 11;
            const exhaustVy = -Math.cos(physics.angle) * 11;
            spawnParticles(
              2,
              physics.x + Math.sin(physics.angle) * 0.4,
              physics.y + 0.1,
              0,
              exhaustVx,
              exhaustVy,
              3.5,
              rocketConfigRef.current.plume === 'plasma_amber'
                ? 0xf59e0b
                : rocketConfigRef.current.plume === 'hyper_magenta'
                ? 0xec4899
                : 0x38bdf8,
              0.36,
            );
          }

          // Handle Relay Pad Touchdown
          if (stepRes.landedPad && stepRes.landingEval) {
            const pad = stepRes.landedPad;
            const ev = stepRes.landingEval;
            soundEngine.playLanding(ev.grade);
            statusBanner = `${pad.name.toUpperCase()} · ${ev.label}`;
            statusBannerTimer = 3.0;

            if (ev.grade === 'perfect') {
              perfectLandings++;
              combo = Math.min(5, combo + 1);
            } else if (ev.grade === 'hard' || ev.grade === 'crash') {
              combo = 1;
              hitstopTimer = 0.06;
              cameraTrauma = Math.min(1, cameraTrauma + 0.55);
              spawnParticles(22, physics.x, physics.y + 0.5, 0, 0, 5, 9, 0xf59e0b, 0.55);
            }

            if (!pad.visited) {
              pad.visited = true;
              padsScore += pad.bonusPoints + ev.scoreAwarded * combo;
              spawnParticles(24, pad.x, pad.y + 1, 0, 0, 7, 10, 0x38bdf8, 0.65);
            }

            // Check Victory at top Orbital Core Pad
            if (pad.id === 'pad-geostationary' && physics.hp > 0) {
              triggerOutcome(true, 'Docked at Mediatama Orbital Core');
            }
          }

          // Check Data Ring synchronization
          for (const ring of rings) {
            if (!ring.collected) {
              const dist = Math.hypot(physics.x - ring.x, physics.y + 2.2 - ring.y);
              if (dist <= ring.radius + 1.1) {
                ring.collected = true;
                ringsScore += ring.points * combo;
                combo = Math.min(5, combo + 1);
                statusBanner = `SPACENET RELAY SYNCED +${ring.points * combo} PTS (${combo}x)`;
                statusBannerTimer = 2.2;
                soundEngine.playRingSync();
                spawnParticles(18, ring.x, ring.y, 0, 0, 2, 9, 0x38bdf8, 0.55);
                const rm = ringMeshes.get(ring.id);
                if (rm) rm.visible = false;
              }
            }
          }

          // Step Hazards (3 distinct policies + windup telegraph)
          const hazStep = stepHazards(hazards, physics.x, physics.y + 2.2, dt, elapsedTotal);
          hazards = hazStep.hazards;
          if (hazStep.telegraphStarted) {
            soundEngine.playTelegraphAlert();
          }

          if (hazStep.rocketPulseHit && physics.invulnerableTimer <= 0) {
            physics.hp = Math.max(0, physics.hp - 1);
            physics.invulnerableTimer = 1.25;
            combo = 1;
            hitstopTimer = 0.06;
            cameraTrauma = Math.min(1, cameraTrauma + 0.6);
            statusBanner = 'SOLAR EMP PULSE IMPACT - HULL DAMAGED';
            statusBannerTimer = 2.4;
            soundEngine.playHullHit();
            spawnParticles(22, physics.x, physics.y + 2, 0, 0, 0, 11, 0xf43f5e, 0.6);
          }

          // Direct physical collision with hazards
          for (const haz of hazards) {
            if (haz.koTimer > 0) continue;
            const dist = Math.hypot(physics.x - haz.x, physics.y + 2.2 - haz.y);
            if (dist <= haz.radius + 1.15) {
              if (physics.invulnerableTimer <= 0) {
                physics.hp = Math.max(0, physics.hp - 1);
                physics.invulnerableTimer = 1.25;
                combo = 1;
                hitstopTimer = 0.06;
                cameraTrauma = Math.min(1, cameraTrauma + 0.65);
                statusBanner =
                  haz.policy === 'drifter'
                    ? 'ASTEROID COLLISION DETECTED'
                    : 'INTERCEPTOR DRONE IMPACT';
                statusBannerTimer = 2.4;
                soundEngine.playHullHit();
                // Knockback impulse away from hazard
                const nx = (physics.x - haz.x) / Math.max(0.1, dist);
                const ny = (physics.y + 2.2 - haz.y) / Math.max(0.1, dist);
                physics.vx += nx * 9;
                physics.vy += ny * 9;
                haz.koTimer = 0.4;
                spawnParticles(24, haz.x, haz.y, 0, 0, 0, 12, 0xf59e0b, 0.6);
              }
            }
          }

          // Check Defeat conditions (Hull depleted or Out of fuel while stranded)
          if (physics.hp <= 0) {
            triggerOutcome(false, 'Critical Hull Breach');
          } else if (physics.fuel <= 0.05 && Math.abs(physics.vy) < 0.2 && !physics.groundedPadId) {
            triggerOutcome(false, 'Propellant Depleted in Sub-Orbit');
          }
        }

        // Sync Rocket 3D Mesh Transform (always visible so captures never catch an invisible blink frame)
        rocketHandles.root.position.set(physics.x, physics.y, 0);
        rocketHandles.bodyGroup.rotation.set(
          0,
          physics.invulnerableTimer > 0 ? Math.sin(elapsedTotal * 28) * 0.18 : 0,
          physics.angle,
        );
        rocketHandles.bodyGroup.visible = true;

        // Thruster Plume & RCS Cones
        if (physics.throttle > 0.02 && physics.fuel > 0) {
          rocketHandles.plumeGroup.visible = true;
          const flicker = 0.85 + Math.sin(elapsedTotal * 42) * 0.18;
          rocketHandles.plumeGroup.scale.set(
            0.85 + physics.throttle * 0.35,
            physics.throttle * 1.45 * flicker,
            0.85 + physics.throttle * 0.35,
          );
        } else {
          rocketHandles.plumeGroup.visible = false;
        }

        rocketHandles.rcsLeftFlame.visible = physics.rcsActive < 0;
        rocketHandles.rcsRightFlame.visible = physics.rcsActive > 0;

        // Contact shadow tracks nearest pad surface below rocket
        let shadowPadY = 0;
        for (const pad of pads) {
          if (Math.abs(physics.x - pad.x) <= pad.width * 0.6 && physics.y >= pad.y - 0.5) {
            shadowPadY = Math.max(shadowPadY, pad.y);
          }
        }
        const heightAbovePad = Math.max(0, physics.y - shadowPadY);
        rocketHandles.contactShadow.position.set(0, shadowPadY - physics.y + 0.02, 0);
        (rocketHandles.contactShadow.material as THREE.MeshBasicMaterial).opacity = Math.max(
          0,
          0.55 * (1 - heightAbovePad / 14),
        );

        // Keep directional keyLight shadow frustum centered on rocket
        keyLight.position.set(physics.x + 18, physics.y + 36, 24);
        keyLight.target.position.set(physics.x, physics.y + 2, 0);

        // Camera Choreography & Presets with FOV speed cue
        const speedMag = Math.hypot(physics.vx, physics.vy);
        const targetFov = THREE.MathUtils.clamp(50 + speedMag * 0.38, 50, 64);
        camera.fov = THREE.MathUtils.damp(camera.fov, targetFov, 4, dt);
        camera.updateProjectionMatrix();

        const preset = cameraPresetRef.current;
        if (preset === 'cockpit') {
          _camTargetPos.set(physics.x, physics.y + 4.2, 6.5);
          _camLookTarget.set(physics.x - Math.sin(physics.angle) * 6, physics.y + 9, 0);
        } else if (preset === 'arcade_ortho') {
          _camTargetPos.set(physics.x * 0.7, physics.y + 5.5, 34);
          _camLookTarget.set(physics.x * 0.85, physics.y + 4.5, 0);
        } else if (preset === 'turntable') {
          _camTargetPos.set(
            physics.x + Math.sin(elapsedTotal * 0.8) * 14,
            physics.y + 4.0,
            Math.cos(elapsedTotal * 0.8) * 14,
          );
          _camLookTarget.set(physics.x, physics.y + 2.4, 0);
        } else {
          // Default 'chase' camera with velocity lead
          _camTargetPos.set(
            physics.x + physics.vx * 0.28,
            Math.max(4.5, physics.y + 4.8 + physics.vy * 0.22),
            21 + Math.min(8, speedMag * 0.25),
          );
          _camLookTarget.set(
            physics.x + physics.vx * 0.18,
            Math.max(2.6, physics.y + 3.2 + physics.vy * 0.18),
            0,
          );
        }
      } else {
        // Paused or GameOver: silence thruster loop and gently orbit
        soundEngine.stopThrusterLoop();
      }

      // Animate Data Rings & Hazards
      for (const ring of rings) {
        if (!ring.collected) {
          const rm = ringMeshes.get(ring.id);
          if (rm) {
            rm.rotation.z = elapsedTotal * 0.9 + ring.phase;
            rm.children[5]?.rotation.set(elapsedTotal * 2, elapsedTotal * 1.5, 0);
          }
        }
      }

      for (const haz of hazards) {
        const hm = hazardMeshes.get(haz.id);
        if (!hm) continue;
        if (haz.koTimer <= 0 && haz.hp <= 0) {
          hm.group.visible = false;
          continue;
        }
        hm.group.position.set(haz.x, haz.y, 0);
        hm.group.rotation.y = elapsedTotal * 1.2 + haz.orbitPhase;
        if (haz.policy === 'drifter') {
          hm.group.rotation.x = elapsedTotal * 0.7;
        }

        if (haz.telegraphTimer > 0) {
          hm.telegraphRing.visible = true;
          const pulseScale = 1 + Math.sin(elapsedTotal * 35) * 0.35;
          hm.telegraphRing.scale.setScalar(pulseScale);
        } else if (haz.attackActiveTimer > 0 && haz.policy === 'solar_turret') {
          hm.telegraphRing.visible = true;
          hm.telegraphRing.scale.setScalar(4.2);
        } else {
          hm.telegraphRing.visible = false;
        }
      }

      // Advance Pooled Particle Ring Buffer in-place
      for (let i = 0; i < PARTICLE_POOL_SIZE; i++) {
        const p = particlePool[i];
        if (p.active) {
          p.life -= dt;
          if (p.life <= 0) {
            p.active = false;
            _dummyObj.position.set(0, -200, 0);
            _dummyObj.scale.setScalar(0);
          } else {
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.z += p.vz * dt;
            const ratio = p.life / p.maxLife;
            _dummyObj.position.set(p.x, p.y, p.z);
            _dummyObj.rotation.set(elapsedTotal * 4, elapsedTotal * 3, 0);
            _dummyObj.scale.setScalar(p.scale * ratio);
            _particleColor.setHex(p.colorHex);
            particleMesh.setColorAt(i, _particleColor);
          }
        } else {
          _dummyObj.position.set(0, -200, 0);
          _dummyObj.scale.setScalar(0);
        }
        _dummyObj.updateMatrix();
        particleMesh.setMatrixAt(i, _dummyObj.matrix);
      }
      particleMesh.instanceMatrix.needsUpdate = true;
      if (particleMesh.instanceColor) particleMesh.instanceColor.needsUpdate = true;

      // Exponentially damp camera position & lookAt target + trauma shake
      const dampFactor = 1 - Math.exp(-6.5 * dt);
      camera.position.lerp(_camTargetPos, dampFactor);
      _currentLook.lerp(_camLookTarget, dampFactor);

      if (cameraTrauma > 0) {
        const shake = cameraTrauma * cameraTrauma * 0.65;
        camera.position.x += (Math.random() - 0.5) * shake;
        camera.position.y += (Math.random() - 0.5) * shake;
        cameraTrauma = Math.max(0, cameraTrauma - dt * 1.8);
      }
      camera.lookAt(_currentLook);

      if (statusBannerTimer > 0) {
        statusBannerTimer = Math.max(0, statusBannerTimer - dt);
        if (statusBannerTimer === 0) statusBanner = null;
      }

      // Throttle HUD React telemetry callback to <= 10Hz
      if (elapsedTotal - lastHudSyncTime >= 0.1) {
        lastHudSyncTime = elapsedTotal;
        const liveScore = calculateMissionScore({
          peakAltitude: physics.peakAltitude,
          ringsPoints: ringsScore,
          padsPoints: padsScore,
          perfectLandings,
          fuelRemaining: physics.fuel,
          victory: false,
        });

        let nearestPadInfo: HudTelemetryPayload['nearestPad'] = null;
        let minDist = Infinity;
        for (const pad of pads) {
          const dist = Math.hypot(physics.x - pad.x, physics.y - pad.y);
          if (dist < minDist) {
            minDist = dist;
            const safeSpeed =
              Math.abs(physics.vy) <= 9.5 &&
              Math.abs(physics.vx) <= 6.5 &&
              Math.abs((physics.angle * 180) / Math.PI) <= 24;
            nearestPadInfo = {
              name: pad.name,
              dist: Math.round(dist),
              dy: Math.round(pad.y - physics.y),
              safeSpeed,
            };
          }
        }

        onTelemetryRef.current({
          physics: { ...physics },
          score: liveScore,
          combo,
          sector: Math.min(4, Math.floor(physics.y / 100) + 1),
          ringsCollected: rings.filter((r) => r.collected).length,
          totalRings: rings.length,
          padsLanded: pads.filter((p) => p.visited).length,
          nearestPad: nearestPadInfo,
          statusBanner,
        });
      }

      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    frameId = requestAnimationFrame(tick);

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      soundEngine.stopThrusterLoop();
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', clearInputs);
      window.removeEventListener('pointermove', onPointerMove);
      resizeObserver.disconnect();
      renderer.dispose();
    };
  }, []);

  return (
    <div
      ref={canvasMountRef}
      data-testid="rocket-webgl-viewport"
      className="fixed inset-0 w-screen h-screen overflow-hidden bg-[#060B14]"
    />
  );
};
