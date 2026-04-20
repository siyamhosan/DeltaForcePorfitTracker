import fs from "node:fs/promises"
import path from "node:path"

import { canonicalUrl, resolvedSiteUrl, seoRoutes } from "./seo-routes.mjs"

const projectRoot = process.cwd()
const distDir = path.join(projectRoot, "dist")
const defaultOgImage = `${resolvedSiteUrl}/og/default.svg`

function upsertMeta(html, { key, value, byProperty = false }) {
  const attr = byProperty ? "property" : "name"
  const tagRegex = new RegExp(`<meta\\s+${attr}=["']${key}["'][^>]*>`, "i")
  const nextTag = `<meta ${attr}="${key}" content="${value}" />`
  if (tagRegex.test(html)) {
    return html.replace(tagRegex, nextTag)
  }
  return html.replace("</head>", `  ${nextTag}\n</head>`)
}

function upsertCanonical(html, href) {
  const canonicalRegex = /<link\s+rel=["']canonical["'][^>]*>/i
  const canonicalTag = `<link rel="canonical" href="${href}" />`
  if (canonicalRegex.test(html)) {
    return html.replace(canonicalRegex, canonicalTag)
  }
  return html.replace("</head>", `  ${canonicalTag}\n</head>`)
}

function injectJsonLd(html, jsonLdPayload) {
  return html.replace(
    "</head>",
    `  <script type="application/ld+json">${JSON.stringify(jsonLdPayload)}</script>\n</head>`,
  )
}

function buildSchemas(route) {
  const url = canonicalUrl(route.path)
  return [
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "Delta Force Profit Tracker",
      url: resolvedSiteUrl,
    },
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "Delta Force Profit Tracker",
      operatingSystem: "Web",
      applicationCategory: "GameApplication",
      description: route.description,
      url,
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "Delta Force Profit Tracker",
      url: resolvedSiteUrl,
      sameAs: ["https://github.com/siyamhosan/DeltaForcePorfitTracker"],
    },
  ]
}

function applySeoToHtml(baseHtml, route) {
  let html = baseHtml
  const url = canonicalUrl(route.path)
  html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${route.title}</title>`)
  html = upsertMeta(html, { key: "description", value: route.description })
  html = upsertMeta(html, { key: "robots", value: route.robots ?? "index, follow" })
  if (route.keywords.length > 0) {
    html = upsertMeta(html, { key: "keywords", value: route.keywords.join(", ") })
  }

  html = upsertMeta(html, { key: "twitter:card", value: "summary_large_image" })
  html = upsertMeta(html, { key: "twitter:title", value: route.title })
  html = upsertMeta(html, { key: "twitter:description", value: route.description })
  html = upsertMeta(html, { key: "twitter:image", value: defaultOgImage })

  html = upsertMeta(html, { key: "og:type", value: "website", byProperty: true })
  html = upsertMeta(html, { key: "og:site_name", value: "Delta Force Profit Tracker", byProperty: true })
  html = upsertMeta(html, { key: "og:title", value: route.title, byProperty: true })
  html = upsertMeta(html, { key: "og:description", value: route.description, byProperty: true })
  html = upsertMeta(html, { key: "og:url", value: url, byProperty: true })
  html = upsertMeta(html, { key: "og:image", value: defaultOgImage, byProperty: true })

  html = upsertCanonical(html, url)
  html = html.replace('<div id="root"></div>', `<div id="root">${route.body}</div>`)

  return injectJsonLd(html, buildSchemas(route))
}

async function writeRouteHtml(route, html) {
  const routePath = route.path === "/" ? path.join(distDir, "index.html") : path.join(distDir, route.path, "index.html")
  await fs.mkdir(path.dirname(routePath), { recursive: true })
  await fs.writeFile(routePath, html, "utf8")
}

const baseHtmlPath = path.join(distDir, "index.html")
const baseHtml = await fs.readFile(baseHtmlPath, "utf8")

for (const route of seoRoutes) {
  const routeHtml = applySeoToHtml(baseHtml, route)
  await writeRouteHtml(route, routeHtml)
}
