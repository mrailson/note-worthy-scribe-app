import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Edit, Save, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { renderNHSMarkdown } from '@/lib/nhsMarkdownRenderer';

interface MeetingOverviewEditorProps {
  meetingId: string;
  currentOverview?: string;
  onOverviewChange?: (overview: string) => void;
  className?: string;
}

export const MeetingOverviewEditor = ({ 
  meetingId, 
  currentOverview = "", 
  onOverviewChange,
  className = ""
}: MeetingOverviewEditorProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [overview, setOverview] = useState(currentOverview);
  const [saving, setSaving] = useState(false);

  // Sync local state with prop changes
  useEffect(() => {
    setOverview(currentOverview);
  }, [currentOverview]);

  // Debug logging for save button state
  const wordCount = overview.trim().split(/\s+/).filter(word => word.length > 0).length;
  const isSaveDisabled = saving || !overview.trim() || wordCount > 150;
  
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
    
    if (wordCount > 150) {
      toast.error("Overview must be 150 words or less");
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
          </div>
        </div>
        <div className="text-sm text-muted-foreground p-3 bg-muted rounded-md min-h-[80px]">
          {overview ? (
            <div 
              dangerouslySetInnerHTML={{ 
                __html: renderNHSMarkdown(overview, { enableNHSStyling: true })
              }}
            />
          ) : (
            "No overview yet. Click Edit to add one."
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
        placeholder="Brief overview of meeting purpose and main topics discussed (80-120 words recommended)"
        className="min-h-[80px] resize-y"
      />
      <div className="text-xs text-muted-foreground">
        {wordCount}/150 words
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
  );
};