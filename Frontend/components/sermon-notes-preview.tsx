"use client"

import { BookOpen, FileText } from "lucide-react"
import { Badge } from "@/components/ui/badge"

interface SermonNotesPreviewProps {
  notesCount: number
  scriptureCount: number
  className?: string
}

export function SermonNotesPreview({ notesCount, scriptureCount, className = "" }: SermonNotesPreviewProps) {
  if (notesCount === 0 && scriptureCount === 0) {
    return null
  }

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      {notesCount > 0 && (
        <Badge variant="secondary" className="bg-purple-500/20 text-purple-200 border-purple-500/30 text-xs">
          <FileText className="w-3 h-3 mr-1" />
          {notesCount} Notes
        </Badge>
      )}
      {scriptureCount > 0 && (
        <Badge variant="secondary" className="bg-amber-500/20 text-amber-200 border-amber-500/30 text-xs">
          <BookOpen className="w-3 h-3 mr-1" />
          {scriptureCount} Verses
        </Badge>
      )}
    </div>
  )
}
