import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CustomizableOutputBubble } from './CustomizableOutputBubble';
import { formatUniversalText, detectContentType } from '@/lib/universalTextFormatter';
import { 
  Copy, 
  Download, 
  FileText, 
  Presentation,
  WandSparkles,
  Users,
  Calendar,
  MapPin,
  Clock,
  CheckSquare,
  ArrowRight
} from 'lucide-react';
import { toast } from 'sonner';

export interface MeetingNotesData {
  title?: string;
  date?: string;
  time?: string;
  venue?: string;
  chair?: string;
  attendees?: string;
  agenda?: string;
  keyPoints?: string;
  decisions?: string;
  actions?: string;
  nextSteps?: string;
  [key: string]: any;
}

interface EnhancedMeetingNotesRendererProps {
  notes: MeetingNotesData;
  onExportWord?: (content: string, title?: string) => void;
  onExportPowerPoint?: (content: string, title?: string) => void;
  className?: string;
}

export const EnhancedMeetingNotesRenderer: React.FC<EnhancedMeetingNotesRendererProps> = ({
  notes,
  onExportWord,
  onExportPowerPoint,
  className = ''
}) => {
  const [activeTab, setActiveTab] = useState('overview');

  // Extract meeting metadata
  const meetingMeta = {
    title: notes.title || 'Meeting Notes',
    date: notes.date,
    time: notes.time,
    venue: notes.venue,
    chair: notes.chair,
    attendees: notes.attendees
  };

  // Organize content sections
  const contentSections = {
    overview: {
      title: 'Meeting Overview',
      icon: Users,
      content: `# ${meetingMeta.title}\n\n${meetingMeta.date ? `**Date:** ${meetingMeta.date}\n` : ''}${meetingMeta.time ? `**Time:** ${meetingMeta.time}\n` : ''}${meetingMeta.venue ? `**Venue:** ${meetingMeta.venue}\n` : ''}${meetingMeta.chair ? `**Chair:** ${meetingMeta.chair}\n` : ''}${meetingMeta.attendees ? `**Attendees:** ${meetingMeta.attendees}\n` : ''}\n---\n\n${notes.agenda || ''}`
    },
    decisions: {
      title: 'Decisions & Resolutions',
      icon: CheckSquare,
      content: notes.decisions || notes.decisions_and_actions || 'No decisions recorded'
    },
    actions: {
      title: 'Action Items',
      icon: ArrowRight,
      content: notes.actions || notes.actionItems || 'No action items recorded'
    },
    summary: {
      title: 'Key Points',
      icon: WandSparkles,
      content: notes.keyPoints || notes.summary || 'No key points recorded'
    },
    nextSteps: {
      title: 'Next Steps',
      icon: Calendar,
      content: notes.nextSteps || notes.next_steps || 'No next steps recorded'
    }
  };

  // Generate full document for export
  const generateFullDocument = () => {
    const sections = Object.values(contentSections);
    return sections.map(section => `# ${section.title}\n\n${section.content}`).join('\n\n---\n\n');
  };

  const handleExportWord = () => {
    if (onExportWord) {
      onExportWord(generateFullDocument(), `${meetingMeta.title} - Complete Notes`);
    }
  };

  const handleExportPowerPoint = () => {
    if (onExportPowerPoint) {
      onExportPowerPoint(generateFullDocument(), `${meetingMeta.title} - Presentation`);
    }
  };

  const copyAllNotes = () => {
    navigator.clipboard.writeText(generateFullDocument());
    toast.success('All meeting notes copied to clipboard');
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Meeting Header */}
      <Card className="bg-gradient-to-r from-primary/5 to-accent/5 border-primary/20">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="text-xl text-primary flex items-center gap-2">
                <Users className="w-5 h-5" />
                {meetingMeta.title}
              </CardTitle>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                {meetingMeta.date && (
                  <div className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    {meetingMeta.date}
                  </div>
                )}
                {meetingMeta.time && (
                  <div className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    {meetingMeta.time}
                  </div>
                )}
                {meetingMeta.venue && (
                  <div className="flex items-center gap-1">
                    <MapPin className="w-4 h-4" />
                    {meetingMeta.venue}
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Badge variant="secondary">Meeting Notes</Badge>
              <Button variant="ghost" size="sm" onClick={copyAllNotes}>
                <Copy className="w-4 h-4" />
              </Button>
              {onExportWord && (
                <Button variant="ghost" size="sm" onClick={handleExportWord}>
                  <FileText className="w-4 h-4" />
                </Button>
              )}
              {onExportPowerPoint && (
                <Button variant="ghost" size="sm" onClick={handleExportPowerPoint}>
                  <Presentation className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          {Object.entries(contentSections).map(([key, section]) => {
            const IconComponent = section.icon;
            return (
              <TabsTrigger key={key} value={key} className="flex items-center gap-1 text-xs">
                <IconComponent className="w-3 h-3" />
                <span className="hidden sm:inline">{section.title}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>

        {Object.entries(contentSections).map(([key, section]) => (
          <TabsContent key={key} value={key} className="mt-4">
            <CustomizableOutputBubble
              content={section.content}
              title={section.title}
              onExportWord={onExportWord}
              onExportPowerPoint={onExportPowerPoint}
              defaultCustomization={{
                contentType: 'meeting-notes',
                useNHSStyling: true,
                enhanceReadability: true,
                addSmartBreaks: true,
                fontSize: 14,
                lineHeight: 1.6,
                backgroundColor: 'bg-background'
              }}
            />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};