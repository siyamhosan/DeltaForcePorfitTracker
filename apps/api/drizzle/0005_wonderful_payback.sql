ALTER TABLE "raids" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "raids" CASCADE;--> statement-breakpoint
ALTER TABLE "stash_snapshots" DROP CONSTRAINT "stash_snapshots_raid_id_raids_id_fk";
--> statement-breakpoint
ALTER TABLE "stash_snapshots" DROP COLUMN "raid_id";--> statement-breakpoint
DROP TYPE "public"."raid_mode";