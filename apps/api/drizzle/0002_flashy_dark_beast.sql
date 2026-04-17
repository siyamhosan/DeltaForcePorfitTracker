CREATE TYPE "public"."session_status" AS ENUM('active', 'ended');--> statement-breakpoint
CREATE TABLE "gameplay_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" integer NOT NULL,
	"status" "session_status" DEFAULT 'active' NOT NULL,
	"initial_stash_value" integer NOT NULL,
	"current_stash_value" integer NOT NULL,
	"final_stash_value" integer,
	"total_profit" integer DEFAULT 0 NOT NULL,
	"total_raids" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_activity_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "raids" ADD COLUMN "session_id" uuid;--> statement-breakpoint
ALTER TABLE "stash_snapshots" ADD COLUMN "session_id" uuid;--> statement-breakpoint
ALTER TABLE "gameplay_sessions" ADD CONSTRAINT "gameplay_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stash_snapshots" ADD CONSTRAINT "stash_snapshots_session_id_gameplay_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."gameplay_sessions"("id") ON DELETE set null ON UPDATE no action;