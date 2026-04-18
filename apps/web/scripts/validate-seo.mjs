import fs from "node:fs/promises"
import path from "node:path"

import { seoRoutes } from "./seo-routes.mjs"

const projectRoot = new URL("..", import.meta.url).pathname
const publicSitemapPath = path.join(projectRoot, "public", "sitemap.xml")

const invalidRoute = seoRoutes.find(
  (route) => !route.path || !route.title || !route.description || !route.robots,
)

if (invalidRoute) {
  throw new Error(`SEO route metadata is incomplete for path: ${invalidRoute.path}`)
}

const duplicates = new Set()
for (const route of seoRoutes) {
  if (duplicates.has(route.path)) {
    throw new Error(`Duplicate SEO path detected: ${route.path}`)
  }
  duplicates.add(route.path)
}

const sitemapExists = await fs
  .access(publicSitemapPath)
  .then(() => true)
  .catch(() => false)

if (!sitemapExists) {
  throw new Error("Missing public/sitemap.xml. Run seo:sitemap before seo:validate.")
}
