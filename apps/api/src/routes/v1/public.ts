import { Elysia } from "elysia"

export const publicRoutes = new Elysia({ prefix: "/v1" }).get("/", () => ({
  name: "Delta Force Profit Tracker API",
  version: "v1",
  status: "ok",
}))
