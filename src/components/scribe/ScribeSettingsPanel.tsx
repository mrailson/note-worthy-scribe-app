import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScribeSettings, ConsultationType, CONSULTATION_TYPE_LABELS, HistoryRetention, HISTORY_RETENTION_LABELS } from "@/types/scribe";
import { Settings, Save, RotateCcw, Stethoscope, Mic, Shield, Clock, AlertTriangle } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Phone, Video, Users } from "lucide-react";
import { MicrophoneSettings } from "@/components/gpscribe/MicrophoneSettings";

interface ScribeSettingsPanelProps {
  settings: ScribeSettings;
  onUpdateSetting: <K extends keyof ScribeSettings>(key: K, value: ScribeSettings[K]) => void;
  onSaveSettings: () => void;
  onResetSettings: () => void;
  onMicrophoneChange?: (deviceId: string | null) => void;
}

const typeIcons: Record<ConsultationType, React.ReactNode> = {
  f2f: <Users className="h-4 w-4" />,
  telephone: <Phone className="h-4 w-4" />,
  video: <Video className="h-4 w-4" />
};

export const ScribeSettingsPanel = ({
  settings,
  onUpdateSetting,
  onSaveSettings,
  onResetSettings,
  onMicrophoneChange,
}: ScribeSettingsPanelProps) => {
  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Microphone Settings - Most important for troubleshooting */}
      <MicrophoneSettings onDeviceChange={onMicrophoneChange} />
      {/* Consultation Defaults */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Stethoscope className="h-5 w-5" />
            Consultation Defaults
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Default Consultation Method</Label>
            <ToggleGroup 
              type="single" 
              value={settings.defaultConsultationType} 
              onValueChange={(v) => v && onUpdateSetting('defaultConsultationType', v as ConsultationType)}
              className="justify-start"
            >
              {(Object.keys(CONSULTATION_TYPE_LABELS) as ConsultationType[]).map((type) => (
                <ToggleGroupItem
                  key={type}
                  value={type}
                  aria-label={CONSULTATION_TYPE_LABELS[type]}
                  className="flex items-center gap-2 px-4 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                >
                  {typeIcons[type]}
                  <span className="hidden sm:inline">{CONSULTATION_TYPE_LABELS[type]}</span>
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>

          <div className="space-y-2">
            <Label htmlFor="emrFormat">EMR System</Label>
            <Select
              value={settings.emrFormat}
              onValueChange={(value: 'emis' | 'systmone') => 
                onUpdateSetting('emrFormat', value)
              }
            >
              <SelectTrigger id="emrFormat">
                <SelectValue placeholder="Select EMR system" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="emis">EMIS Web</SelectItem>
                <SelectItem value="systmone">SystmOne (TPP)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Notes will be formatted for easy copy-paste into your EMR
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Recording Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mic className="h-5 w-5" />
            Recording Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="transcriptionService">Transcription Service</Label>
            <Select
              value={settings.transcriptionService}
              onValueChange={(value: ScribeSettings['transcriptionService']) => 
                onUpdateSetting('transcriptionService', value)
              }
            >
              <SelectTrigger id="transcriptionService">
                <SelectValue placeholder="Select transcription service" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="whisper">Whisper (Default)</SelectItem>
                <SelectItem value="assembly">Assembly AI</SelectItem>
                <SelectItem value="dual">Dual (Both Services)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="showLiveTranscript">Show Live Transcript</Label>
              <p className="text-sm text-muted-foreground">
                Display transcript during recording
              </p>
            </div>
            <Switch
              id="showLiveTranscript"
              checked={settings.showLiveTranscript}
              onCheckedChange={(checked) => onUpdateSetting('showLiveTranscript', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="autoSave">Auto-Save Drafts</Label>
              <p className="text-sm text-muted-foreground">
                Automatically save transcript drafts
              </p>
            </div>
            <Switch
              id="autoSave"
              checked={settings.autoSave}
              onCheckedChange={(checked) => onUpdateSetting('autoSave', checked)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Consent Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Consent & Privacy
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="showConsentReminder">Patient Consent Reminder</Label>
              <p className="text-sm text-muted-foreground">
                Require consent confirmation before each consultation
              </p>
            </div>
            <Switch
              id="showConsentReminder"
              checked={settings.showConsentReminder}
              onCheckedChange={(checked) => onUpdateSetting('showConsentReminder', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="showPatientBanner">Show Patient Banner During Recording</Label>
              <p className="text-sm text-muted-foreground">
                Display captured patient details during recording
              </p>
            </div>
            <Switch
              id="showPatientBanner"
              checked={settings.showPatientBannerDuringRecording}
              onCheckedChange={(checked) => onUpdateSetting('showPatientBannerDuringRecording', checked)}
            />
          </div>
        </CardContent>
      </Card>

      {/* History Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            History Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="historyRetention">Consultation History Retention</Label>
            <Select
              value={settings.historyRetention}
              onValueChange={(value: HistoryRetention) => 
                onUpdateSetting('historyRetention', value)
              }
            >
              <SelectTrigger id="historyRetention">
                <SelectValue placeholder="Select retention period" />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(HISTORY_RETENTION_LABELS) as HistoryRetention[]).map((key) => (
                  <SelectItem key={key} value={key}>
                    {HISTORY_RETENTION_LABELS[key]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Consultations older than this will be automatically removed
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Development Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Development
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="showDevDisclaimer">Show Development Disclaimer</Label>
              <p className="text-sm text-muted-foreground">
                Display the development system warning banner
              </p>
            </div>
            <Switch
              id="showDevDisclaimer"
              checked={settings.showDevDisclaimer}
              onCheckedChange={(checked) => onUpdateSetting('showDevDisclaimer', checked)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <Button onClick={onSaveSettings} className="flex-1">
          <Save className="h-4 w-4 mr-2" />
          Save Settings
        </Button>
        <Button onClick={onResetSettings} variant="outline" className="flex-1">
          <RotateCcw className="h-4 w-4 mr-2" />
          Reset to Defaults
        </Button>
      </div>
    </div>
  );
};
