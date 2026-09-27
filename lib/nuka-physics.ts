export const BRAN_Y = 0.99;
export const BRAN_X = 1.29;
export const BRAN_Z = 0.79;
export const REACH = 2.5;
export const PLAYER_START = { x: 0, z: 2.3, yaw: 0, pitch: -0.34 };
export const ROOM = { x: 9.65, z: 8.65 };
export const STATIONS = [
  { id: "standard", name: "いつもの糠", number: "01", x: 0, z: 0, duration: 5.6, tone: 1, color: "#e2cea5", accent: "#e6c58e", description: "ゆっくり、ぬるっと。" },
  { id: "silky", name: "さらさら糠", number: "02", x: -5.2, z: -4.4, duration: 2.8, tone: 1.55, color: "#eadcc2", accent: "#a9dbd6", description: "すうっと、ひと息で。" },
  { id: "sticky", name: "ねばねば糠", number: "03", x: 5.2, z: -4.4, duration: 10, tone: 0.65, color: "#bca078", accent: "#e9ad82", description: "ねばって、じわじわ。" },
] as const;
export type StationId = typeof STATIONS[number]["id"];
export type Progress = { total: number; byStation: Record<StationId, number> };
export const newProgress = (): Progress => ({ total: 0, byStation: { standard: 0, silky: 0, sticky: 0 } });
export function recordNail(progress: Progress, station: StationId): Progress {
  return { total: progress.total + 1, byStation: { ...progress.byStation, [station]: progress.byStation[station] + 1 } };
}
export function stationAt(x: number, z: number) {
  return STATIONS.find(s => Math.abs(x - s.x) < BRAN_X - 0.04 && Math.abs(z - s.z) < BRAN_Z - 0.04);
}
export type Position = { x: number; z: number };
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

export type JumpState = { height: number; velocity: number; grounded: boolean };
export const newJumpState = (): JumpState => ({ height: 0, velocity: 0, grounded: true });
const JUMP_SPEED = 4.5;
const GRAVITY = 15;

export function startJump(state: JumpState): JumpState {
  return state.grounded ? { height: 0, velocity: JUMP_SPEED, grounded: false } : state;
}

export function stepJump(state: JumpState, dt: number): JumpState {
  if (state.grounded || dt <= 0) return state;
  // Integrate the ballistic arc exactly so the height is independent of FPS.
  const height = state.height + state.velocity * dt - 0.5 * GRAVITY * dt * dt;
  const velocity = state.velocity - GRAVITY * dt;
  return height <= 0 && velocity <= 0 ? newJumpState() : { height, velocity, grounded: false };
}

// Axis-by-axis collision lets the player slide along the table and walls.
export function movePlayer(position: Position, dx: number, dz: number): Position {
  let { x, z } = position;
  const blocked = (a: number, b: number) => STATIONS.some(s => Math.abs(a - s.x) < 1.8 && Math.abs(b - s.z) < 1.29);
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.08));
  for (let i = 0; i < steps; i++) {
    const nx = clamp(x + dx / steps, -ROOM.x, ROOM.x);
    if (!blocked(nx, z)) x = nx;
    const nz = clamp(z + dz / steps, -ROOM.z, ROOM.z);
    if (!blocked(x, nz)) z = nz;
  }
  return { x, z };
}
export function canPlaceNail(x: number, z: number, distance: number) {
  return Number.isFinite(x + z + distance) && !!stationAt(x, z) && distance >= 0 && distance <= REACH;
}
// Quick initial give, then a viscous slide, finally swallowing the head.
export function nailDepth(age: number, duration: number) {
  const t = clamp(age / duration, 0, 1);
  return 0.1 + 0.54 * (0.2 * (1 - Math.exp(-t * 18)) + 0.8 * t * t * (3 - 2 * t));
}
