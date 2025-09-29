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
    // Get counts for all main entities
    const [
      { count: videoCount },
      { count: preacherCount },
      { count: userCount },
      { count: collectionCount },
      { count: favoriteCount },
    ] = await Promise.all([
      supabase.from("videos").select("*", { count: "exact", head: true }),
      supabase.from("preachers").select("*", { count: "exact", head: true }),
      supabase.from("profiles").select("*", { count: "exact", head: true }),
      supabase.from("user_collections").select("*", { count: "exact", head: true }),
      supabase.from("user_favorites").select("*", { count: "exact", head: true }),
    ])

    // Get recent activity
    const { data: recentVideos } = await supabase
      .from("videos")
      .select("title, created_at")
      .order("created_at", { ascending: false })
      .limit(5)

    const { data: recentUsers } = await supabase
      .from("profiles")
      .select("display_name, created_at")
      .order("created_at", { ascending: false })
      .limit(5)

    // Get popular content
    const { data: popularVideos } = await supabase
      .from("videos")
      .select(`
        title,
        user_favorites (count)
      `)
      .limit(5)

    return NextResponse.json({
      stats: {
        totalVideos: videoCount || 0,
        totalPreachers: preacherCount || 0,
        totalUsers: userCount || 0,
        totalCollections: collectionCount || 0,
        totalFavorites: favoriteCount || 0,
      },
      recentActivity: {
        videos: recentVideos || [],
        users: recentUsers || [],
      },
      popularContent: {
        videos: popularVideos || [],
      },
    })
  } catch (error) {
    console.error("Error fetching stats:", error)
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 })
  }
}
