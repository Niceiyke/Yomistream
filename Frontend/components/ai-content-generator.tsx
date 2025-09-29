"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Sparkles, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { apiPost } from "@/lib/api"
import { createClient } from "@/lib/supabase/client"

interface AIContentGeneratorProps {
  videoId: string
  videoTitle: string
  videoDescription?: string
  preacherName?: string
  onContentGenerated?: (content: any) => void
}

export function AIContentGenerator({
  videoId,
  videoTitle,
  videoDescription,
  preacherName,
  onContentGenerated,
}: AIContentGeneratorProps) {
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedContent, setGeneratedContent] = useState<any>(null)

  const generateContent = async () => {
    setIsGenerating(true)
    try {
      const content = await apiPost("/api/ai/generate-sermon-notes", {
        videoTitle,
        videoDescription,
        preacherName,
      })
      setGeneratedContent(content)

      // Update the video in the database
      const supabase = createClient()
      const { data: sessionData } = await supabase.auth.getSession()
      const accessToken = sessionData.session?.access_token
      await apiPost(
        "/api/ai/update-video-content",
        {
          videoId,
          sermon_notes: content.sermon_notes,
          scripture_references: content.scripture_references,
          tags: content.tags,
        },
        {
          headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
        },
      )

      toast.success("AI content generated successfully!")
      onContentGenerated?.(content)
    } catch (error) {
      console.error("Error generating content:", error)
      toast.error("Failed to generate AI content")
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <Card className="bg-white/5 border-white/10">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-purple-400" />
          AI Content Generator
        </CardTitle>
        <CardDescription className="text-gray-400">
          Generate sermon notes, scripture references, and tags using AI
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button
          onClick={generateContent}
          disabled={isGenerating}
          className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 mr-2" />
              Generate AI Content
            </>
          )}
        </Button>

        {generatedContent && (
          <div className="space-y-4 mt-6">
            <div>
              <h4 className="text-white font-semibold mb-2">Generated Tags:</h4>
              <div className="flex flex-wrap gap-2">
                {generatedContent.tags?.map((tag: string, index: number) => (
                  <Badge key={index} variant="secondary" className="bg-purple-500/20 text-purple-200">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>

            <div>
              <h4 className="text-white font-semibold mb-2">Sermon Notes:</h4>
              <ul className="text-gray-300 text-sm space-y-1">
                {generatedContent.sermon_notes?.slice(0, 3).map((note: string, index: number) => (
                  <li key={index} className="flex items-start gap-2">
                    <span className="text-purple-400 mt-1">•</span>
                    {note}
                  </li>
                ))}
                {generatedContent.sermon_notes?.length > 3 && (
                  <li className="text-gray-500 text-xs">+{generatedContent.sermon_notes.length - 3} more points...</li>
                )}
              </ul>
            </div>

            <div>
              <h4 className="text-white font-semibold mb-2">Scripture References:</h4>
              <div className="space-y-2">
                {generatedContent.scripture_references?.slice(0, 2).map((ref: any, index: number) => (
                  <div key={index} className="text-sm">
                    <span className="text-purple-400 font-medium">{ref.reference}</span>
                    <p className="text-gray-400 text-xs mt-1">{ref.context}</p>
                  </div>
                ))}
                {generatedContent.scripture_references?.length > 2 && (
                  <p className="text-gray-500 text-xs">
                    +{generatedContent.scripture_references.length - 2} more references...
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
