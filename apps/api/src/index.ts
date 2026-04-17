import { Elysia } from "elysia"
import { cors } from "@elysiajs/cors"

import { assertServerEnv, env } from "./config/env"
import { appRoutes } from "./routes/v1/app"
import { leaderboardRoutes } from "./routes/v1/leaderboard"
import { publicRoutes } from "./routes/v1/public"

assertServerEnv()

const app = new Elysia()
  .use(
    cors({
      origin: "http://localhost:5173",
      methods: ["GET", "POST", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
    })
  )
  .use(publicRoutes)
  .use(leaderboardRoutes)
  .use(appRoutes)
  .onError(({ code, error, set }) => {
    if (code === "VALIDATION") {
      set.status = 400
      return { error: "Bad request" }
    }

    if (code === "NOT_FOUND") {
      set.status = 404
      return { error: "Not found" }
    }

    set.status = 500
    console.error("API internal error:", error)
    return { error: "Internal server error" }
  })
  .listen(env.port)

console.log(`🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`)
