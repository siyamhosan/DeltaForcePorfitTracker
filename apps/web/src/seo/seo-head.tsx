import { useEffect } from "react"

import {
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_OG_IMAGE,
  SITE_URL,
} from "./site-config"

type SeoHeadProps = {
  title: string
  description: string
  pathname: string
  robots?: string
  keywords?: string[]
  jsonLd?: Record<string, unknown>[]
}

function upsertMetaTag(name: string, content: string) {
  let tag = document.head.querySelector(`meta[name="${name}"]`)
  if (!tag) {
    tag = document.createElement("meta")
    tag.setAttribute("name", name)
    document.head.appendChild(tag)
  }
  tag.setAttribute("content", content)
}

function upsertPropertyTag(property: string, content: string) {
  let tag = document.head.querySelector(`meta[property="${property}"]`)
  if (!tag) {
    tag = document.createElement("meta")
    tag.setAttribute("property", property)
    document.head.appendChild(tag)
  }
  tag.setAttribute("content", content)
}

function upsertCanonicalTag(url: string) {
  let tag = document.head.querySelector('link[rel="canonical"]')
  if (!tag) {
    tag = document.createElement("link")
    tag.setAttribute("rel", "canonical")
    document.head.appendChild(tag)
  }
  tag.setAttribute("href", url)
}

function removeJsonLdTags() {
  document
    .querySelectorAll<HTMLScriptElement>(
      'script[type="application/ld+json"][data-managed-seo="true"]'
    )
    .forEach((node) => node.remove())
}

function appendJsonLd(jsonLd: Record<string, unknown>[]) {
  for (const schema of jsonLd) {
    const tag = document.createElement("script")
    tag.type = "application/ld+json"
    tag.setAttribute("data-managed-seo", "true")
    tag.text = JSON.stringify(schema)
    document.head.appendChild(tag)
  }
}

function toBreadcrumbLabel(segment: string): string {
  return segment
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

function buildBreadcrumbSchema(pathname: string) {
  const segments = pathname.split("/").filter(Boolean)
  const itemListElement = [
    {
      "@type": "ListItem",
      position: 1,
      name: "Home",
      item: SITE_URL,
    },
  ]

  let currentPath = ""
  for (const [index, segment] of segments.entries()) {
    currentPath += `/${segment}`
    itemListElement.push({
      "@type": "ListItem",
      position: index + 2,
      name: toBreadcrumbLabel(segment),
      item: `${SITE_URL}${currentPath}`,
    })
  }

  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement,
  }
}

export const buildPublicSchemas = (
  pathname: string
): Record<string, unknown>[] => {
  const pageUrl = `${SITE_URL}${pathname}`

  return [
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: SITE_NAME,
      url: SITE_URL,
      potentialAction: {
        "@type": "SearchAction",
        target: `${SITE_URL}/?q={search_term_string}`,
        "query-input": "required name=search_term_string",
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: SITE_NAME,
      url: SITE_URL,
      sameAs: ["https://github.com/siyamhosan/DeltaForceProfitTracker"],
    },
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: SITE_NAME,
      applicationCategory: "GameApplication",
      operatingSystem: "Web",
      description: SITE_DESCRIPTION,
      inLanguage: "en",
      url: pageUrl,
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
      },
    },
    buildBreadcrumbSchema(pathname),
  ]
}

export function SeoHead({
  title,
  description,
  pathname,
  robots = "index, follow",
  keywords = [],
  jsonLd = [],
}: SeoHeadProps) {
  useEffect(() => {
    const url = `${SITE_URL}${pathname}`
    document.title = title
    upsertMetaTag("description", description)
    upsertMetaTag("robots", robots)
    if (keywords.length > 0) {
      upsertMetaTag("keywords", keywords.join(", "))
    }
    upsertMetaTag("twitter:card", "summary_large_image")
    upsertMetaTag("twitter:title", title)
    upsertMetaTag("twitter:description", description)
    upsertMetaTag("twitter:image", SITE_OG_IMAGE)
    upsertMetaTag("twitter:image:alt", `${SITE_NAME} preview image`)

    upsertPropertyTag("og:type", "website")
    upsertPropertyTag("og:site_name", SITE_NAME)
    upsertPropertyTag("og:title", title)
    upsertPropertyTag("og:description", description)
    upsertPropertyTag("og:url", url)
    upsertPropertyTag("og:image", SITE_OG_IMAGE)
    upsertPropertyTag("og:image:alt", `${SITE_NAME} preview image`)

    upsertCanonicalTag(url)
    removeJsonLdTags()
    if (jsonLd.length > 0) {
      appendJsonLd(jsonLd)
    }
  }, [description, jsonLd, keywords, pathname, robots, title])

  return null
}
