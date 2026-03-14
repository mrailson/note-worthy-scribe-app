import { useState, useEffect } from 'react';
import { Mic, Download, Loader2, Play, Pause, Edit, RotateCcw, Check, Radio, Plus, Trash2, ChevronDown, ChevronUp, Save, Copy, Mail } from 'lucide-react';
import { MeetingDiscussionPlayer } from './MeetingDiscussionPlayer';
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

// Parse a two-host discussion script into speaker turns
const parseDialogueTurns = (script: string): Array<{ speaker: 'ALICE' | 'GEORGE'; text: string }> => {
  const turns: Array<{ speaker: 'ALICE' | 'GEORGE'; text: string }> = [];
  const lines = script.split('\n').filter(l => l.trim());
  
  let currentSpeaker: 'ALICE' | 'GEORGE' | null = null;
  let currentText = '';
  
  for (const line of lines) {
    const aliceMatch = line.match(/^ALICE:\s*(.*)$/);
    const georgeMatch = line.match(/^GEORGE:\s*(.*)$/);
    
    if (aliceMatch) {
      if (currentSpeaker && currentText.trim()) {
        turns.push({ speaker: currentSpeaker, text: currentText.trim() });
      }
      currentSpeaker = 'ALICE';
      currentText = aliceMatch[1];
    } else if (georgeMatch) {
      if (currentSpeaker && currentText.trim()) {
        turns.push({ speaker: currentSpeaker, text: currentText.trim() });
      }
      currentSpeaker = 'GEORGE';
      currentText = georgeMatch[1];
    } else if (currentSpeaker) {
      currentText += ' ' + line.trim();
    }
  }
  
  if (currentSpeaker && currentText.trim()) {
    turns.push({ speaker: currentSpeaker, text: currentText.trim() });
  }
  
  return turns;
};

