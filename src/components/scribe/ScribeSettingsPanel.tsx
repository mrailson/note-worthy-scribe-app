import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScribeSettings } from "@/types/scribe";
import { Settings, Save, RotateCcw } from "lucide-react";

interface ScribeSettingsPanelProps {
  settings: ScribeSettings;
  onUpdateSetting: <K extends keyof ScribeSettings>(key: K, value: ScribeSettings[K]) => void;
  onSaveSettings: () => void;
  onResetSettings: () => void;
}

export const ScribeSettingsPanel = ({
  settings,
  onUpdateSetting,
  onSaveSettings,
  onResetSettings,
}: ScribeSettingsPanelProps) => {
  return (
    <div className="space-y-6">
      {/* Output Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Output Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="outputFormat">Default Output Format</Label>
            <Select
              value={settings.outputFormat}
              onValueChange={(value: ScribeSettings['outputFormat']) => 
                onUpdateSetting('outputFormat', value)
              }
            >
              <SelectTrigger id="outputFormat">
                <SelectValue placeholder="Select output format" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="summary">Summary</SelectItem>
                <SelectItem value="notes">Detailed Notes</SelectItem>
                <SelectItem value="action-items">Action Items Focus</SelectItem>
                <SelectItem value="detailed">Full Detailed Output</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Transcription Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Transcription Settings</CardTitle>
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
              <Label htmlFor="showTimestamps">Show Timestamps</Label>
              <p className="text-sm text-muted-foreground">Display timestamps in transcript</p>
            </div>
            <Switch
              id="showTimestamps"
              checked={settings.showTimestamps}
              onCheckedChange={(checked) => onUpdateSetting('showTimestamps', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="tickerEnabled">Live Ticker</Label>
              <p className="text-sm text-muted-foreground">Show real-time transcription ticker</p>
            </div>
            <Switch
              id="tickerEnabled"
              checked={settings.tickerEnabled}
              onCheckedChange={(checked) => onUpdateSetting('tickerEnabled', checked)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Auto-Save Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Auto-Save Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="autoSave">Auto-Save Drafts</Label>
              <p className="text-sm text-muted-foreground">Automatically save transcript drafts</p>
            </div>
            <Switch
              id="autoSave"
              checked={settings.autoSave}
              onCheckedChange={(checked) => onUpdateSetting('autoSave', checked)}
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
