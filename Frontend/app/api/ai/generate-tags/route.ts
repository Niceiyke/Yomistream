import { generateObject } from "ai"
import { z } from "zod"
import type { NextRequest } from "next/server"

const tagsSchema = z.object({
  tags: z.array(z.string()).min(3).max(8).describe("3-8 relevant tags for categorizing this sermon"),
  primary_category: z
    .enum(["gospel", "theology", "faith", "prayer", "worship", "biblical-study", "christian-living", "discipleship"])
    .describe("Primary category for this sermon"),
  difficulty_level: z.enum(["beginner", "intermediate", "advanced"]).describe("Theological complexity level"),
  target_audience: z
    .array(z.enum(["youth", "adults", "seniors", "families", "new-believers", "mature-believers"]))
    .describe("Target audience for this sermon"),
})

export async function POST(req: NextRequest) {
  try {
    const { videoTitle, videoDescription, preacherName, existingTags } = await req.json()

    if (!videoTitle) {
      return Response.json({ error: "Video title is required" }, { status: 400 })
    }

    const { object } = await generateObject({
      model: "openai/gpt-4o",
      schema: tagsSchema,
      prompt: `
        Analyze this Christian sermon and generate appropriate categorization:
        
        Title: "${videoTitle}"
        Description: "${videoDescription || "No description provided"}"
        Preacher: "${preacherName || "Unknown"}"
        ${existingTags ? `Existing tags: ${existingTags.join(", ")}` : ""}
        
        Generate:
        1. 3-8 specific tags (use lowercase, hyphenated format like "faith-building", "biblical-study")
        2. Primary category that best fits this sermon
        3. Difficulty level based on theological complexity
        4. Target audience(s) who would benefit most
        
        Tags should be:
        - Specific enough to be useful for filtering
        - Broad enough to group similar content
        - Focused on themes, topics, and practical applications
        - Consistent with Christian terminology
      `,
      maxOutputTokens: 1000,
      temperature: 0.6,
    })

    return Response.json(object)
  } catch (error) {
    console.error("Error generating tags:", error)
    return Response.json({ error: "Failed to generate tags" }, { status: 500 })
  }
}
