import * as THREE from "three";
import type { Grade } from "./scoring";
export type NukaScene = { hit: (grade: Grade) => void; setPhase: (phase: number) => void; dispose: () => void };

export function createNukaScene(host: HTMLElement): NukaScene {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.45;
  renderer.domElement.setAttribute("aria-label", "木箱の糠に立つ釘と金槌"); host.appendChild(renderer.domElement);
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x192123); scene.fog = new THREE.Fog(0x192123, 18, 42);
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  const aim = new THREE.Vector3(0, 0.8, 0);
  scene.add(new THREE.HemisphereLight(0xffe6bd, 0x667f8c, 2));
  const sun = new THREE.DirectionalLight(0xffd49a, 4.2); sun.position.set(-3, 8, 4); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7 });
  sun.shadow.normalBias = 0.025; sun.shadow.bias = -0.0003; scene.add(sun);
  const rim = new THREE.DirectionalLight(0x9dc6e3, 2.4); rim.position.set(4, 4, -5); scene.add(rim);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(150, 150), new THREE.MeshStandardMaterial({ color: 0x192123, roughness: 0.94 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -0.08; floor.receiveShadow = true; scene.add(floor);
  function texture(wood: boolean) {
    const canvas = document.createElement("canvas"); canvas.width = canvas.height = 512;
    const ctx = canvas.getContext("2d")!; ctx.fillStyle = wood ? "#9b693a" : "#b88d4e"; ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < (wood ? 500 : 40000); i++) {
      const x = Math.random() * 512, y = Math.random() * 512;
      if (wood) { ctx.strokeStyle = `rgba(${Math.random() > 0.5 ? "50,22,8" : "245,200,135"},${Math.random() * 0.14})`; ctx.lineWidth = Math.random() * 2 + 0.3; ctx.beginPath(); ctx.moveTo(0, y); ctx.bezierCurveTo(140, y + Math.sin(y) * 10, 340, y - 8, 512, y + 3); ctx.stroke(); }
      else { const bright = Math.random() * 65 + 125; ctx.fillStyle = `rgb(${bright + 36},${bright},${bright * 0.55})`; ctx.fillRect(x, y, Math.random() * 2 + 0.5, Math.random() * 1.5 + 0.5); }
    }
    const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace; map.wrapS = map.wrapT = THREE.RepeatWrapping; map.repeat.set(wood ? 2 : 3, wood ? 1 : 3); return map;
  }
  const woodMap = texture(true), branMap = texture(false);
  const wood = new THREE.MeshStandardMaterial({ color: 0xcd9861, map: woodMap, roughness: 0.83 });
  const darkWood = new THREE.MeshStandardMaterial({ color: 0x72502f, map: woodMap, roughness: 0.9 });
  const steel = new THREE.MeshStandardMaterial({ color: 0xa8bcc2, metalness: 0.87, roughness: 0.24 });
  const iron = new THREE.MeshStandardMaterial({ color: 0x434b4a, metalness: 0.72, roughness: 0.42 });
  const bran = new THREE.MeshStandardMaterial({ color: 0xe8bc72, map: branMap, roughness: 1, bumpMap: branMap, bumpScale: 0.06 });
  const world = new THREE.Group(); scene.add(world);
  function box(w: number, h: number, d: number, x: number, y: number, z: number, material: THREE.Material, parent: THREE.Object3D = world) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material); mesh.position.set(x, y, z); mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh;
  }
  box(5.3, 0.17, 3.7, 0, 0.12, 0, darkWood);
  box(5.5, 1.05, 0.19, 0, 0.64, 1.83, wood); box(5.5, 1.05, 0.19, 0, 0.64, -1.83, wood);
  box(0.2, 1.05, 3.5, 2.65, 0.64, 0, wood); box(0.2, 1.05, 3.5, -2.65, 0.64, 0, wood);
  for (const x of [-2.63, 2.63]) {
    box(0.24, 1.11, 0.025, x, 0.66, 1.935, iron); box(0.24, 1.11, 0.025, x, 0.66, -1.935, iron);
    for (const y of [0.28, 0.98]) { const bolt = new THREE.Mesh(new THREE.SphereGeometry(0.036, 8, 6), steel); bolt.position.set(x, y, 1.956); world.add(bolt); }
  }
  const soilGeometry = new THREE.PlaneGeometry(5.1, 3.47, 64, 44); soilGeometry.rotateX(-Math.PI / 2);
  const pos = soilGeometry.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setY(i, 0.86 + Math.sin(pos.getX(i) * 4) * Math.cos(pos.getZ(i) * 5) * 0.025 + Math.random() * 0.025);
  soilGeometry.computeVertexNormals(); const soil = new THREE.Mesh(soilGeometry, bran); soil.receiveShadow = true; world.add(soil);
  const helper = new THREE.Object3D();
  const specks = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.03, 0), new THREE.MeshStandardMaterial({ color: 0xd5ad70, roughness: 1 }), 2300);
  for (let i = 0; i < specks.count; i++) {
    helper.position.set((Math.random() - 0.5) * 5.08, 0.89 + Math.random() * 0.035, (Math.random() - 0.5) * 3.43);
    helper.scale.set(0.3 + Math.random(), 0.25 + Math.random() * 0.4, 0.5 + Math.random()); helper.rotation.set(Math.random(), Math.random() * 6, Math.random()); helper.updateMatrix(); specks.setMatrixAt(i, helper.matrix);
    specks.setColorAt(i, new THREE.Color().setHSL(0.095 + Math.random() * 0.03, 0.37, 0.35 + Math.random() * 0.27));
  }
  specks.instanceMatrix.needsUpdate = true; specks.receiveShadow = true; world.add(specks);
  const labelCanvas = document.createElement("canvas"); labelCanvas.width = 512; labelCanvas.height = 128;
  const ctx = labelCanvas.getContext("2d")!; ctx.fillStyle = "#ead7b0"; ctx.fillRect(0, 0, 512, 128); ctx.fillStyle = "#4a392a"; ctx.font = "bold 38px serif"; ctx.textAlign = "center"; ctx.fillText("糠 に 釘", 256, 65); ctx.font = "16px monospace"; ctx.fillText("KOTOWAZA  /  No.001", 256, 102);
  const labelMap = new THREE.CanvasTexture(labelCanvas); labelMap.colorSpace = THREE.SRGBColorSpace;
  const label = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.45), new THREE.MeshStandardMaterial({ map: labelMap, roughness: 0.9 })); label.position.set(-0.2, 0.63, 1.935); world.add(label);
  const shaftGeometry = new THREE.CylinderGeometry(0.035, 0.025, 0.7, 10), headGeometry = new THREE.CylinderGeometry(0.09, 0.09, 0.045, 16);
  function nail(x: number, z: number) {
    const group = new THREE.Group(); const shaft = new THREE.Mesh(shaftGeometry, steel); shaft.position.y = 0.35; shaft.castShadow = true; group.add(shaft);
    const head = new THREE.Mesh(headGeometry, steel); head.position.y = 0.70; head.castShadow = true; group.add(head); group.position.set(x, 0.79, z); world.add(group); return group;
  }
  const nails: { mesh: THREE.Group; born: number; tilt: number }[] = [];
  const target = new THREE.Vector3(0.12, 0.79, 0.1); let activeNail = nail(target.x, target.z);
  const ringMaterial = new THREE.MeshBasicMaterial({ color: 0xf7c879, transparent: true, opacity: 0.65, depthWrite: false });
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.18, 0.195, 64), ringMaterial); ring.rotation.x = -Math.PI / 2; ring.position.set(target.x, 0.97, target.z); world.add(ring);
  const approaching = new THREE.Mesh(new THREE.RingGeometry(0.18, 0.19, 64), ringMaterial.clone()); approaching.rotation.x = -Math.PI / 2; approaching.position.copy(ring.position); world.add(approaching);
  const hammer = new THREE.Group(); world.add(hammer);
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.09, 1.2, 14), wood); handle.position.set(0, -0.22, 0); handle.castShadow = true; hammer.add(handle);
  box(0.68, 0.30, 0.29, 0, 0.44, 0, iron, hammer).rotation.z = -0.1; box(0.07, 0.29, 0.28, -0.34, 0.46, 0, steel, hammer);
  hammer.position.set(target.x + 0.55, 2.55, target.z);
  const particles = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.029, 0), new THREE.MeshStandardMaterial({ color: 0xeac784, roughness: 1 }), 90); particles.instanceMatrix.setUsage(THREE.DynamicDrawUsage); particles.frustumCulled = false; world.add(particles);
  const dust = Array.from({ length: 90 }, () => ({ pos: new THREE.Vector3(), velocity: new THREE.Vector3(), life: 0 }));
  let phase = 0, impactAt = -1000, lastTime = performance.now(), frame = 0, disposed = false, strength = 0, hammerX = target.x, hammerZ = target.z;
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const resize = () => {
    const { width, height } = host.getBoundingClientRect(); if (!width || !height) return;
    renderer.setSize(width, height); camera.aspect = width / height;
    const distance = camera.aspect < 0.85 ? 1.3 : camera.aspect < 1.2 ? 1.05 : 0.84;
    camera.position.set(7.5 * distance, 8.5 * distance, 10.7 * distance); camera.lookAt(aim); camera.updateProjectionMatrix();
  };
  const observer = new ResizeObserver(resize); observer.observe(host); resize();
  function animate(time: number) {
    if (disposed) return;
    const dt = Math.min((time - lastTime) / 1000, 0.05); lastTime = time; const elapsed = (time - impactAt) / 1000;
    if (elapsed < 0.38) {
      const swing = elapsed < 0.075 ? elapsed / 0.075 : Math.max(0, 1 - (elapsed - 0.075) / 0.30);
      hammer.position.set(hammerX + 0.25, 2.55 - Math.sin(swing * Math.PI / 2) * 1.35, hammerZ); hammer.rotation.z = -0.5 + swing * 0.9;
    } else { hammer.position.lerp(new THREE.Vector3(target.x + 0.55, 2.55 + Math.sin(time * 0.002) * 0.05, target.z), 0.14); hammer.rotation.z += (-0.5 - hammer.rotation.z) * 0.12; }
    nails.forEach(({ mesh, born, tilt }) => { const age = Math.max(0, (time - born) / 1000); mesh.position.y = 0.79 - Math.min(age * 1.8, 0.66); mesh.rotation.z = Math.sin(Math.min(age * 4, 1) * Math.PI / 2) * tilt; });
    const distance = Math.abs(phase - 0.5); approaching.scale.setScalar(1 + distance * 4.5); (approaching.material as THREE.MeshBasicMaterial).opacity = 0.12 + (1 - distance * 2) * 0.6; ringMaterial.color.setHex(distance < 0.07 ? 0xffedb0 : 0xdab16f);
    for (let i = 0; i < dust.length; i++) {
      const p = dust[i]; p.life -= dt;
      if (p.life > 0) { p.velocity.y -= 6 * dt; p.pos.addScaledVector(p.velocity, dt); helper.position.copy(p.pos); helper.scale.setScalar(Math.min(p.life * 3, 1)); helper.rotation.set(time * 0.003 + i, i, time * 0.001); } else helper.scale.setScalar(0);
      helper.updateMatrix(); particles.setMatrixAt(i, helper.matrix);
    }
    particles.instanceMatrix.needsUpdate = true;
    world.position.y = !reducedMotion && elapsed < 0.22 ? Math.sin(elapsed * 95) * Math.exp(-elapsed * 22) * strength : 0;
    renderer.render(scene, camera); frame = requestAnimationFrame(animate);
  }
  frame = requestAnimationFrame(animate);
  return {
    setPhase(value) { phase = value; },
    hit(grade) {
      const now = performance.now(); if (now - impactAt < 130) return;
      impactAt = now; strength = grade === "perfect" ? 0.06 : 0.025; hammerX = target.x; hammerZ = target.z;
      nails.push({ mesh: activeNail, born: now + 45, tilt: (Math.random() - 0.5) * 0.45 }); if (nails.length > 110) world.remove(nails.shift()!.mesh);
      const amount = grade === "perfect" ? 65 : grade === "good" ? 35 : 18;
      for (let i = 0; i < amount; i++) { const p = dust[i]; p.pos.set(target.x, 0.94, target.z); p.velocity.set((Math.random() - 0.5) * 2.8, 1 + Math.random() * 2, (Math.random() - 0.5) * 2.8); p.life = 0.4 + Math.random() * 0.5; }
      target.set((Math.random() - 0.5) * 3.2, 0.79, (Math.random() - 0.5) * 1.9); activeNail = nail(target.x, target.z); ring.position.set(target.x, 0.97, target.z); approaching.position.copy(ring.position);
    },
    dispose() {
      disposed = true; cancelAnimationFrame(frame); observer.disconnect(); const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
      scene.traverse(object => { if (object instanceof THREE.Mesh) { geometries.add(object.geometry); (Array.isArray(object.material) ? object.material : [object.material]).forEach(m => materials.add(m)); } });
      geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); woodMap.dispose(); branMap.dispose(); labelMap.dispose(); renderer.dispose(); renderer.domElement.remove();
    }
  };
}
