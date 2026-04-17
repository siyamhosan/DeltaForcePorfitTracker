CREATE TYPE "public"."raid_mode" AS ENUM('operations', 'warfare');--> statement-breakpoint
CREATE TYPE "public"."upload_job_status" AS ENUM('queued', 'processed', 'confirmed', 'rejected', 'failed');--> statement-breakpoint
CREATE TABLE "extracted_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"raid_id" uuid NOT NULL,
	"item_name" varchar(255) NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"market_value" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leaderboard_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"period" varchar(24) DEFAULT 'all_time' NOT NULL,
	"total_profit" integer DEFAULT 0 NOT NULL,
	"total_raids" integer DEFAULT 0 NOT NULL,
	"total_extractions" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "manual_upload_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" integer NOT NULL,
	"status" "upload_job_status" DEFAULT 'queued' NOT NULL,
	"raw_image_path" text NOT NULL,
	"parsed_stash_value" integer,
	"confidence" numeric(5, 4),
	"confirmed_stash_value" integer,
	"parse_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "raids" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" integer NOT NULL,
	"mode" "raid_mode" DEFAULT 'operations' NOT NULL,
	"extracted" boolean DEFAULT false NOT NULL,
	"loadout_cost" integer DEFAULT 0 NOT NULL,
	"consumables_cost" integer DEFAULT 0 NOT NULL,
	"insurance_cost" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stash_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" integer NOT NULL,
	"raid_id" uuid,
	"upload_job_id" uuid,
	"stash_value" integer NOT NULL,
	"confidence" numeric(5, 4),
	"source" varchar(32) DEFAULT 'manual_upload' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"clerk_user_id" varchar(255) NOT NULL,
	"display_name" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "extracted_items" ADD CONSTRAINT "extracted_items_raid_id_raids_id_fk" FOREIGN KEY ("raid_id") REFERENCES "public"."raids"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leaderboard_entries" ADD CONSTRAINT "leaderboard_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manual_upload_jobs" ADD CONSTRAINT "manual_upload_jobs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raids" ADD CONSTRAINT "raids_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stash_snapshots" ADD CONSTRAINT "stash_snapshots_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stash_snapshots" ADD CONSTRAINT "stash_snapshots_raid_id_raids_id_fk" FOREIGN KEY ("raid_id") REFERENCES "public"."raids"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stash_snapshots" ADD CONSTRAINT "stash_snapshots_upload_job_id_manual_upload_jobs_id_fk" FOREIGN KEY ("upload_job_id") REFERENCES "public"."manual_upload_jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "leaderboard_period_user_idx" ON "leaderboard_entries" USING btree ("period","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_clerk_user_id_idx" ON "users" USING btree ("clerk_user_id");