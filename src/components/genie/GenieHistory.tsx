import React, { useEffect, useState } from 'react';
import { useGenieHistory, ServiceType, GenieSession } from '@/hooks/useGenieHistory';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, Search, Trash2, Clock, MessageSquare } from 'lucide-react';
import { format } from 'date-fns';
import { Document, Paragraph, TextRun, HeadingLevel, AlignmentType, Table, TableRow, TableCell, WidthType, BorderStyle, Packer } from 'docx';
import { saveAs } from 'file-saver';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface GenieHistoryProps {
  serviceType: ServiceType;
}

export const GenieHistory: React.FC<GenieHistoryProps> = ({ serviceType }) => {
  const { sessions, loading, loadSessions, deleteSession } = useGenieHistory();
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadSessions(serviceType, searchQuery);
  }, [serviceType, searchQuery, loadSessions]);

  const getServiceColor = (type: ServiceType) => {
    switch (type) {
      case 'gp-genie': return '#2563EB'; // Blue
      case 'pm-genie': return '#10B981'; // Emerald
      case 'patient-line': return '#2563EB'; // Blue
    }
  };

  const getServiceName = (type: ServiceType) => {
    switch (type) {
      case 'gp-genie': return 'GP Genie';
      case 'pm-genie': return 'PM Genie';
      case 'patient-line': return 'Oak Lane Patient Line';
    }
  };

  const downloadTranscript = async (session: GenieSession) => {
    const serviceName = getServiceName(session.service_type);
    const serviceColor = getServiceColor(session.service_type);

    const children: any[] = [
      // Title
      new Paragraph({
        text: 'Notewell AI',
        heading: HeadingLevel.HEADING_1,
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
        run: {
          color: '005EB8',
          bold: true,
          size: 32
        }
      }),

      // Service Name Heading
      new Paragraph({
        text: serviceName,
        heading: HeadingLevel.HEADING_2,
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 },
        run: {
          color: serviceColor.replace('#', ''),
          bold: true,
          size: 28
        }
      }),

      // Metadata Table
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: {
          top: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
          bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
          left: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
          right: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
          insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
          insideVertical: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' }
        },
        rows: [
          new TableRow({
            children: [
              new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Start Time', bold: true })] })] }),
              new TableCell({ children: [new Paragraph(format(new Date(session.start_time), 'HH:mm') + ' on ' + format(new Date(session.start_time), 'dd/MM/yyyy'))] })
            ]
          }),
          new TableRow({
            children: [
              new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'End Time', bold: true })] })] }),
              new TableCell({ children: [new Paragraph(format(new Date(session.end_time), 'HH:mm') + ' on ' + format(new Date(session.end_time), 'dd/MM/yyyy'))] })
            ]
          }),
          new TableRow({
            children: [
              new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Duration', bold: true })] })] }),
              new TableCell({ children: [new Paragraph(`${Math.floor(session.duration_seconds / 60)} minutes ${session.duration_seconds % 60} seconds`)] })
            ]
          }),
          new TableRow({
            children: [
              new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Messages', bold: true })] })] }),
              new TableCell({ children: [new Paragraph(session.message_count.toString())] })
            ]
          })
        ]
      }),

      new Paragraph({ text: '', spacing: { after: 400 } }),

      // Conversation History Heading
      new Paragraph({
        text: 'Conversation History',
        heading: HeadingLevel.HEADING_3,
        spacing: { after: 200 },
        run: { bold: true, size: 24 }
      })
    ];

    // Add conversation messages
    session.messages.forEach((msg, idx) => {
      const userTime = msg.userTimestamp ? format(new Date(msg.userTimestamp), 'HH:mm') : format(new Date(msg.timestamp), 'HH:mm');
      const agentTime = msg.agentTimestamp ? format(new Date(msg.agentTimestamp), 'HH:mm') : format(new Date(msg.timestamp), 'HH:mm');

      children.push(
        new Paragraph({
          text: `[${userTime}] You:`,
          spacing: { before: 200, after: 100 },
          run: { bold: true, color: '2563EB' }
        }),
        new Paragraph({
          text: msg.user,
          spacing: { after: 200 }
        }),
        new Paragraph({
          text: `[${agentTime}] ${serviceName}:`,
          spacing: { before: 200, after: 100 },
          run: { bold: true, color: serviceColor.replace('#', '') }
        }),
        new Paragraph({
          text: msg.agent,
          spacing: { after: 300 }
        })
      );
    });

    // Add disclaimer only for GP Genie
    if (session.service_type === 'gp-genie') {
      children.push(
        new Paragraph({ text: '', spacing: { before: 600 } }),
        new Paragraph({
          text: 'IMPORTANT DISCLAIMER',
          heading: HeadingLevel.HEADING_3,
          spacing: { after: 200 },
          run: { bold: true, color: 'DC2626', size: 24 }
        }),
        new Paragraph({
          text: 'This is NOT an approved tool for the NHS and is only being used for non-patient diagnosis and concept testing.',
          spacing: { after: 200 },
          run: { bold: true, color: 'DC2626' }
        }),
        new Paragraph({
          text: 'This AI assistant is a proof-of-concept demonstration tool and should not be used for actual clinical decision-making, patient care, or diagnosis. The information provided by this service has not been clinically validated and is intended solely for testing and evaluation purposes.',
          spacing: { after: 200 }
        })
      );
    }

    // Footer
    children.push(
      new Paragraph({ text: '', spacing: { before: 400 } }),
      new Paragraph({
        text: 'Generated by Notewell AI',
        alignment: AlignmentType.CENTER,
        run: { italics: true, color: '666666', size: 20 }
      })
    );

    const doc = new Document({
      sections: [{
        properties: {},
        children
      }]
    });

    try {
      const blob = await Packer.toBlob(doc);
      const fileName = `${serviceName.replace(/ /g, '_')}_Transcript_${format(new Date(session.start_time), 'yyyyMMdd_HHmm')}.docx`;
      saveAs(blob, fileName);
      toast.success('Transcript downloaded successfully');
    } catch (error) {
      console.error('Failed to generate Word document:', error);
      toast.error('Failed to generate transcript document');
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  if (loading && sessions.length === 0) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-muted-foreground">Loading conversation history...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search conversations..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Session List */}
      {sessions.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center p-8 text-center">
            <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              {searchQuery ? 'No conversations found matching your search.' : 'No conversation history yet.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {sessions.map((session) => (
            <Card key={session.id} className="hover:bg-accent/50 transition-colors">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{session.title}</CardTitle>
                <CardDescription className="line-clamp-2">
                  {session.brief_overview}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      <span>{formatDuration(session.duration_seconds)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <MessageSquare className="h-3 w-3" />
                      <span>{session.message_count} messages</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={() => downloadTranscript(session)}
                      variant="outline"
                      size="sm"
                      className="h-8"
                    >
                      <Download className="h-3 w-3 mr-1" />
                      Download
                    </Button>
                    <Button
                      onClick={() => deleteSession(session.id)}
                      variant="ghost"
                      size="sm"
                      className="h-8 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
