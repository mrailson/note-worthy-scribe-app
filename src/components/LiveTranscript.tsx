import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { 
  MessageSquare, 
  ChevronDown, 
  Clock,
  Upload,
  FileAudio,
  Film
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
  const [isTranscriptOpen, setIsTranscriptOpen] = useState(true);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleDemoMeeting = (type: string) => {
    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
    }, 2000);
  };

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

      {/* Import Options */}
      <Card className="shadow-medium">
        <Collapsible open={isImportOpen} onOpenChange={setIsImportOpen}>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-accent/50 transition-colors">
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Upload className="h-5 w-5" />
                  Import Previous Meeting Transcript or Load Demonstration Meeting
                </div>
                <ChevronDown 
                  className={`h-4 w-4 transition-transform ${isImportOpen ? 'rotate-180' : ''}`}
                />
              </CardTitle>
            </CardHeader>
          </CollapsibleTrigger>
          
          <CollapsibleContent>
            <CardContent className="space-y-6">
              {/* Import Options */}
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <h4 className="font-medium">Import Text Transcript</h4>
                  <Button variant="outline" className="w-full justify-start">
                    <Upload className="h-4 w-4 mr-2" />
                    Click to import transcript
                  </Button>
                </div>
                
                <div className="space-y-2">
                  <h4 className="font-medium">Import Audio File</h4>
                  <Button variant="outline" className="w-full justify-start">
                    <FileAudio className="h-4 w-4 mr-2" />
                    Click to import audio
                  </Button>
                  {isProcessing && (
                    <div className="text-sm text-muted-foreground">
                      Processing audio file...
                    </div>
                  )}
                </div>
              </div>

              {/* Demo Examples */}
              <div className="space-y-3">
                <h4 className="font-medium">Demo Meeting Examples</h4>
                
                <div className="space-y-3">
                  <Button 
                    variant="outline" 
                    className="w-full justify-start text-left h-auto p-4"
                    onClick={() => handleDemoMeeting('icb')}
                  >
                    <div className="flex items-start gap-3">
                      <Film className="h-5 w-5 mt-0.5 text-primary" />
                      <div>
                        <div className="font-medium">ICB Meeting (2+ hours)</div>
                        <div className="text-sm text-muted-foreground">
                          Integrated Care Board strategic planning meeting with 10 senior NHS leaders
                        </div>
                      </div>
                    </div>
                  </Button>

                  <Button 
                    variant="outline" 
                    className="w-full justify-start text-left h-auto p-4"
                    onClick={() => handleDemoMeeting('gp')}
                  >
                    <div className="flex items-start gap-3">
                      <Film className="h-5 w-5 mt-0.5 text-primary" />
                      <div>
                        <div className="font-medium">GP Partnership (1 hour)</div>
                        <div className="text-sm text-muted-foreground">
                          General Practice partnership meeting covering operations and planning
                        </div>
                      </div>
                    </div>
                  </Button>

                  <Button 
                    variant="outline" 
                    className="w-full justify-start text-left h-auto p-4"
                    onClick={() => handleDemoMeeting('hospital')}
                  >
                    <div className="flex items-start gap-3">
                      <Film className="h-5 w-5 mt-0.5 text-primary" />
                      <div>
                        <div className="font-medium">Hospital Management (1 hour)</div>
                        <div className="text-sm text-muted-foreground">
                          Hospital executive meeting covering capacity, quality, and operations
                        </div>
                      </div>
                    </div>
                  </Button>
                </div>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>
    </div>
  );
};