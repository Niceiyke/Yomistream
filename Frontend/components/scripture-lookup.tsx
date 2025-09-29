"use client"

import { useState } from "react"
import { Search, BookOpen, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

interface ScriptureReference {
  book: string
  chapter: number
  verse: number
  text: string
}

interface ScriptureLookupProps {
  references: ScriptureReference[]
  className?: string
}

export function ScriptureLookup({ references, className = "" }: ScriptureLookupProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedReference, setSelectedReference] = useState<ScriptureReference | null>(null)

  const filteredReferences = references.filter(
    (ref) =>
      ref.book.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ref.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
      `${ref.chapter}:${ref.verse}`.includes(searchQuery),
  )

  const openBibleGateway = (ref: ScriptureReference) => {
    const reference = `${ref.book} ${ref.chapter}:${ref.verse}`
    const url = `https://www.biblegateway.com/passage/?search=${encodeURIComponent(reference)}&version=NIV`
    window.open(url, "_blank")
  }

  return (
    <div className={`space-y-4 ${className}`}>
      <Card className="bg-white/10 border-white/20">
        <CardHeader>
          <div className="flex items-center space-x-2">
            <BookOpen className="w-5 h-5 text-amber-400" />
            <CardTitle className="text-white">Scripture Lookup</CardTitle>
            <Badge variant="secondary" className="bg-amber-500/20 text-amber-200 border-amber-500/30">
              {references.length} References
            </Badge>
          </div>
          <CardDescription className="text-gray-300">
            Search and explore biblical passages from this sermon
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search by book, chapter, verse, or text..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-white/10 border-white/20 text-white placeholder:text-gray-400"
            />
          </div>

          {/* Scripture References List */}
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {filteredReferences.map((ref, index) => {
              const reference = `${ref.book} ${ref.chapter}:${ref.verse}`
              return (
                <div
                  key={index}
                  className="p-4 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors cursor-pointer"
                  onClick={() => setSelectedReference(selectedReference?.text === ref.text ? null : ref)}
                >
                  <div className="flex items-start justify-between mb-2">
                    <Badge variant="outline" className="border-amber-500/30 text-amber-200 bg-amber-500/10">
                      {reference}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        openBibleGateway(ref)
                      }}
                      className="text-gray-400 hover:text-white h-8 w-8 p-0"
                      title="Open in Bible Gateway"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </Button>
                  </div>

                  <blockquote className="text-gray-200 italic leading-relaxed border-l-2 border-amber-500/30 pl-4">
                    "{ref.text}"
                  </blockquote>

                  {selectedReference?.text === ref.text && (
                    <div className="mt-3 pt-3 border-t border-white/10">
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            openBibleGateway(ref)
                          }}
                          className="border-amber-500/30 text-amber-200 hover:bg-amber-500/10"
                        >
                          <ExternalLink className="w-3 h-3 mr-1" />
                          Read Full Chapter
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            navigator.clipboard.writeText(`"${ref.text}" - ${reference}`)
                          }}
                          className="border-white/20 text-white hover:bg-white/10"
                        >
                          Copy Verse
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {filteredReferences.length === 0 && searchQuery && (
            <div className="text-center py-8">
              <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-400">No scripture references found matching "{searchQuery}"</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
