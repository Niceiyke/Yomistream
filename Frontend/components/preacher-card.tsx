"use client"

import { Users, Play, Heart } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

interface Preacher {
  id: string
  name: string
  church: string
  description: string
  videoCount: number
  image: string
}

interface PreacherCardProps {
  preacher: Preacher
  isFavorite?: boolean
  onViewSermons: (preacherId: string, preacherName: string) => void
  onToggleFavorite?: (preacherId: string) => void
  user?: any
}

export function PreacherCard({
  preacher,
  isFavorite = false,
  onViewSermons,
  onToggleFavorite,
  user,
}: PreacherCardProps) {
  const handleViewSermons = () => {
    onViewSermons(preacher.id, preacher.name)
  }

  const handleToggleFavorite = () => {
    if (onToggleFavorite) {
      onToggleFavorite(preacher.id)
    }
  }

  return (
    <Card className="bg-white/10 border-white/20 hover:bg-white/15 transition-all duration-200 group">
      <CardHeader className="text-center pb-3">
        <Avatar className="w-20 h-20 mx-auto mb-4 ring-2 ring-purple-500/30">
          <AvatarImage src={preacher.image || "/placeholder.svg"} alt={preacher.name} />
          <AvatarFallback className="bg-gradient-to-r from-purple-500 to-pink-500 text-white text-lg">
            {preacher.name
              .split(" ")
              .map((n) => n[0])
              .join("")}
          </AvatarFallback>
        </Avatar>
        <CardTitle className="text-white text-xl group-hover:text-purple-200 transition-colors">
          {preacher.name}
        </CardTitle>
        <CardDescription className="text-gray-300">{preacher.church}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-center">
        <p className="text-sm text-gray-400">{preacher.description}</p>

        <div className="flex items-center justify-center space-x-1 text-sm text-gray-400">
          <Play className="w-3 h-3" />
          <span>{preacher.videoCount.toLocaleString()} videos</span>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1 border-white/20 text-white hover:bg-white/10 bg-transparent"
            onClick={handleViewSermons}
          >
            <Users className="w-4 h-4 mr-2" />
            View Sermons
          </Button>

          {user && onToggleFavorite && (
            <Button
              variant="outline"
              size="icon"
              className={`border-white/20 hover:bg-white/10 bg-transparent ${
                isFavorite ? "text-red-400 border-red-400/50" : "text-white"
              }`}
              onClick={handleToggleFavorite}
            >
              <Heart className={`w-4 h-4 ${isFavorite ? "fill-current" : ""}`} />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
