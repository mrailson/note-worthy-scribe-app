import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { FileText, Clock, User, Brain, Mail, MessageSquare, Send } from "lucide-react";

interface ExampleSoapDisplayProps {
  exampleData: {
    title?: string;
    type?: string;
    duration?: string;
    summary?: string;
    patientCopy?: string;
    referralLetter?: string;
    aiReview?: string;
  } | null;
}

export const ExampleSoapDisplay = ({ exampleData }: ExampleSoapDisplayProps) => {
  if (!exampleData) {
    return (
      <div className="space-y-6">
        <Card className="border-dashed border-2 bg-muted/20">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Example Loaded</h3>
            <p className="text-muted-foreground mb-4 max-w-md">
              Go to the Examples tab and click "Load" on any consultation example to see the AI-generated analysis here.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl">{exampleData.title}</CardTitle>
              <div className="flex items-center gap-3 mt-2">
                {exampleData.type && (
                  <Badge className={getTypeColor(exampleData.type)}>
                    {exampleData.type}
                  </Badge>
                )}
                {exampleData.duration && (
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {exampleData.duration}
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* GP Summary */}
      {exampleData.summary && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              GP Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={exampleData.summary}
              readOnly
              className="min-h-[300px] resize-none"
            />
          </CardContent>
        </Card>
      )}

      {/* Patient Copy */}
      {exampleData.patientCopy && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Patient Copy (SMS Format)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-4 bg-muted/50 rounded border">
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-2 w-2 bg-green-500 rounded-full"></div>
                  <span className="text-sm font-medium">SMS Ready</span>
                </div>
                <p className="text-sm whitespace-pre-wrap">{exampleData.patientCopy}</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm">
                  <Mail className="h-4 w-4 mr-2" />
                  Email Patient
                </Button>
                <Button variant="outline" size="sm">
                  <Send className="h-4 w-4 mr-2" />
                  Send SMS
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Referral Letter */}
      {exampleData.referralLetter && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Referral Letter
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={exampleData.referralLetter}
              readOnly
              className="min-h-[300px] resize-none"
            />
          </CardContent>
        </Card>
      )}

      {/* AI Review */}
      {exampleData.aiReview && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5" />
              AI Consultation Review (Trainee GP Feedback)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={exampleData.aiReview}
              readOnly
              className="min-h-[400px] resize-none"
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
};