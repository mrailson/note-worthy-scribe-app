import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ConsultationType } from "@/types/gpscribe";
import { OUTPUT_LEVELS } from "@/constants/consultationSettings";
import { Save, RotateCcw } from "lucide-react";
import { MicrophoneSettings } from "./MicrophoneSettings";

interface SettingsPanelProps {
  consultationType: ConsultationType;
  outputLevel: number;
  showSnomedCodes: boolean;
  formatForEmis: boolean;
  formatForSystmOne: boolean;
  tickerEnabled: boolean;
  showTranscriptTimestamps: boolean;
  onConsultationTypeChange: (type: ConsultationType) => void;
  onOutputLevelChange: (level: number) => void;
  onShowSnomedCodesChange: (show: boolean) => void;
  onFormatForEmisChange: (format: boolean) => void;
  onFormatForSystmOneChange: (format: boolean) => void;
  onTickerEnabledChange: (enabled: boolean) => void;
  onShowTranscriptTimestampsChange: (show: boolean) => void;
  onMicrophoneChange?: (deviceId: string | null) => void;
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
  onConsultationTypeChange,
  onOutputLevelChange,
  onShowSnomedCodesChange,
  onFormatForEmisChange,
  onFormatForSystmOneChange,
  onTickerEnabledChange,
  onShowTranscriptTimestampsChange,
  onMicrophoneChange,
  onSaveSettings,
  onResetSettings
}: SettingsPanelProps) => {
  return (
    <div className="space-y-6">
      {/* Microphone Settings - Most important for troubleshooting */}
      <MicrophoneSettings onDeviceChange={onMicrophoneChange} />
      
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