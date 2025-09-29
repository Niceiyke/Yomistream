"use client"

import { useState, useEffect } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { X } from "lucide-react"

interface TagFilterProps {
  availableTags: string[]
  selectedTags: string[]
  onTagsChange: (tags: string[]) => void
}

export function TagFilter({ availableTags, selectedTags, onTagsChange }: TagFilterProps) {
  const [popularTags, setPopularTags] = useState<string[]>([])

  useEffect(() => {
    // Get most popular tags (you could enhance this with actual usage counts)
    const popular = availableTags.slice(0, 12)
    setPopularTags(popular)
  }, [availableTags])

  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      onTagsChange(selectedTags.filter((t) => t !== tag))
    } else {
      onTagsChange([...selectedTags, tag])
    }
  }

  const clearAllTags = () => {
    onTagsChange([])
  }

  if (availableTags.length === 0) return null

  return (
    <div className="space-y-3">
      {selectedTags.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-gray-400">Active filters:</span>
          {selectedTags.map((tag) => (
            <Badge
              key={tag}
              variant="default"
              className="bg-purple-600 text-white cursor-pointer hover:bg-purple-700"
              onClick={() => toggleTag(tag)}
            >
              {tag}
              <X className="w-3 h-3 ml-1" />
            </Badge>
          ))}
          <Button variant="ghost" size="sm" onClick={clearAllTags} className="text-gray-400 hover:text-white text-xs">
            Clear all
          </Button>
        </div>
      )}

      <div className="space-y-2">
        <span className="text-sm text-gray-400">Popular tags:</span>
        <div className="flex flex-wrap gap-2">
          {popularTags.map((tag) => (
            <Badge
              key={tag}
              variant={selectedTags.includes(tag) ? "default" : "outline"}
              className={`cursor-pointer transition-colors ${
                selectedTags.includes(tag)
                  ? "bg-purple-600 text-white hover:bg-purple-700"
                  : "bg-white/5 border-white/20 text-gray-300 hover:bg-white/10 hover:text-white"
              }`}
              onClick={() => toggleTag(tag)}
            >
              {tag}
            </Badge>
          ))}
        </div>
      </div>
    </div>
  )
}
