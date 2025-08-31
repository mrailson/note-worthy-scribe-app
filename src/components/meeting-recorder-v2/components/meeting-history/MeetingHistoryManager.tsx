import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { History, Search, Trash2, FileText, Calendar, Users } from 'lucide-react';

interface MeetingHistoryManagerProps {
  // Add props as needed for meeting data
}

export const MeetingHistoryManager = ({}: MeetingHistoryManagerProps) => {
  // Mock data for now - will be replaced with real data
  const mockMeetings = [
    {
      id: '1',
      title: 'Team Standup',
      date: '2024-01-15',
      duration: '15:30',
      wordCount: 1250,
      participants: ['John', 'Sarah', 'Mike']
    },
    {
      id: '2', 
      title: 'Project Review',
      date: '2024-01-14',
      duration: '45:20',
      wordCount: 3420,
      participants: ['Alex', 'Emma', 'David', 'Lisa']
    },
    {
      id: '3',
      title: 'Client Meeting',
      date: '2024-01-12',
      duration: '32:15',
      wordCount: 2180,
      participants: ['Manager', 'Client A', 'Client B']
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search meetings..."
            className="pl-10"
          />
        </div>
        <Button variant="outline">
          <Calendar className="h-4 w-4 mr-2" />
          Filter by Date
        </Button>
      </div>

      <div className="grid gap-4">
        {mockMeetings.map((meeting) => (
          <Card key={meeting.id} className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold text-foreground">{meeting.title}</h3>
                    <Badge variant="secondary">{meeting.date}</Badge>
                  </div>
                  
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <History className="h-4 w-4" />
                      {meeting.duration}
                    </div>
                    <div className="flex items-center gap-1">
                      <FileText className="h-4 w-4" />
                      {meeting.wordCount.toLocaleString()} words
                    </div>
                    <div className="flex items-center gap-1">
                      <Users className="h-4 w-4" />
                      {meeting.participants.length} participants
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {meeting.participants.slice(0, 3).map((participant, index) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        {participant}
                      </Badge>
                    ))}
                    {meeting.participants.length > 3 && (
                      <Badge variant="outline" className="text-xs">
                        +{meeting.participants.length - 3} more
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm">
                    <FileText className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {mockMeetings.length === 0 && (
        <div className="text-center text-muted-foreground py-12">
          <History className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p className="text-lg font-medium mb-2">No meetings found</p>
          <p className="text-sm">Start recording meetings to see them here</p>
        </div>
      )}
    </div>
  );
};