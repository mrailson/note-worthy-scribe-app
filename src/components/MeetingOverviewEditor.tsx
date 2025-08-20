import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Edit, Save, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { SafeMessageRenderer } from "@/components/SafeMessageRenderer";

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

  const handleSave = async () => {
    if (!overview.trim()) {
      toast.error("Overview cannot be empty");
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
        <div className="text-sm text-muted-foreground p-3 bg-muted rounded-md min-h-[60px]">
          {currentOverview ? (
            <SafeMessageRenderer 
              content={currentOverview} 
              className="prose prose-sm max-w-none prose-headings:text-muted-foreground prose-p:text-muted-foreground prose-strong:text-muted-foreground prose-li:text-muted-foreground"
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
        placeholder="e.g., Meeting discussed: pay rise discussions and performance review processes for team members"
        className="min-h-[80px] resize-none"
        maxLength={500}
      />
      <div className="text-xs text-muted-foreground">
        {overview.length}/500 characters
      </div>
      <div className="flex gap-2">
        <Button
          onClick={handleSave}
          disabled={saving || !overview.trim()}
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