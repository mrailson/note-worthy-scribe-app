import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { 
  Clock, 
  User, 
  FileText, 
  Brain, 
  Play,
  Heart,
  Activity,
  Baby,
  Pill
} from "lucide-react";
import { consultationExamples, ConsultationExample } from "@/data/consultationExamples";
import { toast } from "sonner";

interface ExamplesPanelProps {
  onLoadExample: (example: ConsultationExample) => void;
}

export const ExamplesPanel = ({ onLoadExample }: ExamplesPanelProps) => {
  const [selectedExample, setSelectedExample] = useState<ConsultationExample | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'detail'>('list');

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "Acute Illness":
        return <Activity className="h-4 w-4" />;
      case "Acute Assessment":
        return <Heart className="h-4 w-4" />;
      case "Mental Health":
        return <Brain className="h-4 w-4" />;
      case "Chronic Disease Management":
        return <Pill className="h-4 w-4" />;
      case "Pediatric Assessment":
        return <Baby className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "Acute Illness":
        return "bg-orange-100 text-orange-800 border-orange-200";
      case "Acute Assessment":
        return "bg-red-100 text-red-800 border-red-200";
      case "Mental Health":
        return "bg-purple-100 text-purple-800 border-purple-200";
      case "Chronic Disease Management":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "Pediatric Assessment":
        return "bg-green-100 text-green-800 border-green-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const handleExampleClick = (example: ConsultationExample) => {
    setSelectedExample(example);
    setViewMode('detail');
  };

  const handleLoadExample = (example: ConsultationExample) => {
    onLoadExample(example);
    toast.success(`Loaded example: ${example.title}`);
  };

  const handleBackToList = () => {
    setViewMode('list');
    setSelectedExample(null);
  };

  if (viewMode === 'detail' && selectedExample) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            onClick={handleBackToList}
            className="mb-4"
          >
            ← Back to Examples
          </Button>
          <Button
            onClick={() => handleLoadExample(selectedExample)}
            className="bg-gradient-primary hover:bg-primary-hover"
          >
            <Play className="h-4 w-4 mr-2" />
            Load This Example
          </Button>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl">{selectedExample.title}</CardTitle>
                <div className="flex items-center gap-3 mt-2">
                  <Badge className={getTypeColor(selectedExample.type)}>
                    {getTypeIcon(selectedExample.type)}
                    <span className="ml-1">{selectedExample.type}</span>
                  </Badge>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {selectedExample.duration}
                  </div>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Transcript Section */}
            <div>
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <User className="h-5 w-5" />
                Original Transcript
              </h3>
              <Textarea
                value={selectedExample.transcript}
                readOnly
                className="min-h-[300px] resize-none text-sm font-mono"
              />
            </div>

            <Separator />

            {/* Generated Summary */}
            <div>
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <FileText className="h-5 w-5" />
                AI Generated Summary
              </h3>
              <Textarea
                value={selectedExample.summary}
                readOnly
                className="min-h-[200px] resize-none text-sm"
              />
            </div>

            <Separator />

            {/* Patient Copy */}
            <div>
              <h3 className="text-lg font-semibold mb-3">Patient Copy (SMS Format)</h3>
              <div className="p-3 bg-muted/50 rounded border text-sm">
                {selectedExample.patientCopy}
              </div>
            </div>

            <Separator />

            {/* AI Review for Training */}
            <div>
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <Brain className="h-5 w-5" />
                AI Consultation Review (Trainee GP Feedback)
              </h3>
              <Textarea
                value={selectedExample.aiReview}
                readOnly
                className="min-h-[400px] resize-none text-sm"
              />
            </div>

            {/* Referral Letter if applicable */}
            {selectedExample.referralNeeded && selectedExample.referralLetter && (
              <>
                <Separator />
                <div>
                  <h3 className="text-lg font-semibold mb-3">Generated Referral Letter</h3>
                  <Textarea
                    value={selectedExample.referralLetter}
                    readOnly
                    className="min-h-[200px] resize-none text-sm"
                  />
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-primary mb-2">Consultation Examples</h2>
        <p className="text-muted-foreground">
          Test our AI analysis with these realistic consultation examples
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {consultationExamples.map((example) => (
          <Card 
            key={example.id} 
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => handleExampleClick(example)}
          >
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-lg">{example.title}</CardTitle>
                  <div className="flex items-center gap-3 mt-2">
                    <Badge className={getTypeColor(example.type)}>
                      {getTypeIcon(example.type)}
                      <span className="ml-1">{example.type}</span>
                    </Badge>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {example.duration}
                    </div>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4 line-clamp-3">
                {example.transcript.split('\n')[0].replace('Doctor: ', '').substring(0, 150)}...
              </p>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span>📝 Full transcript</span>
                  <span>🤖 AI summary</span>
                  <span>👥 Trainee feedback</span>
                  {example.referralNeeded && <span>📄 Referral letter</span>}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleLoadExample(example);
                  }}
                >
                  <Play className="h-3 w-3 mr-1" />
                  Load
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-8 p-4 bg-muted/30 rounded-lg">
        <h3 className="text-lg font-semibold mb-2">How to use examples:</h3>
        <ul className="text-sm text-muted-foreground space-y-1">
          <li>• Click any example card to view full details</li>
          <li>• Use "Load" to test with pre-generated content</li>
          <li>• Review AI-generated summaries and feedback</li>
          <li>• See how different consultation types are analyzed</li>
        </ul>
      </div>
    </div>
  );
};