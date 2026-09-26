import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
export const runs = sqliteTable("runs", {
  id: text("id").primaryKey(),
  clientId: text("client_id").notNull(),
  createdAt: integer("created_at").notNull(),
}, table => [index("idx_runs_client_created").on(table.clientId, table.createdAt)]);
export const scores = sqliteTable("scores", {
  runId: text("run_id").primaryKey().references(() => runs.id),
  name: text("name").notNull(),
  score: integer("score").notNull(),
  maxCombo: integer("max_combo").notNull(),
  perfect: integer("perfect").notNull(),
  hits: integer("hits").notNull(),
  createdAt: integer("created_at").notNull(),
}, table => [index("idx_scores_ranking").on(table.score, table.createdAt)]);
