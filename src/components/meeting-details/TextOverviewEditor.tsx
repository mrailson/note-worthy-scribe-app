import { useState, useEffect } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Edit, Save, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { renderMinutesMarkdown } from "@/lib/minutesRenderer";

interface TextOverviewEditorProps {
  meetingId: string;
  currentOverview: string;
  onOverviewChange: (overview: string) => void;
  className?: string;
}

export const TextOverviewEditor = ({ 
  meetingId, 
  currentOverview,
  onOverviewChange,
  className = ""
}: TextOverviewEditorProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [overview, setOverview] = useState(currentOverview);
  const [saving, setSaving] = useState(false);

  // Sync local state with prop changes
  useEffect(() => {
    setOverview(currentOverview);
  }, [currentOverview]);

  const wordCount = overview.trim().split(/\s+/).filter(word => word.length > 0).length;
  const isSaveDisabled = saving || !overview.trim() || wordCount > 80;

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
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        throw new Error("You must be logged in to save changes");
      }

      const { data: existingOverview, error: fetchError } = await supabase
        .from('meeting_overviews')
        .select('id')
        .eq('meeting_id', meetingId)
        .maybeSingle();

      if (fetchError) {
        throw new Error(`Failed to check existing overview: ${fetchError.message}`);
      }

      if (existingOverview) {
        const { error } = await supabase
          .from('meeting_overviews')
          .update({ overview: overview.trim() })
          .eq('meeting_id', meetingId);

        if (error) throw new Error(`Update failed: ${error.message}`);
      } else {
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

  return (
    <div className={className}>
      {!isEditing ? (
        <div>
          {overview ? (
            <div 
              className="prose prose-sm max-w-none text-muted-foreground mb-3"
              dangerouslySetInnerHTML={{ 
                __html: renderMinutesMarkdown(
                  overview.length > 4000 
                    ? overview.slice(0, 4000) + '\n\n[Preview truncated for performance.]'
                    : overview
                )
              }}
            />
          ) : (
            <p className="text-sm text-muted-foreground italic mb-3">
              No overview available. Click Edit to add one.
            </p>
          )}
          
          <div className="flex items-center justify-end">
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
        </div>
      ) : (
        <div className="space-y-3">
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
      )}
    </div>
  );
};
