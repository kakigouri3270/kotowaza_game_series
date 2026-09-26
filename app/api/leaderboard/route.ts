import { database, json, unavailable } from "@/lib/game-server";
export async function GET() {
  try {
    const { results } = await database().prepare("SELECT name, score, max_combo AS maxCombo, perfect, hits, created_at AS createdAt FROM scores ORDER BY score DESC, created_at ASC LIMIT 20").all();
    return json({ entries: results });
  } catch (error) { return unavailable(error); }
}
