import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { 
  Copy, 
  Edit, 
  Save, 
  X, 
  Sparkles, 
  FileText
} from 'lucide-react';
import { toast } from 'sonner';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ScribeTranscriptData } from '@/types/scribe';

interface ScribeTranscriptPanelProps {
  transcript: string;
  isRecording: boolean;
  realtimeTranscripts?: ScribeTranscriptData[];
  cleanedTranscript?: string;
  isCleaningTranscript?: boolean;
  onTranscriptChange?: (transcript: string) => void;
  onCleanTranscript?: () => void;
  onClearTranscript?: () => void;
}

export const ScribeTranscriptPanel: React.FC<ScribeTranscriptPanelProps> = ({
  transcript,
  isRecording,
  realtimeTranscripts = [],
  cleanedTranscript,
  isCleaningTranscript = false,
  onTranscriptChange,
  onCleanTranscript,
  onClearTranscript,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState("");

  const handleStartEdit = () => {
    setEditValue(transcript);
    setIsEditing(true);
  };

  const handleSaveEdit = () => {
    if (onTranscriptChange) {
      onTranscriptChange(editValue);
    }
    setIsEditing(false);
    toast.success("Transcript updated");
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditValue("");
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  return (
    <div className="space-y-6">
      {/* Main Transcript Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Transcript
              {transcript && (
                <Badge variant="outline" className="ml-2">
                  {transcript.split(' ').filter(w => w.trim()).length} words
                </Badge>
              )}
            </CardTitle>
            <div className="flex items-center gap-2">
              {transcript && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(transcript, 'Transcript')}
                >
                  <Copy className="h-4 w-4 mr-1" />
                  Copy
                </Button>
              )}
              {!isEditing && transcript && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleStartEdit}
                >
                  <Edit className="h-4 w-4 mr-1" />
                  Edit
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isEditing ? (
            <div className="space-y-4">
              <Textarea
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="min-h-[300px] resize-vertical"
                placeholder="Edit your transcript here..."
              />
              <div className="flex gap-2">
                <Button onClick={handleSaveEdit} size="sm">
                  <Save className="h-4 w-4 mr-1" />
                  Save Changes
                </Button>
                <Button onClick={handleCancelEdit} variant="outline" size="sm">
                  <X className="h-4 w-4 mr-1" />
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {transcript ? (
                <ScrollArea className="h-[300px]">
                  <div className="bg-muted/30 rounded-lg p-4 whitespace-pre-wrap text-foreground">
                    {transcript}
                  </div>
                </ScrollArea>
              ) : (
                <div className="bg-muted/30 rounded-lg p-4 min-h-[200px] flex items-center justify-center text-muted-foreground">
                  {isRecording 
                    ? "Transcription will appear here as you speak..."
                    : "No transcript available. Start recording to generate a transcript."
                  }
                </div>
              )}
              {transcript && onCleanTranscript && (
                <div className="flex gap-2">
                  <Button
                    onClick={onCleanTranscript}
                    disabled={isCleaningTranscript}
                    variant="outline"
                  >
                    <Sparkles className="h-4 w-4 mr-1" />
                    {isCleaningTranscript ? 'Cleaning...' : 'Clean Transcript'}
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cleaned Transcript */}
      {cleanedTranscript && cleanedTranscript.trim() && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                Cleaned Transcript
                <Badge variant="outline" className="ml-2">
                  {cleanedTranscript.split(' ').filter(w => w.trim()).length} words
                </Badge>
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(cleanedTranscript, 'Cleaned Transcript')}
              >
                <Copy className="h-4 w-4 mr-1" />
                Copy
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[200px]">
              <div className="bg-muted/30 rounded-lg p-4 whitespace-pre-wrap text-foreground">
                {cleanedTranscript}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
