import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScribeSettings, ConsultationType, CONSULTATION_TYPE_LABELS, HistoryRetention, HISTORY_RETENTION_LABELS } from "@/types/scribe";
import { Save, RotateCcw, Stethoscope, Shield, ChevronDown } from "lucide-react";
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
}: ScribeSettingsPanelProps) => {
  const [consultationOpen, setConsultationOpen] = useState(false);
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

      {/* Consent, Privacy & History Settings - Collapsible */}
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

              {/* History Retention */}
              <div className="border-t pt-4 mt-4">
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

              {/* Development Disclaimer */}
              <div className="border-t pt-4 mt-4">
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
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
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