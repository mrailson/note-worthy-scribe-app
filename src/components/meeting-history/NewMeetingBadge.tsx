import { Badge } from "@/components/ui/badge";
import { Sparkles } from "lucide-react";

interface NewMeetingBadgeProps {
  createdAt: string;
  className?: string;
}

/**
 * Shows a "New" badge if the meeting was created within the last 10 minutes
 */
export const NewMeetingBadge = ({ createdAt, className }: NewMeetingBadgeProps) => {
  const createdDate = new Date(createdAt);
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
  
  if (createdDate < tenMinutesAgo) {
    return null;
  }
  
  return (
    <Badge 
      variant="default" 
      className={`bg-green-600 hover:bg-green-600 text-white text-[10px] px-1.5 py-0 h-4 shrink-0 ${className || ''}`}
    >
      <Sparkles className="h-2.5 w-2.5 mr-0.5" />
      New
    </Badge>
  );
};

/**
 * Helper function to check if a meeting is new (created within last 10 minutes)
 */
export const isNewMeeting = (createdAt: string): boolean => {
  const createdDate = new Date(createdAt);
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
  return createdDate >= tenMinutesAgo;
};
