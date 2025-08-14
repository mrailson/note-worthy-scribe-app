import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Mic, RotateCcw, WifiOff, FileText, Languages } from "lucide-react";
import { useState } from "react";

interface RecordingControlsProps {
  isRecording: boolean;
  isPaused: boolean;
  duration: number;
  connectionStatus: string;
  wordCount: number;
  currentConfidence?: number;
  formatDuration: (seconds: number) => string;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onPauseRecording: () => void;
  onResumeRecording: () => void;
}

export const RecordingControls = ({
  isRecording,
  isPaused,
  duration,
  connectionStatus,
  wordCount,
  currentConfidence,
  formatDuration,
  onStartRecording,
  onStopRecording,
  onPauseRecording,
  onResumeRecording
}: RecordingControlsProps) => {
  const [consultationType, setConsultationType] = useState("face-to-face");
  const [translationLanguage, setTranslationLanguage] = useState("none");

  const handleReset = () => {
    if (isRecording) {
      onStopRecording();
    }
    // Additional reset logic can be added here
  };

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <FileText className="h-5 w-5 text-primary" />
          GP Consultation
        </CardTitle>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="flex items-center gap-1">
            <WifiOff className="h-3 w-3" />
            Disconnected
          </Badge>
          <Button variant="outline" size="sm" onClick={handleReset}>
            <RotateCcw className="h-4 w-4 mr-1" />
            Reset
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Consultation Type */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            <Label className="text-sm font-medium">Consultation Type</Label>
          </div>
          <RadioGroup 
            value={consultationType} 
            onValueChange={setConsultationType}
            className="flex gap-6"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="face-to-face" id="face-to-face" />
              <Label htmlFor="face-to-face" className="cursor-pointer">Face to Face</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="telephone" id="telephone" />
              <Label htmlFor="telephone" className="cursor-pointer">Telephone</Label>
            </div>
          </RadioGroup>
        </div>

        {/* Real-time Translation */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Languages className="h-4 w-4 text-primary" />
            <Label className="text-sm font-medium">Real-time Translation</Label>
          </div>
          <Select value={translationLanguage} onValueChange={setTranslationLanguage}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select language" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              <SelectItem value="spanish">Spanish</SelectItem>
              <SelectItem value="french">French</SelectItem>
              <SelectItem value="german">German</SelectItem>
              <SelectItem value="portuguese">Portuguese</SelectItem>
              <SelectItem value="arabic">Arabic</SelectItem>
              <SelectItem value="urdu">Urdu</SelectItem>
              <SelectItem value="bengali">Bengali</SelectItem>
              <SelectItem value="polish">Polish</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Duration and Words Counter */}
        <div className="flex justify-center gap-12">
          <div className="text-center">
            <div className="text-2xl font-bold text-primary">{formatDuration(duration)}</div>
            <div className="text-sm text-muted-foreground">Duration</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-primary">{wordCount}</div>
            <div className="text-sm text-muted-foreground">Words</div>
          </div>
        </div>

        {/* Start Transcribing Button */}
        <div className="flex justify-center">
          {!isRecording ? (
            <Button
              onClick={onStartRecording}
              size="lg"
              className="bg-primary hover:bg-primary/90 text-white px-8 py-3 text-base font-medium min-h-[48px]"
            >
              <Mic className="h-5 w-5 mr-2" />
              Start Transcribing
            </Button>
          ) : (
            <Button
              onClick={onStopRecording}
              variant="destructive"
              size="lg"
              className="px-8 py-3 text-base font-medium min-h-[48px]"
            >
              Stop Transcribing
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};