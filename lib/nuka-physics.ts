export const BRAN_Y = 0.99;
export const BRAN_X = 1.29;
export const BRAN_Z = 0.79;
export const REACH = 2.5;
export const PLAYER_START = { x: 0, z: 2.3, yaw: 0, pitch: -0.34 };
export type Position = { x: number; z: number };
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

// Axis-by-axis collision lets the player slide along the table and walls.
export function movePlayer(position: Position, dx: number, dz: number): Position {
  let { x, z } = position;
  const blocked = (a: number, b: number) => Math.abs(a) < 1.8 && Math.abs(b) < 1.29;
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.08));
  for (let i = 0; i < steps; i++) {
    const nx = clamp(x + dx / steps, -3.65, 3.65);
    if (!blocked(nx, z)) x = nx;
    const nz = clamp(z + dz / steps, -3.65, 3.65);
    if (!blocked(x, nz)) z = nz;
  }
  return { x, z };
}
export function canPlaceNail(x: number, z: number, distance: number) {
  return Number.isFinite(x + z + distance) && Math.abs(x) < BRAN_X - 0.04 && Math.abs(z) < BRAN_Z - 0.04 && distance >= 0 && distance <= REACH;
}
// Quick initial give, then a viscous slide, finally swallowing the head.
export function nailDepth(age: number, duration: number) {
  const t = clamp(age / duration, 0, 1);
  return 0.1 + 0.54 * (0.2 * (1 - Math.exp(-t * 18)) + 0.8 * t * t * (3 - 2 * t));
}
