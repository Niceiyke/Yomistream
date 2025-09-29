"use client"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { AIContentGenerator } from "@/components/ai-content-generator"

interface AIGenerationModalProps {
  isOpen: boolean
  onClose: () => void
  videoId: string
  videoTitle: string
  videoDescription?: string
  preacherName?: string
  onContentGenerated?: (content: any) => void
}

export function AIGenerationModal({
  isOpen,
  onClose,
  videoId,
  videoTitle,
  videoDescription,
  preacherName,
  onContentGenerated,
}: AIGenerationModalProps) {
  const handleContentGenerated = (content: any) => {
    onContentGenerated?.(content)
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-slate-900 border-white/20 text-white max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl">Generate AI Content</DialogTitle>
          <DialogDescription className="text-gray-400">
            Generate sermon notes, scripture references, and tags for "{videoTitle}"
          </DialogDescription>
        </DialogHeader>

        <AIContentGenerator
          videoId={videoId}
          videoTitle={videoTitle}
          videoDescription={videoDescription}
          preacherName={preacherName}
          onContentGenerated={handleContentGenerated}
        />
      </DialogContent>
    </Dialog>
  )
}
