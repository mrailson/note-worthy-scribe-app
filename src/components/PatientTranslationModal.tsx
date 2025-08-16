import * as React from "react"
import { useState, useEffect } from "react"
import { Play, Pause, Volume2, Eye, EyeOff, X } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

interface PatientTranslationModalProps {
  isOpen: boolean
  onClose: () => void
  onAck: (messageId: string) => void
  onBack: (messageId: string) => void
  onPlay: (messageId: string) => void
  onPause: (messageId: string) => void
  messageId: string
  sourceLang: string
  targetLang: string
  originalText: string
  translatedText: string
  audioUrl?: string
  isStreaming: boolean
}

export default function PatientTranslationModal({
  isOpen,
  onClose,
  onAck,
  onBack,
  onPlay,
  onPause,
  messageId,
  sourceLang,
  targetLang,
  originalText,
  translatedText,
  audioUrl,
  isStreaming
}: PatientTranslationModalProps) {
  const [showOriginal, setShowOriginal] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null)

  useEffect(() => {
    if (audioUrl) {
      const audioElement = new Audio(audioUrl)
      audioElement.addEventListener('ended', () => setIsPlaying(false))
      audioElement.addEventListener('pause', () => setIsPlaying(false))
      audioElement.addEventListener('play', () => setIsPlaying(true))
      setAudio(audioElement)
      
      return () => {
        audioElement.pause()
        audioElement.removeEventListener('ended', () => setIsPlaying(false))
        audioElement.removeEventListener('pause', () => setIsPlaying(false))
        audioElement.removeEventListener('play', () => setIsPlaying(true))
      }
    }
  }, [audioUrl])

  const handlePlayPause = () => {
    if (!audio) return
    
    if (isPlaying) {
      audio.pause()
      onPause(messageId)
    } else {
      audio.play()
      onPlay(messageId)
    }
  }

  const handleNext = () => {
    onAck(messageId)
    onClose()
  }

  const handleBack = () => {
    onBack(messageId)
    onClose()
  }

  const getLanguageName = (code: string) => {
    const languages: Record<string, string> = {
      'en': 'English',
      'bn': 'Bengali',
      'hi': 'Hindi',
      'ur': 'Urdu',
      'ar': 'Arabic',
      'fr': 'French',
      'es': 'Spanish',
      'de': 'German',
      'it': 'Italian',
      'pt': 'Portuguese',
      'ru': 'Russian',
      'zh': 'Chinese',
      'ja': 'Japanese',
      'ko': 'Korean'
    }
    return languages[code] || code.toUpperCase()
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto" aria-describedby="translation-description">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Volume2 className="h-5 w-5" />
            Translation Ready
          </DialogTitle>
        </DialogHeader>
        
        <div id="translation-description" className="space-y-4">
          {/* Warning Banner */}
          <Card className="p-4 bg-amber-50 border-amber-200">
            <div className="flex items-start gap-2">
              <div className="w-2 h-2 rounded-full bg-amber-500 mt-2 flex-shrink-0" />
              <p className="text-sm font-medium text-amber-800">
                Automated translation. If anything is unclear, please tell the clinician.
              </p>
            </div>
          </Card>

          {/* Language Info */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="outline">{getLanguageName(sourceLang)}</Badge>
            <span>→</span>
            <Badge variant="outline">{getLanguageName(targetLang)}</Badge>
            {isStreaming && (
              <Badge variant="secondary" className="animate-pulse">
                Streaming...
              </Badge>
            )}
          </div>

          {/* Translated Text */}
          <Card className="p-6">
            <div className="space-y-4">
              <div className="text-2xl font-medium leading-relaxed text-foreground" dir="auto">
                {translatedText}
              </div>
              
              {/* Audio Controls */}
              {audioUrl && (
                <div className="flex items-center gap-2 pt-2 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePlayPause}
                    className="flex items-center gap-2"
                  >
                    {isPlaying ? (
                      <>
                        <Pause className="h-4 w-4" />
                        Pause
                      </>
                    ) : (
                      <>
                        <Play className="h-4 w-4" />
                        Play Audio
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          </Card>

          {/* Original Text Toggle */}
          <div className="space-y-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowOriginal(!showOriginal)}
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
            >
              {showOriginal ? (
                <>
                  <EyeOff className="h-4 w-4" />
                  Hide original
                </>
              ) : (
                <>
                  <Eye className="h-4 w-4" />
                  Show original
                </>
              )}
            </Button>
            
            {showOriginal && (
              <Card className="p-4 bg-muted/50">
                <p className="text-sm text-muted-foreground mb-1">Original ({getLanguageName(sourceLang)}):</p>
                <p className="text-base">{originalText}</p>
              </Card>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex justify-between pt-4 border-t">
            <Button
              variant="outline"
              onClick={handleBack}
              className="flex items-center gap-2"
            >
              ← Back
            </Button>
            
            <Button
              onClick={handleNext}
              className="flex items-center gap-2 bg-primary hover:bg-primary/90"
            >
              Next →
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
