import React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bot, MessageSquare } from "lucide-react";

interface MeetingSummaryTabsProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  meetingNotesContent: React.ReactNode;
  transcriptContent: React.ReactNode;
}

export const MeetingSummaryTabs = ({ 
  activeTab, 
  onTabChange, 
  meetingNotesContent, 
  transcriptContent 
}: MeetingSummaryTabsProps) => {
  return (
    <Tabs value={activeTab} onValueChange={onTabChange} className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="meeting-notes" className="flex items-center gap-2">
          <Bot className="h-4 w-4" />
          Meeting Notes
        </TabsTrigger>
        <TabsTrigger value="transcript" className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4" />
          Transcript
        </TabsTrigger>
      </TabsList>

      <TabsContent value="meeting-notes" className="mt-6">
        {meetingNotesContent}
      </TabsContent>

      <TabsContent value="transcript" className="mt-6">
        {transcriptContent}
      </TabsContent>
    </Tabs>
  );
};