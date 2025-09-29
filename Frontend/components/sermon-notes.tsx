"use client"

import { useState } from "react"
import {
  BookOpen,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  Bookmark,
  BookmarkCheck,
  Share2,
  ExternalLink,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { ScrollArea } from "@/components/ui/scroll-area"

interface ScriptureReference {
  book: string
  chapter: number
  verse: number
  text: string
}

interface SermonNotesProps {
  notes: string[]
  scriptureReferences: ScriptureReference[]
  className?: string
}

export function SermonNotes({ notes, scriptureReferences, className = "" }: SermonNotesProps) {
  const [isNotesOpen, setIsNotesOpen] = useState(true)
  const [isScripturesOpen, setIsScripturesOpen] = useState(true)
  const [copiedVerse, setCopiedVerse] = useState<string | null>(null)
  const [bookmarkedNotes, setBookmarkedNotes] = useState<Set<number>>(new Set())
  const [bookmarkedVerses, setBookmarkedVerses] = useState<Set<string>>(new Set())
  const [highlightedText, setHighlightedText] = useState<string>("")

  const copyToClipboard = async (text: string, reference: string) => {
    try {
      await navigator.clipboard.writeText(`${text} - ${reference}`)
      setCopiedVerse(reference)
      setTimeout(() => setCopiedVerse(null), 2000)
    } catch (error) {
      console.error("Failed to copy text:", error)
    }
  }

  const toggleNoteBookmark = (index: number) => {
    const newBookmarks = new Set(bookmarkedNotes)
    if (newBookmarks.has(index)) {
      newBookmarks.delete(index)
    } else {
      newBookmarks.add(index)
    }
    setBookmarkedNotes(newBookmarks)
  }

  const toggleVerseBookmark = (reference: string) => {
    const newBookmarks = new Set(bookmarkedVerses)
    if (newBookmarks.has(reference)) {
      newBookmarks.delete(reference)
    } else {
      newBookmarks.add(reference)
    }
    setBookmarkedVerses(newBookmarks)
  }

  const shareNote = async (note: string, index: number) => {
    try {
      await navigator.share({
        title: `Sermon Note ${index + 1}`,
        text: note,
      })
    } catch (error) {
      // Fallback to clipboard if share API not available
      await navigator.clipboard.writeText(note)
    }
  }

  const openBibleGateway = (ref: ScriptureReference) => {
    const reference = formatReference(ref)
    const url = `https://www.biblegateway.com/passage/?search=${encodeURIComponent(reference)}&version=NIV`
    window.open(url, "_blank")
  }

  const formatReference = (ref: ScriptureReference) => {
    return `${ref.book} ${ref.chapter}:${ref.verse}`
  }

  return (
    <TooltipProvider>
      <div className={`space-y-4 ${className}`}>
        {/* Sermon Notes Section */}
        <Card className="bg-white/10 border-white/20">
          <Collapsible open={isNotesOpen} onOpenChange={setIsNotesOpen}>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-white/5 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <BookOpen className="w-5 h-5 text-purple-400" />
                    <CardTitle className="text-white">Sermon Notes</CardTitle>
                    <Badge variant="secondary" className="bg-purple-500/20 text-purple-200 border-purple-500/30">
                      {notes.length} Key Points
                    </Badge>
                    {bookmarkedNotes.size > 0 && (
                      <Badge variant="secondary" className="bg-amber-500/20 text-amber-200 border-amber-500/30">
                        {bookmarkedNotes.size} Bookmarked
                      </Badge>
                    )}
                  </div>
                  {isNotesOpen ? (
                    <ChevronUp className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  )}
                </div>
                <CardDescription className="text-gray-300">Key insights and takeaways from this sermon</CardDescription>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0">
                <ScrollArea className="h-[400px] pr-4">
                  <div className="space-y-3">
                    {notes.map((note, index) => (
                      <div
                        key={index}
                        className={`flex items-start space-x-3 p-3 rounded-lg border transition-all duration-200 ${
                          bookmarkedNotes.has(index)
                            ? "bg-amber-500/10 border-amber-500/30"
                            : "bg-white/5 border-white/10 hover:bg-white/10"
                        }`}
                      >
                        <div className="flex-shrink-0 w-6 h-6 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white text-sm font-semibold">
                          {index + 1}
                        </div>
                        <p className="text-gray-200 leading-relaxed flex-1">{note}</p>
                        <div className="flex items-center space-x-1">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleNoteBookmark(index)}
                                className="text-gray-400 hover:text-amber-400 h-8 w-8 p-0"
                              >
                                {bookmarkedNotes.has(index) ? (
                                  <BookmarkCheck className="w-4 h-4 text-amber-400" />
                                ) : (
                                  <Bookmark className="w-4 h-4" />
                                )}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{bookmarkedNotes.has(index) ? "Remove bookmark" : "Bookmark note"}</p>
                            </TooltipContent>
                          </Tooltip>

                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => shareNote(note, index)}
                                className="text-gray-400 hover:text-blue-400 h-8 w-8 p-0"
                              >
                                <Share2 className="w-4 h-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Share note</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>

        {/* Scripture References Section */}
        <Card className="bg-white/10 border-white/20">
          <Collapsible open={isScripturesOpen} onOpenChange={setIsScripturesOpen}>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-white/5 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <BookOpen className="w-5 h-5 text-amber-400" />
                    <CardTitle className="text-white">Scripture References</CardTitle>
                    <Badge variant="secondary" className="bg-amber-500/20 text-amber-200 border-amber-500/30">
                      {scriptureReferences.length} Verses
                    </Badge>
                    {bookmarkedVerses.size > 0 && (
                      <Badge variant="secondary" className="bg-purple-500/20 text-purple-200 border-purple-500/30">
                        {bookmarkedVerses.size} Bookmarked
                      </Badge>
                    )}
                  </div>
                  {isScripturesOpen ? (
                    <ChevronUp className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  )}
                </div>
                <CardDescription className="text-gray-300">Biblical passages referenced in this sermon</CardDescription>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0">
                <ScrollArea className="h-[500px] pr-4">
                  <div className="space-y-4">
                    {scriptureReferences.map((ref, index) => {
                      const reference = formatReference(ref)
                      const isBookmarked = bookmarkedVerses.has(reference)
                      return (
                        <div
                          key={index}
                          className={`p-4 rounded-lg border transition-all duration-200 ${
                            isBookmarked
                              ? "bg-purple-500/10 border-purple-500/30"
                              : "bg-white/5 border-white/10 hover:bg-white/10"
                          }`}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <Badge variant="outline" className="border-amber-500/30 text-amber-200 bg-amber-500/10">
                              {reference}
                            </Badge>
                            <div className="flex items-center space-x-1">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => toggleVerseBookmark(reference)}
                                    className="text-gray-400 hover:text-purple-400 h-8 w-8 p-0"
                                  >
                                    {isBookmarked ? (
                                      <BookmarkCheck className="w-4 h-4 text-purple-400" />
                                    ) : (
                                      <Bookmark className="w-4 h-4" />
                                    )}
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>{isBookmarked ? "Remove bookmark" : "Bookmark verse"}</p>
                                </TooltipContent>
                              </Tooltip>

                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => copyToClipboard(ref.text, reference)}
                                    className="text-gray-400 hover:text-green-400 h-8 w-8 p-0"
                                  >
                                    {copiedVerse === reference ? (
                                      <Check className="w-4 h-4 text-green-400" />
                                    ) : (
                                      <Copy className="w-4 h-4" />
                                    )}
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Copy verse</p>
                                </TooltipContent>
                              </Tooltip>

                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => openBibleGateway(ref)}
                                    className="text-gray-400 hover:text-blue-400 h-8 w-8 p-0"
                                  >
                                    <ExternalLink className="w-4 h-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Open in Bible Gateway</p>
                                </TooltipContent>
                              </Tooltip>
                            </div>
                          </div>
                          <blockquote className="text-gray-200 italic leading-relaxed border-l-2 border-amber-500/30 pl-4">
                            "{ref.text}"
                          </blockquote>
                        </div>
                      )
                    })}
                  </div>
                </ScrollArea>
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      </div>
    </TooltipProvider>
  )
}
