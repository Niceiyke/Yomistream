import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient()

  // Check if user is authenticated
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { title, description, youtube_id, topic, preacher_id, tags, sermon_notes, scripture_references } = body

    const updateData: any = {
      title,
      description,
      topic,
      preacher_id,
    }

    // Update YouTube ID and thumbnail if provided
    if (youtube_id) {
      updateData.youtube_id = youtube_id
      updateData.thumbnail_url = `https://img.youtube.com/vi/${youtube_id}/maxresdefault.jpg`
    }

    // Update optional fields if provided
    if (tags !== undefined) updateData.tags = tags
    if (sermon_notes !== undefined) updateData.sermon_notes = sermon_notes
    if (scripture_references !== undefined) updateData.scripture_references = scripture_references

    const { data: video, error } = await supabase
      .from("videos")
      .update(updateData)
      .eq("id", params.id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ video })
  } catch (error) {
    console.error("Error updating video:", error)
    return NextResponse.json({ error: "Failed to update video" }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient()

  // Check if user is authenticated
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    // First, delete related records
    await supabase.from("user_favorites").delete().eq("video_id", params.id)
    await supabase.from("collection_videos").delete().eq("video_id", params.id)

    // Then delete the video
    const { error } = await supabase.from("videos").delete().eq("id", params.id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting video:", error)
    return NextResponse.json({ error: "Failed to delete video" }, { status: 500 })
  }
}