// Voice mapping for discussion mode
const DISCUSSION_VOICES: Record<string, string> = {
  'ALICE': 'Xb7hH8MSUJpSbSDYk0k2',  // Alice - British Female
  'GEORGE': 'JBFqnCBsd6RMkjVDRZzb',  // George - British Male
};

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
  const [slideAnnotations, setSlideAnnotations] = useState<any[]>([]);
  const [turnTimings, setTurnTimings] = useState<Array<{ startTime: number; endTime: number }>>([]);
  const [hasSavedDiscussion, setHasSavedDiscussion] = useState(false);
  const [isLoadingDiscussion, setIsLoadingDiscussion] = useState(true);

  // Load saved discussion data from database on mount
  useEffect(() => {
    const loadDiscussionData = async () => {
      if (!meetingId) {
        setIsLoadingDiscussion(false);
        return;
      }

      try {
        const { data } = await supabase
          .from('meeting_overviews')
          .select('audio_overview_url, audio_overview_text, discussion_data')
          .eq('meeting_id', meetingId)
          .maybeSingle();

        if (data?.audio_overview_url) {
          setAudioUrl(data.audio_overview_url);
        }

        if (data?.audio_overview_text) {
          setOriginalText(data.audio_overview_text);
          setEditedText(data.audio_overview_text);
          setScriptGenerated(true);
        }

        if (data?.discussion_data) {
          try {
            const parsed = typeof data.discussion_data === 'string'
              ? JSON.parse(data.discussion_data)
              : data.discussion_data;

            if (parsed.slideAnnotations && parsed.slideAnnotations.length > 0) {
              setSlideAnnotations(parsed.slideAnnotations);
              console.log(`📊 Loaded ${parsed.slideAnnotations.length} saved slide annotations`);
            }

            if (data.audio_overview_text?.includes('ALICE:') && data.audio_overview_url) {
              setHasSavedDiscussion(true);
              setScriptGenerated(true);
              console.log('🎙️ Loaded saved discussion — ready to play');
            }
          } catch (e) {
            console.warn('Failed to parse saved discussion data:', e);
          }
        }

        // Fallback to props if DB had nothing
        if (!data && audioOverviewUrl && audioOverviewText) {
          setAudioUrl(audioOverviewUrl);
          setEditedText(audioOverviewText);
          setOriginalText(audioOverviewText);
          setScriptGenerated(true);
          if (audioOverviewDuration) {
            setAudioDuration(audioOverviewDuration);
          }
        }
      } catch (err) {
        console.warn('Failed to load discussion data:', err);
        // Fallback to props
        if (audioOverviewUrl && audioOverviewText) {
          setAudioUrl(audioOverviewUrl);
          setEditedText(audioOverviewText);
          setOriginalText(audioOverviewText);
          setScriptGenerated(true);
        }
      } finally {
        setIsLoadingDiscussion(false);
      }
    };

    loadDiscussionData();
  }, [meetingId]);

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
        if (data.slides && data.slides.length > 0) {
          setSlideAnnotations(data.slides);
          console.log(`📊 Loaded ${data.slides.length} slide annotations`);
        }
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

      // Check if this is a discussion-style script (has ALICE: and GEORGE: tags)
      const isDiscussionScript = editedText.includes('ALICE:') && editedText.includes('GEORGE:');

      if (isDiscussionScript) {
        // Multi-voice synthesis
        const turns = parseDialogueTurns(textWithPronunciations);
        console.log(`🎙️ Discussion mode: ${turns.length} turns to synthesize`);
        
        if (turns.length === 0) {
          showToast.error('Could not parse dialogue turns. Ensure script uses ALICE: and GEORGE: tags.', { section: 'meeting_manager' });
          return;
        }
        
        const audioChunks: Array<{ blob: Blob; duration: number; speaker: string }> = [];
        
        for (let i = 0; i < turns.length; i++) {
          const turn = turns[i];
          const voiceId = DISCUSSION_VOICES[turn.speaker] || DISCUSSION_VOICES['ALICE'];
          
          console.log(`🎙️ Synthesizing turn ${i + 1}/${turns.length}: ${turn.speaker} (${turn.text.substring(0, 50)}...)`);
          showToast.info(`Generating voice ${i + 1} of ${turns.length} (${turn.speaker})...`, { 
            id: 'discussion-synth', 
            duration: 60000,
            section: 'meeting_manager'
          });
          
          const { data, error } = await supabase.functions.invoke('generate-audio-overview', {
            body: {
              meetingId,
              voiceProvider: 'elevenlabs',
              voiceId: voiceId,
              text: turn.text,
              skipSave: true,
            }
          });
          
          if (error || !data?.audioUrl) {
            console.error(`Failed to synthesize turn ${i + 1}:`, error);
            showToast.error(`Failed to generate ${turn.speaker}'s voice for turn ${i + 1}`, { section: 'meeting_manager' });
            return;
          }
          
          // Fetch the audio blob
          const audioResponse = await fetch(data.audioUrl);
          if (!audioResponse.ok) throw new Error(`Failed to fetch audio for turn ${i + 1}`);
          const audioBlob = await audioResponse.blob();
          
          // Measure the actual duration of this audio chunk
          const chunkDuration = await new Promise<number>((resolve) => {
            const tempAudio = new Audio();
            const blobUrl = URL.createObjectURL(audioBlob);
            tempAudio.src = blobUrl;
            tempAudio.addEventListener('loadedmetadata', () => {
              const dur = tempAudio.duration;
              URL.revokeObjectURL(blobUrl);
              resolve(isFinite(dur) ? dur : turn.text.split(/\s+/).length / 2.5);
            });
            tempAudio.addEventListener('error', () => {
              URL.revokeObjectURL(blobUrl);
              resolve(turn.text.split(/\s+/).length / 2.5);
            });
          });
          
          console.log(`🎙️ Turn ${i + 1}: ${turn.speaker} — actual duration: ${chunkDuration.toFixed(2)}s`);
          audioChunks.push({ blob: audioBlob, duration: chunkDuration, speaker: turn.speaker });
        }
        
        showToast.info('Stitching audio together...', { id: 'discussion-synth', duration: 10000, section: 'meeting_manager' });
        
        // Build precise timing from actual audio durations
        const GAP = 0.05; // 50ms — MP3 concatenation gap is tiny
        const turnTimingsData: Array<{ startTime: number; endTime: number }> = [];
        let runningTime = 0;
        for (const chunk of audioChunks) {
          turnTimingsData.push({
            startTime: runningTime,
            endTime: runningTime + chunk.duration,
          });
          runningTime += chunk.duration + GAP;
        }
        console.log(`🎙️ Total audio from chunks: ${runningTime.toFixed(2)}s, ${turnTimingsData.length} turns`);
        
        // Concatenate all audio chunks into a single blob
        const combinedBlob = new Blob(audioChunks.map(c => c.blob), { type: 'audio/mpeg' });
        
        // Upload the combined audio
        const fileName = `${meetingId}/discussion_${Date.now()}.mp3`;
        const { error: uploadError } = await supabase.storage
          .from('meeting-audio-overviews')
          .upload(fileName, combinedBlob, { contentType: 'audio/mpeg', upsert: true });
        
        if (uploadError) throw uploadError;
        
        const { data: urlData } = supabase.storage
          .from('meeting-audio-overviews')
          .getPublicUrl(fileName);
        
        const finalAudioUrl = `${urlData.publicUrl}?v=${Date.now()}`;
        
        // Save to meeting_overviews with discussion data
        const discussionData = {
          scriptStyle: 'discussion',
          slideAnnotations: slideAnnotations,
          turnTimings: turnTimingsData,
          turnCount: turns.length,
          voices: {
            ALICE: DISCUSSION_VOICES['ALICE'],
            GEORGE: DISCUSSION_VOICES['GEORGE'],
          },
          generatedAt: new Date().toISOString(),
        };

        const { data: existingOverview } = await supabase
          .from('meeting_overviews')
          .select('id')
          .eq('meeting_id', meetingId)
          .maybeSingle();
        
        if (existingOverview?.id) {
          await supabase
            .from('meeting_overviews')
            .update({
              audio_overview_url: finalAudioUrl,
              audio_overview_text: editedText,
              discussion_data: discussionData as any,
              updated_at: new Date().toISOString(),
            })
            .eq('meeting_id', meetingId);
        } else {
          await supabase
            .from('meeting_overviews')
            .insert({
              meeting_id: meetingId,
              overview: editedText.slice(0, 600),
              audio_overview_url: finalAudioUrl,
              audio_overview_text: editedText,
              discussion_data: discussionData as any,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });
        }
        
        setAudioUrl(finalAudioUrl);
        setTurnTimings(turnTimingsData);
        setHasSavedDiscussion(true);
        showToast.success(`Discussion generated! ${turns.length} exchanges between Alice and George.`, { section: 'meeting_manager' });
        onAudioGenerated?.();
        
      } else {
        // Existing single-voice synthesis path
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
      {/* Loading state */}
      {isLoadingDiscussion && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">Loading saved discussion...</span>
        </div>
      )}

      {/* Saved discussion — show player immediately */}
      {!isLoadingDiscussion && hasSavedDiscussion && audioUrl && editedText.includes('ALICE:') ? (
        <div className="space-y-4">
          <MeetingDiscussionPlayer
            audioUrl={audioUrl}
            dialogueScript={editedText}
            meetingTitle={meetingTitle}
            slideAnnotations={slideAnnotations}
          />
          <div className="flex items-center justify-between px-1">
            <p className="text-xs text-muted-foreground">
              Saved discussion — {slideAnnotations.length} slide{slideAnnotations.length !== 1 ? 's' : ''}
            </p>
            <div className="flex gap-2">
              <Button onClick={handleDownload} variant="outline" size="sm">
                <Download className="h-4 w-4 mr-1.5" />
                Download
              </Button>
              <Button variant="ghost" size="sm" onClick={() => {
                setHasSavedDiscussion(false);
              }}>
                <Edit className="h-3 w-3 mr-1.5" />
                Edit Script
              </Button>
              <Button variant="ghost" size="sm" onClick={() => {
                setHasSavedDiscussion(false);
                setScriptGenerated(false);
                setOriginalText('');
                setEditedText('');
                setAudioUrl(null);
                setSlideAnnotations([]);
              }}>
                <RotateCcw className="h-3 w-3 mr-1.5" />
                Start Over
              </Button>
            </div>
          </div>
        </div>
      ) : !isLoadingDiscussion ? (
        <>
          {/* Generated Audio Display (non-saved / freshly generated) */}
          {audioUrl && editedText.includes('ALICE:') && editedText.includes('GEORGE:') ? (
            <div className="space-y-4">
              <MeetingDiscussionPlayer
                audioUrl={audioUrl}
                dialogueScript={editedText}
                meetingTitle={meetingTitle}
                slideAnnotations={slideAnnotations}
              />
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
              </div>
            </div>
          ) : audioUrl ? (
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
          ) : null}

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

        </>
      ) : null}

      <PronunciationDialog
        open={showPronunciationDialog}
        onOpenChange={setShowPronunciationDialog}
        onAdd={handleAddPronunciation}
        selectedVoiceId={selectedVoice}
      />
    </div>
  );
};
