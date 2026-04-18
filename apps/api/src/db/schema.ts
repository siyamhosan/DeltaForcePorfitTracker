import {
  boolean,
  integer,
  numeric,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core"

export const uploadJobStatusEnum = pgEnum("upload_job_status", [
  "queued",
  "processed",
  "confirmed",
  "rejected",
  "failed",
])

export const raidModeEnum = pgEnum("raid_mode", ["operations", "warfare"])
export const sessionStatusEnum = pgEnum("session_status", ["active", "ended"])

export const usersTable = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    clerkUserId: varchar("clerk_user_id", { length: 255 }).notNull(),
    displayName: varchar("display_name", { length: 255 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("users_clerk_user_id_idx").on(table.clerkUserId)]
)

export const raidsTable = pgTable("raids", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: integer("user_id")
    .references(() => usersTable.id, { onDelete: "cascade" })
    .notNull(),
  mode: raidModeEnum("mode").notNull().default("operations"),
  extracted: boolean("extracted").notNull().default(false),
  loadoutCost: numeric("loadout_cost", { precision: 6, scale: 1 }).notNull().default("0"),
  consumablesCost: numeric("consumables_cost", { precision: 6, scale: 1 }).notNull().default("0"),
  insuranceCost: numeric("insurance_cost", { precision: 6, scale: 1 }).notNull().default("0"),
  sessionId: uuid("session_id"),
  startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
})

export const gameplaySessionsTable = pgTable("gameplay_sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: integer("user_id")
    .references(() => usersTable.id, { onDelete: "cascade" })
    .notNull(),
  status: sessionStatusEnum("status").notNull().default("active"),
  initialStashValue: numeric("initial_stash_value", { precision: 6, scale: 1 }).notNull(),
  currentStashValue: numeric("current_stash_value", { precision: 6, scale: 1 }).notNull(),
  finalStashValue: numeric("final_stash_value", { precision: 6, scale: 1 }),
  totalProfit: numeric("total_profit", { precision: 7, scale: 1 }).notNull().default("0"),
  totalRaids: integer("total_raids").notNull().default(0),
  startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
  lastActivityAt: timestamp("last_activity_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
})

export const manualUploadJobsTable = pgTable(
  "manual_upload_jobs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: integer("user_id")
      .references(() => usersTable.id, { onDelete: "cascade" })
      .notNull(),
    status: uploadJobStatusEnum("status").notNull().default("queued"),
    rawImagePath: text("raw_image_path").notNull(),
    rawImageHash: varchar("raw_image_hash", { length: 64 }).notNull(),
    parsedStashValue: numeric("parsed_stash_value", { precision: 6, scale: 1 }),
    confidence: numeric("confidence", { precision: 5, scale: 4 }),
    confirmedStashValue: numeric("confirmed_stash_value", { precision: 6, scale: 1 }),
    parseNotes: text("parse_notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("manual_upload_jobs_user_hash_idx").on(table.userId, table.rawImageHash)]
)

export const stashSnapshotsTable = pgTable("stash_snapshots", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: integer("user_id")
    .references(() => usersTable.id, { onDelete: "cascade" })
    .notNull(),
  raidId: uuid("raid_id").references(() => raidsTable.id, { onDelete: "set null" }),
  uploadJobId: uuid("upload_job_id").references(() => manualUploadJobsTable.id, {
    onDelete: "set null",
  }),
  sessionId: uuid("session_id").references(() => gameplaySessionsTable.id, {
    onDelete: "set null",
  }),
  stashValue: numeric("stash_value", { precision: 6, scale: 1 }).notNull(),
  confidence: numeric("confidence", { precision: 5, scale: 4 }),
  source: varchar("source", { length: 32 }).notNull().default("manual_upload"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
})

export const leaderboardEntriesTable = pgTable(
  "leaderboard_entries",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .references(() => usersTable.id, { onDelete: "cascade" })
      .notNull(),
    period: varchar("period", { length: 24 }).notNull().default("all_time"),
    totalProfit: numeric("total_profit", { precision: 10, scale: 1 }).notNull().default("0"),
    totalRaids: integer("total_raids").notNull().default(0),
    totalExtractions: integer("total_extractions").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("leaderboard_period_user_idx").on(table.period, table.userId)]
)
