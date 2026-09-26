import { database, clientId, sameOrigin, json, unavailable } from "@/lib/game-server";
export async function POST(request: Request) {
  if (!sameOrigin(request)) return json({ error: "この画面から開始してください。" }, 403);
  try {
    const db = database(), player = clientId(request) || crypto.randomUUID(), now = Date.now();
    const recent = await db.prepare("SELECT COUNT(*) AS n FROM runs WHERE client_id = ? AND created_at > ?").bind(player, now - 60_000).first<{ n: number }>();
    if ((recent?.n || 0) >= 8) return json({ error: "少し待ってから、もう一度始めてください。" }, 429);
    const id = crypto.randomUUID();
    await db.prepare("INSERT INTO runs (id, client_id, created_at) VALUES (?, ?, ?)").bind(id, player, now).run();
    const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
    return json({ id, duration: 60000 }, 201, { "Set-Cookie": `nuka_player=${player}; HttpOnly; Path=/; SameSite=Lax; Max-Age=31536000${secure}` });
  } catch (error) { return unavailable(error); }
}
