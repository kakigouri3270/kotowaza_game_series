import { z } from "zod";
import { database, clientId, sameOrigin, json, unavailable } from "@/lib/game-server";
import { scoreRun, DURATION } from "@/lib/scoring";
const submission = z.object({
  sessionId: z.string().uuid(),
  name: z.string().trim().min(1).max(16).refine(value => !/[\u0000-\u001f\u007f-\u009f]/.test(value)),
  events: z.array(z.object({ t: z.number().finite().min(0).lt(DURATION) }).strict()).min(1).max(470),
}).strict();
export async function POST(request: Request) {
  if (!sameOrigin(request)) return json({ error: "この画面から記録してください。" }, 403);
  try {
    const raw = await request.text();
    if (raw.length > 24000) return json({ error: "記録が大きすぎます。" }, 413);
    let body: unknown;
    try { body = JSON.parse(raw); } catch { return json({ error: "記録の形式が正しくありません。" }, 400); }
    const parsed = submission.safeParse(body);
    if (!parsed.success) return json({ error: "名前は1〜16文字で入力してください。記録の形式も確認してください。" }, 400);
    const { sessionId, name, events } = parsed.data;
    if (events.some((event, i) => i > 0 && event.t - events[i - 1].t < 125)) return json({ error: "打撃の間隔が正しくありません。" }, 400);
    const db = database(), player = clientId(request);
    const run = await db.prepare("SELECT client_id, created_at FROM runs WHERE id = ?").bind(sessionId).first<{ client_id: string; created_at: number }>();
    if (!run || run.client_id !== player) return json({ error: "このプレイの記録を確認できません。もう一度始めてください。" }, 403);
    const age = Date.now() - run.created_at;
    if (age < DURATION - 500) return json({ error: "60秒のプレイを終えてから記録できます。" }, 409);
    if (age > 86_400_000) return json({ error: "記録の受付時間が過ぎました。もう一度遊んでください。" }, 410);
    const summary = scoreRun(events), now = Date.now();
    await db.prepare("INSERT INTO scores (run_id, name, score, max_combo, perfect, hits, created_at) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(run_id) DO NOTHING").bind(sessionId, name, summary.score, summary.maxCombo, summary.perfect, summary.hits, now).run();
    const saved = await db.prepare("SELECT score, created_at FROM scores WHERE run_id = ?").bind(sessionId).first<{ score: number; created_at: number }>();
    if (!saved) throw new Error("Score insert did not persist");
    const ahead = await db.prepare("SELECT COUNT(*) AS n FROM scores WHERE score > ? OR (score = ? AND created_at < ?)").bind(saved.score, saved.score, saved.created_at).first<{ n: number }>();
    return json({ score: saved.score, rank: (ahead?.n || 0) + 1 });
  } catch (error) { return unavailable(error); }
}
