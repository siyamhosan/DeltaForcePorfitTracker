ALTER TABLE "gameplay_sessions" ALTER COLUMN "initial_stash_value" SET DATA TYPE numeric(6, 1);--> statement-breakpoint
ALTER TABLE "gameplay_sessions" ALTER COLUMN "current_stash_value" SET DATA TYPE numeric(6, 1);--> statement-breakpoint
ALTER TABLE "gameplay_sessions" ALTER COLUMN "final_stash_value" SET DATA TYPE numeric(6, 1);--> statement-breakpoint
ALTER TABLE "gameplay_sessions" ALTER COLUMN "total_profit" SET DATA TYPE numeric(7, 1);--> statement-breakpoint
ALTER TABLE "gameplay_sessions" ALTER COLUMN "total_profit" SET DEFAULT '0';--> statement-breakpoint
ALTER TABLE "leaderboard_entries" ALTER COLUMN "total_profit" SET DATA TYPE numeric(10, 1);--> statement-breakpoint
ALTER TABLE "leaderboard_entries" ALTER COLUMN "total_profit" SET DEFAULT '0';--> statement-breakpoint
ALTER TABLE "manual_upload_jobs" ALTER COLUMN "parsed_stash_value" SET DATA TYPE numeric(6, 1);--> statement-breakpoint
ALTER TABLE "manual_upload_jobs" ALTER COLUMN "confirmed_stash_value" SET DATA TYPE numeric(6, 1);--> statement-breakpoint
ALTER TABLE "raids" ALTER COLUMN "loadout_cost" SET DATA TYPE numeric(6, 1);--> statement-breakpoint
ALTER TABLE "raids" ALTER COLUMN "loadout_cost" SET DEFAULT '0';--> statement-breakpoint
ALTER TABLE "raids" ALTER COLUMN "consumables_cost" SET DATA TYPE numeric(6, 1);--> statement-breakpoint
ALTER TABLE "raids" ALTER COLUMN "consumables_cost" SET DEFAULT '0';--> statement-breakpoint
ALTER TABLE "raids" ALTER COLUMN "insurance_cost" SET DATA TYPE numeric(6, 1);--> statement-breakpoint
ALTER TABLE "raids" ALTER COLUMN "insurance_cost" SET DEFAULT '0';--> statement-breakpoint
ALTER TABLE "stash_snapshots" ALTER COLUMN "stash_value" SET DATA TYPE numeric(6, 1);