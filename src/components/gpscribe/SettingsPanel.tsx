import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ConsultationType, AudioCaptureMode } from "@/types/gpscribe";
import { OUTPUT_LEVELS } from "@/constants/consultationSettings";
import { Save, RotateCcw, Mic, Monitor, AlertCircle } from "lucide-react";
import { MicrophoneSettings } from "./MicrophoneSettings";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface SettingsPanelProps {
  consultationType: ConsultationType;
  outputLevel: number;
  showSnomedCodes: boolean;
  formatForEmis: boolean;
  formatForSystmOne: boolean;
  tickerEnabled: boolean;
  showTranscriptTimestamps: boolean;
  audioCaptureMode?: AudioCaptureMode;
  onConsultationTypeChange: (type: ConsultationType) => void;
  onOutputLevelChange: (level: number) => void;
  onShowSnomedCodesChange: (show: boolean) => void;
  onFormatForEmisChange: (format: boolean) => void;
  onFormatForSystmOneChange: (format: boolean) => void;
  onTickerEnabledChange: (enabled: boolean) => void;
  onShowTranscriptTimestampsChange: (show: boolean) => void;
  onMicrophoneChange?: (deviceId: string | null) => void;
  onAudioCaptureModeChange?: (mode: AudioCaptureMode) => void;
  onSaveSettings: () => void;
  onResetSettings: () => void;
}

export const SettingsPanel = ({
  consultationType,
  outputLevel,
  showSnomedCodes,
  formatForEmis,
  formatForSystmOne,
  tickerEnabled,
  showTranscriptTimestamps,
  audioCaptureMode = "mic-only",
  onConsultationTypeChange,
  onOutputLevelChange,
  onShowSnomedCodesChange,
  onFormatForEmisChange,
  onFormatForSystmOneChange,
  onTickerEnabledChange,
  onShowTranscriptTimestampsChange,
  onMicrophoneChange,
  onAudioCaptureModeChange,
  onSaveSettings,
  onResetSettings
}: SettingsPanelProps) => {
  // Check if browser supports screen/system audio capture
  // Chrome's userAgent contains both "Chrome" and "Safari", so we check for Chrome/Edge specifically
  const isChromium = /Chrome|Edg/.test(navigator.userAgent);
  const supportsSystemAudio = isChromium;
  return (
    <div className="space-y-6">
      {/* Microphone Settings - Most important for troubleshooting */}
      <MicrophoneSettings onDeviceChange={onMicrophoneChange} />
      
      {/* Audio Source Settings - For telephone consultations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Monitor className="h-5 w-5" />
            Audio Source
          </CardTitle>
          <CardDescription>
            Choose how audio is captured during consultations
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <RadioGroup
            value={audioCaptureMode}
            onValueChange={(value: AudioCaptureMode) => onAudioCaptureModeChange?.(value)}
            className="space-y-4"
          >
            <div className="flex items-start space-x-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
              <RadioGroupItem value="mic-only" id="mic-only" className="mt-1" />
              <div className="flex-1">
                <Label htmlFor="mic-only" className="flex items-center gap-2 cursor-pointer font-medium">
                  <Mic className="h-4 w-4" />
                  Microphone Only
                  <Badge variant="secondary" className="text-xs">Default</Badge>
                </Label>
                <p className="text-sm text-muted-foreground mt-1">
                  Best for face-to-face consultations. Captures your microphone only.
                </p>
              </div>
            </div>
            
            <div className={`flex items-start space-x-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors ${!supportsSystemAudio ? 'opacity-60' : ''}`}>
              <RadioGroupItem 
                value="mic-browser" 
                id="mic-browser" 
                className="mt-1"
                disabled={!supportsSystemAudio}
              />
              <div className="flex-1">
                <Label htmlFor="mic-browser" className="flex items-center gap-2 cursor-pointer font-medium">
                  <Monitor className="h-4 w-4" />
                  Microphone + Browser Audio
                  <Badge variant="outline" className="text-xs">Telephone</Badge>
                </Label>
                <p className="text-sm text-muted-foreground mt-1">
                  For telephone/video consultations via browser. Captures your voice AND the patient's voice from your computer.
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Requires screen share permission when starting recording.
                </p>
              </div>
            </div>
          </RadioGroup>

          {audioCaptureMode === 'mic-browser' && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                When you start recording, you'll be asked to share your screen. Select the browser tab with your phone system and <strong>tick "Share audio"</strong> to capture the patient's voice.
              </AlertDescription>
            </Alert>
          )}

          {!supportsSystemAudio && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Browser audio capture requires Chrome or Edge. Your current browser doesn't support this feature.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
      
      {/* Consultation Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Consultation Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Consultation Type</label>
            <Select
              value={consultationType}
              onValueChange={(value: ConsultationType) => onConsultationTypeChange(value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="face-to-face">Face-to-Face</SelectItem>
                <SelectItem value="telephone">Telephone</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Output Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Output Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Output Detail Level</label>
            <Select
              value={outputLevel.toString()}
              onValueChange={(value) => onOutputLevelChange(parseInt(value))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OUTPUT_LEVELS.map((level) => (
                  <SelectItem key={level.value} value={level.value.toString()}>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{level.label}</Badge>
                      <span className="text-sm">{level.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="snomed-codes"
                checked={showSnomedCodes}
                onCheckedChange={onShowSnomedCodesChange}
              />
              <label htmlFor="snomed-codes" className="text-sm font-medium">
                Include SNOMED codes
              </label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="format-emis"
                checked={formatForEmis}
                onCheckedChange={onFormatForEmisChange}
              />
              <label htmlFor="format-emis" className="text-sm font-medium">
                Format for EMIS
              </label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="format-systmone"
                checked={formatForSystmOne}
                onCheckedChange={onFormatForSystmOneChange}
              />
              <label htmlFor="format-systmone" className="text-sm font-medium">
                Format for SystmOne
              </label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Display Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Display Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="ticker-enabled"
              checked={tickerEnabled}
              onCheckedChange={onTickerEnabledChange}
            />
            <label htmlFor="ticker-enabled" className="text-sm font-medium">
              Enable live ticker
            </label>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="transcript-timestamps"
              checked={showTranscriptTimestamps}
              onCheckedChange={onShowTranscriptTimestampsChange}
            />
            <label htmlFor="transcript-timestamps" className="text-sm font-medium">
              Show transcript timestamps
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        <Button
          onClick={onSaveSettings}
          className="bg-gradient-primary hover:bg-primary-hover touch-manipulation min-h-[44px]"
        >
          <Save className="h-4 w-4 mr-2" />
          Save Settings
        </Button>
        
        <Button
          onClick={onResetSettings}
          variant="outline"
          className="touch-manipulation min-h-[44px]"
        >
          <RotateCcw className="h-4 w-4 mr-2" />
          Reset to Defaults
        </Button>
      </div>
    </div>
  );
};