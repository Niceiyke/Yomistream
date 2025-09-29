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
    const { data: preachers, error } = await supabase
      .from("preachers")
      .select(`
        *,
        videos (count)
      `)
      .order("name")

    if (error) throw error

    return NextResponse.json({ preachers })
  } catch (error) {
    console.error("Error fetching preachers:", error)
    return NextResponse.json({ error: "Failed to fetch preachers" }, { status: 500 })
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
    const { name, bio, image_url } = body

    const { data: preacher, error } = await supabase
      .from("preachers")
      .insert([{ name, bio, image_url }])
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ preacher })
  } catch (error) {
    console.error("Error creating preacher:", error)
    return NextResponse.json({ error: "Failed to create preacher" }, { status: 500 })
  }
}
