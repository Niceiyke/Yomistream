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
    const { name, bio, image_url } = body

    const { data: preacher, error } = await supabase
      .from("preachers")
      .update({ name, bio, image_url })
      .eq("id", params.id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ preacher })
  } catch (error) {
    console.error("Error updating preacher:", error)
    return NextResponse.json({ error: "Failed to update preacher" }, { status: 500 })
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
    // Check if preacher has videos
    const { data: videos, error: videoError } = await supabase
      .from("videos")
      .select("id")
      .eq("preacher_id", params.id)
      .limit(1)

    if (videoError) throw videoError

    if (videos && videos.length > 0) {
      return NextResponse.json(
        {
          error: "Cannot delete preacher with associated videos. Please reassign or delete videos first.",
        },
        { status: 400 },
      )
    }

    // Delete preacher favorites first
    await supabase.from("preacher_favorites").delete().eq("preacher_id", params.id)

    // Then delete the preacher
    const { error } = await supabase.from("preachers").delete().eq("id", params.id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting preacher:", error)
    return NextResponse.json({ error: "Failed to delete preacher" }, { status: 500 })
  }
}
