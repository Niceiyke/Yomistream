import { createClient } from "@/lib/supabase/server"
import type { NextRequest } from "next/server"

export async function POST(req: NextRequest) {
  try {
    const { videoId, sermon_notes, scripture_references, tags } = await req.json()

    if (!videoId) {
      return Response.json({ error: "Video ID is required" }, { status: 400 })
    }

    const supabase = createClient()

    // Update the video with AI-generated content
    const { data, error } = await supabase
      .from("videos")
      .update({
        sermon_notes: sermon_notes || null,
        scripture_references: scripture_references || null,
        tags: tags || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", videoId)
      .select()

    if (error) {
      console.error("Database error:", error)
      return Response.json({ error: "Failed to update video" }, { status: 500 })
    }

    return Response.json({ success: true, data })
  } catch (error) {
    console.error("Error updating video content:", error)
    return Response.json({ error: "Failed to update video content" }, { status: 500 })
  }
}
