"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { createClient } from "@/lib/supabase/client"

interface Collection {
  id: string
  name: string
  description: string | null
}

interface AddToCollectionDialogProps {
  videoId: string
  children: React.ReactNode
}

export function AddToCollectionDialog({ videoId, children }: AddToCollectionDialogProps) {
  const [collections, setCollections] = useState<Collection[]>([])
  const [selectedCollections, setSelectedCollections] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)

  const supabase = createClient()

  useEffect(() => {
    if (isOpen) {
      loadCollections()
    }
  }, [isOpen])

  const loadCollections = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      // Load user collections
      const { data: collectionsData, error: collectionsError } = await supabase
        .from("user_collections")
        .select("*")
        .eq("user_id", user.id)
        .order("name")

      if (collectionsError) throw collectionsError

      // Load which collections already contain this video
      const { data: existingData, error: existingError } = await supabase
        .from("collection_videos")
        .select("collection_id")
        .eq("video_id", videoId)

      if (existingError) throw existingError

      setCollections(collectionsData || [])
      setSelectedCollections(existingData?.map((item) => item.collection_id) || [])
    } catch (error) {
      console.error("Error loading collections:", error)
    }
  }

  const handleSave = async () => {
    setLoading(true)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      // Get current collection videos for this video
      const { data: currentData } = await supabase
        .from("collection_videos")
        .select("collection_id, id")
        .eq("video_id", videoId)

      const currentCollectionIds = currentData?.map((item) => item.collection_id) || []

      // Find collections to add and remove
      const toAdd = selectedCollections.filter((id) => !currentCollectionIds.includes(id))
      const toRemove = currentCollectionIds.filter((id) => !selectedCollections.includes(id))

      // Add to new collections
      if (toAdd.length > 0) {
        const { error: addError } = await supabase.from("collection_videos").insert(
          toAdd.map((collectionId) => ({
            collection_id: collectionId,
            video_id: videoId,
          })),
        )

        if (addError) throw addError
      }

      // Remove from collections
      if (toRemove.length > 0) {
        const itemsToRemove = currentData?.filter((item) => toRemove.includes(item.collection_id))
        if (itemsToRemove) {
          const { error: removeError } = await supabase
            .from("collection_videos")
            .delete()
            .in(
              "id",
              itemsToRemove.map((item) => item.id),
            )

          if (removeError) throw removeError
        }
      }

      setIsOpen(false)
    } catch (error) {
      console.error("Error updating collections:", error)
    } finally {
      setLoading(false)
    }
  }

  const toggleCollection = (collectionId: string) => {
    setSelectedCollections((prev) =>
      prev.includes(collectionId) ? prev.filter((id) => id !== collectionId) : [...prev, collectionId],
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="bg-slate-800 border-slate-700">
        <DialogHeader>
          <DialogTitle className="text-white">Add to Collections</DialogTitle>
          <DialogDescription className="text-slate-300">
            Choose which collections to add this video to.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-60 overflow-y-auto">
          {collections.length > 0 ? (
            <div className="space-y-3">
              {collections.map((collection) => (
                <div key={collection.id} className="flex items-center space-x-3">
                  <Checkbox
                    id={collection.id}
                    checked={selectedCollections.includes(collection.id)}
                    onCheckedChange={() => toggleCollection(collection.id)}
                  />
                  <label htmlFor={collection.id} className="flex-1 text-white cursor-pointer">
                    <div className="font-medium">{collection.name}</div>
                    {collection.description && <div className="text-sm text-slate-400">{collection.description}</div>}
                  </label>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-slate-400 mb-4">You don't have any collections yet.</p>
              <Button asChild variant="outline" className="border-slate-600 text-white bg-transparent">
                <a href="/collections">Create Your First Collection</a>
              </Button>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button onClick={handleSave} disabled={loading} className="bg-purple-600 hover:bg-purple-700">
            {loading ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
