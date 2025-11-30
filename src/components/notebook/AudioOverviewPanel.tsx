import { useState, useEffect } from 'react';
import { Mic, Download, Loader2, Play, Pause, Edit, RotateCcw, Check, Radio, BookOpen, Plus, Trash2, ChevronDown, ChevronUp, Save, Copy, MessageSquare } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { UploadedFile } from '@/types/ai4gp';
import { PronunciationDialog } from './PronunciationDialog';
import { 
  loadPronunciationLibrary, 
  addPronunciationRule, 
  removePronunciationRule, 
  applyPronunciations, 
  countPronunciationMatches,
  type PronunciationRule 
} from '@/utils/pronunciationLibrary';
import { useAudioOverviewHistory, type AudioSession } from '@/hooks/useAudioOverviewHistory';
import { AudioScriptStyleSelector, type ScriptStyle } from './AudioScriptStyleSelector';
import { SpeechToText } from '@/components/SpeechToText';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface AudioOverviewPanelProps {
  uploadedFiles: UploadedFile[];
  loadedSession?: AudioSession | null;
  onSessionLoaded?: () => void;
}

const VOICE_OPTIONS = [
  { id: 'Xb7hH8MSUJpSbSDYk0k2', name: 'Alice', description: 'Female, Friendly' },
  { id: 'JBFqnCBsd6RMkjVDRZzb', name: 'George', description: 'Male, Professional' },
  { id: 'XB0fDUnXU5powFXDhCwa', name: 'Charlotte', description: 'Female, Clear' },
  { id: 'onwK4e9ZLuTAKqWW03F9', name: 'Daniel', description: 'Male, Authoritative' },
];

