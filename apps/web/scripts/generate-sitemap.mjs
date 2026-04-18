import fs from "node:fs/promises"
import path from "node:path"

import { canonicalUrl, sitemapRoutes } from "./seo-routes.mjs"

const projectRoot = new URL("..", import.meta.url).pathname
const publicDir = path.join(projectRoot, "public")
const distDir = path.join(projectRoot, "dist")

function xmlEscape(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;")
}

function buildSitemap() {
  const urls = sitemapRoutes
    .map(
      (route) => `  <url>
    <loc>${xmlEscape(canonicalUrl(route.path))}</loc>
    <changefreq>weekly</changefreq>
    <priority>${route.path === "/" ? "1.0" : "0.7"}</priority>
  </url>`,
    )
    .join("\n")

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`
}

async function ensureDir(targetDir) {
  await fs.mkdir(targetDir, { recursive: true })
}

async function writeSitemap(targetDir) {
  await ensureDir(targetDir)
  await fs.writeFile(path.join(targetDir, "sitemap.xml"), buildSitemap(), "utf8")
}

await writeSitemap(publicDir)

try {
  await writeSitemap(distDir)
} catch {
  // dist may not exist before build; public copy is still generated.
}
