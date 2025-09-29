"use client"

import { useState, useEffect } from "react"
import { Plus, BookOpen, Play, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { VideoPlayer } from "@/components/video-player"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import Link from "next/link"

interface Collection {
  id: string
  name: string
  description: string | null
  created_at: string
  video_count?: number
}

interface CollectionVideo {
  id: string
  video_id: string
  added_at: string
  video: {
    id: string
    title: string
    youtube_id: string
    duration: number | null
    preacher: {
      name: string
    }
  }
}

export default function CollectionsPage() {
  const [collections, setCollections] = useState<Collection[]>([])
  const [selectedCollection, setSelectedCollection] = useState<Collection | null>(null)
  const [collectionVideos, setCollectionVideos] = useState<CollectionVideo[]>([])
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null)
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [newCollectionName, setNewCollectionName] = useState("")
  const [newCollectionDescription, setNewCollectionDescription] = useState("")

  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    checkUserAndLoadCollections()
  }, [])

  const checkUserAndLoadCollections = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      router.push("/auth/login")
      return
    }
    setUser(user)
    await loadCollections(user.id)
    setLoading(false)
  }

  const loadCollections = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("user_collections")
        .select(`
          *,
          collection_videos(count)
        `)
        .eq("user_id", userId)
        .order("created_at", { ascending: false })

      if (error) throw error

      const collectionsWithCount =
        data?.map((collection) => ({
          ...collection,
          video_count: collection.collection_videos?.[0]?.count || 0,
        })) || []

      setCollections(collectionsWithCount)
    } catch (error) {
      console.error("Error loading collections:", error)
    }
  }

  const loadCollectionVideos = async (collectionId: string) => {
    try {
      const { data, error } = await supabase
        .from("collection_videos")
        .select(`
          *,
          video:videos(
            id,
            title,
            youtube_id,
            duration,
            preacher:preachers(name)
          )
        `)
        .eq("collection_id", collectionId)
        .order("added_at", { ascending: false })

      if (error) throw error
      setCollectionVideos(data || [])
    } catch (error) {
      console.error("Error loading collection videos:", error)
    }
  }

  const createCollection = async () => {
    if (!user || !newCollectionName.trim()) return

    try {
      const { data, error } = await supabase
        .from("user_collections")
        .insert({
          user_id: user.id,
          name: newCollectionName.trim(),
          description: newCollectionDescription.trim() || null,
        })
        .select()
        .single()

      if (error) throw error

      await loadCollections(user.id)
      setIsCreateDialogOpen(false)
      setNewCollectionName("")
      setNewCollectionDescription("")
    } catch (error) {
      console.error("Error creating collection:", error)
    }
  }

  const deleteCollection = async (collectionId: string) => {
    if (!user) return

    try {
      const { error } = await supabase.from("user_collections").delete().eq("id", collectionId).eq("user_id", user.id)

      if (error) throw error

      await loadCollections(user.id)
      if (selectedCollection?.id === collectionId) {
        setSelectedCollection(null)
        setCollectionVideos([])
      }
    } catch (error) {
      console.error("Error deleting collection:", error)
    }
  }

  const removeVideoFromCollection = async (collectionVideoId: string) => {
    try {
      const { error } = await supabase.from("collection_videos").delete().eq("id", collectionVideoId)

      if (error) throw error

      if (selectedCollection) {
        await loadCollectionVideos(selectedCollection.id)
        await loadCollections(user.id)
      }
    } catch (error) {
      console.error("Error removing video from collection:", error)
    }
  }

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "N/A"
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading your collections...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Header */}
      <header className="border-b border-white/10 bg-black/20 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Button asChild variant="ghost" className="text-white hover:bg-white/10">
                <Link href="/">← Back to Home</Link>
              </Button>
              <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                <BookOpen className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">My Collections</h1>
                <p className="text-sm text-gray-300">Organize your favorite gospel content</p>
              </div>
            </div>
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-purple-600 hover:bg-purple-700">
                  <Plus className="w-4 h-4 mr-2" />
                  New Collection
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-slate-800 border-slate-700">
                <DialogHeader>
                  <DialogTitle className="text-white">Create New Collection</DialogTitle>
                  <DialogDescription className="text-slate-300">
                    Create a new collection to organize your favorite videos.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="name" className="text-slate-200">
                      Collection Name
                    </Label>
                    <Input
                      id="name"
                      value={newCollectionName}
                      onChange={(e) => setNewCollectionName(e.target.value)}
                      className="bg-slate-700 border-slate-600 text-white"
                      placeholder="e.g., Sunday Sermons"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="description" className="text-slate-200">
                      Description (Optional)
                    </Label>
                    <Textarea
                      id="description"
                      value={newCollectionDescription}
                      onChange={(e) => setNewCollectionDescription(e.target.value)}
                      className="bg-slate-700 border-slate-600 text-white"
                      placeholder="Describe what this collection is about..."
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    onClick={createCollection}
                    className="bg-purple-600 hover:bg-purple-700"
                    disabled={!newCollectionName.trim()}
                  >
                    Create Collection
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Collections List */}
          <div className="lg:col-span-1">
            <h2 className="text-xl font-semibold text-white mb-4">Your Collections</h2>
            <div className="space-y-3">
              {collections.map((collection) => (
                <Card
                  key={collection.id}
                  className={`bg-slate-800/50 border-slate-700 cursor-pointer transition-colors ${
                    selectedCollection?.id === collection.id ? "ring-2 ring-purple-500" : "hover:bg-slate-800/70"
                  }`}
                  onClick={() => {
                    setSelectedCollection(collection)
                    loadCollectionVideos(collection.id)
                  }}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-white text-lg">{collection.name}</CardTitle>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          deleteCollection(collection.id)
                        }}
                        className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {collection.description && <p className="text-slate-300 text-sm mb-2">{collection.description}</p>}
                    <p className="text-slate-400 text-xs">
                      {collection.video_count} video{collection.video_count !== 1 ? "s" : ""}
                    </p>
                  </CardContent>
                </Card>
              ))}

              {collections.length === 0 && (
                <Card className="bg-slate-800/50 border-slate-700">
                  <CardContent className="text-center py-8">
                    <BookOpen className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                    <p className="text-slate-300 mb-2">No collections yet</p>
                    <p className="text-slate-400 text-sm">Create your first collection to get started</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>

          {/* Collection Videos */}
          <div className="lg:col-span-2">
            {selectedCollection ? (
              <>
                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-white mb-2">{selectedCollection.name}</h2>
                  {selectedCollection.description && <p className="text-slate-300">{selectedCollection.description}</p>}
                  <p className="text-slate-400 text-sm mt-2">
                    {collectionVideos.length} video{collectionVideos.length !== 1 ? "s" : ""}
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {collectionVideos.map((item) => (
                    <Card key={item.id} className="bg-slate-800/50 border-slate-700">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <h3 className="text-white font-medium mb-1">{item.video.title}</h3>
                            <p className="text-slate-400 text-sm">
                              {item.video.preacher?.name} • {formatDuration(item.video.duration)}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeVideoFromCollection(item.id)}
                            className="text-red-400 hover:text-red-300 hover:bg-red-900/20 ml-2"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                        <Button
                          onClick={() => setSelectedVideo(item.video.youtube_id)}
                          className="w-full bg-purple-600 hover:bg-purple-700"
                        >
                          <Play className="w-4 h-4 mr-2" />
                          Watch Video
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {collectionVideos.length === 0 && (
                  <Card className="bg-slate-800/50 border-slate-700">
                    <CardContent className="text-center py-12">
                      <Play className="w-16 h-16 text-slate-400 mx-auto mb-4" />
                      <h3 className="text-xl font-semibold text-white mb-2">No videos yet</h3>
                      <p className="text-slate-400 mb-4">Add videos to this collection from the main page</p>
                      <Button asChild className="bg-purple-600 hover:bg-purple-700">
                        <Link href="/">Browse Videos</Link>
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </>
            ) : (
              <Card className="bg-slate-800/50 border-slate-700">
                <CardContent className="text-center py-16">
                  <BookOpen className="w-20 h-20 text-slate-400 mx-auto mb-4" />
                  <h3 className="text-2xl font-semibold text-white mb-2">Select a Collection</h3>
                  <p className="text-slate-400">Choose a collection from the left to view its videos</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Video Player Modal */}
      {selectedVideo && <VideoPlayer videoId={selectedVideo} onClose={() => setSelectedVideo(null)} />}
    </div>
  )
}
