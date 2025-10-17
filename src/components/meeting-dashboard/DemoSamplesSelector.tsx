import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Clock, Users, FileText, Play, Sparkles } from 'lucide-react';
import { demoMeetings, DemoMeeting } from '@/data/demoMeetings';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';

interface DemoSamplesSelectorProps {
  onSelectDemo: (demo: DemoMeeting) => void;
  disabled?: boolean;
}

export const DemoSamplesSelector: React.FC<DemoSamplesSelectorProps> = ({
  onSelectDemo,
  disabled = false
}) => {
  const getMeetingTypeColor = (type: DemoMeeting['type']) => {
    switch (type) {
      case 'LMC':
        return 'bg-blue-500/10 text-blue-700 border-blue-300';
      case 'PCN':
        return 'bg-green-500/10 text-green-700 border-green-300';
      case 'Partnership':
        return 'bg-purple-500/10 text-purple-700 border-purple-300';
      case 'ICB':
        return 'bg-orange-500/10 text-orange-700 border-orange-300';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 p-4 bg-primary/5 border border-primary/20 rounded-lg">
        <Sparkles className="h-5 w-5 text-primary mt-0.5 shrink-0" />
        <div>
          <h3 className="font-medium text-sm mb-1">Demo & Training Meetings</h3>
          <p className="text-sm text-muted-foreground">
            Select from pre-configured NHS meetings with realistic transcripts. Perfect for demonstrations, training, and testing the system's capabilities. All data is fictional and safe to share.
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {demoMeetings.map((demo) => (
          <Card key={demo.id} className="relative overflow-hidden hover:shadow-md transition-shadow">
            <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-primary/5 to-transparent" />
            
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{demo.icon}</span>
                  <Badge variant="outline" className={getMeetingTypeColor(demo.type)}>
                    {demo.type}
                  </Badge>
                </div>
                <Badge variant="secondary" className="bg-accent/50">
                  Demo
                </Badge>
              </div>
              <CardTitle className="text-lg leading-tight">{demo.title}</CardTitle>
              <CardDescription className="text-sm">
                {demo.description}
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  <span>{demo.duration}</span>
                </div>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Users className="h-3.5 w-3.5" />
                  <span>{demo.attendees.length} attendees</span>
                </div>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <FileText className="h-3.5 w-3.5" />
                  <span>{demo.wordCount.toLocaleString()} words</span>
                </div>
              </div>

              <div className="pt-2 border-t">
                <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
                  <strong>Topics:</strong> {demo.agenda}
                </p>

                <div className="flex gap-2">
                  <HoverCard>
                    <HoverCardTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        disabled={disabled}
                      >
                        Preview
                      </Button>
                    </HoverCardTrigger>
                    <HoverCardContent className="w-80" side="top">
                      <div className="space-y-2">
                        <h4 className="text-sm font-semibold">Meeting Details</h4>
                        <div className="text-xs space-y-1.5">
                          <div>
                            <span className="font-medium">Format:</span> {demo.format}
                          </div>
                          <div>
                            <span className="font-medium">Attendees:</span>
                            <ul className="mt-1 space-y-0.5 ml-2">
                              {demo.attendees.slice(0, 3).map((attendee, i) => (
                                <li key={i} className="text-muted-foreground">
                                  • {attendee.name} - {attendee.title}
                                </li>
                              ))}
                              {demo.attendees.length > 3 && (
                                <li className="text-muted-foreground">
                                  • ... and {demo.attendees.length - 3} more
                                </li>
                              )}
                            </ul>
                          </div>
                          <div>
                            <span className="font-medium">Agenda:</span>
                            <p className="text-muted-foreground mt-0.5">{demo.agenda}</p>
                          </div>
                        </div>
                      </div>
                    </HoverCardContent>
                  </HoverCard>

                  <Button
                    size="sm"
                    onClick={() => onSelectDemo(demo)}
                    disabled={disabled}
                    className="flex-1"
                  >
                    <Play className="h-3.5 w-3.5 mr-1.5" />
                    Load Sample
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg text-xs text-muted-foreground">
        <Sparkles className="h-3.5 w-3.5 mt-0.5 shrink-0" />
        <p>
          Demo meetings are marked with a special badge and contain fictional data based on realistic NHS scenarios. 
          They're ideal for client presentations, training sessions, and testing the note generation capabilities.
        </p>
      </div>
    </div>
  );
};