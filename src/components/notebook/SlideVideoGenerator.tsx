import { useState } from 'react';
import { Video, Download, Loader2, Play } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { useVideoGenerator } from '@/hooks/useVideoGenerator';
import { VideoPreviewPlayer } from './VideoPreviewPlayer';
import type { UploadedFile } from '@/types/ai4gp';

interface SlideVideoGeneratorProps {
  uploadedFiles: UploadedFile[];
}

const VOICE_OPTIONS = [
  { id: 'nPczCjzI2devNBz1zQrb', name: 'Brian (Male, Professional)' },
  { id: 'pFZP5JQG7iQjIQuC4Bku', name: 'Lily (Female, Warm)' },
  { id: 'TX3LPaxmHKxFdv7VOQHJ', name: 'Liam (Male, Energetic)' },
  { id: 'XB0fDUnXU5powFXDhCwa', name: 'Charlotte (Female, Clear)' },
];

export const SlideVideoGenerator = ({ uploadedFiles }: SlideVideoGeneratorProps) => {
  const [title, setTitle] = useState('');
  const [slides, setSlides] = useState<Array<{ content: string; notes: string }>>([
    { content: '', notes: '' }
  ]);
  const [selectedVoice, setSelectedVoice] = useState(VOICE_OPTIONS[0].id);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  const { generateVideo, isGenerating, progress } = useVideoGenerator();

  const addSlide = () => {
    setSlides([...slides, { content: '', notes: '' }]);
  };

  const updateSlide = (index: number, field: 'content' | 'notes', value: string) => {
    const updated = [...slides];
    updated[index][field] = value;
    setSlides(updated);
  };

  const removeSlide = (index: number) => {
    if (slides.length > 1) {
      setSlides(slides.filter((_, i) => i !== index));
    }
  };

  const handleGenerate = async () => {
    if (!title.trim()) {
      toast.error('Please enter a presentation title');
      return;
    }

    if (slides.some(s => !s.content.trim())) {
      toast.error('Please fill in all slide content');
      return;
    }

    try {
      const url = await generateVideo({
        title,
        slides,
        voiceId: selectedVoice,
        uploadedFiles
      });

      if (url) {
        setVideoUrl(url);
        toast.success('Video generated successfully!');
      }
    } catch (error: any) {
      console.error('Video generation error:', error);
      toast.error(error.message || 'Failed to generate video');
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Generate Slide Video</CardTitle>
          <CardDescription>
            Create a narrated video presentation from your slides with AI-generated voiceover
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Title Input */}
          <div className="space-y-2">
            <Label>Presentation Title</Label>
            <Input
              placeholder="Enter presentation title..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isGenerating}
            />
          </div>

          {/* Voice Selection */}
          <div className="space-y-2">
            <Label>Narrator Voice</Label>
            <Select value={selectedVoice} onValueChange={setSelectedVoice} disabled={isGenerating}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VOICE_OPTIONS.map(voice => (
                  <SelectItem key={voice.id} value={voice.id}>
                    {voice.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Slides */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Slides</Label>
              <Button
                onClick={addSlide}
                variant="outline"
                size="sm"
                disabled={isGenerating}
              >
                Add Slide
              </Button>
            </div>

            {slides.map((slide, idx) => (
              <Card key={idx} className="border-dashed">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">Slide {idx + 1}</CardTitle>
                    {slides.length > 1 && (
                      <Button
                        onClick={() => removeSlide(idx)}
                        variant="ghost"
                        size="sm"
                        disabled={isGenerating}
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    <Label className="text-xs">Slide Content</Label>
                    <Textarea
                      placeholder="Enter slide content (bullet points, text, etc.)..."
                      value={slide.content}
                      onChange={(e) => updateSlide(idx, 'content', e.target.value)}
                      disabled={isGenerating}
                      rows={3}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Speaker Notes (for narration)</Label>
                    <Textarea
                      placeholder="Enter what should be spoken during this slide..."
                      value={slide.notes}
                      onChange={(e) => updateSlide(idx, 'notes', e.target.value)}
                      disabled={isGenerating}
                      rows={2}
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Generate Button */}
          <Button 
            onClick={handleGenerate} 
            disabled={isGenerating}
            className="w-full"
            size="lg"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                Generating Video... {progress}%
              </>
            ) : (
              <>
                <Video className="h-5 w-5 mr-2" />
                Generate Video
              </>
            )}
          </Button>

          {isGenerating && (
            <div className="space-y-2">
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground text-center">
                Processing slides and generating narration...
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Video Player */}
      {videoUrl && (
        <VideoPreviewPlayer videoUrl={videoUrl} title={title} />
      )}
    </div>
  );
};
