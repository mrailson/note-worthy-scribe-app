import { useState, useEffect } from 'react';
import { Mic, Download, Loader2, Play, Pause, Edit, RotateCcw, Check, Radio, Plus, Trash2, ChevronDown, ChevronUp, Save, Copy, Mail } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { showToast } from '@/utils/toastWrapper';
import { PronunciationDialog } from '../notebook/PronunciationDialog';
import { 
  loadPronunciationLibrary, 
  addPronunciationRule, 
  removePronunciationRule, 
  applyPronunciations, 
  countPronunciationMatches,
  type PronunciationRule 
} from '@/utils/pronunciationLibrary';
import { AudioScriptStyleSelector, type ScriptStyle } from '../notebook/AudioScriptStyleSelector';
import { SpeechToText } from '@/components/SpeechToText';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface MeetingAudioStudioProps {
  meetingId: string;
  meetingTitle: string;
  audioOverviewUrl?: string;
  audioOverviewText?: string;
  audioOverviewDuration?: number;
  meetingDurationMinutes?: number;
  onAudioGenerated?: () => void;
}

const VOICE_OPTIONS = [
  { id: 'Xb7hH8MSUJpSbSDYk0k2', name: 'Alice', description: 'British Female - Friendly' },
  { id: 'JBFqnCBsd6RMkjVDRZzb', name: 'George', description: 'British Male - Professional' },
  { id: 'XB0fDUnXU5powFXDhCwa', name: 'Charlotte', description: 'British Female - Clear' },
  { id: 'onwK4e9ZLuTAKqWW03F9', name: 'Daniel', description: 'British Male - Authoritative' },
];

