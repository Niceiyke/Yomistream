import { generateObject } from "ai"
import { z } from "zod"
import type { NextRequest } from "next/server"

const sermonNotesSchema = z.object({
  sermon_notes: z.array(z.string()).min(5).max(10).describe("5-10 key sermon points or takeaways"),
  scripture_references: z
    .array(
      z.object({
        reference: z.string().describe('Bible verse reference (e.g., "John 3:16")'),
        text: z.string().describe("The actual verse text"),
        context: z.string().describe("How this verse relates to the sermon point"),
      }),
    )
    .min(2)
    .max(5)
    .describe("2-5 key scripture references used in the sermon"),
  tags: z.array(z.string()).min(3).max(8).describe("3-8 relevant tags for categorizing this sermon"),
})

export async function POST(req: NextRequest) {
  try {
    const { videoTitle, videoDescription, preacherName } = await req.json()

    if (!videoTitle) {
      return Response.json({ error: "Video title is required" }, { status: 400 })
    }

    // Generate sermon notes, scripture references, and tags using AI
    const { object } = await generateObject({
      model: "openai/gpt-4o",
      schema: sermonNotesSchema,
      prompt: `
        Analyze this Christian sermon and generate comprehensive study materials:
        
        Title: "${videoTitle}"
        Description: "${videoDescription || "No description provided"}"
        Preacher: "${preacherName || "Unknown"}"
        
        Please provide:
        1. 5-10 key sermon points or takeaways that capture the main teachings
        2. 2-5 scripture references that would likely be used in this sermon (provide actual verse text)
        3. 3-8 relevant tags for categorizing this sermon (use lowercase, hyphenated format like "faith-building", "biblical-study")
        
        Focus on practical, actionable insights that would help viewers understand and apply the teachings.
        Make sure scripture references are accurate and contextually relevant.
        Tags should be specific enough to be useful for filtering but broad enough to group similar content.
      `,
      maxOutputTokens: 2000,
      temperature: 0.7,
    })

    return Response.json(object)
  } catch (error) {
    console.error("Error generating sermon notes:", error)
    return Response.json({ error: "Failed to generate sermon notes" }, { status: 500 })
  }
}
