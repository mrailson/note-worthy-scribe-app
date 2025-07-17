import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  MessageSquare, 
  ChevronDown, 
  Clock
} from "lucide-react";

interface LiveTranscriptProps {
  transcript: string;
  showTimestamps: boolean;
  onTimestampsToggle: (show: boolean) => void;
}

export const LiveTranscript = ({ 
  transcript, 
  showTimestamps, 
  onTimestampsToggle 
}: LiveTranscriptProps) => {
  const [isTranscriptOpen, setIsTranscriptOpen] = useState(false);

  const formatTranscriptWithTimestamps = (text: string) => {
    if (!text) return "";
    
    const sentences = text.split('. ');
    return sentences.map((sentence, index) => {
      const timestamp = `${Math.floor(index * 0.5).toString().padStart(2, '0')}:${((index * 30) % 60).toString().padStart(2, '0')}`;
      return showTimestamps ? `[${timestamp}] ${sentence}` : sentence;
    }).join('. ');
  };

  return (
    <div className="space-y-4">
      {/* Live Transcript */}
      <Card className="shadow-medium">
        <Collapsible open={isTranscriptOpen} onOpenChange={setIsTranscriptOpen}>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-accent/50 transition-colors">
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  Live Meeting Transcript
                </div>
                <ChevronDown 
                  className={`h-4 w-4 transition-transform ${isTranscriptOpen ? 'rotate-180' : ''}`}
                />
              </CardTitle>
            </CardHeader>
          </CollapsibleTrigger>
          
          <CollapsibleContent>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <Button
                  variant={showTimestamps ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => onTimestampsToggle(!showTimestamps)}
                >
                  <Clock className="h-4 w-4 mr-2" />
                  Timestamps
                </Button>
              </div>

              <div className="min-h-[200px] p-4 bg-accent/20 rounded-lg border">
                {transcript ? (
                  <div className="text-sm leading-relaxed whitespace-pre-wrap">
                    {formatTranscriptWithTimestamps(transcript)}
                  </div>
                ) : (
                  <div className="text-muted-foreground text-center py-8">
                    Start recording to see live transcript appear here...
                  </div>
                )}
              </div>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

    </div>
  );
};