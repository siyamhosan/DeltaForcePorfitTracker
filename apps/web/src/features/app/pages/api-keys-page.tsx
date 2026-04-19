import { useCallback, useEffect, useMemo, useState } from "react"
import type { ApiKeyDto } from "@workspace/domain"

import { createApi } from "@/lib/api"

type ApiKeysPageProps = {
  getToken: () => Promise<string | null>
}

export function ApiKeysPage({ getToken }: ApiKeysPageProps) {
  const api = useMemo(() => createApi(getToken), [getToken])
  const [keys, setKeys] = useState<ApiKeyDto[]>([])
  const [newKeyName, setNewKeyName] = useState("Manual Key")
  const [lastCreatedSecret, setLastCreatedSecret] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [isBusy, setIsBusy] = useState(false)

  const refresh = useCallback(async () => {
    setIsBusy(true)
    try {
      const response = await api.getApiKeys()
      setKeys(response.keys)
      setStatus(null)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to load API keys.")
    } finally {
      setIsBusy(false)
    }
  }, [api])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const createManualKey = useCallback(async () => {
    setIsBusy(true)
    try {
      const created = await api.createApiKey({
        name: newKeyName.trim() || "Manual Key",
        type: "manual",
      })
      setLastCreatedSecret(created.secret)
      setStatus("Created a new API key. Copy it now, this is the only time it is shown.")
      await refresh()
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to create API key.")
    } finally {
      setIsBusy(false)
    }
  }, [api, newKeyName, refresh])

  const revokeKey = useCallback(
    async (keyId: string) => {
      setIsBusy(true)
      try {
        await api.deleteApiKey(keyId)
        setStatus("API key revoked.")
        await refresh()
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "Failed to revoke API key.")
      } finally {
        setIsBusy(false)
      }
    },
    [api, refresh]
  )

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">API Keys</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Manage long-lived keys linked to your account. Desktop client uses a dedicated desktop key.
        </p>
      </header>

      <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-sm font-semibold">Create Manual API Key</h2>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <input
            value={newKeyName}
            onChange={(event) => setNewKeyName(event.target.value)}
            className="min-w-[220px] rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            placeholder="Key name"
          />
          <button
            type="button"
            disabled={isBusy}
            onClick={() => {
              void createManualKey()
            }}
            className="rounded-md bg-zinc-900 px-3 py-2 text-sm text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
          >
            Create key
          </button>
        </div>
        {lastCreatedSecret ? (
          <div className="mt-3 rounded-md border border-emerald-300 bg-emerald-50 p-3 dark:border-emerald-900 dark:bg-emerald-950/40">
            <p className="text-xs font-medium text-emerald-800 dark:text-emerald-200">
              Copy this key now:
            </p>
            <code className="mt-1 block break-all text-xs">{lastCreatedSecret}</code>
          </div>
        ) : null}
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-sm font-semibold">Existing Keys</h2>
        <div className="mt-3 space-y-2">
          {keys.length === 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">No keys yet.</p>
          ) : (
            keys.map((key) => (
              <div
                key={key.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-zinc-200 p-3 text-sm dark:border-zinc-800"
              >
                <div>
                  <p className="font-medium">{key.name}</p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {key.type} · {key.prefix} · {key.revokedAt ? "revoked" : "active"}
                  </p>
                </div>
                {!key.revokedAt ? (
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => {
                      void revokeKey(key.id)
                    }}
                    className="rounded-md border border-red-300 px-2 py-1 text-xs text-red-600 disabled:opacity-60 dark:border-red-900 dark:text-red-300"
                  >
                    Revoke
                  </button>
                ) : null}
              </div>
            ))
          )}
        </div>
      </div>

      {status ? <p className="text-xs text-zinc-500 dark:text-zinc-400">{status}</p> : null}
    </section>
  )
}
