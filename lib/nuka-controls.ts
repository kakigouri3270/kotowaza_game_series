export const SETTINGS_KEY = "nuka-settings-v1";
export type ControlSettings = { sensitivity: number; invertY: boolean; showMap: boolean };
export const defaultSettings = (): ControlSettings => ({ sensitivity: 1, invertY: false, showMap: true });
export function parseSettings(raw: string | null): ControlSettings {
  try {
    const value = JSON.parse(raw ?? "null");
    return {
      sensitivity: typeof value?.sensitivity === "number" && Number.isFinite(value.sensitivity) ? Math.min(3, Math.max(0.25, value.sensitivity)) : 1,
      invertY: value?.invertY === true,
      showMap: value?.showMap !== false,
    };
  } catch { return defaultSettings(); }
}
export function lookDelta(dx: number, dy: number, settings: ControlSettings) {
  return { x: dx * settings.sensitivity, y: dy * settings.sensitivity * (settings.invertY ? -1 : 1) };
}

type MouseLookOptions = {
  document: Document; surface: HTMLElement;
  look: (dx: number, dy: number) => void;
  pause: () => void;
  lockChanged: (locked: boolean) => void;
  unavailable: () => void;
};

// Pointer Lock is requested on every explicit start/resume. If an embedded
// browser refuses it, ordinary mouse movement still looks around without drag.
export class MouseLookController {
  private options: MouseLookOptions;
  private active = false;
  private locked = false;
  private generation = 0;
  private previous: { x: number; y: number } | null = null;
  private edge = { x: 0, y: 0 };
  private frame: number | null = null;
  private lastFrame: number | null = null;
  constructor(options: MouseLookOptions) {
    this.options = options;
    options.document.addEventListener("mousemove", this.mousemove);
    options.document.addEventListener("pointerlockchange", this.lockchange);
    options.document.addEventListener("pointerlockerror", this.lockerror);
    options.surface.addEventListener("mouseleave", this.leave);
  }
  private mousemove = (event: MouseEvent) => {
    if (!this.active) return;
    if (this.options.document.pointerLockElement === this.options.surface) {
      this.options.look(event.movementX, event.movementY);
      return;
    }
    if (!this.options.surface.contains(event.target as Node)) { this.leave(); return; }
    const previous = this.previous;
    this.previous = { x: event.clientX, y: event.clientY };
    if (previous) this.options.look(event.clientX - previous.x, event.clientY - previous.y);
    // An embedded browser may deny Pointer Lock. Edge turning still allows
    // complete rotations there, without dragging or running out of screen.
    const rect = this.options.surface.getBoundingClientRect();
    this.edge = { x: event.clientX <= rect.left + 16 ? -1 : event.clientX >= rect.right - 16 ? 1 : 0,
      y: event.clientY <= rect.top + 16 ? -1 : event.clientY >= rect.bottom - 16 ? 1 : 0 };
    if ((this.edge.x || this.edge.y) && this.frame === null) this.frame = this.options.document.defaultView?.requestAnimationFrame(this.turnAtEdge) ?? null;
  };
  private turnAtEdge = (now: number) => {
    this.frame = null;
    if (!this.active || this.locked || (!this.edge.x && !this.edge.y)) { this.lastFrame = null; return; }
    const dt = this.lastFrame === null ? 0 : Math.min((now - this.lastFrame) / 1000, 0.04);
    this.lastFrame = now;
    if (dt > 0) this.options.look(this.edge.x * dt * 600, this.edge.y * dt * 600);
    this.frame = this.options.document.defaultView?.requestAnimationFrame(this.turnAtEdge) ?? null;
  };
  private leave = () => {
    this.previous = null; this.edge = { x: 0, y: 0 }; this.lastFrame = null;
    if (this.frame !== null) this.options.document.defaultView?.cancelAnimationFrame(this.frame);
    this.frame = null;
  };
  private lockerror = () => { if (this.active && !this.locked) this.options.unavailable(); };
  private lockchange = () => {
    const locked = this.options.document.pointerLockElement === this.options.surface;
    const wasLocked = this.locked;
    this.locked = locked; this.leave();
    this.options.lockChanged(locked);
    if (locked && !this.active) this.options.document.exitPointerLock();
    else if (wasLocked && !locked && this.active) this.options.pause();
  };
  start(lockPointer = true) {
    this.active = true; this.leave();
    const generation = ++this.generation;
    if (!lockPointer) return;
    const fail = () => { if (this.active && this.generation === generation && !this.locked) this.options.unavailable(); };
    try {
      if (!this.options.surface.requestPointerLock) { fail(); return; }
      const result = this.options.surface.requestPointerLock();
      if (result) void result.catch(fail);
    } catch { fail(); }
  }
  stop() {
    this.active = false; this.generation++; this.leave();
    if (this.options.document.pointerLockElement === this.options.surface) this.options.document.exitPointerLock();
  }
  dispose() {
    this.stop();
    this.options.document.removeEventListener("mousemove", this.mousemove);
    this.options.document.removeEventListener("pointerlockchange", this.lockchange);
    this.options.document.removeEventListener("pointerlockerror", this.lockerror);
    this.options.surface.removeEventListener("mouseleave", this.leave);
  }
}
