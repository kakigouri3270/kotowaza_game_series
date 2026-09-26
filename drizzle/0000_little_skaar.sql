CREATE TABLE `runs` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_runs_client_created` ON `runs` (`client_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `scores` (
	`run_id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`score` integer NOT NULL,
	`max_combo` integer NOT NULL,
	`perfect` integer NOT NULL,
	`hits` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `runs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_scores_ranking` ON `scores` (`score`,`created_at`);