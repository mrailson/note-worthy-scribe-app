import { useState } from 'react';
import { Mic, Download, Loader2, Play, Pause, Edit, RotateCcw, Check, Radio } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { UploadedFile } from '@/types/ai4gp';

interface AudioOverviewPanelProps {
  uploadedFiles: UploadedFile[];
}

const VOICE_OPTIONS = [
  { id: 'JBFqnCBsd6RMkjVDRZzb', name: 'George', description: 'Male, Professional' },
  { id: 'N2lVS1w4EtoT3dr4eOWO', name: 'Callum', description: 'Male, Warm' },
  { id: 'XB0fDUnXU5powFXDhCwa', name: 'Charlotte', description: 'Female, Clear' },
  { id: 'Xb7hH8MSUJpSbSDYk0k2', name: 'Alice', description: 'Female, Friendly' },
  { id: 'XrExE9yKIg1WjnnlVkGX', name: 'Matilda', description: 'Female, Articulate' },
  { id: 'bIHbv24MWmeRgasZH58o', name: 'Will', description: 'Male, Confident' },
  { id: 'onwK4e9ZLuTAKqWW03F9', name: 'Daniel', description: 'Male, Authoritative' },
];

export const AudioOverviewPanel = ({ uploadedFiles }: AudioOverviewPanelProps) => {
  // Script generation state
  const [isGeneratingScript, setIsGeneratingScript] = useState(false);
  const [scriptGenerated, setScriptGenerated] = useState(false);
  const [originalText, setOriginalText] = useState('');
  const [editedText, setEditedText] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  
  // Voice preview state
  const [selectedVoice, setSelectedVoice] = useState(VOICE_OPTIONS[0].id);
  const [voicePreviews, setVoicePreviews] = useState<Record<string, string>>({});
  const [previewingVoice, setPreviewingVoice] = useState<string | null>(null);
  const [isGeneratingPreview, setIsGeneratingPreview] = useState<string | null>(null);
  const [previewAudio, setPreviewAudio] = useState<HTMLAudioElement | null>(null);
  
  // Final audio state
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  
  const [duration, setDuration] = useState([3]); // Default 3 minutes

  const handleGenerateScript = async () => {
    if (uploadedFiles.length === 0) {
      toast.error('Please upload documents first');
      return;
    }

    setIsGeneratingScript(true);

    try {
      const combinedContent = uploadedFiles.map(f => 
        `Document: ${f.name}\n\n${f.content}`
      ).join('\n\n---\n\n');

      const { data, error } = await supabase.functions.invoke('generate-document-audio-overview', {
        body: {
          content: combinedContent,
          targetDuration: duration[0] * 60,
          mode: 'script-only'
        }
      });

      if (error) throw error;

      if (data.narrativeText) {
        setOriginalText(data.narrativeText);
        setEditedText(data.narrativeText);
        setScriptGenerated(true);
        toast.success('Script generated successfully!');
      } else {
        throw new Error('No script text returned');
      }
    } catch (error: any) {
      console.error('Script generation error:', error);
      toast.error(error.message || 'Failed to generate script');
    } finally {
      setIsGeneratingScript(false);
    }
  };

  const handlePreviewVoice = async (voiceId: string) => {
    // Stop any currently playing preview
    if (previewAudio) {
      previewAudio.pause();
      previewAudio.currentTime = 0;
    }

    // If already previewed, just play cached audio
    if (voicePreviews[voiceId]) {
      if (previewingVoice === voiceId) {
        setPreviewingVoice(null);
        return;
      }
      const audio = new Audio(voicePreviews[voiceId]);
      audio.addEventListener('ended', () => setPreviewingVoice(null));
      setPreviewAudio(audio);
      audio.play();
      setPreviewingVoice(voiceId);
      return;
    }

    // Generate preview
    setIsGeneratingPreview(voiceId);

    try {
      const { data, error } = await supabase.functions.invoke('generate-document-audio-overview', {
        body: {
          text: editedText,
          voiceId,
          voiceProvider: 'elevenlabs',
          mode: 'audio-only',
          previewLength: 50 // ~20 seconds
        }
      });

      if (error) throw error;

      if (data.audioUrl) {
        setVoicePreviews(prev => ({ ...prev, [voiceId]: data.audioUrl }));
        const audio = new Audio(data.audioUrl);
        audio.addEventListener('ended', () => setPreviewingVoice(null));
        setPreviewAudio(audio);
        audio.play();
        setPreviewingVoice(voiceId);
      } else {
        throw new Error('No audio URL returned');
      }
    } catch (error: any) {
      console.error('Preview generation error:', error);
      toast.error(error.message || 'Failed to generate preview');
    } finally {
      setIsGeneratingPreview(null);
    }
  };

  const stopPreview = () => {
    if (previewAudio) {
      previewAudio.pause();
      previewAudio.currentTime = 0;
    }
    setPreviewingVoice(null);
  };

  const handleRegenerateWithVoice = async () => {
    setIsGeneratingAudio(true);
    setAudioUrl(null);

    try {
      const { data, error } = await supabase.functions.invoke('generate-document-audio-overview', {
        body: {
          text: editedText,
          voiceId: selectedVoice,
          voiceProvider: 'elevenlabs',
          mode: 'audio-only'
        }
      });

      if (error) throw error;

      if (data.audioUrl) {
        setAudioUrl(data.audioUrl);
        toast.success('Full audio generated successfully!');
      } else {
        throw new Error('No audio URL returned');
      }
    } catch (error: any) {
      console.error('Audio generation error:', error);
      toast.error(error.message || 'Failed to generate audio');
    } finally {
      setIsGeneratingAudio(false);
    }
  };

  const handleResetScript = () => {
    setEditedText(originalText);
    setIsEditing(false);
    toast.success('Script reset to original');
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

  const wordCount = editedText.split(' ').filter(w => w.length > 0).length;
  const estimatedDuration = Math.ceil(wordCount / 2.5);

  return (
    <div className="space-y-6">
      {/* Step 1: Generate Script */}
      {!scriptGenerated && (
        <Card>
          <CardHeader>
            <CardTitle>Step 1: Generate Script</CardTitle>
            <CardDescription>
              Create an AI-generated narration script from your documents
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
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

            <Button 
              onClick={handleGenerateScript} 
              disabled={isGeneratingScript || uploadedFiles.length === 0}
              className="w-full"
              size="lg"
            >
              {isGeneratingScript ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Generating Script...
                </>
              ) : (
                <>
                  <Mic className="h-5 w-5 mr-2" />
                  Generate Script
                </>
              )}
            </Button>

            {uploadedFiles.length === 0 && (
              <p className="text-sm text-muted-foreground text-center">
                Upload documents first to generate a script
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 2: Review & Edit Script */}
      {scriptGenerated && !audioUrl && (
        <>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Step 2: Review & Edit Script</CardTitle>
                  <CardDescription>
                    Review and edit the generated narration before selecting a voice
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  {isEditing ? (
                    <Button onClick={() => setIsEditing(false)} size="sm" variant="outline">
                      <Check className="h-4 w-4 mr-2" />
                      Done Editing
                    </Button>
                  ) : (
                    <Button onClick={() => setIsEditing(true)} size="sm" variant="outline">
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                  )}
                  <Button onClick={handleResetScript} size="sm" variant="outline">
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Reset
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Narration Text</Label>
                  <p className="text-sm text-muted-foreground">
                    {wordCount} words • ~{Math.floor(estimatedDuration / 60)}:{(estimatedDuration % 60).toString().padStart(2, '0')} duration
                  </p>
                </div>
                <Textarea
                  value={editedText}
                  onChange={(e) => setEditedText(e.target.value)}
                  className="min-h-[200px] font-mono text-sm"
                  disabled={!isEditing}
                />
              </div>

              <Button 
                onClick={handleGenerateScript}
                variant="outline"
                className="w-full"
              >
                <Loader2 className="h-4 w-4 mr-2" />
                Regenerate Script
              </Button>
            </CardContent>
          </Card>

          {/* Step 3: Voice Selection with Previews */}
          <Card>
            <CardHeader>
              <CardTitle>Step 3: Select Voice</CardTitle>
              <CardDescription>
                Listen to voice previews (first 20 seconds) and select your preferred narrator
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                {VOICE_OPTIONS.map(voice => (
                  <Card 
                    key={voice.id}
                    className={`cursor-pointer transition-all hover:shadow-md ${
                      selectedVoice === voice.id ? 'border-primary border-2' : ''
                    }`}
                    onClick={() => {
                      stopPreview();
                      setSelectedVoice(voice.id);
                    }}
                  >
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-semibold">{voice.name}</h4>
                          <p className="text-sm text-muted-foreground">{voice.description}</p>
                        </div>
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                          selectedVoice === voice.id ? 'border-primary bg-primary' : 'border-muted'
                        }`}>
                          {selectedVoice === voice.id && (
                            <Radio className="h-3 w-3 text-primary-foreground fill-primary-foreground" />
                          )}
                        </div>
                      </div>
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePreviewVoice(voice.id);
                        }}
                        variant={previewingVoice === voice.id ? "default" : "outline"}
                        size="sm"
                        className="w-full"
                        disabled={isGeneratingPreview === voice.id}
                      >
                        {isGeneratingPreview === voice.id ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Loading...
                          </>
                        ) : previewingVoice === voice.id ? (
                          <>
                            <Pause className="h-4 w-4 mr-2" />
                            Stop Preview
                          </>
                        ) : (
                          <>
                            <Play className="h-4 w-4 mr-2" />
                            Preview
                          </>
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Generate Full Audio Button */}
              <Button 
                onClick={handleRegenerateWithVoice}
                disabled={isGeneratingAudio}
                className="w-full"
                size="lg"
              >
                {isGeneratingAudio ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    Generating Full Audio...
                  </>
                ) : (
                  <>
                    <Mic className="h-5 w-5 mr-2" />
                    Generate Full Audio with {VOICE_OPTIONS.find(v => v.id === selectedVoice)?.name}
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </>
      )}

      {/* Step 4: Final Audio Player */}
      {audioUrl && (
        <Card className="border-primary">
          <CardHeader>
            <CardTitle>Your Audio Overview</CardTitle>
            <CardDescription>
              Generated with {VOICE_OPTIONS.find(v => v.id === selectedVoice)?.name}
            </CardDescription>
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

            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm font-medium mb-2">Final Narration Text:</p>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {editedText}
              </p>
            </div>

            <Button 
              onClick={() => {
                setScriptGenerated(false);
                setAudioUrl(null);
                setEditedText('');
                setOriginalText('');
                setVoicePreviews({});
                stopPreview();
              }}
              variant="outline"
              className="w-full"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Start Over
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
