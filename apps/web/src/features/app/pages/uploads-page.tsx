import { useEffect, useMemo, useRef, useState } from "react"
import type {
  UploadAnalysisDto,
  UploadConfirmWarningDto,
} from "@workspace/domain"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { RiImageLine, RiUploadCloud2Line } from "@remixicon/react"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"

import { ApiError, createApi } from "@/lib/api"
import { AnalysisCanvasPreview } from "../components/analysis-canvas-preview"
import type { GetToken } from "../types"
import {
  formatAbsoluteDateTime,
  formatTimeAgo,
  parseMillionInput,
  toMillionValue,
} from "../utils/format"

export function UploadsPage({ getToken }: { getToken: GetToken }) {
  const api = useMemo(() => createApi(getToken), [getToken])
  const queryClient = useQueryClient()
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [selectedPreviewUrl, setSelectedPreviewUrl] = useState<string | null>(
    null
  )
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [isDragActive, setIsDragActive] = useState(false)
  const [clipboardHint, setClipboardHint] = useState<string | null>(null)
  const [clipboardError, setClipboardError] = useState<string | null>(null)
  const [correctionMode, setCorrectionMode] = useState<
    Record<string, "correct" | "incorrect">
  >({})
  const [stashInputByUpload, setStashInputByUpload] = useState<
    Record<string, string>
  >({})
  const [warningByUpload, setWarningByUpload] = useState<
    Record<string, UploadConfirmWarningDto>
  >({})
  const [latestAnalysisPreview, setLatestAnalysisPreview] = useState<{
    jobId: string
    imageUrl: string
    analysis: UploadAnalysisDto
    autoConfirmed: boolean
  } | null>(null)
  const [pendingDeleteUploadId, setPendingDeleteUploadId] = useState<string | null>(null)
  const [deleteConfirmTextByUpload, setDeleteConfirmTextByUpload] = useState<
    Record<string, string>
  >({})

  async function fileToBase64(file: File) {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const result = typeof reader.result === "string" ? reader.result : ""
        const [, base64 = ""] = result.split(",")
        resolve(base64)
      }
      reader.onerror = () => reject(new Error("Failed to read file"))
      reader.readAsDataURL(file)
    })
  }

  function selectImageFile(file: File | null) {
    if (!file) {
      return
    }
    if (!file.type.startsWith("image/")) {
      setClipboardError("Only image files are supported.")
      return
    }
    setClipboardError(null)
    if (selectedPreviewUrl) {
      URL.revokeObjectURL(selectedPreviewUrl)
    }
    setSelectedFile(file)
    setSelectedPreviewUrl(URL.createObjectURL(file))
    setClipboardHint(`Selected: ${file.name}`)
  }

  const uploadsQuery = useQuery({
    queryKey: ["app", "uploads"],
    queryFn: () => api.getUploads(),
  })

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const imageBase64 = await fileToBase64(file)
      return api.createUpload({
        filename: file.name,
        imageBase64,
      })
    },
    onSuccess: async (response) => {
      setWarningByUpload((current) => {
        const next = { ...current }
        delete next[response.job.id]
        return next
      })
      setStashInputByUpload((current) => ({
        ...current,
        [response.job.id]:
          response.job.parsedStashValue !== null
            ? toMillionValue(response.job.parsedStashValue)
            : "",
      }))
      setCorrectionMode((current) => ({
        ...current,
        [response.job.id]: "correct",
      }))

      if (selectedPreviewUrl) {
        setLatestAnalysisPreview({
          jobId: response.job.id,
          imageUrl: selectedPreviewUrl,
          analysis: response.analysis,
          autoConfirmed: response.autoConfirmed,
        })
        setSelectedPreviewUrl(null)
      }
      setSelectedFile(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
      setClipboardHint(
        response.autoConfirmed
          ? "High confidence OCR detected. Snapshot auto-confirmed."
          : "OCR completed. Please verify the parsed stash value."
      )
      setClipboardError(null)
      await queryClient.invalidateQueries({ queryKey: ["app", "uploads"] })
    },
  })

  const confirmMutation = useMutation({
    mutationFn: (payload: {
      uploadId: string
      stashValue: number
      forceConfirm?: boolean
    }) =>
      api.confirmUpload(payload.uploadId, {
        stashValue: payload.stashValue,
        raidMode: "operations",
        extracted: false,
        loadoutCost: 0,
        consumablesCost: 0,
        insuranceCost: 0,
        forceConfirm: payload.forceConfirm,
      }),
    onSuccess: async (_, variables) => {
      setWarningByUpload((current) => {
        const next = { ...current }
        delete next[variables.uploadId]
        return next
      })
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["app", "uploads"] }),
        queryClient.invalidateQueries({ queryKey: ["app", "overview"] }),
        queryClient.invalidateQueries({ queryKey: ["app", "sessions"] }),
        queryClient.invalidateQueries({
          queryKey: ["app", "session", "active"],
        }),
        queryClient.invalidateQueries({ queryKey: ["app", "leaderboard"] }),
      ])
    },
    onError: (error, variables) => {
      if (error instanceof ApiError && error.status === 409) {
        const payload = error.payload as {
          warning?: UploadConfirmWarningDto
        } | null
        if (payload?.warning) {
          const warning = payload.warning
          setWarningByUpload((current) => ({
            ...current,
            [variables.uploadId]: warning,
          }))
        }
      }
    },
  })
  const deleteSnapshotMutation = useMutation({
    mutationFn: (uploadId: string) => api.deleteUploadSnapshot(uploadId),
    onSuccess: async () => {
      setPendingDeleteUploadId(null)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["app", "uploads"] }),
        queryClient.invalidateQueries({ queryKey: ["app", "overview"] }),
        queryClient.invalidateQueries({ queryKey: ["app", "sessions"] }),
        queryClient.invalidateQueries({
          queryKey: ["app", "session", "active"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["app", "session", "reopenable"],
        }),
        queryClient.invalidateQueries({ queryKey: ["app", "leaderboard"] }),
      ])
    },
  })

  const submitting =
    uploadMutation.isPending ||
    confirmMutation.isPending ||
    deleteSnapshotMutation.isPending
  const error =
    uploadsQuery.error instanceof Error
      ? uploadsQuery.error.message
      : uploadMutation.error instanceof Error
        ? uploadMutation.error.message
        : confirmMutation.error instanceof ApiError &&
            confirmMutation.error.status === 409
          ? null
          : confirmMutation.error instanceof Error
            ? confirmMutation.error.message
            : null
  const uploads = uploadsQuery.data ?? []

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const clipboardItems = event.clipboardData?.items
      if (!clipboardItems?.length) {
        return
      }

      const imageItem = Array.from(clipboardItems).find((item) =>
        item.type.startsWith("image/")
      )
      if (!imageItem) {
        return
      }

      const file = imageItem.getAsFile()
      if (!file) {
        return
      }

      event.preventDefault()
      selectImageFile(file)
    }

    window.addEventListener("paste", onPaste)
    return () => window.removeEventListener("paste", onPaste)
  }, [])

  useEffect(() => {
    return () => {
      if (selectedPreviewUrl) {
        URL.revokeObjectURL(selectedPreviewUrl)
      }
      if (latestAnalysisPreview) {
        URL.revokeObjectURL(latestAnalysisPreview.imageUrl)
      }
    }
  }, [latestAnalysisPreview, selectedPreviewUrl])

  function onUpload() {
    if (!selectedFile) {
      return
    }
    uploadMutation.mutate(selectedFile)
  }

  function clearSelectedFile() {
    if (selectedPreviewUrl) {
      URL.revokeObjectURL(selectedPreviewUrl)
    }
    setSelectedFile(null)
    setSelectedPreviewUrl(null)
    setClipboardHint(null)
    setClipboardError(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  function openFilePicker() {
    if (submitting) {
      return
    }
    fileInputRef.current?.click()
  }

  function onConfirm(uploadId: string, forceConfirm = false) {
    const stashInput = stashInputByUpload[uploadId] ?? ""
    const parsed = parseMillionInput(stashInput)
    if (parsed === null) {
      return
    }
    confirmMutation.mutate({ uploadId, stashValue: parsed, forceConfirm })
  }

  function startDeleteConfirmation(uploadId: string) {
    setPendingDeleteUploadId(uploadId)
    setDeleteConfirmTextByUpload((current) => ({
      ...current,
      [uploadId]: "",
    }))
  }

  function cancelDeleteConfirmation() {
    setPendingDeleteUploadId(null)
    deleteSnapshotMutation.reset()
  }

  function confirmDeleteSnapshot(uploadId: string) {
    deleteSnapshotMutation.mutate(uploadId)
  }

  function onDeleteDialogOpenChange(uploadId: string, open: boolean) {
    if (open) {
      startDeleteConfirmation(uploadId)
      return
    }
    cancelDeleteConfirmation()
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-2xl border border-zinc-200/70 bg-gradient-to-br from-zinc-50 via-white to-zinc-100 p-6 shadow-sm dark:border-zinc-800 dark:from-zinc-900 dark:via-zinc-900 dark:to-zinc-950">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
          Manual Uploads
        </h1>
        <p className="text-zinc-500 dark:text-zinc-400">
          Upload via drag/drop, clipboard, or file picker. OCR values are
          handled externally.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-zinc-200 bg-white/70 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900/60">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Total Jobs
            </p>
            <p className="text-lg font-semibold">{uploads.length}</p>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-white/70 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900/60">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Awaiting Confirm
            </p>
            <p className="text-lg font-semibold">
              {uploads.filter((job) => job.status === "processed").length}
            </p>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-white/70 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900/60">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Confirmed
            </p>
            <p className="text-lg font-semibold">
              {uploads.filter((job) => job.status === "confirmed").length}
            </p>
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">
          {error}
        </div>
      ) : null}

      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div
          className={`rounded-xl border-2 border-dashed p-6 transition-colors ${
            isDragActive
              ? "border-primary bg-primary/5"
              : "border-zinc-300 bg-zinc-50/50 dark:border-zinc-700 dark:bg-zinc-900/30"
          } ${!selectedFile ? "cursor-pointer" : ""}`}
          role={!selectedFile ? "button" : undefined}
          tabIndex={!selectedFile ? 0 : undefined}
          onClick={() => {
            if (!selectedFile) {
              openFilePicker()
            }
          }}
          onKeyDown={(event) => {
            if (!selectedFile) {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault()
                openFilePicker()
              }
            }
          }}
          onDragOver={(event) => {
            event.preventDefault()
            setIsDragActive(true)
          }}
          onDragLeave={() => setIsDragActive(false)}
          onDrop={(event) => {
            event.preventDefault()
            setIsDragActive(false)
            const file = event.dataTransfer.files?.[0] ?? null
            selectImageFile(file)
          }}
        >
          <div className="flex flex-col items-center gap-3 text-center">
            {!selectedFile ? (
              <>
                <RiUploadCloud2Line className="h-8 w-8 text-zinc-500" />
                <div>
                  <p className="text-sm font-medium">
                    Drag & drop stash screenshot here
                  </p>
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    Click anywhere on this card to browse, or paste from
                    clipboard (<kbd className="rounded border px-1">Ctrl</kbd> +{" "}
                    <kbd className="rounded border px-1">V</kbd>)
                  </p>
                </div>
              </>
            ) : null}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={(event) =>
                selectImageFile(event.target.files?.[0] ?? null)
              }
              className="hidden"
            />
            {clipboardError ? (
              <div className="w-full rounded-lg border border-red-200 bg-red-50 p-2 text-left text-xs text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">
                {clipboardError}
              </div>
            ) : null}

            {selectedPreviewUrl ? (
              <div className="w-full">
                <img
                  src={selectedPreviewUrl}
                  alt="Selected upload preview"
                  className="max-h-64 w-full rounded-lg border border-zinc-200 bg-zinc-100 object-contain dark:border-zinc-700 dark:bg-zinc-800"
                />
              </div>
            ) : null}

            {selectedFile ? (
              <div className="flex w-full items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                  <RiImageLine className="h-4 w-4" />
                  <span>
                    {clipboardHint ? clipboardHint : selectedFile?.name}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <Button onClick={onUpload} disabled={submitting}>
                    {submitting ? "Submitting..." : "Submit screenshot"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={clearSelectedFile}
                    disabled={submitting}
                  >
                    Remove
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid gap-4">
        {uploads.map((upload) => {
          const stashInput =
            stashInputByUpload[upload.id] ??
            (upload.parsedStashValue !== null
              ? toMillionValue(upload.parsedStashValue)
              : "")
          const parsedInput = parseMillionInput(stashInput)
          const warning = warningByUpload[upload.id]
          const selectedMode = correctionMode[upload.id] ?? "correct"
          const confidencePct = upload.confidence
            ? Math.round(upload.confidence * 100)
            : null
          const ocrAnalysis = upload.ocrAnalysis
          const ocrConfidencePct = ocrAnalysis
            ? Math.round(ocrAnalysis.confidence * 100)
            : confidencePct
          const ocrParsedStash =
            ocrAnalysis?.stashValueMillions ?? upload.parsedStashValue
          const confirmationLabel =
            upload.confirmationMethod === "auto"
              ? "Auto-confirmed"
              : upload.confirmationMethod === "user"
                ? "Confirmed by user"
                : upload.status === "processed"
                  ? "Awaiting confirmation"
                  : null

          const isLatestPreview =
            latestAnalysisPreview && latestAnalysisPreview.jobId === upload.id

          return (
            <div
              key={upload.id}
              className={`rounded-xl border p-6 shadow-sm transition-colors ${
                upload.status === "processed"
                  ? "border-amber-300 bg-amber-50/50 dark:border-amber-900/40 dark:bg-amber-950/20"
                  : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
              }`}
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      Job #{upload.id.slice(0, 8)}
                    </p>
                    <span className="w-fit rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                      {upload.status}
                    </span>
                    {confirmationLabel ? (
                      <span
                        className={`w-fit rounded-full px-2 py-0.5 text-xs font-medium ${
                          upload.confirmationMethod === "auto"
                            ? "bg-sky-100 text-sky-900 dark:bg-sky-900/40 dark:text-sky-200"
                            : upload.confirmationMethod === "user"
                              ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200"
                              : "bg-amber-200/50 text-amber-900 dark:bg-amber-900/50 dark:text-amber-200"
                        }`}
                      >
                        {confirmationLabel}
                      </span>
                    ) : null}
                    {upload.editedByUser ? (
                      <span className="w-fit rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-900 dark:bg-violet-900/40 dark:text-violet-200">
                        Edited by user
                      </span>
                    ) : null}
                  </div>
                  <p
                    className="mt-1 text-xs text-zinc-500 dark:text-zinc-400"
                    title={formatAbsoluteDateTime(upload.createdAt)}
                  >
                    {formatAbsoluteDateTime(upload.createdAt)} ·{" "}
                    {formatTimeAgo(upload.createdAt)}
                  </p>
                  {upload.confirmedAt ? (
                    <p
                      className="mt-1 text-xs text-zinc-500 dark:text-zinc-400"
                      title={formatAbsoluteDateTime(upload.confirmedAt)}
                    >
                      Confirmed {formatTimeAgo(upload.confirmedAt)}
                    </p>
                  ) : null}
                </div>
              </div>

              {isLatestPreview ? (
                <div className="mt-4 rounded-xl bg-white/50 p-4 dark:bg-black/20">
                  <div className="mb-3">
                    <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      Analysis Preview
                    </h3>
                  </div>
                  <AnalysisCanvasPreview
                    imageUrl={latestAnalysisPreview.imageUrl}
                    analysis={latestAnalysisPreview.analysis}
                  />
                  <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
                    <div>
                      <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                        OCR Stash
                      </p>
                      <p className="mt-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                        {latestAnalysisPreview.analysis.stashValueMillions !==
                        null
                          ? toMillionValue(
                              latestAnalysisPreview.analysis.stashValueMillions
                            )
                          : "N/A"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                        Confidence
                      </p>
                      <p className="mt-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                        {Math.round(
                          latestAnalysisPreview.analysis.confidence * 100
                        )}
                        %
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                        Anchor
                      </p>
                      <p className="mt-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                        {latestAnalysisPreview.analysis.foundTotalAssetsAnchor
                          ? "Found"
                          : "Missing"}
                      </p>
                    </div>
                    {latestAnalysisPreview.analysis.stashValueText ? (
                      <div>
                        <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                          Raw Text
                        </p>
                        <p className="mt-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                          {latestAnalysisPreview.analysis.stashValueText}
                        </p>
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : (
                <div className="mt-4 grid grid-cols-2 gap-4 rounded-xl border border-zinc-100 bg-zinc-50/50 p-4 sm:grid-cols-4 dark:border-zinc-800/80 dark:bg-zinc-900/30">
                  <div>
                    <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                      OCR Stash
                    </p>
                    <p className="mt-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      {ocrParsedStash !== null
                        ? toMillionValue(ocrParsedStash)
                        : "N/A"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                      Confidence
                    </p>
                    <p className="mt-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      {ocrConfidencePct !== null
                        ? `${ocrConfidencePct}%`
                        : "N/A"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                      Anchor
                    </p>
                    <p className="mt-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      {ocrAnalysis
                        ? ocrAnalysis.foundTotalAssetsAnchor
                          ? "Found"
                          : "Missing"
                        : "N/A"}
                    </p>
                  </div>
                  {ocrAnalysis?.stashValueText ? (
                    <div>
                      <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                        Raw Text
                      </p>
                      <p className="mt-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                        {ocrAnalysis.stashValueText}
                      </p>
                    </div>
                  ) : null}
                </div>
              )}

              {upload.status === "processed" ? (
                <div className="mt-6 space-y-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-sm font-medium">
                      Is the parsed stash value correct?
                    </span>
                    <Button
                      size="sm"
                      variant={
                        selectedMode === "correct" ? "default" : "outline"
                      }
                      onClick={() =>
                        setCorrectionMode((current) => ({
                          ...current,
                          [upload.id]: "correct",
                        }))
                      }
                    >
                      Yes
                    </Button>
                    <Button
                      size="sm"
                      variant={
                        selectedMode === "incorrect" ? "default" : "outline"
                      }
                      onClick={() =>
                        setCorrectionMode((current) => ({
                          ...current,
                          [upload.id]: "incorrect",
                        }))
                      }
                    >
                      No, let me correct it
                    </Button>
                  </div>

                  {selectedMode === "incorrect" ? (
                    <div className="mt-2">
                      <label className="mb-1 block text-xs text-zinc-500 dark:text-zinc-400">
                        Enter correct stash value
                      </label>
                      <input
                        type="text"
                        value={stashInput}
                        onChange={(event) =>
                          setStashInputByUpload((current) => ({
                            ...current,
                            [upload.id]: event.target.value.toUpperCase(),
                          }))
                        }
                        placeholder="e.g. 36.4M"
                        className="w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm sm:w-56 dark:border-zinc-700"
                      />
                    </div>
                  ) : null}

                  {warning ? (
                    <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/20 dark:text-amber-200">
                      <p className="font-semibold">
                        Large stash jump detected!
                      </p>
                      <p className="mt-1">
                        Previous: {toMillionValue(warning.lastStashValue)} →
                        New: {toMillionValue(warning.currentStashValue)} (delta{" "}
                        {toMillionValue(warning.delta)}, threshold{" "}
                        {toMillionValue(warning.threshold)}).
                      </p>
                      <div className="mt-3">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onConfirm(upload.id, true)}
                          disabled={submitting || parsedInput === null}
                          className="border-amber-300 text-amber-900 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-200 dark:hover:bg-amber-900/50"
                        >
                          Force confirm anyway
                        </Button>
                      </div>
                    </div>
                  ) : null}

                  <Button
                    onClick={() => onConfirm(upload.id, false)}
                    disabled={submitting || parsedInput === null}
                    className="mt-2"
                  >
                    Confirm & Save Snapshot
                  </Button>
                </div>
              ) : upload.status === "confirmed" ? (
                <div className="mt-5 space-y-3">
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200/60 bg-emerald-50/50 px-4 py-3 dark:border-emerald-900/40 dark:bg-emerald-950/20">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/50">
                        <svg
                          className="h-4 w-4 text-emerald-600 dark:text-emerald-400"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2.5}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-emerald-800 dark:text-emerald-400">
                          Confirmed Stash
                        </p>
                        <p className="text-sm font-bold text-emerald-900 dark:text-emerald-300">
                          {upload.confirmedStashValue !== null
                            ? toMillionValue(upload.confirmedStashValue)
                            : "N/A"}
                        </p>
                      </div>
                    </div>
                    <Dialog
                      open={pendingDeleteUploadId === upload.id}
                      onOpenChange={(open) =>
                        onDeleteDialogOpenChange(upload.id, open)
                      }
                    >
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => startDeleteConfirmation(upload.id)}
                        disabled={submitting}
                        className="border-red-300 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950/30"
                      >
                        Delete Snapshot
                      </Button>
                      <DialogContent showCloseButton={false}>
                        <DialogHeader>
                          <DialogTitle>Confirm Snapshot Deletion</DialogTitle>
                          <DialogDescription>
                            This permanently deletes this snapshot. If this is
                            the last snapshot in its session, that session is
                            deleted too. Type <strong>DELETE</strong> to
                            continue.
                          </DialogDescription>
                        </DialogHeader>
                        <input
                          type="text"
                          value={deleteConfirmTextByUpload[upload.id] ?? ""}
                          onChange={(event) =>
                            setDeleteConfirmTextByUpload((current) => ({
                              ...current,
                              [upload.id]: event.target.value.toUpperCase(),
                            }))
                          }
                          placeholder="Type DELETE"
                          className="w-full rounded-md border border-red-300 bg-white px-3 py-2 text-sm text-red-900 placeholder:text-red-400 dark:border-red-800 dark:bg-zinc-950 dark:text-red-200 dark:placeholder:text-red-400"
                        />
                        {deleteSnapshotMutation.error instanceof Error ? (
                          <p className="text-xs text-red-600 dark:text-red-400">
                            {deleteSnapshotMutation.error.message}
                          </p>
                        ) : null}
                        <DialogFooter>
                          <DialogClose asChild>
                            <Button
                              variant="outline"
                              onClick={cancelDeleteConfirmation}
                              disabled={deleteSnapshotMutation.isPending}
                            >
                              Cancel
                            </Button>
                          </DialogClose>
                          <Button
                            onClick={() => confirmDeleteSnapshot(upload.id)}
                            disabled={
                              deleteSnapshotMutation.isPending ||
                              (deleteConfirmTextByUpload[upload.id] ?? "") !==
                                "DELETE"
                            }
                            className="bg-red-600 text-white hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600"
                          >
                            {deleteSnapshotMutation.isPending
                              ? "Deleting..."
                              : "Yes, Delete"}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}
