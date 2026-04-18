import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import type {
  UploadAnalysisDto,
  UploadConfirmWarningDto,
} from "@workspace/domain"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { RiImageLine, RiUploadCloud2Line } from "@remixicon/react"
import { Button } from "@workspace/ui/components/button"
import { Link } from "react-router-dom"
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
  const [originalFileSizeBytes, setOriginalFileSizeBytes] = useState<
    number | null
  >(null)
  const [selectedPreviewUrl, setSelectedPreviewUrl] = useState<string | null>(
    null
  )
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [isDragActive, setIsDragActive] = useState(false)
  const [isOptimizingImage, setIsOptimizingImage] = useState(false)
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
  const [pendingDeleteUploadId, setPendingDeleteUploadId] = useState<
    string | null
  >(null)
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

  function IconBadge({
    title,
    className,
    children,
  }: {
    title: string
    className: string
    children: ReactNode
  }) {
    return (
      <span
        title={title}
        aria-label={title}
        className={`inline-flex h-6 w-6 items-center justify-center rounded-full border ${className}`}
      >
        {children}
      </span>
    )
  }

  function formatBytes(bytes: number) {
    if (bytes < 1024) {
      return `${bytes} B`
    }
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`
    }
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  }

  async function canvasToBlob(canvas: HTMLCanvasElement, quality: number) {
    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("Failed to compress image."))
            return
          }
          resolve(blob)
        },
        "image/jpeg",
        quality
      )
    })
  }

  async function optimizeImageForUpload(file: File) {
    const imageUrl = URL.createObjectURL(file)
    try {
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image()
        img.onload = () => resolve(img)
        img.onerror = () => reject(new Error("Failed to load selected image."))
        img.src = imageUrl
      })

      const maxDimension = 1920
      const shouldResize =
        image.naturalWidth > maxDimension || image.naturalHeight > maxDimension
      const shouldCompress = file.size > 1.5 * 1024 * 1024 || shouldResize

      if (!shouldCompress) {
        return file
      }

      const scale = shouldResize
        ? Math.min(
            maxDimension / image.naturalWidth,
            maxDimension / image.naturalHeight
          )
        : 1
      const width = Math.max(1, Math.round(image.naturalWidth * scale))
      const height = Math.max(1, Math.round(image.naturalHeight * scale))

      const canvas = document.createElement("canvas")
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext("2d")
      if (!ctx) {
        return file
      }
      ctx.drawImage(image, 0, 0, width, height)

      let quality = 0.9
      let blob = await canvasToBlob(canvas, quality)
      const targetSizeBytes = 1.1 * 1024 * 1024
      while (blob.size > targetSizeBytes && quality > 0.65) {
        quality -= 0.08
        blob = await canvasToBlob(canvas, quality)
      }

      if (blob.size >= file.size) {
        return file
      }

      const originalNameWithoutExt = file.name.replace(/\.[^.]+$/, "")
      return new File([blob], `${originalNameWithoutExt}.jpg`, {
        type: "image/jpeg",
        lastModified: file.lastModified,
      })
    } finally {
      URL.revokeObjectURL(imageUrl)
    }
  }

  async function selectImageFile(file: File | null) {
    if (!file) {
      return
    }
    if (!file.type.startsWith("image/")) {
      setClipboardError("Only image files are supported.")
      return
    }
    setIsOptimizingImage(true)
    setClipboardError(null)
    try {
      const optimizedFile = await optimizeImageForUpload(file)
      if (selectedPreviewUrl) {
        URL.revokeObjectURL(selectedPreviewUrl)
      }

      setOriginalFileSizeBytes(file.size)
      setSelectedFile(optimizedFile)
      setSelectedPreviewUrl(URL.createObjectURL(optimizedFile))

      if (optimizedFile.size < file.size) {
        const reducedPct = Math.round(
          (1 - optimizedFile.size / file.size) * 100
        )
        setClipboardHint(
          `Optimized: ${file.name} (${formatBytes(file.size)} -> ${formatBytes(
            optimizedFile.size
          )}, ${reducedPct}% smaller)`
        )
      } else {
        setClipboardHint(
          `Selected: ${optimizedFile.name} (${formatBytes(optimizedFile.size)})`
        )
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to prepare selected image."
      setClipboardError(message)
    } finally {
      setIsOptimizingImage(false)
    }
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
    if (!selectedFile || isOptimizingImage) {
      return
    }
    uploadMutation.mutate(selectedFile)
  }

  function clearSelectedFile() {
    if (selectedPreviewUrl) {
      URL.revokeObjectURL(selectedPreviewUrl)
    }
    setSelectedFile(null)
    setOriginalFileSizeBytes(null)
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
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    Large screenshots are auto-optimized before upload.
                  </p>
                </div>
              </>
            ) : null}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={(event) => {
                void selectImageFile(event.target.files?.[0] ?? null)
              }}
              className="hidden"
            />
            {clipboardError ? (
              <div className="w-full rounded-lg border border-red-200 bg-red-50 p-2 text-left text-xs text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">
                {clipboardError}
              </div>
            ) : null}

            {isOptimizingImage ? (
              <div className="w-full rounded-lg border border-zinc-200 bg-zinc-50 p-2 text-left text-xs text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
                Optimizing screenshot for faster upload...
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
                  <Button
                    onClick={onUpload}
                    disabled={submitting || isOptimizingImage}
                  >
                    {submitting ? "Submitting..." : "Submit screenshot"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={clearSelectedFile}
                    disabled={submitting || isOptimizingImage}
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
                    {upload.status === "processed" ? (
                      <IconBadge
                        title="Awaiting confirmation"
                        className="border-amber-300 bg-amber-100 text-amber-900 dark:border-amber-800 dark:bg-amber-900/40 dark:text-amber-200"
                      >
                        <svg
                          className="h-3.5 w-3.5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z"
                          />
                        </svg>
                      </IconBadge>
                    ) : null}
                    {upload.confirmationMethod === "auto" ? (
                      <IconBadge
                        title="Auto-confirmed"
                        className="border-sky-300 bg-sky-100 text-sky-900 dark:border-sky-800 dark:bg-sky-900/40 dark:text-sky-200"
                      >
                        <svg
                          className="h-3.5 w-3.5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9.75 3a1.5 1.5 0 013 0v1.31a7.5 7.5 0 014.94 4.94H19.5a1.5 1.5 0 010 3h-1.31a7.5 7.5 0 01-4.94 4.94V21a1.5 1.5 0 01-3 0v-1.31a7.5 7.5 0 01-4.94-4.94H3a1.5 1.5 0 010-3h1.31a7.5 7.5 0 014.94-4.94V3z"
                          />
                        </svg>
                      </IconBadge>
                    ) : null}
                    {upload.confirmationMethod === "user" ? (
                      <IconBadge
                        title="Confirmed by user"
                        className="border-emerald-300 bg-emerald-100 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"
                      >
                        <svg
                          className="h-3.5 w-3.5"
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
                      </IconBadge>
                    ) : null}
                    {upload.editedByUser ? (
                      <IconBadge
                        title="Edited by user"
                        className="border-violet-300 bg-violet-100 text-violet-900 dark:border-violet-800 dark:bg-violet-900/40 dark:text-violet-200"
                      >
                        <svg
                          className="h-3.5 w-3.5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M16.862 3.487a2.06 2.06 0 112.913 2.913L8.25 17.926 4 19l1.074-4.25L16.862 3.487z"
                          />
                        </svg>
                      </IconBadge>
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
                  {upload.sessionId ? (
                    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                      Session:{" "}
                      <Link
                        to={`/app/sessions/${upload.sessionId}`}
                        className="font-medium text-zinc-700 underline underline-offset-2 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
                      >
                        {upload.sessionId.slice(0, 8)}
                      </Link>
                    </p>
                  ) : null}
                </div>
              </div>

              <details className="mt-4 rounded-lg border border-zinc-200/80 bg-zinc-50/40 p-3 dark:border-zinc-800 dark:bg-zinc-900/30">
                <summary className="flex cursor-pointer list-none items-center gap-2 text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-300">
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-zinc-300 dark:border-zinc-700">
                    <svg
                      className="h-3 w-3"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9.75 3a1.5 1.5 0 013 0v1.31a7.5 7.5 0 014.94 4.94H19.5a1.5 1.5 0 010 3h-1.31a7.5 7.5 0 01-4.94 4.94V21a1.5 1.5 0 01-3 0v-1.31a7.5 7.5 0 01-4.94-4.94H3a1.5 1.5 0 010-3h1.31a7.5 7.5 0 014.94-4.94V3z"
                      />
                    </svg>
                  </span>
                  OCR analysis
                </summary>
                {isLatestPreview ? (
                  <div className="mt-3 rounded-xl bg-white/50 p-3 dark:bg-black/20">
                    <AnalysisCanvasPreview
                      imageUrl={latestAnalysisPreview.imageUrl}
                      analysis={latestAnalysisPreview.analysis}
                    />
                  </div>
                ) : null}
                <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
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
              </details>

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
