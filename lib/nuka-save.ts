import type { Progress, StationId } from "./nuka-physics";

export const SAVE_KEY = "nuka-save-v1";
const JOURNAL_PREFIX = "nuka-pending-v1:";
export const STATION_IDS = ["standard", "silky", "sticky"] as const;
export const MAX_TOTAL = 1_000_000_000;
export type SavedGame = { version: 1; token: string; id: string; name: string; progress: Progress; syncedTotal: number; applied?: string[] };
export type RankingEntry = { id: string; name: string; total: number };
export const emptyProgress = (): Progress => ({ total: 0, byStation: { standard: 0, silky: 0, sticky: 0 } });

export function parseProgress(value: unknown): Progress | null {
  if (!value || typeof value !== "object") return null;
  const p = value as Progress;
  if (!p.byStation || !STATION_IDS.every(id => Number.isSafeInteger(p.byStation[id]) && p.byStation[id] >= 0)) return null;
  const total = STATION_IDS.reduce((sum, id) => sum + p.byStation[id], 0);
  return Number.isSafeInteger(total) && total <= MAX_TOTAL && p.total === total ? {
    total, byStation: { standard: p.byStation.standard, silky: p.byStation.silky, sticky: p.byStation.sticky },
  } : null;
}
export function mergeProgress(a: Progress, b: Progress): Progress {
  const byStation = { standard: Math.max(a.byStation.standard, b.byStation.standard), silky: Math.max(a.byStation.silky, b.byStation.silky), sticky: Math.max(a.byStation.sticky, b.byStation.sticky) };
  return { total: byStation.standard + byStation.silky + byStation.sticky, byStation };
}
export function validName(value: unknown): value is string {
  return typeof value === "string" && value.trim() === value && value.length > 0 && Array.from(value).length <= 16 && !/[<>\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/u.test(value);
}
export function parseSave(raw: string | null): SavedGame | null {
  try {
    const s = JSON.parse(raw ?? "null") as SavedGame;
    const progress = s && parseProgress(s.progress);
    return s?.version === 1 && /^[a-f0-9]{64}$/.test(s.token) && typeof s.id === "string" && (s.name === "" || validName(s.name)) && progress
      ? { version: 1, token: s.token, id: s.id, name: s.name, progress, syncedTotal: Number.isSafeInteger(s.syncedTotal) ? Math.max(0, Math.min(s.syncedTotal, progress.total)) : 0, applied: Array.isArray(s.applied) ? s.applied.filter(k => typeof k === "string" && k.startsWith(JOURNAL_PREFIX)) : [] } : null;
  } catch { return null; }
}

// One browser identity; Web Locks serialize read/modify/write across its tabs.
export class NukaSave {
  current: SavedGame;
  persistent = true;
  private pending: Promise<unknown> = Promise.resolve();
  private syncing: Promise<boolean> | null = null;
  private syncedOnce = false;
  private nextAttempt = 0;
  private storage: Pick<Storage, "getItem" | "setItem" | "removeItem" | "key" | "length">;
  private notify: (save: SavedGame, status: string) => void;
  private withLock: <T>(fn: () => Promise<T>) => Promise<T>;
  private request: typeof fetch;
  constructor(storage: Pick<Storage, "getItem" | "setItem" | "removeItem" | "key" | "length">, notify: (save: SavedGame, status: string) => void,
    withLock: <T>(fn: () => Promise<T>) => Promise<T>, request: typeof fetch = (...args) => fetch(...args)) {
    this.storage = storage; this.notify = notify; this.withLock = withLock; this.request = request;
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    this.current = { version: 1, token: Array.from(bytes, n => n.toString(16).padStart(2, "0")).join(""), id: "", name: "", progress: emptyProgress(), syncedTotal: 0 };
  }
  private read() {
    if (!this.persistent) return;
    try {
      const raw = this.storage.getItem(SAVE_KEY);
      const saved = parseSave(raw);
      if (raw && !saved) throw new Error("invalid save");
      if (saved) this.current = saved;
    } catch { this.persistent = false; }
  }
  private write(status = "このブラウザーに保存済み") {
    try { if (this.persistent) this.storage.setItem(SAVE_KEY, JSON.stringify(this.current)); }
    catch { this.persistent = false; }
    this.notify(this.current, this.persistent ? status : "保存できません。ブラウザーの保存設定を確認してください。");
  }
  private update(fn: () => void) {
    const next = this.pending.then(() => this.withLock(async () => {
      this.read(); fn();
      const applied = new Set(this.current.applied ?? []), consumed: string[] = [];
      if (this.persistent) try {
        for (let i = 0; i < this.storage.length; i++) {
          const key = this.storage.key(i);
          if (!key?.startsWith(JOURNAL_PREFIX)) continue;
          let entry;
          try { entry = JSON.parse(this.storage.getItem(key) ?? "null"); } catch { continue; }
          if (entry?.token !== this.current.token || !STATION_IDS.includes(entry.station)) continue;
          if (!applied.has(key)) this.increment(entry.station);
          consumed.push(key);
        }
      } catch { this.persistent = false; }
      this.current = { ...this.current, applied: consumed };
      this.write();
      // Commit applied IDs before removing journal entries. A reload/crash at
      // either point can replay safely, without losing or duplicating a nail.
      if (this.persistent) for (const key of consumed) try { this.storage.removeItem(key); } catch {}
    }));
    this.pending = next.catch(() => {});
    return next;
  }
  async load() { await this.update(() => {}); }
  async refresh() { await this.update(() => {}); }
  private increment(station: StationId) {
    if (this.current.progress.total >= MAX_TOTAL) return;
    const p = this.current.progress;
    this.current = { ...this.current, progress: { total: p.total + 1, byStation: { ...p.byStation, [station]: p.byStation[station] + 1 } } };
  }
  async add(station: StationId) {
    // Persist synchronously before waiting for the cross-tab lock, including a
    // reload immediately after a click. Unique keys avoid competing tab writes.
    if (this.persistent) try {
      this.storage.setItem(JOURNAL_PREFIX + crypto.randomUUID(), JSON.stringify({ token: this.current.token, station }));
    } catch { this.persistent = false; }
    const inMemory = !this.persistent;
    await this.update(() => { if (inMemory) this.increment(station); });
  }
  async sync(name?: string): Promise<boolean> {
    if (this.syncing) { const result = await this.syncing; return name === undefined ? result : this.sync(name); }
    if (name === undefined && Date.now() < this.nextAttempt) return false;
    this.syncing = this.performSync(name).finally(() => { this.syncing = null; });
    return this.syncing;
  }
  private async performSync(name?: string): Promise<boolean> {
    await this.pending;
    if (!this.persistent) return false;
    const snapshot = this.current;
    if (name === undefined && this.syncedOnce && snapshot.syncedTotal === snapshot.progress.total) return true;
    try {
      const response = await this.request("/api/progress", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + snapshot.token },
        body: JSON.stringify({ progress: snapshot.progress, ...(name !== undefined ? { name } : {}) }), signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) throw new Error("sync failed");
      const body = await response.json() as { id: string; name: string; progress: Progress; pending: boolean };
      const confirmed = parseProgress(body.progress);
      if (!confirmed || typeof body.id !== "string" || !validName(body.name)) throw new Error("invalid response");
      await this.update(() => {
        if (this.current.token !== snapshot.token) return;
        this.current = { ...this.current, id: body.id, name: body.name, progress: mergeProgress(this.current.progress, confirmed), syncedTotal: Math.max(this.current.syncedTotal, confirmed.total) };
      });
      this.syncedOnce = true;
      this.nextAttempt = Date.now() + 3000;
      this.notify(this.current, body.pending ? "保存済み・ランキングの反映待ち" : "保存済み・ランキングに同期済み");
      return !body.pending;
    } catch {
      this.nextAttempt = Date.now() + 15000;
      this.notify(this.current, "端末に保存済み・通信が戻ると自動で同期します");
      return false;
    }
  }
}
