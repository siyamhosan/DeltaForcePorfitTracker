import { Link } from "react-router-dom"

import { Button } from "@workspace/ui/components/button"

import { SeoHead } from "@/seo/seo-head"

export function NotFoundPage() {
  return (
    <>
      <SeoHead
        title="Page Not Found - Delta Force Profit Tracker"
        description="The page you requested could not be found."
        pathname="/not-found"
        robots="noindex, nofollow"
      />
      <main className="max-w-3xl gap-5 px-6 mx-auto flex min-h-screen w-full flex-col items-start justify-center">
        <p className="text-xs font-semibold text-zinc-500 tracking-[0.2em] uppercase">
          404
        </p>
        <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
          This page does not exist.
        </h1>
        <p className="text-zinc-600 dark:text-zinc-300">
          Head back to the homepage or continue to signup to start tracking your
          stash and profit.
        </p>
        <div className="gap-3 flex flex-wrap">
          <Link to="/">
            <Button>Go home</Button>
          </Link>
          <Link to="/sign-up">
            <Button variant="outline">Create account</Button>
          </Link>
        </div>
      </main>
    </>
  )
}
