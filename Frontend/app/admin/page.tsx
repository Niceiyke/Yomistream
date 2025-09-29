"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import { apiGet, apiGetCached, apiPost, apiPut, apiDelete } from "@/lib/api"
import { getAccessTokenCached } from "@/lib/auth-cache"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Plus, Edit, Trash2, Users, BookOpen, BarChart3, Sparkles } from "lucide-react"
import { useRouter } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"

interface AdminVideo {
  id: string
  title: string
  description: string
  youtube_id: string
  thumbnail_url: string
  duration: number
  topic: string
  tags: string[]
  sermon_notes: string[]
  scripture_references: any[]
  preacher_id: string
  created_at: string
  start_time_seconds?: number | null
  end_time_seconds?: number | null
  video_url?: string | null
}

// Edit Video Form Component with preview player
function EditVideoForm({
  video,
  onClose,
  onSave,
}: {
  video: AdminVideo
  onClose: () => void
  onSave: () => void | Promise<void>
}) {
  const [formData, setFormData] = useState({
    title: video.title || "",
    description: video.description || "",
    youtube_id: video.youtube_id || "",
    topic: video.topic || "",
    preacher_id: video.preacher_id || "",
    start_time_seconds: (video.start_time_seconds ?? "") as number | string,
    end_time_seconds: (video.end_time_seconds ?? "") as number | string,
    video_url: video.video_url ?? "",
  })
  const [isSaving, setIsSaving] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [preachers, setPreachers] = useState<Preacher[]>([])
  const [loopPreview, setLoopPreview] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const playerContainerRef = useRef<HTMLDivElement | null>(null)
  const playerRef = useRef<any>(null)

  const authHeaders = async (): Promise<Record<string, string>> => {
    const token = await getAccessTokenCached()
    return token ? { Authorization: `Bearer ${token}` } : {}
  }

  useEffect(() => {
    // Load preachers for select
    ;(async () => {
      try {
        const data = await apiGet("/api/admin/preachers", { headers: await authHeaders() })
        setPreachers(data || [])
      } catch (e) {
        console.error("Load preachers failed", e)
      }
    })()
  }, [])

  // Initialize lightweight YT player
  useEffect(() => {
    let inited = false
    const init = () => {
      if (inited) return
      if (!playerContainerRef.current) return
      if (playerRef.current) return
      // @ts-ignore
      playerRef.current = new window.YT.Player(playerContainerRef.current, {
        videoId: formData.youtube_id,
        playerVars: { autoplay: 0, rel: 0, modestbranding: 1, playsinline: 1 },
        events: {
          onReady: () => {
            const start = typeof video.start_time_seconds === "number" ? Math.max(0, video.start_time_seconds) : 0
            if (start > 0) {
              try { playerRef.current.seekTo(start, true) } catch {}
            }
          },
        },
      })
      inited = true
    }

    // Try immediate init if YT is ready
    // @ts-ignore
    if (typeof window !== "undefined" && window.YT && window.YT.Player) {
      init()
    } else {
      // Inject script if not present
      const existing = document.querySelector('script[src="https://www.youtube.com/iframe_api"]')
      if (!existing) {
        const script = document.createElement("script")
        script.src = "https://www.youtube.com/iframe_api"
        script.async = true
        document.body.appendChild(script)
      }
      // Poll for YT readiness to avoid overriding global handlers
      const waitId = window.setInterval(() => {
        // @ts-ignore
        if (typeof window !== "undefined" && window.YT && window.YT.Player) {
          window.clearInterval(waitId)
          init()
        }
      }, 100)
    }

    const id = window.setInterval(() => {
      try {
        const t = playerRef.current?.getCurrentTime?.()
        if (typeof t === "number") setCurrentTime(t)
        // Handle preview loop if end is reached
        const start = typeof formData.start_time_seconds === "string" ? Number(formData.start_time_seconds) : (formData.start_time_seconds as number)
        const end = typeof formData.end_time_seconds === "string" ? Number(formData.end_time_seconds) : (formData.end_time_seconds as number)
        if (loopPreview && !Number.isNaN(end) && typeof t === "number" && end && t >= end) {
          const seekTo = !Number.isNaN(start) && start ? start : 0
          try {
            playerRef.current?.seekTo?.(seekTo, true)
            playerRef.current?.playVideo?.()
          } catch {}
        }
      } catch {}
    }, 500)
    return () => window.clearInterval(id)
  }, [])

  // If YouTube ID changes, load that video into preview
  useEffect(() => {
    try {
      if (playerRef.current && formData.youtube_id) {
        playerRef.current.loadVideoById({ videoId: formData.youtube_id })
      }
    } catch {}
  }, [formData.youtube_id])

  const setStartFromCurrent = () => setFormData((d) => ({ ...d, start_time_seconds: Math.floor(currentTime).toString() }))
  const setEndFromCurrent = () => setFormData((d) => ({ ...d, end_time_seconds: Math.floor(currentTime).toString() }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    // Validate bounds
    const s = formData.start_time_seconds !== "" ? Number(formData.start_time_seconds) : undefined
    const ed = formData.end_time_seconds !== "" ? Number(formData.end_time_seconds) : undefined
    if (s !== undefined && ed !== undefined && ed <= s) {
      setErrorMsg("End time must be greater than start time.")
      return
    }
    setErrorMsg(null)
    setIsSaving(true)
    try {
      const payload: any = {
        title: formData.title,
        description: formData.description,
        youtube_id: formData.youtube_id,
        topic: formData.topic,
        preacher_id: formData.preacher_id,
        start_time_seconds: s,
        end_time_seconds: ed,
        video_url: formData.video_url !== "" ? formData.video_url : undefined,
      }
      await apiPut(`/api/admin/videos/${video.id}`, payload, { headers: await authHeaders() })
      await onSave()
      onClose()
    } catch (e) {
      console.error("Update video failed", e)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-3">
          <div>
            <Label htmlFor="title" className="text-white">Title</Label>
            <Input id="title" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} className="bg-slate-700 border-slate-600 text-white" />
          </div>
          <div>
            <Label htmlFor="description" className="text-white">Description</Label>
            <Textarea id="description" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="bg-slate-700 border-slate-600 text-white" rows={3} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="youtube_id" className="text-white">YouTube ID</Label>
              <Input id="youtube_id" value={formData.youtube_id} onChange={(e) => setFormData({ ...formData, youtube_id: e.target.value })} className="bg-slate-700 border-slate-600 text-white" />
            </div>
            <div>
              <Label htmlFor="topic" className="text-white">Topic</Label>
              <Input id="topic" value={formData.topic} onChange={(e) => setFormData({ ...formData, topic: e.target.value })} className="bg-slate-700 border-slate-600 text-white" />
            </div>
          </div>
          <div>
            <Label htmlFor="preacher_id" className="text-white">Preacher</Label>
            <select
              id="preacher_id"
              value={formData.preacher_id}
              onChange={(e) => setFormData({ ...formData, preacher_id: e.target.value })}
              className="w-full p-2 bg-slate-700 border border-slate-600 text-white rounded-md"
            >
              {preachers.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-white">Start (s)</Label>
              <Input type="number" min={0} value={formData.start_time_seconds} onChange={(e) => setFormData({ ...formData, start_time_seconds: e.target.value })} className="bg-slate-700 border-slate-600 text-white" />
            </div>
            <div>
              <Label className="text-white">End (s)</Label>
              <Input type="number" min={0} value={formData.end_time_seconds} onChange={(e) => setFormData({ ...formData, end_time_seconds: e.target.value })} className="bg-slate-700 border-slate-600 text-white" />
            </div>
            <div className="flex items-end">
              <div className="flex gap-2 w-full">
                <Button type="button" variant="outline" className="border-slate-600 text-white hover:bg-slate-700 bg-transparent w-1/2" onClick={setStartFromCurrent}>Set Start</Button>
                <Button type="button" variant="outline" className="border-slate-600 text-white hover:bg-slate-700 bg-transparent w-1/2" onClick={setEndFromCurrent}>Set End</Button>
              </div>
            </div>
          </div>
          {errorMsg && <div className="text-red-400 text-sm">{errorMsg}</div>}
          <div>
            <Label htmlFor="video_url" className="text-white">Video URL (optional)</Label>
            <Input id="video_url" value={formData.video_url as string} onChange={(e) => setFormData({ ...formData, video_url: e.target.value })} className="bg-slate-700 border-slate-600 text-white" />
          </div>
        </div>
        <div className="space-y-2">
          <div className="aspect-video bg-black">
            <div ref={playerContainerRef} className="w-full h-full" />
          </div>
          <div className="flex items-center justify-between text-sm text-gray-300">
            <div>Current time: {Math.floor(currentTime)}s</div>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={loopPreview} onChange={(e) => setLoopPreview(e.target.checked)} />
              Loop preview
            </label>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="border-slate-600 text-white hover:bg-slate-700 bg-transparent" onClick={() => { try { playerRef.current?.seekTo?.(Number(formData.start_time_seconds) || 0, true); playerRef.current?.playVideo?.() } catch {} }}>Jump to Start</Button>
            <Button type="button" variant="outline" className="border-slate-600 text-white hover:bg-slate-700 bg-transparent" onClick={() => { try { const end = Number(formData.end_time_seconds) || 0; if (end) { playerRef.current?.seekTo?.(end - 2, true); playerRef.current?.playVideo?.() } } catch {} }}>Near End</Button>
          </div>
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onClose} className="border-slate-600 text-white hover:bg-slate-700 bg-transparent">Cancel</Button>
        <Button type="submit" disabled={isSaving} className="bg-blue-600 hover:bg-blue-700">{isSaving ? "Saving..." : "Save Changes"}</Button>
      </div>
    </form>
  )
}

interface Preacher {
  id: string
  name: string
  bio: string
  image_url: string
  created_at: string
}

interface User {
  id: string
  display_name: string
  created_at: string
}

export default function AdminDashboard() {
  const [user, setUser] = useState<any>(null)
  const [videos, setVideos] = useState<AdminVideo[]>([])
  const [preachers, setPreachers] = useState<Preacher[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [stats, setStats] = useState({
    totalVideos: 0,
    totalPreachers: 0,
    totalUsers: 0,
    totalCollections: 0,
  })
  const [isLoading, setIsLoading] = useState(true)
  const [selectedVideo, setSelectedVideo] = useState<AdminVideo | null>(null)
  const [selectedPreacher, setSelectedPreacher] = useState<Preacher | null>(null)
  const [isVideoDialogOpen, setIsVideoDialogOpen] = useState(false)
  const [isPreacherDialogOpen, setIsPreacherDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isGeneratingContent, setIsGeneratingContent] = useState(false)
  const router = useRouter()

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      router.push("/auth/login")
      return
    }

    setUser(user)
  }

  const queryClient = useQueryClient()
  const authHeaders = async (): Promise<Record<string, string>> => {
    const token = await getAccessTokenCached()
    return token ? { Authorization: `Bearer ${token}` } : {}
  }

  // React Query: admin lists
  const videosQuery = useQuery({
    queryKey: ["admin", "videos"],
    queryFn: async () => apiGet("/api/admin/videos", { headers: await authHeaders() }),
  })
  const preachersQuery = useQuery({
    queryKey: ["admin", "preachers"],
    queryFn: async () => apiGet("/api/admin/preachers", { headers: await authHeaders() }),
  })
  const usersQuery = useQuery({
    queryKey: ["admin", "users"],
    queryFn: async () => apiGet("/api/admin/users", { headers: await authHeaders() }),
  })
  const statsQuery = useQuery({
    queryKey: ["admin", "stats"],
    queryFn: async () => apiGet("/api/admin/stats", { headers: await authHeaders() }),
  })

  useEffect(() => {
    setIsLoading(videosQuery.isLoading || preachersQuery.isLoading || usersQuery.isLoading || statsQuery.isLoading)
    if (videosQuery.data) setVideos(videosQuery.data)
    if (preachersQuery.data) setPreachers(preachersQuery.data)
    if (usersQuery.data) setUsers(usersQuery.data)
    if (statsQuery.data) setStats(statsQuery.data)
  }, [videosQuery.data, preachersQuery.data, usersQuery.data, statsQuery.data, videosQuery.isLoading, preachersQuery.isLoading, usersQuery.isLoading, statsQuery.isLoading])

  const generateAIContent = async (videoId: string) => {
    setIsGeneratingContent(true)
    try {
      await apiPost("/api/ai/update-video-content", { videoId }, { headers: await authHeaders() })
      await queryClient.invalidateQueries({ queryKey: ["admin", "videos"] })
    } catch (error) {
      console.error("Error generating AI content:", error)
    } finally {
      setIsGeneratingContent(false)
    }
  }

  const deleteVideo = async (videoId: string) => {
    try {
      await apiDelete(`/api/admin/videos/${videoId}`, { headers: await authHeaders() })
      await queryClient.invalidateQueries({ queryKey: ["admin", "videos"] })
    } catch (e) {
      console.error("Delete video failed", e)
    }
  }

  const deletePreacher = async (preacherId: string) => {
    try {
      await apiDelete(`/api/admin/preachers/${preacherId}`, { headers: await authHeaders() })
      await queryClient.invalidateQueries({ queryKey: ["admin", "preachers"] })
    } catch (e) {
      console.error("Delete preacher failed", e)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-white">Loading admin dashboard...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-6 overflow-x-hidden">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">Admin Dashboard</h1>
            <p className="text-gray-300">Manage your gospel video platform</p>
          </div>
          <Button
            onClick={() => router.push("/")}
            variant="outline"
            className="border-white/20 text-white hover:bg-white/10"
          >
            Back to Platform
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="bg-white/10 border-white/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-white">Total Videos</CardTitle>
              <BookOpen className="h-4 w-4 text-purple-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{stats.totalVideos}</div>
            </CardContent>
          </Card>

          <Card className="bg-white/10 border-white/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-white">Total Preachers</CardTitle>
              <Users className="h-4 w-4 text-amber-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{stats.totalPreachers}</div>
            </CardContent>
          </Card>

          <Card className="bg-white/10 border-white/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-white">Total Users</CardTitle>
              <Users className="h-4 w-4 text-green-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{stats.totalUsers}</div>
            </CardContent>
          </Card>

          <Card className="bg-white/10 border-white/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-white">Collections</CardTitle>
              <BookOpen className="h-4 w-4 text-blue-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{stats.totalCollections}</div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="videos" className="space-y-6">
          <TabsList className="bg-white/10 border-white/20">
            <TabsTrigger value="videos" className="data-[state=active]:bg-white/20">
              Videos
            </TabsTrigger>
            <TabsTrigger value="preachers" className="data-[state=active]:bg-white/20">
              Preachers
            </TabsTrigger>
            <TabsTrigger value="users" className="data-[state=active]:bg-white/20">
              Users
            </TabsTrigger>
            <TabsTrigger value="analytics" className="data-[state=active]:bg-white/20">
              Analytics
            </TabsTrigger>
          </TabsList>

          {/* Videos Tab */}
          <TabsContent value="videos">
            <Card className="bg-white/10 border-white/20">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-white">Video Management</CardTitle>
                    <CardDescription className="text-gray-300">
                      Manage all videos, generate AI content, and organize your library
                    </CardDescription>
                  </div>
                  <Dialog open={isVideoDialogOpen} onOpenChange={setIsVideoDialogOpen}>
                    <DialogTrigger asChild>
                      <Button className="bg-purple-600 hover:bg-purple-700">
                        <Plus className="w-4 h-4 mr-2" />
                        Add Video
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-2xl">
                      <DialogHeader>
                        <DialogTitle>Add New Video</DialogTitle>
                        <DialogDescription className="text-gray-300">
                          Add a new gospel video to your platform
                        </DialogDescription>
                      </DialogHeader>
                      <VideoForm
                        onClose={() => setIsVideoDialogOpen(false)}
                        onSave={() => queryClient.invalidateQueries({ queryKey: ["admin", "videos"] })}
                      />
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-hidden">
                  <Table className="w-full table-fixed">
                    <TableHeader>
                      <TableRow className="border-white/20">
                        <TableHead className="px-4 py-2 text-left text-gray-300 truncate whitespace-nowrap">Title</TableHead>
                        <TableHead className="px-4 py-2 text-left text-gray-300 truncate whitespace-nowrap">Preacher</TableHead>
                        <TableHead className="px-4 py-2 text-left text-gray-300 truncate whitespace-nowrap">Topic</TableHead>
                        <TableHead className="px-4 py-2 text-left text-gray-300 truncate whitespace-nowrap">Tags</TableHead>
                        <TableHead className="px-4 py-2 text-left text-gray-300 truncate whitespace-nowrap">AI Content</TableHead>
                        <TableHead className="px-4 py-2 text-left text-gray-300 truncate whitespace-nowrap">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {videos.map((video) => (
                        <TableRow key={video.id} className="border-white/20">
                          <TableCell className="text-white font-medium">{video.title}</TableCell>
                          <TableCell className="text-gray-300">{(video as any).preachers?.name}</TableCell>
                          <TableCell className="text-gray-300">{video.topic}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {video.tags?.slice(0, 2).map((tag, index) => (
                                <Badge
                                  key={index}
                                  variant="secondary"
                                  className="bg-purple-500/20 text-purple-200 text-xs"
                                >
                                  {tag}
                                </Badge>
                              ))}
                              {video.tags?.length > 2 && (
                                <Badge variant="secondary" className="bg-gray-500/20 text-gray-300 text-xs">
                                  +{video.tags.length - 2}
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => generateAIContent(video.id)}
                              disabled={isGeneratingContent}
                              className="border-purple-500/30 text-purple-200 hover:bg-purple-500/10"
                            >
                              <Sparkles className="w-3 h-3 mr-1" />
                              {isGeneratingContent ? "Generating..." : "Generate"}
                            </Button>
                          </TableCell>
                          <TableCell>
                            <div className="flex space-x-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className="border-blue-500/40 text-blue-300 hover:bg-blue-600/20 hover:text-blue-100"
                                onClick={() => {
                                  setSelectedVideo(video)
                                  setIsEditDialogOpen(true)
                                }}
                              >
                                <Edit className="w-3 h-3 mr-1" />
                                Edit
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button size="sm" variant="ghost" className="text-red-400 hover:bg-red-500/10">
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent className="bg-slate-800 border-slate-700">
                                  <AlertDialogHeader>
                                    <AlertDialogTitle className="text-white">Delete Video</AlertDialogTitle>
                                    <AlertDialogDescription className="text-gray-300">
                                      Are you sure you want to delete "{video.title}"? This action cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel className="bg-slate-700 border-slate-600 text-white hover:bg-slate-600">
                                      Cancel
                                    </AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => deleteVideo(video.id)}
                                      className="bg-red-600 hover:bg-red-700"
                                    >
                                      Delete
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Preachers Tab */}
          <TabsContent value="preachers">
            <Card className="bg-white/10 border-white/20">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-white">Preacher Management</CardTitle>
                    <CardDescription className="text-gray-300">
                      Manage preacher profiles and information
                    </CardDescription>
                  </div>
                  <Dialog open={isPreacherDialogOpen} onOpenChange={setIsPreacherDialogOpen}>
                    <DialogTrigger asChild>
                      <Button className="bg-amber-600 hover:bg-amber-700">
                        <Plus className="w-4 h-4 mr-2" />
                        Add Preacher
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-2xl">
                      <DialogHeader>
                        <DialogTitle>Add New Preacher</DialogTitle>
                        <DialogDescription className="text-gray-300">
                          Add a new preacher to your platform
                        </DialogDescription>
                      </DialogHeader>
                      <PreacherForm
                        onClose={() => setIsPreacherDialogOpen(false)}
                        onSave={() => queryClient.invalidateQueries({ queryKey: ["admin", "preachers"] })}
                      />
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {preachers.map((preacher) => (
                    <Card key={preacher.id} className="bg-white/5 border-white/10">
                      <CardContent className="p-4">
                        <div className="flex items-start space-x-4">
                          <img
                            src={preacher.image_url || "/placeholder.svg?height=60&width=60"}
                            alt={preacher.name}
                            className="w-15 h-15 rounded-full object-cover"
                          />
                          <div className="flex-1">
                            <h3 className="text-white font-semibold">{preacher.name}</h3>
                            <p className="text-gray-300 text-sm mt-1 line-clamp-2">{preacher.bio}</p>
                            <div className="flex space-x-2 mt-3">
                              <Button size="sm" variant="ghost" className="text-blue-400 hover:bg-blue-500/10">
                                <Edit className="w-3 h-3" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button size="sm" variant="ghost" className="text-red-400 hover:bg-red-500/10">
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent className="bg-slate-800 border-slate-700">
                                  <AlertDialogHeader>
                                    <AlertDialogTitle className="text-white">Delete Preacher</AlertDialogTitle>
                                    <AlertDialogDescription className="text-gray-300">
                                      Are you sure you want to delete {preacher.name}? This will also affect all
                                      associated videos.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel className="bg-slate-700 border-slate-600 text-white hover:bg-slate-600">
                                      Cancel
                                    </AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => deletePreacher(preacher.id)}
                                      className="bg-red-600 hover:bg-red-700"
                                    >
                                      Delete
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users">
            <Card className="bg-white/10 border-white/20">
              <CardHeader>
                <CardTitle className="text-white">User Management</CardTitle>
                <CardDescription className="text-gray-300">View and manage platform users</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table >
                    <TableHeader>
                      <TableRow className="border-white/20">
                        <TableHead className="text-gray-300">Display Name</TableHead>
                        <TableHead className="text-gray-300">User ID</TableHead>
                        <TableHead className="text-gray-300">Joined</TableHead>
                        <TableHead className="text-gray-300">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.map((user) => (
                        <TableRow key={user.id} className="border-white/20">
                          <TableCell className="text-white font-medium">{user.display_name}</TableCell>
                          <TableCell className="text-gray-300 font-mono text-xs">{user.id}</TableCell>
                          <TableCell className="text-gray-300">
                            {new Date(user.created_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <Button size="sm" variant="ghost" className="text-blue-400 hover:bg-blue-500/10">
                              View Details
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics">
            <Card className="bg-white/10 border-white/20">
              <CardHeader>
                <CardTitle className="text-white">Platform Analytics</CardTitle>
                <CardDescription className="text-gray-300">View platform usage and engagement metrics</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12">
                  <BarChart3 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-white text-lg font-semibold mb-2">Analytics Coming Soon</h3>
                  <p className="text-gray-300">
                    Detailed analytics and reporting features will be available in a future update.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
        {/* Edit Video Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="bg-slate-800 border-slate-700 text-white sm:max-w-5xl w-[92vw] md:w-[75vw] max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center justify-between">
                <div>
                  <DialogTitle>Edit Video</DialogTitle>
                  <DialogDescription className="text-gray-300">Update video details and clip times</DialogDescription>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsEditDialogOpen(false)}
                  className="text-white hover:bg-white/10"
                >
                  Close
                </Button>
              </div>
            </DialogHeader>
            {selectedVideo && (
              <EditVideoForm
                video={selectedVideo}
                onClose={() => setIsEditDialogOpen(false)}
                onSave={async () => {
                  await queryClient.invalidateQueries({ queryKey: ["admin", "videos"] })
                }}
              />
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}

// Video Form Component
function VideoForm({ onClose, onSave }: { onClose: () => void; onSave: () => void }) {
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    youtube_id: "",
    topic: "",
    preacher_id: "",
    start_time_seconds: "",
    end_time_seconds: "",
    video_url: "",
  })
  const [preachers, setPreachers] = useState<Preacher[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const queryClient = useQueryClient()

  const authHeaders = async (): Promise<Record<string, string>> => {
    const token = await getAccessTokenCached()
    return token ? { Authorization: `Bearer ${token}` } : {}
  }

  useEffect(() => {
    // Load preachers for select
    ;(async () => {
      try {
        const data = await apiGet("/api/admin/preachers", { headers: await authHeaders() })
        setPreachers(data || [])
      } catch (e) {
        console.error("Load preachers failed", e)
      }
    })()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      await apiPost(
        "/api/admin/videos",
        {
          title: formData.title,
          description: formData.description,
          youtube_id: formData.youtube_id,
          topic: formData.topic,
          preacher_id: formData.preacher_id,
          thumbnail_url: `https://img.youtube.com/vi/${formData.youtube_id}/maxresdefault.jpg`,
          duration: 0,
          tags: [],
          sermon_notes: [],
          scripture_references: [],
          start_time_seconds:
            formData.start_time_seconds !== "" ? Number(formData.start_time_seconds) : undefined,
          end_time_seconds:
            formData.end_time_seconds !== "" ? Number(formData.end_time_seconds) : undefined,
          video_url: formData.video_url !== "" ? formData.video_url : undefined,
        },
        { headers: await authHeaders() },
      )
      await queryClient.invalidateQueries({ queryKey: ["admin", "videos"] })
      onSave()
      onClose()
    } catch (error) {
      console.error("Create video failed", error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="title" className="text-white">
          Title
        </Label>
        <Input
          id="title"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          className="bg-slate-700 border-slate-600 text-white"
          required
        />
      </div>
      <div>
        <Label htmlFor="description" className="text-white">
          Description
        </Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          className="bg-slate-700 border-slate-600 text-white"
          rows={3}
        />
      </div>
      <div>
        <Label htmlFor="youtube_id" className="text-white">
          YouTube ID
        </Label>
        <Input
          id="youtube_id"
          value={formData.youtube_id}
          onChange={(e) => setFormData({ ...formData, youtube_id: e.target.value })}
          className="bg-slate-700 border-slate-600 text-white"
          placeholder="e.g., dQw4w9WgXcQ"
          required
        />
      </div>
      <div>
        <Label htmlFor="topic" className="text-white">
          Topic
        </Label>
        <Input
          id="topic"
          value={formData.topic}
          onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
          className="bg-slate-700 border-slate-600 text-white"
        />
      </div>
      <div>
        <Label htmlFor="preacher_id" className="text-white">
          Preacher
        </Label>
        <select
          id="preacher_id"
          value={formData.preacher_id}
          onChange={(e) => setFormData({ ...formData, preacher_id: e.target.value })}
          className="w-full p-2 bg-slate-700 border border-slate-600 text-white rounded-md"
          required
        >
          <option value="">Select a preacher</option>
          {preachers.map((preacher) => (
            <option key={preacher.id} value={preacher.id}>
              {preacher.name}
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <Label htmlFor="start_time_seconds" className="text-white">
            Start Time (seconds)
          </Label>
          <Input
            id="start_time_seconds"
            type="number"
            min={0}
            value={formData.start_time_seconds}
            onChange={(e) => setFormData({ ...formData, start_time_seconds: e.target.value })}
            className="bg-slate-700 border-slate-600 text-white"
            placeholder="e.g., 30"
          />
        </div>
        <div>
          <Label htmlFor="end_time_seconds" className="text-white">
            End Time (seconds)
          </Label>
          <Input
            id="end_time_seconds"
            type="number"
            min={0}
            value={formData.end_time_seconds}
            onChange={(e) => setFormData({ ...formData, end_time_seconds: e.target.value })}
            className="bg-slate-700 border-slate-600 text-white"
            placeholder="e.g., 120"
          />
        </div>
        <div>
          <Label htmlFor="video_url" className="text-white">
            Video URL (optional)
          </Label>
          <Input
            id="video_url"
            value={formData.video_url}
            onChange={(e) => setFormData({ ...formData, video_url: e.target.value })}
            className="bg-slate-700 border-slate-600 text-white"
            placeholder="Override full video URL"
          />
        </div>
      </div>
      <div className="flex justify-end space-x-2 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          className="border-slate-600 text-white hover:bg-slate-700 bg-transparent"
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isLoading} className="bg-purple-600 hover:bg-purple-700">
          {isLoading ? "Adding..." : "Add Video"}
        </Button>
      </div>
    </form>
  )
}

// Preacher Form Component
function PreacherForm({ onClose, onSave }: { onClose: () => void; onSave: () => void }) {
  const [formData, setFormData] = useState({
    name: "",
    bio: "",
    image_url: "",
  })
  const [isLoading, setIsLoading] = useState(false)
  const queryClient = useQueryClient()

  const authHeaders = async (): Promise<Record<string, string>> => {
    const token = await getAccessTokenCached()
    return token ? { Authorization: `Bearer ${token}` } : {}
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    try {
      await apiPost("/api/admin/preachers", formData, {
        headers: await authHeaders(),
      })
      await queryClient.invalidateQueries({ queryKey: ["admin", "preachers"] })
      onSave()
      onClose()
    } catch (error) {
      console.error("Create preacher failed", error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="name" className="text-white">
          Name
        </Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          className="bg-slate-700 border-slate-600 text-white"
          required
        />
      </div>
      <div>
        <Label htmlFor="bio" className="text-white">
          Biography
        </Label>
        <Textarea
          id="bio"
          value={formData.bio}
          onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
          className="bg-slate-700 border-slate-600 text-white"
          rows={4}
        />
      </div>
      <div>
        <Label htmlFor="image_url" className="text-white">
          Image URL
        </Label>
        <Input
          id="image_url"
          value={formData.image_url}
          onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
          className="bg-slate-700 border-slate-600 text-white"
          placeholder="https://example.com/image.jpg"
        />
      </div>
      <div className="flex justify-end space-x-2 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          className="border-slate-600 text-white hover:bg-slate-700 bg-transparent"
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isLoading} className="bg-amber-600 hover:bg-amber-700">
          {isLoading ? "Adding..." : "Add Preacher"}
        </Button>
      </div>
    </form>
  )
}
