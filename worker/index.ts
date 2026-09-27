import { mergeProgress, parseProgress, validName } from "../lib/nuka-save.ts";

type Env = { LEADERBOARD: DurableObjectNamespace; ASSETS: Fetcher };
type PlayerRow = { id: string; name: string; standard: number; silky: number; sticky: number; total: number; created: number };
const json = (value: unknown, status = 200) => Response.json(value, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });

export class NukaLeaderboard {
  private sql: SqlStorage;
  private rates = new Map<string, { start: number; count: number }>();
  constructor(ctx: DurableObjectState) {
    this.sql = ctx.storage.sql;
    this.sql.exec(`CREATE TABLE IF NOT EXISTS players (
      token_hash TEXT PRIMARY KEY, id TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
      standard INTEGER NOT NULL DEFAULT 0, silky INTEGER NOT NULL DEFAULT 0, sticky INTEGER NOT NULL DEFAULT 0,
      total INTEGER NOT NULL DEFAULT 0, created INTEGER NOT NULL, achieved INTEGER NOT NULL
    ); CREATE INDEX IF NOT EXISTS top_players ON players(total DESC, achieved ASC, id ASC);`);
  }
  private limited(key: string, limit: number, now: number) {
    if (this.rates.size > 5000) for (const [k, v] of this.rates) if (now - v.start >= 60000) this.rates.delete(k);
    const previous = this.rates.get(key);
    const next = !previous || now - previous.start >= 60000 ? { start: now, count: 1 } : { ...previous, count: previous.count + 1 };
    this.rates.set(key, next);
    return next.count > limit;
  }
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const now = Date.now();
    const ip = request.headers.get("CF-Connecting-IP") ?? "local";
    if (this.limited("requests:" + ip, 120, now)) return json({ error: "しばらく待ってからお試しください。" }, 429);
    if (url.pathname === "/api/leaderboard" && request.method === "GET") {
      const entries = this.sql.exec<{ id: string; name: string; total: number }>("SELECT id, name, total FROM players WHERE total > 0 ORDER BY total DESC, achieved ASC, id ASC LIMIT 10").toArray();
      return json({ entries });
    }
    if (url.pathname !== "/api/progress" || request.method !== "POST") return json({ error: "Not found" }, 404);
    const token = request.headers.get("Authorization")?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
    if (!token) return json({ error: "保存用の識別情報が必要です。" }, 401);
    if (!request.headers.get("Content-Type")?.startsWith("application/json")) return json({ error: "JSON required" }, 415);
    if (Number(request.headers.get("Content-Length")) > 2048) return json({ error: "Too large" }, 413);
    let input: { progress?: unknown; name?: unknown };
    try {
      const text = await request.text();
      if (text.length > 2048) return json({ error: "Too large" }, 413);
      input = JSON.parse(text);
      if (!input || typeof input !== "object" || Array.isArray(input)) return json({ error: "Invalid body" }, 400);
    } catch { return json({ error: "Invalid JSON" }, 400); }
    const incoming = parseProgress(input.progress);
    if (!incoming || (input.name !== undefined && !validName(input.name))) return json({ error: "本数または表示名が不正です。" }, 400);
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token))), b => b.toString(16).padStart(2, "0")).join("");
    // No await between reading and writing: requests are serialized by the Durable Object.
    let row = this.sql.exec<PlayerRow>("SELECT id,name,standard,silky,sticky,total,created FROM players WHERE token_hash = ?", hash).toArray()[0];
    if (!row) {
      if (this.limited("new:" + ip, 8, now)) return json({ error: "しばらく待ってからお試しください。" }, 429);
      const id = crypto.randomUUID();
      this.sql.exec("INSERT INTO players(token_hash,id,name,created,achieved) VALUES(?,?,?,?,?)", hash, id, "糠の旅人 " + id.slice(0, 4), now, now);
      row = { id, name: "糠の旅人 " + id.slice(0, 4), standard: 0, silky: 0, sticky: 0, total: 0, created: now };
    }
    const stored = { total: row.total, byStation: { standard: row.standard, silky: row.silky, sticky: row.sticky } };
    const merged = mergeProgress(stored, incoming);
    if (!parseProgress(merged)) return json({ error: "本数の上限です。" }, 400);
    // The game allows one nail per 120 ms. Allow modest clock/network slack and
    // offline catch-up, but never accept an arbitrarily large fresh score.
    const plausible = merged.total <= Math.floor((now - row.created) / 1000 * 10) + 50;
    const progress = plausible ? merged : stored;
    const name = input.name === undefined ? row.name : input.name as string;
    if (progress.total !== row.total || name !== row.name) {
      this.sql.exec("UPDATE players SET name=?,standard=?,silky=?,sticky=?,total=?,achieved=CASE WHEN total < ? THEN ? ELSE achieved END WHERE token_hash=?",
        name, progress.byStation.standard, progress.byStation.silky, progress.byStation.sticky, progress.total, progress.total, now, hash);
    }
    return json({ id: row.id, name, progress, pending: !plausible });
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(request);
    const origin = request.headers.get("Origin");
    if ((origin && origin !== url.origin) || request.headers.get("Sec-Fetch-Site") === "cross-site") return json({ error: "Forbidden" }, 403);
    try { return await env.LEADERBOARD.get(env.LEADERBOARD.idFromName("nuka-lifetime-v1")).fetch(request); }
    catch { return json({ error: "ランキングを一時的に読み込めません。記録は端末に残っています。" }, 503); }
  },
};
