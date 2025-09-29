"use client"

import { useState } from "react"
import { Copy, Check, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"

interface ScriptureReference {
  book: string
  chapter: number
  verse: number
  text: string
}

interface ScriptureVerseCardProps {
  reference: ScriptureReference
  className?: string
  compact?: boolean
}

export function ScriptureVerseCard({ reference, className = "", compact = false }: ScriptureVerseCardProps) {
  const [copied, setCopied] = useState(false)

  const formatReference = () => {
    return `${reference.book} ${reference.chapter}:${reference.verse}`
  }

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(`"${reference.text}" - ${formatReference()}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error("Failed to copy text:", error)
    }
  }

  const openBibleGateway = () => {
    const ref = formatReference()
    const url = `https://www.biblegateway.com/passage/?search=${encodeURIComponent(ref)}&version=NIV`
    window.open(url, "_blank")
  }

  if (compact) {
    return (
      <div className={`p-3 rounded-lg bg-white/5 border border-white/10 ${className}`}>
        <div className="flex items-start justify-between mb-2">
          <Badge variant="outline" className="border-amber-500/30 text-amber-200 bg-amber-500/10 text-xs">
            {formatReference()}
          </Badge>
          <div className="flex space-x-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={copyToClipboard}
              className="text-gray-400 hover:text-white h-6 w-6 p-0"
            >
              {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={openBibleGateway}
              className="text-gray-400 hover:text-white h-6 w-6 p-0"
            >
              <ExternalLink className="w-3 h-3" />
            </Button>
          </div>
        </div>
        <ScrollArea className="max-h-[120px]">
          <p className="text-gray-200 text-sm italic leading-relaxed">"{reference.text}"</p>
        </ScrollArea>
      </div>
    )
  }

  return (
    <Card className={`bg-white/10 border-white/20 hover:bg-white/15 transition-colors ${className}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <Badge variant="outline" className="border-amber-500/30 text-amber-200 bg-amber-500/10">
            {formatReference()}
          </Badge>
          <div className="flex space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={copyToClipboard}
              className="text-gray-400 hover:text-white h-8 w-8 p-0"
              title="Copy verse"
            >
              {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={openBibleGateway}
              className="text-gray-400 hover:text-white h-8 w-8 p-0"
              title="Open in Bible Gateway"
            >
              <ExternalLink className="w-4 h-4" />
            </Button>
          </div>
        </div>
        <ScrollArea className="max-h-[200px]">
          <blockquote className="text-gray-200 italic leading-relaxed border-l-2 border-amber-500/30 pl-4">
            "{reference.text}"
          </blockquote>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
