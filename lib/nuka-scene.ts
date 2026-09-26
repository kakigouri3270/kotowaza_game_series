import * as THREE from "three";
import { BRAN_X, BRAN_Y, BRAN_Z, PLAYER_START, canPlaceNail, movePlayer, nailDepth } from "./nuka-physics";

export type NukaState = {
  active: boolean; aimed: boolean;
  target: { x: number; z: number } | null;
  player: { x: number; z: number; yaw: number; pitch: number };
  visibleNails: number;
  nails: { x: number; z: number; depth: number }[];
};
export type NukaScene = {
  setActive(active: boolean): void;
  setKey(code: string, pressed: boolean): void;
  setTouchMove(x: number, y: number): void;
  look(dx: number, dy: number): void;
  insert(): boolean;
  resetPlayer(): void;
  getState(): NukaState;
  dispose(): void;
};

export function createNukaScene(host: HTMLElement, onState: (state: NukaState) => void): NukaScene {
  const world = new THREE.Scene();
  world.background = new THREE.Color("#b6b2a0");
  world.fog = new THREE.Fog("#c5c0aa", 8, 18);
  const camera = new THREE.PerspectiveCamera(62, 1, 0.025, 35);
  camera.rotation.order = "YXZ";
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.7));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.domElement.setAttribute("aria-label", "一人称で歩ける糠の作業部屋");
  renderer.domElement.tabIndex = -1;
  host.appendChild(renderer.domElement);
  const textures: THREE.Texture[] = [];
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const material = (color: string, roughness = 0.8, metalness = 0) => {
    const m = new THREE.MeshStandardMaterial({ color, roughness, metalness }); materials.add(m); return m;
  };
  const wood = material("#987047"), darkWood = material("#493c2d"), floorMat = material("#81745c");
  const branMat = material("#e2cea5"), plaster = material("#c2c1ae"), iron = material("#a0aaa6", 0.28, 0.5);
  const darkIron = material("#394644", 0.35, 0.65), ceramic = material("#65766d"), cloth = material("#c1b99a");
  const skin = material("#b79872"), sleeve = material("#344d4b");

  function texture(kind: "wood" | "bran") {
    const canvas = document.createElement("canvas"); canvas.width = canvas.height = 256;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = kind === "wood" ? "#b89971" : "#c9ae7f"; ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < (kind === "wood" ? 1800 : 11000); i++) {
      const x = Math.random() * 256, y = Math.random() * 256;
      ctx.fillStyle = kind === "wood" ? "rgba(53,32,17,0.07)" : (i % 2 ? "#e2c792" : "#9b794e");
      ctx.globalAlpha = kind === "bran" ? 0.35 + Math.random() * 0.35 : 1;
      ctx.fillRect(x, y, kind === "wood" ? Math.random() * 90 + 8 : 1 + Math.random() * 1.5, kind === "wood" ? 0.5 : 1);
    }
    const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace;
    map.wrapS = map.wrapT = THREE.RepeatWrapping; map.repeat.set(kind === "bran" ? 4 : 2, kind === "bran" ? 3 : 1);
    map.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy()); textures.push(map); return map;
  }
  wood.map = texture("wood"); floorMat.map = wood.map;
  branMat.map = texture("bran"); branMat.bumpMap = branMat.map; branMat.bumpScale = 0.015;
  const boxGeo = new THREE.BoxGeometry(1, 1, 1); geometries.add(boxGeo);
  function mesh(geometry: THREE.BufferGeometry, mat: THREE.Material, parent: THREE.Object3D = world) {
    geometries.add(geometry); materials.add(mat);
    const object = new THREE.Mesh(geometry, mat); object.castShadow = true; object.receiveShadow = true;
    parent.add(object); return object;
  }
  function box(x: number, y: number, z: number, sx: number, sy: number, sz: number, mat = wood, parent: THREE.Object3D = world) {
    const object = mesh(boxGeo, mat, parent); object.position.set(x, y, z); object.scale.set(sx, sy, sz); return object;
  }
  function cylinder(rt: number, rb: number, height: number, mat: THREE.Material, parent: THREE.Object3D = world, segments = 24) {
    return mesh(new THREE.CylinderGeometry(rt, rb, height, segments), mat, parent);
  }
  world.add(new THREE.HemisphereLight("#fff2d4", "#52625d", 2.4));
  const sun = new THREE.DirectionalLight("#ffdfac", 3.6); sun.position.set(-3, 5.8, -2.3);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5, near: 0.1, far: 16 });
  sun.shadow.normalBias = 0.02; sun.shadow.bias = -0.0003; world.add(sun);
  const fill = new THREE.PointLight("#fff0d1", 8, 8); fill.position.set(2.5, 2.5, 1); world.add(fill);

  // A small, navigable workshop with a low, generously filled bran tray.
  box(0, -0.11, 0, 8, 0.2, 8, floorMat);
  for (let i = -7; i <= 7; i++) box(i * 0.55, -0.005, 0, 0.008, 0.005, 8, darkWood);
  box(0, 1.7, -4, 8.1, 3.4, 0.16, plaster);
  box(-4, 1.7, 0, 0.16, 3.4, 8, plaster);
  box(4, 1.7, 0, 0.16, 3.4, 8, plaster);
  box(0, 1.7, 4, 8, 3.4, 0.16, plaster);
  for (const x of [-3.9, 0, 3.9]) box(x, 1.7, -3.88, 0.13, 3.4, 0.16, darkWood);
  for (const z of [-3.9, 0, 3.9]) box(-3.88, 1.7, z, 0.16, 3.4, 0.13, darkWood);
  for (const y of [0.14, 3.15]) {
    box(0, y, -3.85, 8, 0.16, 0.14, darkWood);
    box(-3.85, y, 0, 0.14, 0.16, 8, darkWood);
    box(3.85, y, 0, 0.14, 0.16, 8, darkWood);
    box(0, y, 3.85, 8, 0.16, 0.14, darkWood);
  }
  const paper = material("#ece9ce"); paper.emissive.set("#ffe9b3"); paper.emissiveIntensity = 0.38;
  box(-3.88, 2.05, -1.1, 0.04, 1.6, 3.6, paper);
  for (let z = -2.9; z <= 0.8; z += 0.45) box(-3.83, 2.05, z, 0.07, 1.7, 0.035, darkWood);
  for (const y of [1.22, 1.78, 2.32, 2.88]) box(-3.83, y, -1.1, 0.07, 0.04, 3.7, darkWood);
  const signCanvas = document.createElement("canvas"); signCanvas.width = 256; signCanvas.height = 512;
  const signCtx = signCanvas.getContext("2d")!; signCtx.fillStyle = "#d8cfad"; signCtx.fillRect(0, 0, 256, 512);
  signCtx.fillStyle = "#424839"; signCtx.font = "62px serif"; signCtx.textAlign = "center";
  ["手", "応", "え", "無", "用"].forEach((s, i) => signCtx.fillText(s, 128, 99 + i * 78));
  const signMap = new THREE.CanvasTexture(signCanvas); signMap.colorSpace = THREE.SRGBColorSpace; textures.push(signMap);
  const signMat = material("#ffffff"); signMat.map = signMap;
  box(1.55, 2.1, -3.86, 0.64, 1.34, 0.045, darkWood);
  box(1.55, 2.1, -3.82, 0.56, 1.25, 0.035, signMat);
  box(-1.65, 0.84, -3.48, 2.4, 0.09, 0.62);
  for (const x of [-2.65, -0.65]) box(x, 0.42, -3.48, 0.1, 0.82, 0.43, darkWood);
  for (let i = 0; i < 3; i++) {
    const jar = cylinder(0.16, 0.2, 0.38 + i * 0.035, ceramic); jar.position.set(-2.4 + i * 0.65, 1.08, -3.48);
    const lid = cylinder(0.18, 0.16, 0.06, darkWood); lid.position.set(jar.position.x, 1.29 + i * 0.018, -3.48);
  }
  box(2.5, 0.3, -3.35, 1, 0.6, 0.85, wood);
  box(2.5, 0.65, -3.35, 0.88, 0.09, 0.73, cloth);
  box(0, 0.66, 0, 3.15, 0.16, 2.12, wood);
  for (const x of [-1.28, 1.28]) for (const z of [-0.78, 0.78]) box(x, 0.28, z, 0.17, 0.59, 0.17, darkWood);
  box(0, 0.82, 0, 2.8, 0.2, 1.8, wood);
  box(0, 0.91, 0, BRAN_X * 2, 0.16, BRAN_Z * 2, branMat);
  const rims: THREE.Mesh[] = [];
  for (const x of [-1.37, 1.37]) rims.push(box(x, 0.94, 0, 0.16, 0.3, 1.92));
  for (const z of [-0.88, 0.88]) rims.push(box(0, 0.94, z, 2.74, 0.3, 0.16));
  for (const x of [-1.37, 1.37]) for (const z of [-0.87, 0.87]) {
    const peg = cylinder(0.022, 0.022, 0.012, darkIron, world, 10); peg.position.set(x, 1.095, z);
  }
  const grainGeo = new THREE.IcosahedronGeometry(0.0055, 0); geometries.add(grainGeo);
  const grains = new THREE.InstancedMesh(grainGeo, branMat, 5000); grains.receiveShadow = true;
  const dummy = new THREE.Object3D(), tint = new THREE.Color();
  for (let i = 0; i < grains.count; i++) {
    dummy.position.set((Math.random() * 2 - 1) * (BRAN_X - 0.01), BRAN_Y + Math.random() * 0.012, (Math.random() * 2 - 1) * (BRAN_Z - 0.01));
    dummy.rotation.set(Math.random() * 3, Math.random() * 6, Math.random());
    dummy.scale.set(1, 0.4 + Math.random() * 0.45, 0.5 + Math.random() * 0.7); dummy.updateMatrix();
    grains.setMatrixAt(i, dummy.matrix); grains.setColorAt(i, tint.setHSL(0.105, 0.23 + Math.random() * 0.2, 0.56 + Math.random() * 0.3));
  }
  world.add(grains);
  const shaftGeo = new THREE.CylinderGeometry(0.012, 0.011, 0.41, 10), headGeo = new THREE.CylinderGeometry(0.042, 0.038, 0.025, 16), tipGeo = new THREE.ConeGeometry(0.011, 0.075, 10);
  function makeNail(parent: THREE.Object3D) {
    const group = new THREE.Group(); parent.add(group);
    mesh(shaftGeo, iron, group).position.y = 0.245;
    mesh(headGeo, iron, group).position.y = 0.46;
    const tip = mesh(tipGeo, darkIron, group); tip.position.y = 0.0375; tip.rotation.z = Math.PI;
    return group;
  }
  world.add(camera);
  const hand = new THREE.Group(); camera.add(hand);
  const forearm = cylinder(0.069, 0.093, 0.4, sleeve, hand, 10);
  forearm.rotation.x = -0.65; forearm.position.set(0.01, -0.18, 0.06);
  box(0, 0, -0.055, 0.13, 0.095, 0.19, skin, hand);
  for (let i = 0; i < 3; i++) box(-0.036 + i * 0.038, -0.025, -0.155, 0.032, 0.065, 0.077, skin, hand);
  const thumb = box(-0.075, 0.004, -0.09, 0.05, 0.058, 0.1, skin, hand); thumb.rotation.y = -0.4;
  const held = makeNail(hand); held.scale.setScalar(0.6); held.position.set(-0.05, -0.095, -0.145); held.rotation.z = -0.13;
  hand.traverse(o => { if (o instanceof THREE.Mesh) { o.castShadow = false; o.receiveShadow = false; } });
  hand.visible = false;
  const markerMat = new THREE.MeshBasicMaterial({ color: "#fff3c1", transparent: true, opacity: 0.78, depthWrite: false });
  const marker = mesh(new THREE.RingGeometry(0.036, 0.042, 32), markerMat); marker.rotation.x = -Math.PI / 2; marker.castShadow = false; marker.visible = false;
  type Nail = { group: THREE.Group; halo: THREE.Mesh; haloMat: THREE.MeshBasicMaterial; particles: THREE.InstancedMesh; born: number; duration: number; tiltX: number; tiltZ: number; phase: number };
  const nails: Nail[] = [];
  const haloGeo = new THREE.RingGeometry(0.016, 0.04, 24); geometries.add(haloGeo);
  const scatterGeo = new THREE.IcosahedronGeometry(0.014, 0); geometries.add(scatterGeo);
  let player = { ...PLAYER_START }, active = false, started = false, time = 0, lastInsert = -10, frame = 0, disposed = false;
  let previousTime = performance.now(), lastState = -1, walkTime = 0, touchX = 0, touchY = 0;
  const keyStarted = new Map<string, number>(), keyRelease = new Map<string, number>();
  let touchMinimum = 0, touchRelease = Infinity;
  const keys = new Set<string>(), ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -BRAN_Y);
  const intersection = new THREE.Vector3(), center = new THREE.Vector2(0, 0);
  let target: THREE.Vector3 | null = null;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  function updateAim() {
    if (active) { camera.position.set(player.x, 1.68, player.z); camera.rotation.set(player.pitch, player.yaw, 0); }
    camera.updateMatrixWorld(); ray.setFromCamera(center, camera);
    const hit = ray.ray.intersectPlane(plane, intersection);
    target = active && hit && canPlaceNail(hit.x, hit.z, camera.position.distanceTo(hit)) ? intersection : null;
    if (target) {
      const obstruction = ray.intersectObjects(rims, false)[0];
      if (obstruction && obstruction.distance < camera.position.distanceTo(target) - 0.01) target = null;
    }
    marker.visible = !!target;
    if (target) marker.position.set(target.x, BRAN_Y + 0.022, target.z);
  }
  function getState(): NukaState {
    return { active, aimed: !!target, target: target ? { x: +target.x.toFixed(3), z: +target.z.toFixed(3) } : null, player: { ...player }, visibleNails: nails.filter(n => n.group.position.y + 0.47 > BRAN_Y).length, nails: nails.map(n => ({ x: +n.group.position.x.toFixed(3), z: +n.group.position.z.toFixed(3), depth: +(BRAN_Y - n.group.position.y).toFixed(3) })) };
  }
  function removeNail(n: Nail) { world.remove(n.group, n.halo, n.particles); n.haloMat.dispose(); materials.delete(n.haloMat); n.particles.dispose(); }
  function insert() {
    updateAim();
    if (!active || !target || time - lastInsert < 0.12) return false;
    lastInsert = time;
    const group = makeNail(world); group.position.copy(target); group.position.y -= 0.1;
    const haloMat = new THREE.MeshBasicMaterial({ color: "#826440", transparent: true, opacity: 0.4, depthWrite: false });
    const halo = mesh(haloGeo, haloMat); halo.rotation.x = -Math.PI / 2; halo.position.copy(target); halo.position.y += 0.018; halo.castShadow = false;
    const particles = new THREE.InstancedMesh(scatterGeo, branMat, 12); particles.position.copy(target); world.add(particles);
    nails.push({ group, halo, haloMat, particles, born: time, duration: 4.8 + Math.random() * 1.6, tiltX: (Math.random() - 0.5) * 0.34, tiltZ: (Math.random() - 0.5) * 0.34, phase: Math.random() * Math.PI * 2 });
    if (nails.length > 72) removeNail(nails.shift()!);
    onState(getState()); return true;
  }
  function resize() {
    const width = host.clientWidth, height = host.clientHeight;
    if (!width || !height) return;
    camera.aspect = width / height; camera.updateProjectionMatrix(); renderer.setSize(width, height, false);
  }
  const observer = new ResizeObserver(resize); observer.observe(host); resize();
  function tick(now: number) {
    if (disposed) return;
    const dt = Math.min((now - previousTime) / 1000, 0.04); previousTime = now;
    if (active) {
      time += dt;
      for (const [key, until] of keyRelease) if (time >= until) { keys.delete(key); keyRelease.delete(key); keyStarted.delete(key); }
      if (time >= touchRelease) { touchX = touchY = 0; touchRelease = Infinity; }
      let forward = Number(keys.has("KeyW")) - Number(keys.has("KeyS")) - touchY;
      let sideways = Number(keys.has("KeyD")) - Number(keys.has("KeyA")) + touchX;
      const magnitude = Math.hypot(forward, sideways);
      if (magnitude > 1) { forward /= magnitude; sideways /= magnitude; }
      const step = dt * 1.55;
      const next = movePlayer(player, (-Math.sin(player.yaw) * forward + Math.cos(player.yaw) * sideways) * step, (-Math.cos(player.yaw) * forward - Math.sin(player.yaw) * sideways) * step);
      const moved = Math.hypot(next.x - player.x, next.z - player.z); walkTime += moved * 7;
      Object.assign(player, next);
      player.yaw += (Number(keys.has("ArrowLeft")) - Number(keys.has("ArrowRight"))) * dt * 1.25;
      player.pitch = THREE.MathUtils.clamp(player.pitch + (Number(keys.has("ArrowUp")) - Number(keys.has("ArrowDown"))) * dt, -1.35, 1.25);
      camera.position.set(player.x, 1.68, player.z); camera.rotation.set(player.pitch, player.yaw, 0);
      const thrust = Math.max(0, Math.sin(Math.min(1, (time - lastInsert) / 0.42) * Math.PI));
      hand.position.set((0.3 - thrust * 0.18) * Math.min(1, camera.aspect), -0.23 - thrust * 0.03 + (reducedMotion ? 0 : Math.sin(walkTime) * Math.min(moved * 0.5, 0.008)), -0.43 - thrust * 0.25);
      hand.rotation.set(-0.2 - thrust * 0.5, -0.18, -0.12);
      held.visible = time - lastInsert > 0.26;
      for (let i = nails.length - 1; i >= 0; i--) {
        const n = nails[i], age = time - n.born, progress = Math.min(1, age / n.duration);
        n.group.position.y = BRAN_Y - nailDepth(age, n.duration);
        const settle = 1 - Math.exp(-age * 1.7), wobble = Math.sin(age * 3.1 + n.phase) * Math.exp(-age * 0.45) * 0.025;
        n.group.rotation.set(n.tiltX * settle + wobble, 0, n.tiltZ * settle + wobble * 0.7);
        n.halo.scale.setScalar(1 + Math.sin(progress * Math.PI) * 2.1);
        n.haloMat.opacity = Math.sin(progress * Math.PI) * 0.28 + Math.max(0, 1 - age * 2) * 0.2;
        for (let j = 0; j < 12; j++) {
          const angle = j * 2.4 + n.phase, radius = 0.025 + Math.min(age, 0.8) * (0.07 + (j % 3) * 0.025);
          dummy.position.set(Math.cos(angle) * radius, Math.max(-0.015, age * (0.25 + (j % 4) * 0.06) - age * age * 0.9), Math.sin(angle) * radius);
          dummy.scale.setScalar(Math.max(0.001, 1 - age / 1.1)); dummy.rotation.set(age * 4, angle, age * 2); dummy.updateMatrix(); n.particles.setMatrixAt(j, dummy.matrix);
        }
        n.particles.instanceMatrix.needsUpdate = true;
        if (age > n.duration + 0.25) { removeNail(n); nails.splice(i, 1); }
      }
    } else if (!started) {
      camera.position.set(2.75, 2.45, 3.6); camera.lookAt(0, 0.83, -0.05);
    }
    updateAim();
    if (now - lastState > 100) { onState(getState()); lastState = now; }
    renderer.render(world, camera); frame = requestAnimationFrame(tick);
  }
  frame = requestAnimationFrame(tick);
  return {
    setActive(value) { active = value; if (active) started = true; hand.visible = started; keys.clear(); keyStarted.clear(); keyRelease.clear(); touchX = touchY = 0; updateAim(); onState(getState()); },
    setKey(code, pressed) {
      if (pressed && active) { if (!keys.has(code)) keyStarted.set(code, time); keys.add(code); keyRelease.delete(code); }
      else if (keys.has(code)) keyRelease.set(code, Math.max(time, (keyStarted.get(code) ?? time) + 0.075));
    },
    setTouchMove(x, y) {
      if (x || y) { touchX = x; touchY = y; touchMinimum = time + 0.075; touchRelease = Infinity; }
      else touchRelease = Math.max(time, touchMinimum);
    },
    look(dx, dy) { if (!active) return; player.yaw -= dx * 0.0027; player.pitch = THREE.MathUtils.clamp(player.pitch - dy * 0.0027, -1.35, 1.25); },
    insert,
    resetPlayer() { player = { ...PLAYER_START }; keys.clear(); keyStarted.clear(); keyRelease.clear(); touchX = touchY = 0; },
    getState,
    dispose() { disposed = true; cancelAnimationFrame(frame); observer.disconnect(); geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose()); grains.dispose(); nails.forEach(n => n.particles.dispose()); renderer.dispose(); renderer.domElement.remove(); },
  };
}
