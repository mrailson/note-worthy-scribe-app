import { useState, useEffect, useRef } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Edit, Save, X, Play, Pause, RefreshCw, Headphones, Download, ChevronDown, ChevronUp } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { renderMinutesMarkdown } from "@/lib/minutesRenderer";

interface MeetingOverviewEditorProps {
  meetingId: string;
  currentOverview: string;
  audioOverviewUrl?: string;
  audioOverviewText?: string;
  audioOverviewDuration?: number;
  onOverviewChange: (overview: string) => void;
  onRegenerateAudio?: (voiceProvider?: string, voiceId?: string) => void;
  className?: string;
}

export const MeetingOverviewEditor = ({ 
  meetingId, 
  currentOverview,
  audioOverviewUrl,
  audioOverviewText,
  audioOverviewDuration,
  onOverviewChange,
  onRegenerateAudio,
  className = ""
}: MeetingOverviewEditorProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [overview, setOverview] = useState(currentOverview);
  const [saving, setSaving] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(() => {
    const saved = localStorage.getItem('audioPlaybackSpeed');
    return saved ? parseFloat(saved) : 1.25;
  });
  const [showTranscript, setShowTranscript] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState<string>(() => {
    return localStorage.getItem('audioVoiceSelection') || 'deepgram-arcas';
  });
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioObjectUrlRef = useRef<string | null>(null);
  const sourceUrlRef = useRef<string | null>(null);

  // Sync local state with prop changes
  useEffect(() => {
    setOverview(currentOverview);
  }, [currentOverview]);

  // Debug logging for save button state
  const wordCount = overview.trim().split(/\s+/).filter(word => word.length > 0).length;
  const isSaveDisabled = saving || !overview.trim() || wordCount > 80;
  
  useEffect(() => {
    if (isEditing) {
      console.log('🔍 Save button state:', {
        saving,
        hasContent: !!overview.trim(),
        wordCount,
        isSaveDisabled,
        overviewLength: overview.length,
        trimmedLength: overview.trim().length
      });
    }
  }, [overview, saving, isEditing, wordCount, isSaveDisabled]);

  const handleSave = async () => {
    const wordCount = overview.trim().split(' ').filter(word => word.length > 0).length;
    
    if (!overview.trim()) {
      toast.error("Overview cannot be empty");
      return;
    }
    
    if (wordCount > 80) {
      toast.error("Overview must be 80 words or less");
      return;
    }

    setSaving(true);
    try {
      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        throw new Error("You must be logged in to save changes");
      }

      // Check if overview already exists
      const { data: existingOverview, error: fetchError } = await supabase
        .from('meeting_overviews')
        .select('id')
        .eq('meeting_id', meetingId)
        .maybeSingle();

      if (fetchError) {
        throw new Error(`Failed to check existing overview: ${fetchError.message}`);
      }

      if (existingOverview) {
        // Update existing overview
        const { error } = await supabase
          .from('meeting_overviews')
          .update({ overview: overview.trim() })
          .eq('meeting_id', meetingId);

        if (error) throw new Error(`Update failed: ${error.message}`);
      } else {
        // Create new overview
        const { error } = await supabase
          .from('meeting_overviews')
          .insert({
            meeting_id: meetingId,
            overview: overview.trim(),
            created_by: user.id
          });

        if (error) throw new Error(`Insert failed: ${error.message}`);
      }

      setIsEditing(false);
      onOverviewChange?.(overview.trim());
      toast.success("Overview saved successfully");
    } catch (error: any) {
      console.error("Error saving overview:", error);
      toast.error(error.message || "Failed to save overview");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setOverview(currentOverview);
    setIsEditing(false);
  };

  const handlePlayAudio = async () => {
    if (!audioOverviewUrl) {
      console.log('❌ No audio URL available');
      toast.error('No audio URL available');
      return;
    }

    try {
      // Prepare blob URL to bypass CSP (media-src 'self' blob:)
      if (sourceUrlRef.current !== audioOverviewUrl || !audioObjectUrlRef.current) {
        console.log('⬇️ Downloading audio to blob URL due to CSP');
        const res = await fetch(audioOverviewUrl);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        if (!blob.type.startsWith('audio/')) {
          console.warn('Unexpected MIME type:', blob.type);
        }
        if (audioObjectUrlRef.current) {
          URL.revokeObjectURL(audioObjectUrlRef.current);
        }
        audioObjectUrlRef.current = URL.createObjectURL(blob);
        sourceUrlRef.current = audioOverviewUrl;
        console.log('✅ Blob URL ready');
      }

      if (!audioRef.current) {
        audioRef.current = new Audio(audioObjectUrlRef.current!);
        audioRef.current.playbackRate = playbackSpeed;
        audioRef.current.addEventListener('ended', () => {
          console.log('✅ Audio playback ended');
          setIsPlaying(false);
        });
        audioRef.current.addEventListener('error', (e) => {
          console.error('❌ Audio playback error:', e);
          console.error('Audio URL (blob):', audioObjectUrlRef.current);
          toast.error('Failed to play audio - check console for details');
          setIsPlaying(false);
        });
      } else {
        // If player exists but source changed, reload
        if (audioObjectUrlRef.current && audioRef.current.src !== audioObjectUrlRef.current) {
          audioRef.current.src = audioObjectUrlRef.current;
        }
      }

      if (isPlaying) {
        console.log('⏸️ Pausing audio');
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        console.log('▶️ Playing audio');
        await audioRef.current.play();
        setIsPlaying(true);
      }
    } catch (error: any) {
      console.error('❌ Play error:', error);
      toast.error(`Playback error: ${error.message}`);
      setIsPlaying(false);
    }
  };

  const handleRegenerateAudio = async () => {
    if (!onRegenerateAudio) return;
    
    setIsGeneratingAudio(true);
    try {
      // Parse voice selection to get provider and voiceId
      const [provider, voiceId] = selectedVoice.split('-');
      await onRegenerateAudio(provider, voiceId);
      // Stop any currently playing audio
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      // Revoke previous blob URL so next play fetches fresh audio
      if (audioObjectUrlRef.current) {
        URL.revokeObjectURL(audioObjectUrlRef.current);
        audioObjectUrlRef.current = null;
      }
      sourceUrlRef.current = null;
      setIsPlaying(false);
    } finally {
      setIsGeneratingAudio(false);
    }
  };

  const handleVoiceChange = (voice: string) => {
    setSelectedVoice(voice);
    localStorage.setItem('audioVoiceSelection', voice);
  };

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (audioObjectUrlRef.current) {
        URL.revokeObjectURL(audioObjectUrlRef.current);
        audioObjectUrlRef.current = null;
      }
      sourceUrlRef.current = null;
    };
  }, []);

  const handleDownloadAudio = async () => {
    if (!audioOverviewUrl) {
      toast.error('No audio available to download');
      return;
    }

    try {
      const res = await fetch(audioOverviewUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `meeting-overview-${meetingId}.mp3`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Audio downloaded');
    } catch (error: any) {
      console.error('❌ Download error:', error);
      toast.error(`Download failed: ${error.message}`);
    }
  };

  const handleSpeedChange = (speed: string) => {
    const speedValue = parseFloat(speed);
    setPlaybackSpeed(speedValue);
    localStorage.setItem('audioPlaybackSpeed', speed);
    if (audioRef.current) {
      audioRef.current.playbackRate = speedValue;
    }
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Main render - split into read-only and edit modes
  return (
    <div className={`bg-card border border-border rounded-lg ${className}`}>
      {!isEditing ? (
        // READ-ONLY VIEW
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
              Meeting Overview
            </h3>
            <Button
              onClick={() => setIsEditing(true)}
              variant="ghost"
              size="sm"
              className="h-8 px-3"
            >
              <Edit className="h-4 w-4 mr-1" />
              Edit
            </Button>
          </div>
          
          {overview ? (
            <div 
              className="prose prose-sm max-w-none text-muted-foreground"
              dangerouslySetInnerHTML={{ __html: renderMinutesMarkdown(overview) }}
            />
          ) : (
            <p className="text-sm text-muted-foreground italic">
              No overview available. Click Edit to add one.
            </p>
          )}

          {/* Audio Overview Section */}
          {(audioOverviewUrl || onRegenerateAudio) && (
            <div className="mt-4 pt-4 border-t border-border">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Headphones className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium text-foreground">
                    Audio Overview
                  </span>
                  {audioOverviewDuration && (
                    <span className="text-xs text-muted-foreground">
                      ({formatDuration(audioOverviewDuration)})
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {onRegenerateAudio && (
                    <Select value={selectedVoice} onValueChange={handleVoiceChange}>
                      <SelectTrigger className="h-8 w-48 text-xs">
                        <SelectValue placeholder="Select voice" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="deepgram-arcas">Deepgram - British Male (Arcas)</SelectItem>
                        <SelectItem value="deepgram-orion">Deepgram - British Male (Orion)</SelectItem>
                        <SelectItem value="deepgram-luna">Deepgram - British Female (Luna)</SelectItem>
                        <SelectItem value="deepgram-stella">Deepgram - British Female (Stella)</SelectItem>
                        <SelectItem value="elevenlabs-JBFqnCBsd6RMkjVDRZzb">ElevenLabs - George (British Male)</SelectItem>
                        <SelectItem value="elevenlabs-XB0fDUnXU5powFXDhCwa">ElevenLabs - Charlotte (British Female)</SelectItem>
                        <SelectItem value="elevenlabs-Xb7hH8MSUJpSbSDYk0k2">ElevenLabs - Alice (British Female)</SelectItem>
                        <SelectItem value="elevenlabs-N2lVS1w4EtoT3dr4eOWO">ElevenLabs - Callum (British Male)</SelectItem>
                        <SelectItem value="elevenlabs-IKne3meq5aSn9XLyUdCD">ElevenLabs - Charlie (British Male)</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                  {audioOverviewUrl && (
                    <>
                      <Select value={playbackSpeed.toString()} onValueChange={handleSpeedChange}>
                        <SelectTrigger className="h-8 w-20 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0.75">0.75×</SelectItem>
                          <SelectItem value="1">1×</SelectItem>
                          <SelectItem value="1.25">1.25×</SelectItem>
                          <SelectItem value="1.5">1.5×</SelectItem>
                          <SelectItem value="1.75">1.75×</SelectItem>
                          <SelectItem value="2">2×</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        onClick={handlePlayAudio}
                        variant="outline"
                        size="sm"
                        className="h-8 px-3"
                      >
                        {isPlaying ? (
                          <>
                            <Pause className="h-4 w-4 mr-1" />
                            Pause
                          </>
                        ) : (
                          <>
                            <Play className="h-4 w-4 mr-1" />
                            Play
                          </>
                        )}
                      </Button>
                      <Button
                        onClick={handleDownloadAudio}
                        variant="outline"
                        size="sm"
                        className="h-8 px-3"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                  {onRegenerateAudio && (
                    <Button
                      onClick={handleRegenerateAudio}
                      variant="ghost"
                      size="sm"
                      className="h-8 px-3"
                      disabled={isGeneratingAudio}
                    >
                      <RefreshCw className={`h-4 w-4 mr-1 ${isGeneratingAudio ? 'animate-spin' : ''}`} />
                      {isGeneratingAudio ? 'Generating...' : audioOverviewUrl ? 'Regenerate' : 'Generate'}
                    </Button>
                  )}
                </div>
              </div>
              {!audioOverviewUrl && !isGeneratingAudio && (
                <p className="text-xs text-muted-foreground mt-2">
                  Generate a 2-minute spoken overview of this meeting
                </p>
              )}
              
              {audioOverviewText && (
                <div className="mt-3">
                  <Button
                    onClick={() => setShowTranscript(!showTranscript)}
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 text-xs mb-2"
                  >
                    {showTranscript ? (
                      <>
                        <ChevronUp className="h-3 w-3 mr-1" />
                        Hide Transcript
                      </>
                    ) : (
                      <>
                        <ChevronDown className="h-3 w-3 mr-1" />
                        Show Transcript
                      </>
                    )}
                  </Button>
                  {showTranscript && (
                    <div className="p-3 bg-muted/30 rounded-md border border-border/50">
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {audioOverviewText}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        // EDIT MODE
        <div className="p-4">
          <div className="space-y-3">
            <h3 className="text-base font-semibold text-foreground">
              Edit Meeting Overview
            </h3>
            <Textarea
              value={overview}
              onChange={(e) => setOverview(e.target.value)}
              placeholder="Brief overview paragraph followed by bullet points (e.g., • Key point 1, • Key point 2)"
              className="min-h-[120px] resize-y"
            />
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                {wordCount}/80 words {wordCount > 80 && <span className="text-destructive font-semibold">(too long)</span>}
              </span>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleSave}
                disabled={isSaveDisabled}
                size="sm"
              >
                <Save className="h-3 w-3 mr-1" />
                {saving ? "Saving..." : "Save"}
              </Button>
              <Button
                variant="outline"
                onClick={handleCancel}
                disabled={saving}
                size="sm"
              >
                <X className="h-3 w-3 mr-1" />
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
