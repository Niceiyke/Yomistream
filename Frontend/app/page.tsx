"use client"

import { useState, useEffect } from "react"
import { Search, Play, Heart, BookOpen, Users, Filter, LogIn, LogOut, FolderOpen, Tag } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { VideoPlayer } from "@/components/video-player"
import { PreacherCard } from "@/components/preacher-card"
import { VideoCard } from "@/components/video-card"
import { TagFilter } from "@/components/tag-filter"
import { AIGenerationModal } from "@/components/ai-generation-modal"
import { createClient } from "@/lib/supabase/client"
import { apiGet, apiGetCached, apiPost, apiDelete } from "@/lib/api"
import { getAccessTokenCached } from "@/lib/auth-cache"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useQuery, useQueryClient } from "@tanstack/react-query"

interface Preacher {
  id: string
  name: string
  bio: string | null
  image_url: string | null
  created_at: string
}

interface Video {
  id: string
  title: string
  description: string | null
  youtube_id: string
  topic: string | null
  duration: number | null
  thumbnail_url: string | null
  created_at: string
  sermon_notes: string[] | null
  scripture_references: any[] | null
  tags: string[] | null
  preacher: Preacher
  start_time_seconds?: number | null
  end_time_seconds?: number | null
  video_url?: string | null
}

interface UserFavorite {
  id: string
  video_id: string
  created_at: string
}

