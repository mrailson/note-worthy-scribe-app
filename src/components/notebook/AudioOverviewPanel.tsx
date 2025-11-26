import { useState } from 'react';
import { Mic, Download, Loader2, Play, Pause } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { UploadedFile } from '@/types/ai4gp';

interface AudioOverviewPanelProps {
  uploadedFiles: UploadedFile[];
}

const VOICE_OPTIONS = [
  { id: 'nPczCjzI2devNBz1zQrb', name: 'Brian (Male, Professional)', provider: 'elevenlabs' },
  { id: 'pFZP5JQG7iQjIQuC4Bku', name: 'Lily (Female, Warm)', provider: 'elevenlabs' },
  { id: 'TX3LPaxmHKxFdv7VOQHJ', name: 'Liam (Male, Energetic)', provider: 'elevenlabs' },
  { id: 'XB0fDUnXU5powFXDhCwa', name: 'Charlotte (Female, Clear)', provider: 'elevenlabs' },
];

export const AudioOverviewPanel = ({ uploadedFiles }: AudioOverviewPanelProps) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioText, setAudioText] = useState<string>('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState(VOICE_OPTIONS[0].id);
  const [duration, setDuration] = useState([3]); // Default 3 minutes
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);

  const handleGenerate = async () => {
    if (uploadedFiles.length === 0) {
      toast.error('Please upload documents first');
      return;
    }

    setIsGenerating(true);
    setAudioUrl(null);
    setAudioText('');

    try {
      // Combine all file contents
      const combinedContent = uploadedFiles.map(f => 
        `Document: ${f.name}\n\n${f.content}`
      ).join('\n\n---\n\n');

      const selectedVoiceOption = VOICE_OPTIONS.find(v => v.id === selectedVoice);

      const { data, error } = await supabase.functions.invoke('generate-document-audio-overview', {
        body: {
          content: combinedContent,
          voiceProvider: selectedVoiceOption?.provider || 'elevenlabs',
          voiceId: selectedVoice,
          targetDuration: duration[0] * 60 // Convert to seconds
        }
      });

      if (error) throw error;

      if (data.audioUrl) {
        setAudioUrl(data.audioUrl);
        setAudioText(data.narrativeText || '');
        toast.success('Audio overview generated successfully!');
      } else {
        throw new Error('No audio URL returned');
      }
    } catch (error: any) {
      console.error('Audio generation error:', error);
      toast.error(error.message || 'Failed to generate audio overview');
    } finally {
      setIsGenerating(false);
    }
  };

  const togglePlayPause = () => {
    if (!audioUrl) return;

    if (!audioElement) {
      const audio = new Audio(audioUrl);
      audio.addEventListener('ended', () => setIsPlaying(false));
      setAudioElement(audio);
      audio.play();
      setIsPlaying(true);
    } else {
      if (isPlaying) {
        audioElement.pause();
      } else {
        audioElement.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleDownload = () => {
    if (!audioUrl) return;
    
    const link = document.createElement('a');
    link.href = audioUrl;
    link.download = `audio-overview-${new Date().toISOString()}.mp3`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Audio downloaded!');
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Generate Audio Overview</CardTitle>
          <CardDescription>
            Create a spoken summary of your documents with AI-generated narration
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Voice Selection */}
          <div className="space-y-2">
            <Label>Select Voice</Label>
            <Select value={selectedVoice} onValueChange={setSelectedVoice}>
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

          {/* Duration Slider */}
          <div className="space-y-2">
            <Label>Target Duration: {duration[0]} minute{duration[0] > 1 ? 's' : ''}</Label>
            <Slider
              value={duration}
              onValueChange={setDuration}
              min={1}
              max={10}
              step={1}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              AI will create an overview approximately {duration[0]} minute{duration[0] > 1 ? 's' : ''} long
            </p>
          </div>

          {/* Generate Button */}
          <Button 
            onClick={handleGenerate} 
            disabled={isGenerating || uploadedFiles.length === 0}
            className="w-full"
            size="lg"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                Generating Audio...
              </>
            ) : (
              <>
                <Mic className="h-5 w-5 mr-2" />
                Generate Audio Overview
              </>
            )}
          </Button>

          {uploadedFiles.length === 0 && (
            <p className="text-sm text-muted-foreground text-center">
              Upload documents first to generate an audio overview
            </p>
          )}
        </CardContent>
      </Card>

      {/* Audio Player */}
      {audioUrl && (
        <Card className="border-primary">
          <CardHeader>
            <CardTitle>Your Audio Overview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <Button
                onClick={togglePlayPause}
                size="lg"
                variant="outline"
              >
                {isPlaying ? (
                  <Pause className="h-5 w-5" />
                ) : (
                  <Play className="h-5 w-5" />
                )}
              </Button>
              <Button
                onClick={handleDownload}
                size="lg"
                variant="outline"
              >
                <Download className="h-5 w-5 mr-2" />
                Download
              </Button>
            </div>

            {audioText && (
              <div className="mt-4 p-4 bg-muted rounded-lg">
                <p className="text-sm font-medium mb-2">Narration Text:</p>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {audioText}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};
