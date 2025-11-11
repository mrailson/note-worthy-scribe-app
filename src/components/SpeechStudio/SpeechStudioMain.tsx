import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Loader2, Volume2, Download, Star } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';

interface SpeechStudioMainProps {
  onGenerated: () => void;
}

export const SpeechStudioMain = ({ onGenerated }: SpeechStudioMainProps) => {
  const [text, setText] = useState('');
  const [voice, setVoice] = useState<'chris' | 'alice'>('chris');
  const [quality, setQuality] = useState<'standard' | 'high'>('standard');
  const [preprocess, setPreprocess] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const audioRef = useRef<HTMLAudioElement>(null);
  const { toast } = useToast();

  const characterCount = text.length;
  const maxChars = 5000;
  const estimatedDuration = Math.ceil((characterCount / 5) / 150 * 60); // ~150 words/min, 5 chars/word
  const estimatedCost = (characterCount / 1000) * 0.30; // Rough estimate: $0.30 per 1K chars

  const handleGenerate = async () => {
    if (!text.trim()) {
      toast({
        title: 'Text required',
        description: 'Please enter some text to generate speech',
        variant: 'destructive'
      });
      return;
    }

    setIsGenerating(true);
    setAudioUrl(null);

    try {
      const { data, error } = await supabase.functions.invoke('generate-speech', {
        body: {
          text,
          voiceId: voice,
          quality,
          preprocess
        }
      });

      if (error) throw error;

      if (data.success) {
        setAudioUrl(data.audioUrl);
        toast({
          title: 'Speech generated',
          description: `Audio ready (${data.duration}s, ${data.characterCount} chars)`
        });
        onGenerated();
      } else {
        throw new Error(data.error || 'Generation failed');
      }
    } catch (error: any) {
      console.error('Generation error:', error);
      toast({
        title: 'Generation failed',
        description: error.message || 'Failed to generate speech',
        variant: 'destructive'
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = () => {
    if (audioUrl) {
      const a = document.createElement('a');
      a.href = audioUrl;
      a.download = `AI4PM-Speech-${Date.now()}.mp3`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  const handlePlaybackSpeedChange = (speed: number) => {
    setPlaybackSpeed(speed);
    if (audioRef.current) {
      audioRef.current.playbackRate = speed;
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-6 space-y-4">
          {/* Text Input */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="speech-text">Text to Speech</Label>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span className={characterCount > maxChars ? 'text-destructive font-medium' : ''}>
                  {characterCount.toLocaleString()} / {maxChars.toLocaleString()}
                </span>
                <span>~{estimatedDuration}s</span>
                <span>~${estimatedCost.toFixed(2)}</span>
              </div>
            </div>
            <Textarea
              id="speech-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste or type your text here..."
              className="min-h-[200px] font-mono text-sm"
              maxLength={maxChars}
            />
          </div>

          {/* Controls */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Voice Selection */}
            <div className="space-y-2">
              <Label htmlFor="voice-select">Voice</Label>
              <Select value={voice} onValueChange={(v) => setVoice(v as 'chris' | 'alice')}>
                <SelectTrigger id="voice-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="chris">
                    <div className="flex items-center gap-2">
                      <span>Chris</span>
                      <Badge variant="outline" className="text-xs">Male</Badge>
                    </div>
                  </SelectItem>
                  <SelectItem value="alice">
                    <div className="flex items-center gap-2">
                      <span>Alice</span>
                      <Badge variant="outline" className="text-xs">Female</Badge>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {voice === 'chris' ? 'British Male - Natural' : 'British Female - Friendly'}
              </p>
            </div>

            {/* Quality */}
            <div className="space-y-2">
              <Label htmlFor="quality-select">Audio Quality</Label>
              <Select value={quality} onValueChange={(q) => setQuality(q as 'standard' | 'high')}>
                <SelectTrigger id="quality-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">Standard (128kbps)</SelectItem>
                  <SelectItem value="high">High (192kbps)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Preprocessing */}
            <div className="space-y-2">
              <Label htmlFor="preprocess-switch" className="flex items-center gap-2">
                Text Preprocessing
              </Label>
              <div className="flex items-center gap-2 pt-2">
                <Switch
                  id="preprocess-switch"
                  checked={preprocess}
                  onCheckedChange={setPreprocess}
                />
                <span className="text-sm text-muted-foreground">
                  {preprocess ? 'Enabled' : 'Disabled'}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Optimizes NHS terms and abbreviations
              </p>
            </div>
          </div>

          {/* Generate Button */}
          <Button
            onClick={handleGenerate}
            disabled={isGenerating || !text.trim() || characterCount > maxChars}
            className="w-full"
            size="lg"
          >
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating Speech...
              </>
            ) : (
              <>
                <Volume2 className="mr-2 h-4 w-4" />
                Generate Speech
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Audio Player */}
      {audioUrl && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center justify-between">
              <Label>Generated Audio</Label>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownload}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download MP3
                </Button>
              </div>
            </div>

            <audio
              ref={audioRef}
              src={audioUrl}
              controls
              className="w-full"
              onLoadedMetadata={() => {
                if (audioRef.current) {
                  audioRef.current.playbackRate = playbackSpeed;
                }
              }}
            />

            {/* Playback Speed */}
            <div className="flex items-center gap-2 justify-center">
              <Label className="text-sm">Speed:</Label>
              {[0.5, 0.75, 1, 1.25, 1.5, 2].map((speed) => (
                <Button
                  key={speed}
                  variant={playbackSpeed === speed ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handlePlaybackSpeedChange(speed)}
                  className="h-8 px-3"
                >
                  {speed}x
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
