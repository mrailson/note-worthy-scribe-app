import React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { MeetingData } from "@/types/meetingTypes";

interface MeetingHeaderProps {
  meetingData: MeetingData | null;
  practiceData?: any;
}

export const MeetingHeader: React.FC<MeetingHeaderProps> = ({ meetingData, practiceData }) => {
  const navigate = useNavigate();

  return (
    <div className="flex items-center justify-between p-4 border-b bg-white">
      <div className="flex items-center gap-4">
        <Button
          onClick={() => navigate('/meeting-history')}
          variant="ghost"
          size="sm"
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to History
        </Button>
        
        <div className="flex items-center gap-3">
          {practiceData?.practice_logo_url && (
            <img 
              src={practiceData.practice_logo_url} 
              alt="Practice Logo" 
              className="h-10 w-10 object-contain rounded"
            />
          )}
          <div>
            <h1 className="text-xl font-semibold text-foreground">
              {meetingData?.title || 'Meeting Summary'}
            </h1>
            {practiceData?.practice_name && (
              <p className="text-sm text-muted-foreground">{practiceData.practice_name}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};