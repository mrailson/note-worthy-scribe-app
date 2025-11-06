import { useState, useEffect, useRef } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Edit, Save, X, Play, Pause, RefreshCw, Headphones } from "lucide-react";
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
  onRegenerateAudio?: () => void;
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
  const audioRef = useRef<HTMLAudioElement | null>(null);

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

  const handlePlayAudio = () => {
    if (!audioOverviewUrl) return;

    if (!audioRef.current) {
      audioRef.current = new Audio(audioOverviewUrl);
      audioRef.current.addEventListener('ended', () => setIsPlaying(false));
      audioRef.current.addEventListener('error', () => {
        toast.error('Failed to play audio');
        setIsPlaying(false);
      });
    }

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleRegenerateAudio = async () => {
    if (!onRegenerateAudio) return;
    
    setIsGeneratingAudio(true);
    try {
      await onRegenerateAudio();
      // Stop any currently playing audio
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      setIsPlaying(false);
    } finally {
      setIsGeneratingAudio(false);
    }
  };

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

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
              <div className="flex items-center justify-between">
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
                  {audioOverviewUrl && (
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
                <div className="mt-3 p-3 bg-muted/30 rounded-md border border-border/50">
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {audioOverviewText}
                  </p>
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