export default function GospelPlatform() {
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedTopic, setSelectedTopic] = useState("all")
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [favorites, setFavorites] = useState<string[]>([])
  const [preacherFavorites, setPreacherFavorites] = useState<string[]>([])
  const [filteredPreacherId, setFilteredPreacherId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<"videos" | "preachers">("videos")
  const [showTagFilter, setShowTagFilter] = useState(false)
  const [aiModalOpen, setAiModalOpen] = useState(false)
  const [selectedVideoForAI, setSelectedVideoForAI] = useState<Video | null>(null)
  const [videos, setVideos] = useState<Video[]>([])
  const [preachers, setPreachers] = useState<Preacher[]>([])
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const supabase = createClient()
  const router = useRouter()
  const queryClient = useQueryClient()

  useEffect(() => {
    checkUser()
  }, [])

  const checkUser = async () => {
    try {
      console.log("[v0] Checking user authentication...")
      const {
        data: { user },
      } = await supabase.auth.getUser()
      console.log("[v0] User check result:", user ? "authenticated" : "not authenticated")
      setUser(user)
    } catch (error) {
      console.error("[v0] Error checking user:", error)
    }
  }

  // React Query: videos & preachers
  const videosQuery = useQuery({
    queryKey: ["videos"],
    queryFn: () => apiGetCached("/api/data/videos"),
    staleTime: 60_000,
  })
  const preachersQuery = useQuery({
    queryKey: ["preachers"],
    queryFn: () => apiGetCached("/api/data/preachers"),
    staleTime: 60_000,
  })

  useEffect(() => {
    if (videosQuery.data) setVideos(videosQuery.data)
    if (preachersQuery.data) setPreachers(preachersQuery.data)
    // manage loading/error flags
    if (videosQuery.isError || preachersQuery.isError) {
      setError("Failed to load data")
      setLoading(false)
    } else if (videosQuery.isLoading || preachersQuery.isLoading) {
      setLoading(true)
    } else {
      setLoading(false)
    }
  }, [videosQuery.data, preachersQuery.data, videosQuery.isLoading, preachersQuery.isLoading, videosQuery.isError, preachersQuery.isError])

  // React Query: favorites (dependent on user)
  const favoritesQuery = useQuery({
    queryKey: ["favorites", user?.id],
    queryFn: async () => {
      const accessToken = await getAccessTokenCached()
      const favs = await apiGet("/api/favorites", {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      })
      return favs?.video_ids || []
    },
    enabled: !!user?.id,
  })

  const preacherFavoritesQuery = useQuery({
    queryKey: ["preacherFavorites", user?.id],
    queryFn: async () => {
      const accessToken = await getAccessTokenCached()
      const favs = await apiGet("/api/favorites/preachers", {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      })
      return favs?.preacher_ids || []
    },
    enabled: !!user?.id,
  })

  useEffect(() => {
    if (favoritesQuery.data) setFavorites(favoritesQuery.data)
    if (preacherFavoritesQuery.data) setPreacherFavorites(preacherFavoritesQuery.data)
  }, [favoritesQuery.data, preacherFavoritesQuery.data])

  // Toggle favorites via API then invalidate queries
  const toggleFavorite = async (videoId: string) => {
    if (!user) {
      router.push("/auth/login")
      return
    }
    const isFavorite = favorites.includes(videoId)
    const accessToken = await getAccessTokenCached()
    const headers: Record<string, string> = accessToken ? { Authorization: `Bearer ${accessToken}` } : {}
    try {
      if (isFavorite) {
        await apiDelete(`/api/favorites/${videoId}`, { headers })
      } else {
        await apiPost("/api/favorites", { video_id: videoId }, { headers })
      }
      await queryClient.invalidateQueries({ queryKey: ["favorites", user.id] })
    } catch (error) {
      console.error("Error toggling favorite:", error)
    }
  }

  const togglePreacherFavorite = async (preacherId: string) => {
    if (!user) {
      router.push("/auth/login")
      return
    }
    const isFavorite = preacherFavorites.includes(preacherId)
    const accessToken = await getAccessTokenCached()
    const headers: Record<string, string> = accessToken ? { Authorization: `Bearer ${accessToken}` } : {}
    try {
      if (isFavorite) {
        await apiDelete(`/api/favorites/preachers/${preacherId}`, { headers })
      } else {
        await apiPost("/api/favorites/preachers", { preacher_id: preacherId }, { headers })
      }
      await queryClient.invalidateQueries({ queryKey: ["preacherFavorites", user.id] })
    } catch (error) {
      console.error("Error toggling preacher favorite:", error)
    }
  }

  const handleViewPreacherSermons = (preacherId: string, preacherName: string) => {
    setFilteredPreacherId(preacherId)
    setActiveTab("videos")
    setSearchQuery(preacherName)
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setFavorites([])
    setPreacherFavorites([])
    setFilteredPreacherId(null)
    router.refresh()
  }

  const handleGenerateAI = (videoId: string) => {
    const video = videos.find((v) => v.id === videoId)
    if (video) {
      setSelectedVideoForAI(video)
      setAiModalOpen(true)
    }
  }

  const handleAIContentGenerated = (content: any) => {
    // Invalidate to refresh videos
    queryClient.invalidateQueries({ queryKey: ["videos"] })
  }

  // Get all unique tags from videos
  const allTags = Array.from(
    new Set(videos.flatMap((video) => video.tags || []).filter((tag) => tag && tag.trim() !== "")),
  ).sort()

  const filteredVideos = videos.filter((video) => {
    const matchesSearch =
      video.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      video.preacher?.name.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesTopic = selectedTopic === "all" || video.topic?.toLowerCase() === selectedTopic.toLowerCase()
    const matchesPreacher = !filteredPreacherId || video.preacher?.id === filteredPreacherId
    const matchesTags = selectedTags.length === 0 || selectedTags.some((tag) => video.tags?.includes(tag))
    return matchesSearch && matchesTopic && matchesPreacher && matchesTags
  })

  const filteredPreachers = preachers.filter((preacher) =>
    preacher.name.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "N/A"
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-white text-xl mb-4">Loading gospel content...</div>
          <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto"></div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="text-red-400 text-xl mb-4">Connection Error</div>
          <p className="text-gray-300 mb-6">{error}</p>
          <Button
            onClick={() => {
              setError(null)
              setLoading(true)
              queryClient.invalidateQueries({ queryKey: ["videos"] })
              queryClient.invalidateQueries({ queryKey: ["preachers"] })
            }}
            className="bg-purple-600 hover:bg-purple-700 text-white"
          >
            Try Again
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <header className="border-b border-white/10 bg-black/20 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                <BookOpen className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">Gospel Stream</h1>
                <p className="text-sm text-gray-300">Curated Christian Content</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              {user ? (
                <>
                  <Button
                    asChild
                    variant="outline"
                    className="border-white/20 text-white hover:bg-white/10 bg-transparent"
                  >
                    <Link href="/collections">
                      <FolderOpen className="w-4 h-4 mr-2" />
                      My Collections
                    </Link>
                  </Button>
                  <Button variant="outline" className="border-white/20 text-white hover:bg-white/10 bg-transparent">
                    <Heart className="w-4 h-4 mr-2" />
                    Favorites ({favorites.length})
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleSignOut}
                    className="border-white/20 text-white hover:bg-white/10 bg-transparent"
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    Sign Out
                  </Button>
                </>
              ) : (
                <Button
                  asChild
                  variant="outline"
                  className="border-white/20 text-white hover:bg-white/10 bg-transparent"
                >
                  <Link href="/auth/login">
                    <LogIn className="w-4 h-4 mr-2" />
                    Sign In
                  </Link>
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="mb-8 space-y-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search videos, preachers, or topics..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  if (e.target.value === "") {
                    setFilteredPreacherId(null)
                  }
                }}
                className="pl-10 bg-white/10 border-white/20 text-white placeholder:text-gray-400"
              />
            </div>
            <Select value={selectedTopic} onValueChange={setSelectedTopic}>
              <SelectTrigger className="w-full md:w-48 bg-white/10 border-white/20 text-white">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Filter by topic" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Topics</SelectItem>
                <SelectItem value="gospel">Gospel</SelectItem>
                <SelectItem value="theology">Theology</SelectItem>
                <SelectItem value="faith">Faith</SelectItem>
                <SelectItem value="prayer">Prayer</SelectItem>
                <SelectItem value="worship">Worship</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              onClick={() => setShowTagFilter(!showTagFilter)}
              className={`border-white/20 hover:bg-white/10 bg-transparent ${
                showTagFilter ? "text-purple-400 border-purple-400/50" : "text-white"
              }`}
            >
              <Tag className="w-4 h-4 mr-2" />
              Tags {selectedTags.length > 0 && `(${selectedTags.length})`}
            </Button>
            {(filteredPreacherId || selectedTags.length > 0) && (
              <Button
                variant="outline"
                onClick={() => {
                  setFilteredPreacherId(null)
                  setSearchQuery("")
                  setSelectedTags([])
                }}
                className="border-white/20 text-white hover:bg-white/10 bg-transparent"
              >
                Clear Filters
              </Button>
            )}
          </div>

          {showTagFilter && (
            <div className="bg-white/5 rounded-lg p-4 border border-white/10">
              <TagFilter availableTags={allTags} selectedTags={selectedTags} onTagsChange={setSelectedTags} />
            </div>
          )}

          <div className="flex space-x-1 bg-white/10 rounded-lg p-1">
            <Button
              variant={activeTab === "videos" ? "default" : "ghost"}
              onClick={() => setActiveTab("videos")}
              className={`flex-1 ${activeTab === "videos" ? "bg-white text-black" : "text-white hover:bg-white/10"}`}
            >
              <Play className="w-4 h-4 mr-2" />
              Videos
            </Button>
            <Button
              variant={activeTab === "preachers" ? "default" : "ghost"}
              onClick={() => setActiveTab("preachers")}
              className={`flex-1 ${activeTab === "preachers" ? "bg-white text-black" : "text-white hover:bg-white/10"}`}
            >
              <Users className="w-4 h-4 mr-2" />
              Preachers
            </Button>
          </div>
        </div>

        {selectedVideo && (
          <VideoPlayer
            videoId={selectedVideo.youtube_id}
            videoTitle={selectedVideo.title}
            sermonNotes={selectedVideo.sermon_notes || []}
            scriptureReferences={selectedVideo.scripture_references || []}
            startTimeSeconds={selectedVideo.start_time_seconds ?? undefined}
            endTimeSeconds={selectedVideo.end_time_seconds ?? undefined}
            videoUrl={selectedVideo.video_url ?? undefined}
            onClose={() => setSelectedVideo(null)}
          />
        )}

        {activeTab === "videos" ? (
          <div>
            {(filteredPreacherId || selectedTags.length > 0) && (
              <div className="mb-6 p-4 bg-white/10 rounded-lg border border-white/20">
                <p className="text-gray-200">
                  {filteredPreacherId && (
                    <>
                      Showing sermons by{" "}
                      <span className="font-semibold">{preachers.find((p) => p.id === filteredPreacherId)?.name}</span>
                    </>
                  )}
                  {filteredPreacherId && selectedTags.length > 0 && " • "}
                  {selectedTags.length > 0 && <>Filtered by tags: {selectedTags.join(", ")}</>}
                </p>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredVideos.map((video) => (
                <VideoCard
                  key={video.id}
                  video={{
                    id: video.id,
                    title: video.title,
                    preacher: video.preacher?.name || "Unknown",
                    duration: formatDuration(video.duration),
                    views: "N/A",
                    youtubeId: video.youtube_id,
                    topic: video.topic || "General",
                    description: video.description || "",
                    sermonNotes: video.sermon_notes || [],
                    scriptureReferences: video.scripture_references || [],
                    tags: video.tags || [],
                  }}
                  isFavorite={favorites.includes(video.id)}
                  onPlay={() => setSelectedVideo(video)}
                  onToggleFavorite={() => toggleFavorite(video.id)}
                  onGenerateAI={handleGenerateAI}
                  user={user}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPreachers.map((preacher) => (
              <PreacherCard
                key={preacher.id}
                preacher={{
                  id: preacher.id,
                  name: preacher.name,
                  church: "Ministry",
                  description: preacher.bio || "Gospel preacher and teacher",
                  videoCount: videos.filter((v) => v.preacher?.id === preacher.id).length,
                  image: preacher.image_url || "/preacher.jpg",
                }}
                isFavorite={preacherFavorites.includes(preacher.id)}
                onViewSermons={() => handleViewPreacherSermons(preacher.id, preacher.name)}
                onToggleFavorite={() => togglePreacherFavorite(preacher.id)}
                user={user}
              />
            ))}
          </div>
        )}

        {((activeTab === "videos" && filteredVideos.length === 0) ||
          (activeTab === "preachers" && filteredPreachers.length === 0)) && (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Search className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">No results found</h3>
            <p className="text-gray-400">Try adjusting your search or filter criteria</p>
          </div>
        )}
      </div>

      {selectedVideoForAI && (
        <AIGenerationModal
          isOpen={aiModalOpen}
          onClose={() => {
            setAiModalOpen(false)
            setSelectedVideoForAI(null)
          }}
          videoId={selectedVideoForAI!.id}
          videoTitle={selectedVideoForAI!.title}
          videoDescription={selectedVideoForAI!.description || undefined}
          preacherName={selectedVideoForAI!.preacher?.name}
          onContentGenerated={handleAIContentGenerated}
        />
      )}
    </div>
  )
}
