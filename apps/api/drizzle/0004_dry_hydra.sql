CREATE TYPE "public"."api_key_type" AS ENUM('desktop', 'manual');--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" integer NOT NULL,
	"name" varchar(64) NOT NULL,
	"type" "api_key_type" DEFAULT 'manual' NOT NULL,
	"prefix" varchar(24) NOT NULL,
	"secret_hash" varchar(64) NOT NULL,
	"encrypted_secret" text,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP TABLE "extracted_items" CASCADE;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "api_keys_secret_hash_idx" ON "api_keys" USING btree ("secret_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "api_keys_prefix_idx" ON "api_keys" USING btree ("prefix");