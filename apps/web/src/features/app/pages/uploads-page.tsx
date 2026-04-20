import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import type {
  UploadAnalysisDto,
  UploadConfirmWarningDto,
} from "@workspace/domain"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  RiCharacterRecognitionLine,
  RiImageLine,
  RiUploadCloud2Line,
} from "@remixicon/react"
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
        className={`h-6 w-6 inline-flex items-center justify-center rounded-full border ${className}`}
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
    <div className="gap-6 flex flex-col">
      <div className="border-zinc-200/70 from-zinc-50 via-white to-zinc-100 p-6 shadow-sm dark:border-zinc-800 dark:from-zinc-900 dark:via-zinc-900 dark:to-zinc-950 rounded-2xl border bg-gradient-to-br">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
          Manual Uploads
        </h1>
        <p className="text-zinc-500 dark:text-zinc-400">
          Upload via drag/drop, clipboard, or file picker. OCR values are
          handled externally.
        </p>
        <div className="mt-4 gap-3 sm:grid-cols-3 grid">
          <div className="border-zinc-200 bg-white/70 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900/60 rounded-lg border">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Total Jobs
            </p>
            <p className="text-lg font-semibold">{uploads.length}</p>
          </div>
          <div className="border-zinc-200 bg-white/70 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900/60 rounded-lg border">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Awaiting Confirm
            </p>
            <p className="text-lg font-semibold">
              {uploads.filter((job) => job.status === "processed").length}
            </p>
          </div>
          <div className="border-zinc-200 bg-white/70 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900/60 rounded-lg border">
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
        <div className="border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200 rounded-lg border">
          {error}
        </div>
      ) : null}

      <div className="border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 rounded-xl border">
        <div
          className={`p-6 rounded-xl border-2 border-dashed transition-colors ${
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
          <div className="gap-3 flex flex-col items-center text-center">
            {!selectedFile ? (
              <>
                <RiUploadCloud2Line className="h-8 w-8 text-zinc-500" />
                <div>
                  <p className="text-sm font-medium">
                    Drag & drop stash screenshot here
                  </p>
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    Click anywhere on this card to browse, or paste from
                    clipboard (<kbd className="rounded px-1 border">Ctrl</kbd> +{" "}
                    <kbd className="rounded px-1 border">V</kbd>)
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
              <div className="border-red-200 bg-red-50 p-2 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200 w-full rounded-lg border text-left">
                {clipboardError}
              </div>
            ) : null}

            {isOptimizingImage ? (
              <div className="border-zinc-200 bg-zinc-50 p-2 text-xs text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 w-full rounded-lg border text-left">
                Optimizing screenshot for faster upload...
              </div>
            ) : null}

            {selectedPreviewUrl ? (
              <div className="w-full">
                <img
                  src={selectedPreviewUrl}
                  alt="Selected upload preview"
                  className="max-h-64 border-zinc-200 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 w-full rounded-lg border object-contain"
                />
              </div>
            ) : null}

            {selectedFile ? (
              <div className="flex w-full items-center justify-between">
                <div className="gap-2 text-xs text-zinc-500 dark:text-zinc-400 flex items-center">
                  <RiImageLine className="h-4 w-4" />
                  <span>
                    {clipboardHint ? clipboardHint : selectedFile?.name}
                  </span>
                </div>

                <div className="gap-2 flex items-center">
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

      <div className="gap-4 grid">
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
              className={`p-6 shadow-sm rounded-xl border transition-colors ${
                upload.status === "processed"
                  ? "border-amber-300 bg-amber-50/50 dark:border-amber-900/40 dark:bg-amber-950/20"
                  : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
              }`}
            >
              <div className="gap-3 lg:flex-row lg:items-start lg:justify-between flex flex-col">
                <div className="min-w-0">
                  <div className="gap-2 flex flex-wrap items-center">
                    <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      Snapshot #{upload.id.slice(0, 8)}
                    </p>
                    {upload.status === "confirmed" ? (
                      <IconBadge
                        title="Status: confirmed"
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
                    {upload.status === "processed" ? (
                      <IconBadge
                        title="Status: awaiting confirmation"
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
                    {upload.status !== "processed" &&
                    upload.status !== "confirmed" ? (
                      <IconBadge
                        title={`Status: ${upload.status}`}
                        className="border-zinc-300 bg-zinc-100 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
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
                            d="M12 8h.01M11 12h1v4h1m-1-14a9 9 0 110 18 9 9 0 010-18z"
                          />
                        </svg>
                      </IconBadge>
                    ) : null}
                    {upload.confirmationMethod === "auto" ? (
                      <IconBadge
                        title="Auto-confirmed"
                        className="border-sky-300 bg-sky-100 text-sky-900 dark:border-sky-800 dark:bg-sky-900/40 dark:text-sky-200"
                      >
                        <RiCharacterRecognitionLine className="h-3.5 w-3.5" />
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
                </div>
                <div className="gap-2 lg:max-w-[55%] lg:justify-end flex flex-wrap items-center">
                  <span
                    className="border-zinc-200 bg-zinc-50 px-2 py-1 text-xs text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900/50 dark:text-zinc-300 inline-flex items-center rounded-md border"
                    title={formatAbsoluteDateTime(upload.createdAt)}
                  >
                    Created {formatTimeAgo(upload.createdAt)}
                  </span>
                  {upload.confirmedAt ? (
                    <span
                      className="border-emerald-200 bg-emerald-50 px-2 py-1 text-xs text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-300 inline-flex items-center rounded-md border"
                      title={formatAbsoluteDateTime(upload.confirmedAt)}
                    >
                      Confirmed {formatTimeAgo(upload.confirmedAt)}
                    </span>
                  ) : null}
                  {upload.sessionId ? (
                    <span className="border-zinc-200 bg-zinc-50 px-2 py-1 text-xs text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900/50 dark:text-zinc-300 inline-flex items-center rounded-md border">
                      Session{" "}
                      <Link
                        to={`/app/sessions/${upload.sessionId}`}
                        className="ml-1 font-semibold text-zinc-700 hover:text-zinc-900 dark:text-zinc-200 dark:hover:text-zinc-100 underline underline-offset-2"
                      >
                        {upload.sessionId.slice(0, 8)}
                      </Link>
                    </span>
                  ) : null}
                </div>
              </div>

              {upload.status === "processed" &&
              upload.source !== "desktop_client" ? (
                <div className="mt-6 space-y-4">
                  <div className="gap-3 flex flex-wrap items-center">
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
                      <label className="mb-1 text-xs text-zinc-500 dark:text-zinc-400 block">
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
                        className="border-zinc-300 px-3 py-2 text-sm sm:w-56 dark:border-zinc-700 w-full rounded-md border bg-transparent"
                      />
                    </div>
                  ) : null}

                  {warning ? (
                    <div className="border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/20 dark:text-amber-200 rounded-lg border">
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
                  <div className="gap-3 border-emerald-200/60 bg-emerald-50/50 px-4 py-3 dark:border-emerald-900/40 dark:bg-emerald-950/20 flex items-center justify-between rounded-xl border">
                    <div className="gap-3 flex items-center">
                      <div className="h-8 w-8 bg-emerald-100 dark:bg-emerald-900/50 flex shrink-0 items-center justify-center rounded-full">
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
                          className="border-red-300 bg-white px-3 py-2 text-sm text-red-900 placeholder:text-red-400 dark:border-red-800 dark:bg-zinc-950 dark:text-red-200 dark:placeholder:text-red-400 w-full rounded-md border"
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
              ) : upload.status === "failed" &&
                upload.source === "desktop_client" ? (
                <div className="mt-4 border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-200 rounded-lg border">
                  <p className="font-semibold">Desktop capture failed OCR</p>
                  <p className="mt-1">
                    {upload.processingFailureReason ??
                      "Desktop screenshot could not be parsed. It was marked failed automatically."}
                  </p>
                </div>
              ) : null}

              <details className="mt-2 bg-zinc-50/40 dark:border-zinc-800 dark:bg-zinc-900/30 rounded-lg">
                <summary className="gap-2 text-xs font-semibold tracking-wide text-zinc-600 dark:text-zinc-300 flex cursor-pointer list-none items-center uppercase">
                  <IconBadge title="Status: confirmed" className="border-2">
                    <RiCharacterRecognitionLine className="h-3.5 w-3.5" />
                  </IconBadge>
                  OCR analysis
                </summary>
                {isLatestPreview ? (
                  <div className="mt-3 bg-white/50 p-3 dark:bg-black/20 rounded-xl">
                    <AnalysisCanvasPreview
                      imageUrl={latestAnalysisPreview.imageUrl}
                      analysis={latestAnalysisPreview.analysis}
                    />
                  </div>
                ) : null}
                <div className="mt-3 gap-4 sm:grid-cols-4 grid grid-cols-2">
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
            </div>
          )
        })}
      </div>
    </div>
  )
}