export const AudioOverviewPanel = ({ uploadedFiles, loadedSession, onSessionLoaded }: AudioOverviewPanelProps) => {
  const { saveSession, updateSession } = useAudioOverviewHistory();
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  
  // Script generation state
  const [isGeneratingScript, setIsGeneratingScript] = useState(false);
  const [scriptGenerated, setScriptGenerated] = useState(false);
  const [originalText, setOriginalText] = useState('');
  const [editedText, setEditedText] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  
  // Voice preview state - stores blob URLs for reliable playback
  const [selectedVoice, setSelectedVoice] = useState(VOICE_OPTIONS[0].id);
  const [voicePreviews, setVoicePreviews] = useState<Record<string, string>>({});
  const [isGeneratingPreview, setIsGeneratingPreview] = useState<string | null>(null);
  const [preloadingPreviews, setPreloadingPreviews] = useState(false);
  
  // Final audio state
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null); // original (e.g. base64) URL used for saving
  const [audioPlaybackUrl, setAudioPlaybackUrl] = useState<string | null>(null); // browser-friendly blob URL for playback
  
  const [duration, setDuration] = useState([3]); // Default 3 minutes
  const [selectedScriptStyle, setSelectedScriptStyle] = useState<ScriptStyle>('executive');
  const [customDirections, setCustomDirections] = useState('');
  const [directionsExpanded, setDirectionsExpanded] = useState(false);

  // Pronunciation library state
  const [pronunciationRules, setPronunciationRules] = useState<PronunciationRule[]>(() => loadPronunciationLibrary());
  const [showPronunciationDialog, setShowPronunciationDialog] = useState(false);
  const [pronunciationExpanded, setPronunciationExpanded] = useState(false);
  const [testingPronunciation, setTestingPronunciation] = useState<string | null>(null);
  const [pronunciationTestUrl, setPronunciationTestUrl] = useState<string | null>(null);

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
          mode: 'script-only',
          scriptStyle: selectedScriptStyle,
          customDirections: customDirections.trim() || undefined
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

  // Helper to convert data URL to blob URL for reliable playback
  const dataUrlToObjectUrl = (dataUrl: string): string | null => {
    try {
      if (!dataUrl.startsWith('data:audio')) {
        console.warn('Not a data URL, using as-is:', dataUrl.slice(0, 50));
        return dataUrl;
      }

      const base64Part = dataUrl.split(',')[1];
      if (!base64Part) {
        console.error('No base64 data found in URL');
        return null;
      }

      const binary = atob(base64Part);
      const len = binary.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binary.charCodeAt(i);
      }

      const blob = new Blob([bytes], { type: 'audio/mpeg' });
      const objectUrl = URL.createObjectURL(blob);
      console.log('✅ Created blob URL:', objectUrl.slice(0, 50));
      return objectUrl;
    } catch (error) {
      console.error('❌ Failed to convert data URL to blob:', error);
      return null;
    }
  };

  // Preload all voice previews when script is generated
  const preloadAllVoices = async () => {
    setPreloadingPreviews(true);
    const sampleText = "Welcome to your audio notebook. This is a preview of how this voice sounds.";
    
    for (const voice of VOICE_OPTIONS) {
      // Skip if already cached
      if (voicePreviews[voice.id]) continue;
      
      try {
        const { data, error } = await supabase.functions.invoke('generate-document-audio-overview', {
          body: {
            text: sampleText,
            voiceId: voice.id,
            voiceProvider: 'elevenlabs',
            mode: 'audio-only',
            previewLength: 25 // ~10 seconds at ~2.5 words/sec
          }
        });

        if (error) {
          console.error(`Failed to preload ${voice.name}:`, error);
          continue;
        }

        if (data.audioUrl) {
          const blobUrl = dataUrlToObjectUrl(data.audioUrl);
          if (blobUrl) {
            setVoicePreviews(prev => ({
              ...prev,
              [voice.id]: blobUrl
            }));
          }
        }
      } catch (error) {
        console.error(`Error preloading ${voice.name}:`, error);
      }
    }
    
    setPreloadingPreviews(false);
    toast.success('Voice previews ready');
  };

  // Preload when script is first generated
  useEffect(() => {
    if (scriptGenerated && !audioUrl && Object.keys(voicePreviews).length === 0) {
      preloadAllVoices();
    }
  }, [scriptGenerated, audioUrl]);

  // Cleanup blob URLs on unmount
  useEffect(() => {
    return () => {
      Object.values(voicePreviews).forEach(url => {
        if (url.startsWith('blob:')) {
          URL.revokeObjectURL(url);
        }
      });
    };
  }, [voicePreviews]);


  // Create a blob/object URL for playback when we have a base64 data URL
  useEffect(() => {
    try {
      // Clean up any previous playback URL
      return () => {
        if (audioPlaybackUrl) {
          URL.revokeObjectURL(audioPlaybackUrl);
        }
      };
    } catch {
      // Ignore cleanup errors
    }
  }, [audioPlaybackUrl]);

  useEffect(() => {
    if (!audioUrl) {
      // When audio is cleared, also clear playback URL
      if (audioPlaybackUrl) {
        URL.revokeObjectURL(audioPlaybackUrl);
      }
      setAudioPlaybackUrl(null);
      return;
    }

    if (!audioUrl.startsWith('data:audio')) {
      // For normal URLs (already streamable), just use them directly
      if (audioPlaybackUrl) {
        URL.revokeObjectURL(audioPlaybackUrl);
        setAudioPlaybackUrl(null);
      }
      return;
    }

    try {
      const base64Part = audioUrl.split(',')[1];
      if (!base64Part) return;

      const binary = atob(base64Part);
      const len = binary.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binary.charCodeAt(i);
      }

      const blob = new Blob([bytes], { type: 'audio/mpeg' });
      const objectUrl = URL.createObjectURL(blob);

      if (audioPlaybackUrl) {
        URL.revokeObjectURL(audioPlaybackUrl);
      }

      setAudioPlaybackUrl(objectUrl);
    } catch (error) {
      console.error('Failed to create playback URL from base64 audio:', error);
      if (audioPlaybackUrl) {
        URL.revokeObjectURL(audioPlaybackUrl);
      }
      setAudioPlaybackUrl(null);
    }
  }, [audioUrl]);

  const handlePreviewVoice = async (voiceId: string) => {
    // If already previewed, player is already visible
    if (voicePreviews[voiceId]) {
      console.log('✅ Using cached preview for', voiceId);
      return;
    }

    // Generate preview with pronunciation rules applied
    setIsGeneratingPreview(voiceId);

    try {
      const textWithPronunciations = applyPronunciations(editedText, pronunciationRules);
      const appliedCount = pronunciationRules.filter(rule => 
        countPronunciationMatches(editedText, rule) > 0
      ).length;

      const { data, error } = await supabase.functions.invoke('generate-document-audio-overview', {
        body: {
          text: textWithPronunciations,
          voiceId,
          voiceProvider: 'elevenlabs',
          mode: 'audio-only',
          previewLength: 25 // ~10 seconds at ~2.5 words/sec
        }
      });

      if (error) throw error;

      if (data.audioUrl) {
        console.log('📥 Received audio, converting to blob...');
        const blobUrl = dataUrlToObjectUrl(data.audioUrl);
        
        if (!blobUrl) {
          throw new Error('Failed to convert audio to playable format');
        }

        console.log('✅ Blob URL created, storing in state');
        setVoicePreviews(prev => ({ ...prev, [voiceId]: blobUrl }));

        const message = appliedCount > 0 
          ? `Preview ready with ${appliedCount} pronunciation rule${appliedCount > 1 ? 's' : ''}`
          : 'Preview ready - play below';
        toast.success(message);
      } else {
        throw new Error('No audio URL returned');
      }
    } catch (error: any) {
      console.error('❌ Preview generation error:', error);
      toast.error(error.message || 'Failed to generate preview');
    } finally {
      setIsGeneratingPreview(null);
    }
  };


  const handleRegenerateWithVoice = async () => {
    setIsGeneratingAudio(true);
    setAudioUrl(null);

    try {
      const textWithPronunciations = applyPronunciations(editedText, pronunciationRules);
      const appliedCount = pronunciationRules.filter(rule => 
        countPronunciationMatches(editedText, rule) > 0
      ).length;

      const { data, error } = await supabase.functions.invoke('generate-document-audio-overview', {
        body: {
          text: textWithPronunciations,
          voiceId: selectedVoice,
          voiceProvider: 'elevenlabs',
          mode: 'audio-only'
        }
      });

      if (error) throw error;

      if (data.audioUrl) {
        setAudioUrl(data.audioUrl);
        if (appliedCount > 0) {
          toast.success(`Audio generated with ${appliedCount} pronunciation rule${appliedCount > 1 ? 's' : ''}!`);
        } else {
          toast.success('Full audio generated successfully!');
        }
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
    // Clear voice previews to force regeneration
    Object.values(voicePreviews).forEach(url => {
      if (url.startsWith('blob:')) {
        URL.revokeObjectURL(url);
      }
    });
    setVoicePreviews({});
    toast.success('Script reset to original');
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

  const handleAddPronunciation = (rule: Omit<PronunciationRule, 'id' | 'createdAt'>) => {
    const updatedRules = addPronunciationRule(rule);
    setPronunciationRules(updatedRules);
  };

  const handleRemovePronunciation = (id: string) => {
    const updatedRules = removePronunciationRule(id);
    setPronunciationRules(updatedRules);
    toast.success('Pronunciation rule removed');
  };

  const handleTestPronunciation = async (rule: PronunciationRule) => {
    setTestingPronunciation(rule.id);
    setPronunciationTestUrl(null);

    try {
      // Create a test sentence using the word
      const testText = `The word is ${rule.original}. When pronounced correctly, it sounds like ${rule.pronounceAs}.`;
      
      const { data, error } = await supabase.functions.invoke('generate-document-audio-overview', {
        body: {
          text: testText,
          voiceId: selectedVoice,
          voiceProvider: 'elevenlabs',
          mode: 'audio-only',
          previewLength: 50 // Short test
        }
      });

      if (error) throw error;

      if (data.audioUrl) {
        setPronunciationTestUrl(data.audioUrl);
        toast.success('Test audio ready. Use player below to listen.');
      } else {
        throw new Error('No audio URL returned');
      }
    } catch (error: any) {
      console.error('Pronunciation test error:', error);
      toast.error(error.message || 'Failed to generate test audio');
    } finally {
      setTestingPronunciation(null);
    }
  };

  const [isSaving, setIsSaving] = useState(false);

  const handleSaveSession = async () => {
    if (!scriptGenerated || !editedText) {
      toast.error('Generate a script first');
      return;
    }

    setIsSaving(true);
    try {
      const voiceName = VOICE_OPTIONS.find(v => v.id === selectedVoice)?.name || 'Unknown';
      const sourceDocNames = uploadedFiles.map(f => f.name);

      if (currentSessionId) {
        // Update existing session
        await updateSession(currentSessionId, {
          title: sourceDocNames.length > 0 ? `${sourceDocNames[0]} - ${new Date().toLocaleDateString('en-GB')}` : `Audio Session - ${new Date().toLocaleDateString('en-GB')}`,
          edited_script: editedText,
          audio_url: audioUrl,
          pronunciation_rules: pronunciationRules,
          custom_directions: customDirections.trim() || undefined,
        });
      } else {
        // Save new session
        const savedSession = await saveSession({
          title: sourceDocNames.length > 0 ? `${sourceDocNames[0]} - ${new Date().toLocaleDateString('en-GB')}` : `Audio Session - ${new Date().toLocaleDateString('en-GB')}`,
          original_script: originalText,
          edited_script: editedText,
          audio_url: audioUrl,
          voice_id: selectedVoice,
          voice_name: voiceName,
          source_documents: sourceDocNames,
          pronunciation_rules: pronunciationRules,
          target_duration_minutes: duration[0],
          script_style: selectedScriptStyle,
          custom_directions: customDirections.trim() || undefined,
        });

        if (savedSession) {
          setCurrentSessionId(savedSession.id);
        }
      }
    } finally {
      setIsSaving(false);
    }
  };

  // Load session when loadedSession prop changes
  useEffect(() => {
    if (loadedSession) {
      setCurrentSessionId(loadedSession.id);
      setOriginalText(loadedSession.original_script);
      setEditedText(loadedSession.edited_script || loadedSession.original_script);
      setSelectedVoice(loadedSession.voice_id);
      setAudioUrl(loadedSession.audio_url);
      setPronunciationRules(loadedSession.pronunciation_rules || []);
      setScriptGenerated(true);
      
      if (loadedSession.target_duration_minutes) {
        setDuration([loadedSession.target_duration_minutes]);
      }
      
      if (loadedSession.script_style) {
        setSelectedScriptStyle(loadedSession.script_style as ScriptStyle);
      }
      
      if (loadedSession.custom_directions) {
        setCustomDirections(loadedSession.custom_directions);
      }
      
      toast.success(`Loaded: ${loadedSession.title}`);
      onSessionLoaded?.();
    }
  }, [loadedSession]);

  const wordCount = editedText.split(' ').filter(w => w.length > 0).length;
  const estimatedDuration = Math.ceil(wordCount / 2.5);
  const activeRulesCount = pronunciationRules.filter(rule => 
    countPronunciationMatches(editedText, rule) > 0
  ).length;

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

            <AudioScriptStyleSelector 
              selectedStyle={selectedScriptStyle}
              onStyleSelect={setSelectedScriptStyle}
            />

            <Collapsible
              open={directionsExpanded}
              onOpenChange={setDirectionsExpanded}
              className="space-y-2"
            >
              <CollapsibleTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-between"
                  type="button"
                >
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    <span>Custom Directions</span>
                    {customDirections && (
                      <Badge variant="secondary" className="ml-2">
                        {customDirections.length} chars
                      </Badge>
                    )}
                  </div>
                  {directionsExpanded ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-2">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">
                    Add specific instructions for the AI script generation (optional)
                  </Label>
                  <div className="relative">
                    <Textarea
                      value={customDirections}
                      onChange={(e) => setCustomDirections(e.target.value)}
                      placeholder="e.g., Focus on the financial implications, keep it upbeat and motivational, emphasise the patient safety aspects, use simple language suitable for a general audience..."
                      className="min-h-[100px] pr-12 resize-y"
                      maxLength={500}
                    />
                    <div className="absolute bottom-2 right-2">
                      <SpeechToText
                        onTranscription={(text) => {
                          setCustomDirections(prev => {
                            const newText = prev ? `${prev} ${text}` : text;
                            return newText.slice(0, 500);
                          });
                        }}
                        size="sm"
                        className="h-8 w-8"
                      />
                    </div>
                  </div>
                  <div className="flex justify-between items-center text-xs text-muted-foreground">
                    <span>
                      {customDirections.length}/500 characters
                    </span>
                    {customDirections && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setCustomDirections('')}
                        className="h-6 px-2"
                      >
                        Clear
                      </Button>
                    )}
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>

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
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Label>Narration Text</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(editedText || '');
                          toast.success('Narration text copied');
                        } catch (error) {
                          console.error('Failed to copy narration text:', error);
                          toast.error('Unable to copy text to clipboard');
                        }
                      }}
                      title="Copy narration text"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
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

          {/* Pronunciation Guide */}
          <Card>
            <CardHeader 
              className="cursor-pointer" 
              onClick={() => setPronunciationExpanded(!pronunciationExpanded)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5" />
                  <CardTitle>Pronunciation Guide</CardTitle>
                  {activeRulesCount > 0 && (
                    <Badge variant="secondary">{activeRulesCount} active</Badge>
                  )}
                </div>
                {pronunciationExpanded ? (
                  <ChevronUp className="h-5 w-5" />
                ) : (
                  <ChevronDown className="h-5 w-5" />
                )}
              </div>
              <CardDescription>
                Help the AI pronounce names and places correctly
              </CardDescription>
            </CardHeader>
            
            {pronunciationExpanded && (
              <CardContent className="space-y-4">
                {pronunciationRules.length > 0 ? (
                  <div className="space-y-2">
                    {pronunciationRules.map(rule => {
                      const matchCount = countPronunciationMatches(editedText, rule);
                      return (
                        <div 
                          key={rule.id} 
                          className={`p-3 rounded-lg border ${
                            matchCount > 0 ? 'bg-primary/5 border-primary/20' : 'bg-muted border-border'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium">"{rule.original}"</span>
                                <span className="text-muted-foreground">→</span>
                                <span className="font-medium">"{rule.pronounceAs}"</span>
                                {matchCount > 0 && (
                                  <Badge variant="outline" className="text-xs">
                                    ×{matchCount}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground capitalize">
                                {rule.category}
                                {rule.caseInsensitive && ' • Case insensitive'}
                              </p>
                            </div>
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleTestPronunciation(rule)}
                                disabled={testingPronunciation === rule.id || !selectedVoice}
                                className="h-8 w-8 p-0"
                                title="Test pronunciation"
                              >
                                {testingPronunciation === rule.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Play className="h-4 w-4" />
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemovePronunciation(rule.id)}
                                className="h-8 w-8 p-0"
                                title="Remove rule"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No pronunciation rules yet. Add rules to fix mispronounced words.
                  </p>
                )}

                <Button
                  onClick={() => setShowPronunciationDialog(true)}
                  variant="outline"
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Pronunciation Rule
                </Button>

                {pronunciationTestUrl && (
                  <div className="space-y-2 pt-2">
                    <Label>Pronunciation test player</Label>
                    <audio
                      key={pronunciationTestUrl}
                      controls
                      src={pronunciationTestUrl}
                      className="w-full"
                      onError={(e) => {
                        console.error('Pronunciation test audio error:', e);
                        toast.error('Unable to play test audio.');
                      }}
                    />
                  </div>
                )}

                {activeRulesCount > 0 && (
                  <p className="text-xs text-muted-foreground text-center">
                    💡 {activeRulesCount} rule{activeRulesCount > 1 ? 's' : ''} will be applied when generating audio
                  </p>
                )}
              </CardContent>
            )}
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
              {preloadingPreviews && (
                <div className="flex items-center gap-2 p-4 bg-muted rounded-lg mb-4">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Preparing voice previews...</span>
                </div>
              )}
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                {VOICE_OPTIONS.map(voice => (
                  <Card 
                    key={voice.id}
                    className={`cursor-pointer transition-all hover:shadow-md ${
                      selectedVoice === voice.id ? 'border-primary border-2' : ''
                    }`}
                    onClick={() => {
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
                         variant={voicePreviews[voice.id] ? 'default' : 'outline'}
                         size="sm"
                         className="w-full"
                         disabled={isGeneratingPreview === voice.id || (!voicePreviews[voice.id] && preloadingPreviews)}
                       >
                        {isGeneratingPreview === voice.id ? (
                           <>
                             <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                             Loading...
                           </>
                         ) : !voicePreviews[voice.id] && preloadingPreviews ? (
                           <>
                             <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                             Preparing...
                           </>
                         ) : voicePreviews[voice.id] ? (
                           <>
                             <Play className="h-4 w-4 mr-2" />
                             Preview Voice
                           </>
                         ) : (
                           <>
                             <Play className="h-4 w-4 mr-2" />
                             Preview Voice
                           </>
                         )}
                       </Button>
                      
                      {voicePreviews[voice.id] && (
                        <div className="mt-3 space-y-1">
                          <p className="text-xs text-muted-foreground">Preview player:</p>
                          <audio
                            key={voicePreviews[voice.id]}
                            controls
                            src={voicePreviews[voice.id]}
                            className="w-full"
                            onLoadedData={(e) => {
                              const audio = e.currentTarget;
                              console.log('🎵 Audio loaded, duration:', audio.duration);
                            }}
                            onError={(e) => {
                              console.error('❌ Audio error:', e);
                              toast.error('Unable to play preview');
                            }}
                          />
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>


              {/* Generate Full Audio Button */}
              <Button 
                onClick={handleRegenerateWithVoice}
                disabled={isGeneratingAudio}
                className="w-full mt-6"
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
            <div className="space-y-2">
              <Label>Audio player with timeline</Label>
              <audio
                key={audioPlaybackUrl || audioUrl || 'audio-player'}
                controls
                src={audioPlaybackUrl || audioUrl || undefined}
                className="w-full"
                onError={(e) => {
                  console.error('Audio playback error:', e);
                  toast.error('Unable to play audio in this browser. Please use the Download button instead.');
                }}
              />
            </div>

            <div className="flex items-center gap-4 flex-wrap">
              <Button
                onClick={handleDownload}
                size="lg"
                variant="outline"
              >
                <Download className="h-5 w-5 mr-2" />
                Download
              </Button>
              <Button
                onClick={handleSaveSession}
                size="lg"
                variant="default"
                disabled={isSaving}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : currentSessionId ? (
                  <>
                    <Check className="h-5 w-5 mr-2" />
                    Update Session
                  </>
                ) : (
                  <>
                    <Save className="h-5 w-5 mr-2" />
                    Save to History
                  </>
                )}
              </Button>
            </div>

            {currentSessionId && (
              <Badge variant="secondary" className="w-fit">
                <Check className="h-3 w-3 mr-1" />
                Saved to history
              </Badge>
            )}

            <div className="p-4 bg-muted rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <p className="text-sm font-medium">Final Narration Text:</p>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(editedText || '');
                      toast.success('Final narration text copied');
                    } catch (error) {
                      console.error('Failed to copy narration text:', error);
                      toast.error('Unable to copy text to clipboard');
                    }
                  }}
                  title="Copy narration text"
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
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

      {/* Pronunciation Dialog */}
      <PronunciationDialog
        open={showPronunciationDialog}
        onOpenChange={setShowPronunciationDialog}
        onAdd={handleAddPronunciation}
        selectedVoiceId={selectedVoice}
      />
    </div>
  );
};
