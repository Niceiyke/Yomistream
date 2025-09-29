import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET() {
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
    const { data: videos, error } = await supabase
      .from("videos")
      .select(`
        *,
        preachers (
          id,
          name,
          image_url
        )
      `)
      .order("created_at", { ascending: false })

    if (error) throw error

    return NextResponse.json({ videos })
  } catch (error) {
    console.error("Error fetching videos:", error)
    return NextResponse.json({ error: "Failed to fetch videos" }, { status: 500 })
  }
}

export async function POST(request: Request) {
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
    const { title, description, youtube_id, topic, preacher_id } = body

    // Generate thumbnail URL from YouTube ID
    const thumbnail_url = `https://img.youtube.com/vi/${youtube_id}/maxresdefault.jpg`

    const { data: video, error } = await supabase
      .from("videos")
      .insert([
        {
          title,
          description,
          youtube_id,
          topic,
          preacher_id,
          thumbnail_url,
          duration: 0,
          tags: [],
          sermon_notes: [],
          scripture_references: [],
        },
      ])
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ video })
  } catch (error) {
    console.error("Error creating video:", error)
    return NextResponse.json({ error: "Failed to create video" }, { status: 500 })
  }
}