export const MeetingAudioStudio = ({ 
  meetingId, 
  meetingTitle,
  audioOverviewUrl,
  audioOverviewText,
  audioOverviewDuration,
  meetingDurationMinutes,
  onAudioGenerated
}: MeetingAudioStudioProps) => {
  // Script generation state
  const [isGeneratingScript, setIsGeneratingScript] = useState(false);
  const [scriptGenerated, setScriptGenerated] = useState(false);
  const [originalText, setOriginalText] = useState('');
  const [editedText, setEditedText] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  
  // Voice preview state
  const [selectedVoice, setSelectedVoice] = useState(VOICE_OPTIONS[0].id);
  const [voicePreviews, setVoicePreviews] = useState<Record<string, string>>({});
  const [previewBarVoiceId, setPreviewBarVoiceId] = useState<string | null>(null);
  const [previewBarUrl, setPreviewBarUrl] = useState<string | null>(null);
  const [isGeneratingPreview, setIsGeneratingPreview] = useState<string | null>(null);
  
  // Final audio state
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(audioOverviewUrl || null);
  const [audioDuration, setAudioDuration] = useState<number | null>(audioOverviewDuration || null);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  
  const { user } = useAuth();
  
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

  // Load existing audio overview if available
  useEffect(() => {
    if (audioOverviewUrl && audioOverviewText) {
      setAudioUrl(audioOverviewUrl);
      setEditedText(audioOverviewText);
      setOriginalText(audioOverviewText);
      setScriptGenerated(true);
      if (audioOverviewDuration) {
        setAudioDuration(audioOverviewDuration);
      }
    }
  }, [audioOverviewUrl, audioOverviewText, audioOverviewDuration]);

  const handleGenerateScript = async () => {
    setIsGeneratingScript(true);

    try {
      const { data, error } = await supabase.functions.invoke('generate-meeting-audio-script', {
        body: {
          meetingId,
          targetDuration: duration[0] * 60,
          scriptStyle: selectedScriptStyle,
          customDirections: customDirections.trim() || undefined
        }
      });

      if (error) throw error;

      if (data.narrativeText) {
        setOriginalText(data.narrativeText);
        setEditedText(data.narrativeText);
        setScriptGenerated(true);
        showToast.success('Script generated successfully', { section: 'meeting_manager' });
      } else {
        throw new Error('No script text returned');
      }
    } catch (error: any) {
      console.error('Script generation error:', error);
      showToast.error(error.message || 'Failed to generate script', { section: 'meeting_manager' });
    } finally {
      setIsGeneratingScript(false);
    }
  };

  const handlePreviewVoice = async (voiceId: string) => {
    // If already previewed, just wire up the player bar
    if (voicePreviews[voiceId]) {
      setPreviewBarVoiceId(voiceId);
      setPreviewBarUrl(voicePreviews[voiceId]);
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
        setVoicePreviews(prev => ({ ...prev, [voiceId]: data.audioUrl }));
        setPreviewBarVoiceId(voiceId);
        setPreviewBarUrl(data.audioUrl);

        if (appliedCount > 0) {
          showToast.success(`Preview ready with ${appliedCount} pronunciation rule${appliedCount > 1 ? 's' : ''}`, { section: 'meeting_manager' });
        } else {
          showToast.success('Preview ready', { section: 'meeting_manager' });
        }
      } else {
        throw new Error('No audio URL returned');
      }
    } catch (error: any) {
      console.error('Preview generation error:', error);
      showToast.error(error.message || 'Failed to generate preview', { section: 'meeting_manager' });
    } finally {
      setIsGeneratingPreview(null);
    }
  };

  const stopPreview = () => {
    setPreviewBarUrl(null);
    setPreviewBarVoiceId(null);
  };

  const handleGenerateFullAudio = async () => {
    setIsGeneratingAudio(true);
    setAudioUrl(null);

    try {
      const textWithPronunciations = applyPronunciations(editedText, pronunciationRules);
      const appliedCount = pronunciationRules.filter(rule => 
        countPronunciationMatches(editedText, rule) > 0
      ).length;

      const { data, error } = await supabase.functions.invoke('generate-audio-overview', {
        body: {
          meetingId,
          voiceProvider: 'elevenlabs',
          voiceId: selectedVoice,
          overrideText: textWithPronunciations,
          targetDuration: duration[0]
        }
      });

      if (error) throw error;

      if (data.audioUrl) {
        setAudioUrl(data.audioUrl);
        setAudioDuration(data.duration || null);
        if (appliedCount > 0) {
          showToast.success(`Audio generated with ${appliedCount} pronunciation rule${appliedCount > 1 ? 's' : ''}`, { section: 'meeting_manager' });
        } else {
          showToast.success('Full audio generated successfully', { section: 'meeting_manager' });
        }
        onAudioGenerated?.();
      } else {
        throw new Error('No audio URL returned');
      }
    } catch (error: any) {
      console.error('Audio generation error:', error);
      showToast.error(error.message || 'Failed to generate audio', { section: 'meeting_manager' });
    } finally {
      setIsGeneratingAudio(false);
    }
  };

  const handleResetScript = () => {
    setEditedText(originalText);
    setIsEditing(false);
    showToast.success('Script reset to original', { section: 'meeting_manager' });
  };

  const handleStartOver = () => {
    setScriptGenerated(false);
    setAudioUrl(null);
    setOriginalText('');
    setEditedText('');
    setVoicePreviews({});
    setPreviewBarUrl(null);
    setPreviewBarVoiceId(null);
    showToast.success('Ready to generate new script', { section: 'meeting_manager' });
  };

  const handleDownload = () => {
    if (!audioUrl) return;
    
    const link = document.createElement('a');
    link.href = audioUrl;
    link.download = `${meetingTitle}-audio-overview.mp3`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast.success('Audio downloaded', { section: 'meeting_manager' });
  };

  const handleAddPronunciation = (rule: Omit<PronunciationRule, 'id' | 'createdAt'>) => {
    const updatedRules = addPronunciationRule(rule);
    setPronunciationRules(updatedRules);
  };

  const handleRemovePronunciation = (id: string) => {
    const updatedRules = removePronunciationRule(id);
    setPronunciationRules(updatedRules);
    showToast.success('Pronunciation rule removed', { section: 'meeting_manager' });
  };

  const handleTestPronunciation = async (rule: PronunciationRule) => {
    setTestingPronunciation(rule.id);
    setPronunciationTestUrl(null);

    try {
      const testText = `The word is ${rule.original}. When pronounced correctly, it sounds like ${rule.pronounceAs}.`;
      
      const { data, error } = await supabase.functions.invoke('generate-document-audio-overview', {
        body: {
          text: testText,
          voiceId: selectedVoice,
          voiceProvider: 'elevenlabs',
          mode: 'audio-only',
          previewLength: 50
        }
      });

      if (error) throw error;

      if (data.audioUrl) {
        setPronunciationTestUrl(data.audioUrl);
        showToast.success('Test audio ready', { section: 'meeting_manager' });
      } else {
        throw new Error('No audio URL returned');
      }
    } catch (error: any) {
      console.error('Pronunciation test error:', error);
      showToast.error(error.message || 'Failed to generate test audio', { section: 'meeting_manager' });
    } finally {
      setTestingPronunciation(null);
    }
  };

  const handleCopyScript = () => {
    navigator.clipboard.writeText(editedText);
    showToast.success('Script copied to clipboard', { section: 'meeting_manager' });
  };

  const handleSendToEmail = async () => {
    if (!user?.email || !audioUrl) {
      showToast.error('Missing user email or audio URL', { section: 'meeting_manager' });
      return;
    }
    
    setIsSendingEmail(true);
    try {
      const { error } = await supabase.functions.invoke('send-audio-email-resend', {
        body: {
          userEmail: user.email,
          meetingTitle,
          audioUrl,
          scriptText: editedText
        }
      });
      
      if (error) throw error;
      
      showToast.success('Audio summary sent to your email', { section: 'meeting_manager' });
    } catch (error: any) {
      console.error('Email send error:', error);
      showToast.error(error.message || 'Failed to send email', { section: 'meeting_manager' });
    } finally {
      setIsSendingEmail(false);
    }
  };

  const wordCount = editedText.split(' ').filter(w => w.length > 0).length;
  const estimatedDuration = Math.ceil(wordCount / 2.5);
  const activeRulesCount = pronunciationRules.filter(rule => 
    countPronunciationMatches(editedText, rule) > 0
  ).length;

  return (
    <div className="space-y-6">
      {/* Generated Audio Display */}
      {audioUrl && (
        <Card>
          <CardHeader>
            <CardTitle>Generated Audio</CardTitle>
            <CardDescription>
              Your audio overview is ready
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted p-4 rounded-lg">
              <audio 
                controls 
                className="w-full" 
                src={audioUrl}
                preload="metadata"
              >
                Your browser does not support audio playback.
              </audio>
            </div>
            
            <div className="flex items-center gap-2 flex-wrap">
              <Button onClick={handleDownload} variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Download MP3
              </Button>
              <Button 
                onClick={handleSendToEmail} 
                variant="outline" 
                size="sm"
                disabled={isSendingEmail}
              >
                {isSendingEmail ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Mail className="h-4 w-4 mr-2" />
                    Send to me
                  </>
                )}
              </Button>
              <Button onClick={handleStartOver} variant="outline" size="sm">
                <RotateCcw className="h-4 w-4 mr-2" />
                Start Over
              </Button>
              {audioDuration && (
                <Badge variant="secondary">
                  Duration: {Math.floor(audioDuration / 60)}:{(audioDuration % 60).toString().padStart(2, '0')}
                </Badge>
              )}
            </div>

            {/* Show narration text */}
            <Collapsible className="space-y-2">
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="w-full justify-between">
                  <span>View Narration Text</span>
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="bg-background border rounded-lg p-4 text-sm max-h-96 overflow-y-auto">
                  {editedText}
                </div>
              </CollapsibleContent>
            </Collapsible>
          </CardContent>
        </Card>
      )}

      {/* Step 1: Generate Script */}
      {!scriptGenerated && !audioUrl && (
        <Card>
          <CardHeader>
            <CardTitle>Step 1: Generate Script</CardTitle>
            <CardDescription>
              Create an AI-generated narration script from your meeting
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
                <Button variant="ghost" size="sm" className="w-full justify-between">
                  <span>Custom Directions (Optional)</span>
                  {directionsExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-2">
                <div className="flex items-center gap-2">
                  <Textarea
                    value={customDirections}
                    onChange={(e) => setCustomDirections(e.target.value)}
                    placeholder="e.g., Focus on clinical decisions, emphasise action items, use formal tone..."
                    className="min-h-[80px]"
                  />
                  <SpeechToText
                    onTranscription={setCustomDirections}
                    size="sm"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Add specific instructions to customise the script generation
                </p>
              </CollapsibleContent>
            </Collapsible>

            <Button
              onClick={handleGenerateScript}
              disabled={isGeneratingScript}
              className="w-full"
            >
              {isGeneratingScript ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating Script...
                </>
              ) : (
                <>
                  <Mic className="h-4 w-4 mr-2" />
                  Generate Script
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Review & Edit Script */}
      {scriptGenerated && !audioUrl && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Step 2: Review & Edit Script</CardTitle>
              <CardDescription>
                Review and refine the generated narration
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Badge variant="outline">
                    {wordCount} words
                  </Badge>
                  <Badge variant="outline">
                    ~{estimatedDuration} seconds
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    onClick={handleCopyScript}
                    variant="outline"
                    size="sm"
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copy
                  </Button>
                  {isEditing ? (
                    <Button
                      onClick={() => setIsEditing(false)}
                      variant="outline"
                      size="sm"
                    >
                      <Check className="h-4 w-4 mr-2" />
                      Done Editing
                    </Button>
                  ) : (
                    <Button
                      onClick={() => setIsEditing(true)}
                      variant="outline"
                      size="sm"
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                  )}
                  <Button
                    onClick={handleResetScript}
                    variant="outline"
                    size="sm"
                  >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Reset
                  </Button>
                </div>
              </div>

              <Textarea
                value={editedText}
                onChange={(e) => setEditedText(e.target.value)}
                disabled={!isEditing}
                className="min-h-[300px] font-mono text-sm"
              />
            </CardContent>
          </Card>

          {/* Pronunciation Guide */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Pronunciation Guide</CardTitle>
                  <CardDescription>
                    Add custom pronunciations for names, places, and terms
                  </CardDescription>
                </div>
                <Button
                  onClick={() => setShowPronunciationDialog(true)}
                  size="sm"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Rule
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Collapsible
                open={pronunciationExpanded}
                onOpenChange={setPronunciationExpanded}
              >
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="w-full justify-between">
                    <span>
                      Pronunciation Rules ({pronunciationRules.length})
                      {activeRulesCount > 0 && ` • ${activeRulesCount} active in script`}
                    </span>
                    {pronunciationExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-2 mt-4">
                  {pronunciationRules.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No pronunciation rules added yet
                    </p>
                  ) : (
                    pronunciationRules.map((rule) => {
                      const matches = countPronunciationMatches(editedText, rule);
                      return (
                        <div
                          key={rule.id}
                          className="flex items-center justify-between p-3 bg-muted rounded-lg"
                        >
                          <div className="flex-1">
                            <div className="font-medium text-sm">
                              {rule.original} → {rule.pronounceAs}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {rule.category} • {matches} match{matches !== 1 ? 'es' : ''} in script
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              onClick={() => handleTestPronunciation(rule)}
                              disabled={testingPronunciation === rule.id}
                              variant="outline"
                              size="sm"
                            >
                              {testingPronunciation === rule.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                'Test'
                              )}
                            </Button>
                            <Button
                              onClick={() => handleRemovePronunciation(rule.id)}
                              variant="ghost"
                              size="sm"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </CollapsibleContent>
              </Collapsible>

              {pronunciationTestUrl && (
                <div className="mt-4 p-3 bg-muted rounded-lg">
                  <p className="text-sm mb-2">Pronunciation Test:</p>
                  <audio controls className="w-full" src={pronunciationTestUrl}>
                    Your browser does not support audio playback.
                  </audio>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Step 3: Select Voice */}
          <Card>
            <CardHeader>
              <CardTitle>Step 3: Select Voice</CardTitle>
              <CardDescription>
                Choose a narrator voice and preview
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {VOICE_OPTIONS.map((voice) => {
                  const isSelected = selectedVoice === voice.id;
                  const isPreviewing = previewBarVoiceId === voice.id;
                  const isGenerating = isGeneratingPreview === voice.id;

                  return (
                    <Card
                      key={voice.id}
                      className={`cursor-pointer transition-all ${
                        isSelected
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50'
                      }`}
                      onClick={() => setSelectedVoice(voice.id)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h4 className="font-semibold">{voice.name}</h4>
                            <p className="text-xs text-muted-foreground">{voice.description}</p>
                          </div>
                          {isSelected && (
                            <Badge variant="default">Selected</Badge>
                          )}
                        </div>
                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePreviewVoice(voice.id);
                          }}
                          disabled={isGenerating}
                          variant="outline"
                          size="sm"
                          className="w-full mt-2"
                        >
                          {isGenerating ? (
                            <>
                              <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                              Generating...
                            </>
                          ) : isPreviewing ? (
                            <>
                              <Pause className="h-3 w-3 mr-2" />
                              Playing Preview
                            </>
                          ) : (
                            <>
                              <Play className="h-3 w-3 mr-2" />
                              Preview Voice
                            </>
                          )}
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {previewBarUrl && (
                <div className="p-4 bg-muted rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">
                      Preview: {VOICE_OPTIONS.find(v => v.id === previewBarVoiceId)?.name}
                    </p>
                    <Button onClick={stopPreview} variant="ghost" size="sm">
                      Stop
                    </Button>
                  </div>
                  <audio
                    controls
                    autoPlay
                    className="w-full"
                    src={previewBarUrl}
                    onEnded={stopPreview}
                  >
                    Your browser does not support audio playback.
                  </audio>
                </div>
              )}

              <Button
                onClick={handleGenerateFullAudio}
                disabled={isGeneratingAudio}
                className="w-full"
                size="lg"
              >
                {isGeneratingAudio ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating Full Audio...
                  </>
                ) : (
                  <>
                    <Radio className="h-4 w-4 mr-2" />
                    Generate Full Audio
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </>
      )}

      <PronunciationDialog
        open={showPronunciationDialog}
        onOpenChange={setShowPronunciationDialog}
        onAdd={handleAddPronunciation}
        selectedVoiceId={selectedVoice}
      />
    </div>
  );
};
