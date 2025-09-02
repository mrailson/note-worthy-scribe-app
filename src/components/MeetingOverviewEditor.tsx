import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Edit, Save, X, Sparkles, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { renderNHSMarkdown } from '@/lib/nhsMarkdownRenderer';

interface MeetingOverviewEditorProps {
  meetingId: string;
  currentOverview?: string;
  onOverviewChange?: (overview: string) => void;
  className?: string;
  meetingNotes?: string;
  meetingTitle?: string;
}

export const MeetingOverviewEditor = ({ 
  meetingId, 
  currentOverview = "", 
  onOverviewChange,
  className = "",
  meetingNotes,
  meetingTitle
}: MeetingOverviewEditorProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [overview, setOverview] = useState(currentOverview);
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  const handleRegenerateOverview = async () => {
    setRegenerating(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('generate-meeting-overview', {
        body: {
          meetingTitle: meetingTitle,
          meetingNotes: meetingNotes
        }
      });
      
      if (error) throw error;
      
      if (data?.overview) {
        setOverview(data.overview);
        
        // Auto-save the regenerated overview
        const { data: existingOverview } = await supabase
          .from('meeting_overviews')
          .select('id')
          .eq('meeting_id', meetingId)
          .maybeSingle();

        if (existingOverview) {
          const { error: updateError } = await supabase
            .from('meeting_overviews')
            .update({ overview: data.overview })
            .eq('meeting_id', meetingId);

          if (updateError) throw updateError;
        } else {
          const { error: insertError } = await supabase
            .from('meeting_overviews')
            .insert({
              meeting_id: meetingId,
              overview: data.overview,
              created_by: (await supabase.auth.getUser()).data.user?.id
            });

          if (insertError) throw insertError;
        }
        
        toast.success("Overview regenerated successfully");
        onOverviewChange?.(data.overview);
      } else {
        toast.error("Failed to generate overview");
      }
    } catch (error: any) {
      console.error('Error regenerating overview:', error);
      toast.error("Failed to regenerate overview");
    } finally {
      setRegenerating(false);
    }
  };

  const handleSave = async () => {
    const wordCount = overview.trim().split(' ').filter(word => word.length > 0).length;
    
    if (!overview.trim()) {
      toast.error("Overview cannot be empty");
      return;
    }
    
    if (wordCount > 50) {
      toast.error("Overview must be 50 words or less");
      return;
    }

    setSaving(true);
    try {
      // Check if overview already exists
      const { data: existingOverview } = await supabase
        .from('meeting_overviews')
        .select('id')
        .eq('meeting_id', meetingId)
        .maybeSingle();

      if (existingOverview) {
        // Update existing overview
        const { error } = await supabase
          .from('meeting_overviews')
          .update({ overview: overview.trim() })
          .eq('meeting_id', meetingId);

        if (error) throw error;
      } else {
        // Create new overview
        const { error } = await supabase
          .from('meeting_overviews')
          .insert({
            meeting_id: meetingId,
            overview: overview.trim(),
            created_by: (await supabase.auth.getUser()).data.user?.id
          });

        if (error) throw error;
      }

      toast.success("Meeting overview saved successfully");
      setIsEditing(false);
      onOverviewChange?.(overview.trim());
    } catch (error: any) {
      console.error("Error saving overview:", error);
      toast.error("Failed to save overview");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setOverview(currentOverview);
    setIsEditing(false);
  };

  if (!isEditing) {
    return (
      <div className={`space-y-2 ${className}`}>
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Meeting Overview</Label>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsEditing(true)}
              className="h-8 px-2"
            >
              <Edit className="h-3 w-3 mr-1" />
              Edit
            </Button>
            {(meetingNotes || meetingTitle) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRegenerateOverview}
                disabled={regenerating}
                className="h-8 px-2"
              >
                <RefreshCw className={`h-3 w-3 mr-1 ${regenerating ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            )}
          </div>
        </div>
        <div className="text-sm text-muted-foreground p-3 bg-muted rounded-md min-h-[60px]">
          {currentOverview ? (
            <div 
              dangerouslySetInnerHTML={{ 
                __html: renderNHSMarkdown(currentOverview, { enableNHSStyling: true })
              }}
            />
          ) : (
            "No overview yet. Click Edit to add one or Regenerate to create one automatically."
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className}`}>
      <Label htmlFor="overview" className="text-sm font-medium">
        Meeting Overview
      </Label>
      <Textarea
        id="overview"
        value={overview}
        onChange={(e) => setOverview(e.target.value)}
        placeholder="Brief overview of meeting purpose and main topics discussed (max 50 words)"
        className="min-h-[80px] resize-none"
        maxLength={300}
      />
      <div className="text-xs text-muted-foreground">
        {overview.split(' ').filter(word => word.length > 0).length}/50 words
      </div>
      <div className="flex gap-2">
        <Button
          onClick={handleSave}
          disabled={saving || !overview.trim() || overview.split(' ').filter(word => word.length > 0).length > 50}
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
  );
};