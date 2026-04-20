import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { ClerkProvider } from "@clerk/clerk-react"
import { dark } from "@clerk/themes"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { BrowserRouter } from "react-router-dom"

import "@workspace/ui/globals.css"
import { AppRoot } from "./app-root"
import { ThemeProvider, useTheme } from "@/components/theme-provider.tsx"
import { initWebVitals } from "@/lib/web-vitals"

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
})

if (!PUBLISHABLE_KEY) {
  throw new Error("Missing Clerk Publishable Key")
}

initWebVitals()

function ClerkProviderWithTheme({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme()
  const isDark =
    theme === "dark" ||
    (theme === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches)

  return (
    <ClerkProvider
      publishableKey={PUBLISHABLE_KEY}
      afterSignOutUrl="/"
      appearance={{
        baseTheme: isDark ? dark : undefined,
      }}
    >
      {children}
    </ClerkProvider>
  )
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <ClerkProviderWithTheme>
            <AppRoot />
          </ClerkProviderWithTheme>
        </QueryClientProvider>
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>
)
