import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScribeSettings, ConsultationType, CONSULTATION_TYPE_LABELS, HistoryRetention, HISTORY_RETENTION_LABELS, AudioRecordingFormat, AUDIO_FORMAT_LABELS, CHUNK_DURATION_OPTIONS } from "@/types/scribe";
import { Save, RotateCcw, Stethoscope, Mic, Shield, Clock, AlertTriangle, ChevronDown } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Phone, ScrollText, Users } from "lucide-react";
import { ScribeMicrophoneSettings } from "./ScribeMicrophoneSettings";
import { useState } from "react";

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
  dictate: <ScrollText className="h-4 w-4" />
};

export const ScribeSettingsPanel = ({
  settings,
  onUpdateSetting,
  onSaveSettings,
  onResetSettings,
  onMicrophoneChange,
}: ScribeSettingsPanelProps) => {
  const [consultationOpen, setConsultationOpen] = useState(false);
  const [recordingOpen, setRecordingOpen] = useState(false);
  const [consentOpen, setConsentOpen] = useState(false);

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Microphone Settings - Per Consultation Type */}
      <ScribeMicrophoneSettings
        currentConsultationType={settings.defaultConsultationType}
        f2fMicrophoneId={settings.f2fMicrophoneId}
        telephoneMicrophoneId={settings.telephoneMicrophoneId}
        dictateMicrophoneId={settings.dictateMicrophoneId}
        onF2FMicrophoneChange={(deviceId) => onUpdateSetting('f2fMicrophoneId', deviceId)}
        onTelephoneMicrophoneChange={(deviceId) => onUpdateSetting('telephoneMicrophoneId', deviceId)}
        onDictateMicrophoneChange={(deviceId) => onUpdateSetting('dictateMicrophoneId', deviceId)}
        systemAudioEnabled={settings.systemAudioEnabled}
        onSystemAudioChange={(enabled) => onUpdateSetting('systemAudioEnabled', enabled)}
      />

      {/* Consultation Defaults - Collapsible */}
      <Card>
        <Collapsible open={consultationOpen} onOpenChange={setConsultationOpen}>
          <CollapsibleTrigger className="w-full">
            <div className="flex items-center justify-between p-6">
              <div className="flex items-center gap-2 font-semibold">
                <Stethoscope className="h-5 w-5" />
                Consultation Defaults
              </div>
              <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform ${consultationOpen ? 'rotate-180' : ''}`} />
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-4 pt-0">
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
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {/* Recording Settings - Collapsible */}
      <Card>
        <Collapsible open={recordingOpen} onOpenChange={setRecordingOpen}>
          <CollapsibleTrigger className="w-full">
            <div className="flex items-center justify-between p-6">
              <div className="flex items-center gap-2 font-semibold">
                <Mic className="h-5 w-5" />
                Recording Settings
              </div>
              <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform ${recordingOpen ? 'rotate-180' : ''}`} />
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-4 pt-0">
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

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="minimalRecordingView">Minimal Recording View</Label>
                  <p className="text-sm text-muted-foreground">
                    Show only timer and word count during consultations
                  </p>
                </div>
                <Switch
                  id="minimalRecordingView"
                  checked={settings.minimalRecordingView}
                  onCheckedChange={(checked) => onUpdateSetting('minimalRecordingView', checked)}
                />
              </div>

              <div className="border-t pt-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="audioFormat">Audio Format</Label>
                  <Select
                    value={settings.audioFormat || 'webm'}
                    onValueChange={(value: AudioRecordingFormat) => 
                      onUpdateSetting('audioFormat', value)
                    }
                  >
                    <SelectTrigger id="audioFormat">
                      <SelectValue placeholder="Select audio format" />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(AUDIO_FORMAT_LABELS) as AudioRecordingFormat[]).map((format) => (
                        <SelectItem key={format} value={format}>
                          {AUDIO_FORMAT_LABELS[format]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Audio encoding format for recording. WebM is recommended for best compatibility.
                  </p>
                </div>

                <div className="space-y-2 mt-4">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="chunkDuration">Chunk Duration</Label>
                    <span className="text-sm font-medium">{settings.chunkDurationSeconds || CHUNK_DURATION_OPTIONS.default}s</span>
                  </div>
                  <Slider
                    id="chunkDuration"
                    value={[settings.chunkDurationSeconds || CHUNK_DURATION_OPTIONS.default]}
                    onValueChange={(value) => onUpdateSetting('chunkDurationSeconds', value[0])}
                    min={CHUNK_DURATION_OPTIONS.min}
                    max={CHUNK_DURATION_OPTIONS.max}
                    step={CHUNK_DURATION_OPTIONS.step}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{CHUNK_DURATION_OPTIONS.min}s</span>
                    <span>{CHUNK_DURATION_OPTIONS.max}s</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Audio is processed in chunks. Longer chunks may improve accuracy but increase latency.
                  </p>
                </div>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {/* Consent Settings - Collapsible */}
      <Card>
        <Collapsible open={consentOpen} onOpenChange={setConsentOpen}>
          <CollapsibleTrigger className="w-full">
            <div className="flex items-center justify-between p-6">
              <div className="flex items-center gap-2 font-semibold">
                <Shield className="h-5 w-5" />
                Consent & Privacy
              </div>
              <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform ${consentOpen ? 'rotate-180' : ''}`} />
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-4 pt-0">
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
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {/* History Settings */}
      <Card>
        <div className="p-6">
          <div className="flex items-center gap-2 font-semibold mb-4">
            <Clock className="h-5 w-5" />
            History Settings
          </div>
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
        </div>
      </Card>

      {/* Development Settings */}
      <Card>
        <div className="p-6">
          <div className="flex items-center gap-2 font-semibold mb-4">
            <AlertTriangle className="h-5 w-5" />
            Development
          </div>
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
        </div>
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
