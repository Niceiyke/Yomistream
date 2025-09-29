"use client"

import { useEffect, useRef, useState } from "react"
import { X, BookOpen, Maximize2, Minimize2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SermonNotes } from "@/components/sermon-notes"

interface ScriptureReference {
  book: string
  chapter: number
  verse: number
  text: string
}

interface VideoPlayerProps {
  videoId: string
  videoTitle: string
  sermonNotes?: string[]
  scriptureReferences?: ScriptureReference[]
  onClose: () => void
  startTimeSeconds?: number
  endTimeSeconds?: number
  videoUrl?: string
}

export const VideoPlayer = ({
  videoId,
  videoTitle,
  sermonNotes = [],
  scriptureReferences = [],
  onClose,
  startTimeSeconds,
  endTimeSeconds,
  videoUrl,
}: VideoPlayerProps) => {
  const [isExpanded, setIsExpanded] = useState(false)
  const [showNotes, setShowNotes] = useState(false)
  const playerContainerRef = useRef<HTMLDivElement | null>(null)
  const playerRef = useRef<any>(null)
  const loadedVideoIdRef = useRef<string | null>(null)
  const frameHostRef = useRef<HTMLDivElement | null>(null)

  // Load YouTube IFrame API once and create a single player instance
  useEffect(() => {
    // If API already loaded
    const onYouTubeIframeAPIReady = () => {
      if (!playerContainerRef.current) return
      if (playerRef.current) return
      // @ts-ignore
      playerRef.current = new window.YT.Player(playerContainerRef.current, {
        videoId,
        playerVars: {
          autoplay: 1,
          rel: 0,
          modestbranding: 1,
          playsinline: 1,
          fs: 1,
        },
        events: {
          onReady: () => {
            try {
              const start = typeof startTimeSeconds === "number" ? Math.max(0, startTimeSeconds) : 0
              const end = typeof endTimeSeconds === "number" && endTimeSeconds > start ? endTimeSeconds : undefined
              if (end !== undefined) {
                playerRef.current.loadVideoById({ videoId, startSeconds: start, endSeconds: end })
              } else if (start > 0) {
                playerRef.current.loadVideoById({ videoId, startSeconds: start })
              }
            } catch {}
            loadedVideoIdRef.current = videoId
          },
          onStateChange: () => {
            try {
              const start = typeof startTimeSeconds === "number" ? Math.max(0, startTimeSeconds) : 0
              const end = typeof endTimeSeconds === "number" && endTimeSeconds > start ? endTimeSeconds : undefined
              const t = playerRef.current?.getCurrentTime?.()
              if (typeof t === "number") {
                if (start > 0 && t < start - 0.25) {
                  playerRef.current?.seekTo?.(start, true)
                }
                if (end !== undefined && t >= end) {
                  playerRef.current?.pauseVideo?.()
                }
              }
            } catch {}
          },
        },
      })
    }

    // If YT present use it, else inject script (singleton)
    // @ts-ignore
    if (typeof window !== "undefined" && window.YT && window.YT.Player) {
      onYouTubeIframeAPIReady()
    } else {
      // @ts-ignore
      if (typeof window !== "undefined") {
        // Only attach handler if not already
        // @ts-ignore
        if (!window.onYouTubeIframeAPIReady) {
          // @ts-ignore
          window.onYouTubeIframeAPIReady = onYouTubeIframeAPIReady
        }
      }
      // Ensure we only add the script once
      const existing = document.querySelector('script[src="https://www.youtube.com/iframe_api"]')
      if (!existing) {
        const script = document.createElement("script")
        script.src = "https://www.youtube.com/iframe_api"
        script.async = true
        document.body.appendChild(script)
      }
    }

    return () => {
      // Do not destroy player on unmount of this component's toggle states; only when component unmounts
      // Keep it to persist between mini/fullscreen within same mount
      // If we wanted cleanup on full unmount, uncomment below:
      // try { playerRef.current?.destroy?.() } catch {}
    }
  }, [])

  // If videoId/start/end change, (re)load or seek with the configured clip times
  useEffect(() => {
    if (!playerRef.current) return
    try {
      const start = typeof startTimeSeconds === "number" ? Math.max(0, startTimeSeconds) : 0
      const end = typeof endTimeSeconds === "number" && endTimeSeconds > start ? endTimeSeconds : undefined
      playerRef.current.loadVideoById(
        end !== undefined
          ? { videoId, startSeconds: start, endSeconds: end }
          : { videoId, startSeconds: start }
      )
      loadedVideoIdRef.current = videoId
    } catch (e) {
      // Fallback
      try {
        const start = typeof startTimeSeconds === "number" ? Math.max(0, startTimeSeconds) : 0
        const end = typeof endTimeSeconds === "number" && endTimeSeconds > start ? endTimeSeconds : undefined
        playerRef.current.cueVideoById(
          end !== undefined
            ? { videoId, startSeconds: start, endSeconds: end }
            : { videoId, startSeconds: start }
        )
        playerRef.current.playVideo?.()
        loadedVideoIdRef.current = videoId
      } catch {}
    }
  }, [videoId, startTimeSeconds, endTimeSeconds])

  // Enforce end time if provided by pausing when reached
  useEffect(() => {
    if (typeof endTimeSeconds !== "number" || !playerRef.current) return
    const id = window.setInterval(() => {
      try {
        const t = playerRef.current?.getCurrentTime?.()
        if (typeof t === "number" && t >= endTimeSeconds) {
          playerRef.current.pauseVideo?.()
        }
      } catch {}
    }, 500)
    return () => window.clearInterval(id)
  }, [endTimeSeconds])

  // Handle entering/exiting native fullscreen and orientation for better mobile UX
  useEffect(() => {
    const container = frameHostRef.current
    const tryLockLandscape = async () => {
      try {
        // @ts-ignore
        if (screen.orientation && screen.orientation.lock) {
          // @ts-ignore
          await screen.orientation.lock("landscape")
        }
      } catch {}
    }
    const tryUnlockOrientation = async () => {
      try {
        // @ts-ignore
        if (screen.orientation && screen.orientation.unlock) {
          // @ts-ignore
          screen.orientation.unlock()
        }
      } catch {}
    }

    const enterFullscreen = async () => {
      if (!container) return
      try {
        if (!document.fullscreenElement && container.requestFullscreen) {
          await container.requestFullscreen()
        }
        await tryLockLandscape()
      } catch {}
    }

    const exitFullscreen = async () => {
      try {
        if (document.fullscreenElement && document.exitFullscreen) {
          await document.exitFullscreen()
        }
      } catch {}
      await tryUnlockOrientation()
    }

    if (isExpanded) {
      enterFullscreen()
    } else {
      exitFullscreen()
    }

    return () => {
      // Ensure orientation is unlocked if component unmounts while expanded
      if (!isExpanded) return
      tryUnlockOrientation()
    }
  }, [isExpanded])

  // Unified layout that keeps a single player DOM node and only changes styles (no reparenting)
  return (
    <div
      className={
        isExpanded
          ? "fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex flex-col"
          : "fixed bottom-6 right-6 w-80 bg-black rounded-lg overflow-hidden shadow-2xl z-50 flex flex-col"
      }
      style={isExpanded ? { height: "100dvh", width: "100vw" } : undefined}
    >
      {/* Header (both modes, different styling) */}
      <div className={isExpanded ? "flex items-center justify-between p-4 bg-black/50" : "flex items-center justify-between p-2 bg-black/80"}>
        <div className="truncate pr-2">
          <span className={isExpanded ? "text-white text-lg font-semibold" : "text-white text-sm font-medium"}>{videoTitle}</span>
        </div>
        <div className="flex items-center space-x-2">
          {(sermonNotes.length > 0 || scriptureReferences.length > 0) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowNotes(!showNotes)}
              className={isExpanded ? "text-white hover:bg-white/10" : "text-white hover:bg-white/10 h-6 w-6 p-0"}
              title="Toggle Notes"
            >
              <BookOpen className={isExpanded ? "w-4 h-4 mr-2" : "w-3 h-3"} />
              {isExpanded ? (showNotes ? "Hide Notes" : "Show Notes") : null}
            </Button>
          )}
          {isExpanded ? (
            <Button variant="ghost" size="sm" onClick={() => setIsExpanded(false)} className="text-white hover:bg-white/10">
              <Minimize2 className="w-4 h-4" />
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(true)}
              className="text-white hover:bg-white/10 h-6 w-6 p-0"
              title="Expand"
            >
              <Maximize2 className="w-3 h-3" />
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={onClose} className={isExpanded ? "text-white hover:bg-white/10" : "text-white hover:bg-white/10 h-6 w-6 p-0"}>
            <X className={isExpanded ? "w-4 h-4" : "w-3 h-3"} />
          </Button>
        </div>
      </div>

      {/* Body (single stable container) */}
      <div className={isExpanded ? "flex-1 flex w-full" : "w-full"}>
        <div
          ref={frameHostRef}
          className={
            isExpanded
              ? `${showNotes ? "w-2/3" : "w-full"} bg-black flex items-center justify-center`
              : "aspect-video w-full"
          }
          style={isExpanded ? { height: "100%" } : undefined}
        >
          <div ref={playerContainerRef} className="w-full h-full" />
        </div>
        {isExpanded ? (
          showNotes && (
            <div className="w-1/3 bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4 overflow-y-auto">
              <SermonNotes notes={sermonNotes} scriptureReferences={scriptureReferences} />
            </div>
          )
        ) : (
          (showNotes && (sermonNotes.length > 0 || scriptureReferences.length > 0)) && (
            <div className="max-h-64 overflow-y-auto bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-3">
              <SermonNotes notes={sermonNotes} scriptureReferences={scriptureReferences} />
            </div>
          )
        )}
      </div>
    </div>
  )
}
