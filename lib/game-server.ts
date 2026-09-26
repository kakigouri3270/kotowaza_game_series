import { env } from "cloudflare:workers";
export function database() {
  if (!env.DB) throw new Error("Score storage unavailable");
  return env.DB;
}
export function clientId(request: Request) {
  const value = /(?:^|;\s*)nuka_player=([a-f0-9-]{36})(?:;|$)/.exec(request.headers.get("cookie") || "")?.[1];
  return value || null;
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}
export function json(data: unknown, status = 200, extra: Record<string, string> = {}) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store", ...extra } });
}
export function unavailable(error: unknown) {
  console.error("Nuka score service:", error);
  return json({ error: "記録サービスに接続できませんでした。少し待って再試行してください。" }, 503);
}
