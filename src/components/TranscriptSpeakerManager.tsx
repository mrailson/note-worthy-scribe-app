import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { User, Save, Edit2, Check, X, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface TranscriptSpeakerManagerProps {
  transcript: string;
  meetingId: string;
  onTranscriptUpdate?: (updatedTranscript: string) => void;
}

interface SpeakerIdentification {
  speakerLabel: string;
  speakerName: string;
  role?: string;
}

export const TranscriptSpeakerManager: React.FC<TranscriptSpeakerManagerProps> = ({
  transcript,
  meetingId,
  onTranscriptUpdate
}) => {
  const [speakers, setSpeakers] = useState<SpeakerIdentification[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [tempName, setTempName] = useState('');
  const [tempRole, setTempRole] = useState('');
  const [isLoading, setSaving] = useState(false);

  // Extract speaker patterns from transcript
  useEffect(() => {
    const speakerPattern = /Speaker (\d+):/g;
    const foundSpeakers = new Set<string>();
    let match;
    
    while ((match = speakerPattern.exec(transcript)) !== null) {
      foundSpeakers.add(`Speaker ${match[1]}`);
    }
    
    const speakerArray = Array.from(foundSpeakers).map(label => ({
      speakerLabel: label,
      speakerName: '',
      role: ''
    }));
    
    setSpeakers(speakerArray);
  }, [transcript]);

  // Parse markdown formatting
  const parseMarkdown = (text: string) => {
    if (!text || typeof text !== 'string') return '';
    
    let parsed = text.trim();
    
    // Handle **bold** text (including cases where ** appears at start/end)
    parsed = parsed.replace(/\*\*(.*?)\*\*/gs, '<strong>$1</strong>');
    
    // Handle standalone ** at beginning or end of lines
    parsed = parsed.replace(/^\*\*\s*/gm, '');
    parsed = parsed.replace(/\s*\*\*$/gm, '');
    
    // Handle *italic* text (but not double asterisks)
    parsed = parsed.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, '<em>$1</em>');
    
    // Handle line breaks
    parsed = parsed.replace(/\n/g, '<br />');
    
    return parsed;
  };

  // Extract timestamps from content or generate them
  const generateTimestamp = (segmentIndex: number, totalSegments: number) => {
    // If we have actual timestamps, use them, otherwise estimate based on position
    const estimatedMinutes = Math.floor((segmentIndex / totalSegments) * 30); // Assume 30 min meeting
    const minutes = Math.floor(estimatedMinutes);
    const seconds = Math.floor((estimatedMinutes % 1) * 60);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // Format transcript with better structure
  const formatTranscript = (text: string, speakerMappings: SpeakerIdentification[]) => {
    let formatted = text;
    
    // Apply speaker name replacements
    speakerMappings.forEach(speaker => {
      if (speaker.speakerName) {
        const regex = new RegExp(`${speaker.speakerLabel}:`, 'g');
        const replacement = speaker.role 
          ? `${speaker.speakerName} (${speaker.role}):`
          : `${speaker.speakerName}:`;
        formatted = formatted.replace(regex, replacement);
      }
    });
    
    // Split into speaker segments and format
    const segments = formatted.split(/(?=\b(?:Speaker \d+|[A-Za-z ]+(?:\([^)]+\))?):)/);
    
    return segments.filter(segment => segment.trim()).map((segment, index) => {
      const lines = segment.trim().split('\n');
      const speakerLine = lines[0];
      const content = lines.slice(1).join('\n').trim();
      
      // Extract speaker info and content
      const speakerMatch = speakerLine.match(/^(.+?):\s*(.*)/);
      if (speakerMatch) {
        const speakerInfo = speakerMatch[1];
        const firstContent = speakerMatch[2];
        const fullContent = firstContent + (content ? '\n' + content : '');
        const timestamp = generateTimestamp(index, segments.length);
        
        return (
          <div key={index} className="mb-4 p-4 bg-background border-l-4 border-primary/30 rounded-r-lg shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-primary" />
                <Badge variant="secondary" className="font-medium">
                  {speakerInfo}
                </Badge>
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                <span>{timestamp}</span>
              </div>
            </div>
            <div className="ml-6 text-sm leading-relaxed">
              {fullContent.split('\n').map((line, lineIndex) => (
                <div 
                  key={lineIndex} 
                  className={lineIndex > 0 ? 'mt-2' : ''}
                  dangerouslySetInnerHTML={{ __html: parseMarkdown(line) }}
                />
              ))}
            </div>
          </div>
        );
      } else {
        // Handle content without clear speaker
        const timestamp = generateTimestamp(index, segments.length);
        return (
          <div key={index} className="mb-4 p-4 bg-muted/30 rounded-lg shadow-sm">
            <div className="flex items-center justify-end mb-2">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                <span>{timestamp}</span>
              </div>
            </div>
            <div className="text-sm leading-relaxed">
              {segment.split('\n').map((line, lineIndex) => (
                <div 
                  key={lineIndex} 
                  className={lineIndex > 0 ? 'mt-2' : ''}
                  dangerouslySetInnerHTML={{ __html: parseMarkdown(line) }}
                />
              ))}
            </div>
          </div>
        );
      }
    });
  };

  const handleEdit = (index: number) => {
    setEditingIndex(index);
    setTempName(speakers[index].speakerName);
    setTempRole(speakers[index].role || '');
  };

  const handleSave = async (index: number) => {
    const updatedSpeakers = [...speakers];
    updatedSpeakers[index] = {
      ...updatedSpeakers[index],
      speakerName: tempName,
      role: tempRole
    };
    
    setSpeakers(updatedSpeakers);
    setEditingIndex(null);
    
    // Update the transcript with new speaker names
    let updatedTranscript = transcript;
    const speaker = updatedSpeakers[index];
    
    if (speaker.speakerName) {
      const regex = new RegExp(`${speaker.speakerLabel}:`, 'g');
      const replacement = speaker.role 
        ? `${speaker.speakerName} (${speaker.role}):`
        : `${speaker.speakerName}:`;
      updatedTranscript = updatedTranscript.replace(regex, replacement);
    }
    
    // Save to database
    await saveTranscriptUpdates(updatedTranscript);
    onTranscriptUpdate?.(updatedTranscript);
  };

  const handleCancel = () => {
    setEditingIndex(null);
    setTempName('');
    setTempRole('');
  };

  const saveTranscriptUpdates = async (updatedTranscript: string) => {
    setSaving(true);
    try {
      // Update transcript table
      const { error: deleteError } = await supabase
        .from('meeting_transcripts')
        .delete()
        .eq('meeting_id', meetingId);

      if (deleteError) throw deleteError;

      const { error: insertError } = await supabase
        .from('meeting_transcripts')
        .insert({
          meeting_id: meetingId,
          content: updatedTranscript,
          speaker_name: 'Updated Transcript',
          timestamp_seconds: 0,
          confidence_score: 1.0
        });

      if (insertError) throw insertError;

      toast.success('Speaker identifications saved successfully!');
    } catch (error) {
      console.error('Error saving speaker updates:', error);
      toast.error('Failed to save speaker identifications');
    } finally {
      setSaving(false);
    }
  };

  const saveAllSpeakers = async () => {
    setSaving(true);
    try {
      let updatedTranscript = transcript;
      
      // Apply all speaker name replacements
      speakers.forEach(speaker => {
        if (speaker.speakerName) {
          const regex = new RegExp(`${speaker.speakerLabel}:`, 'g');
          const replacement = speaker.role 
            ? `${speaker.speakerName} (${speaker.role}):`
            : `${speaker.speakerName}:`;
          updatedTranscript = updatedTranscript.replace(regex, replacement);
        }
      });
      
      await saveTranscriptUpdates(updatedTranscript);
      onTranscriptUpdate?.(updatedTranscript);
    } catch (error) {
      console.error('Error saving all speakers:', error);
      toast.error('Failed to save speaker identifications');
    }
  };

  return (
    <div className="space-y-4">
      {/* Speaker Identification Panel */}
      {speakers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <User className="h-4 w-4" />
              Speaker Identification
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {speakers.map((speaker, index) => (
              <div key={speaker.speakerLabel} className="flex items-center gap-3 p-2 border rounded-lg">
                <Badge variant="outline" className="min-w-20">
                  {speaker.speakerLabel}
                </Badge>
                
                {editingIndex === index ? (
                  <div className="flex items-center gap-2 flex-1">
                    <Input
                      placeholder="Enter name"
                      value={tempName}
                      onChange={(e) => setTempName(e.target.value)}
                      className="h-8"
                    />
                    <Input
                      placeholder="Role (optional)"
                      value={tempRole}
                      onChange={(e) => setTempRole(e.target.value)}
                      className="h-8"
                    />
                    <Button 
                      size="sm" 
                      onClick={() => handleSave(index)}
                      disabled={!tempName.trim()}
                    >
                      <Check className="h-3 w-3" />
                    </Button>
                    <Button size="sm" variant="outline" onClick={handleCancel}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 flex-1">
                    <span className="text-sm flex-1">
                      {speaker.speakerName || 'Unknown Speaker'}
                      {speaker.role && (
                        <span className="text-muted-foreground ml-1">({speaker.role})</span>
                      )}
                    </span>
                    <Button size="sm" variant="ghost" onClick={() => handleEdit(index)}>
                      <Edit2 className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
            
            <div className="pt-2">
              <Button 
                onClick={saveAllSpeakers} 
                disabled={isLoading}
                className="w-full"
              >
                {isLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-2"></div>
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-3 w-3 mr-2" />
                    Save All Speaker Updates
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Separator />

      {/* Formatted Transcript */}
      <div className="bg-accent/30 p-4 rounded-lg max-h-96 overflow-y-auto">
        <div className="space-y-2">
          {formatTranscript(transcript, speakers)}
        </div>
      </div>
    </div>
  );
};