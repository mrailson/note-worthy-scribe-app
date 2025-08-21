import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { 
  Play, 
  Pause, 
  Square, 
  Mic,
  MicOff,
  MonitorSpeaker,
  Headphones,
  Settings,
  Activity,
  Cpu,
  HardDrive,
  Network,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Download,
  Share2
} from "lucide-react";
import { useDashboard } from "../utils/DashboardContext";
import { cn } from "@/lib/utils";

interface ControlsTabProps {
  isRecording: boolean;
}

interface SystemStats {
  cpuUsage: number;
  memoryUsage: number;
  networkLatency: number;
  processingDelay: number;
}

export const ControlsTab = ({ isRecording }: ControlsTabProps) => {
  const { processingSettings, updateProcessingSettings } = useDashboard();
  const [audioSettings, setAudioSettings] = useState({
    microphoneEnabled: true,
    systemAudioEnabled: false,
    noiseReduction: true,
    autoGainControl: true,
    echoCancellation: true
  });
  const [systemStats, setSystemStats] = useState<SystemStats>({
    cpuUsage: 45,
    memoryUsage: 62,
    networkLatency: 25,
    processingDelay: 150
  });
  const [recordingQuality, setRecordingQuality] = useState([48]); // kHz
  const [compressionLevel, setCompressionLevel] = useState([75]);

  // Simulate system stats updates
  useEffect(() => {
    if (!isRecording) return;
    
    const interval = setInterval(() => {
      setSystemStats(prev => ({
        cpuUsage: Math.max(20, Math.min(90, prev.cpuUsage + (Math.random() - 0.5) * 10)),
        memoryUsage: Math.max(30, Math.min(85, prev.memoryUsage + (Math.random() - 0.5) * 5)),
        networkLatency: Math.max(10, Math.min(200, prev.networkLatency + (Math.random() - 0.5) * 20)),
        processingDelay: Math.max(50, Math.min(500, prev.processingDelay + (Math.random() - 0.5) * 50))
      }));
    }, 2000);

    return () => clearInterval(interval);
  }, [isRecording]);

  const getPerformanceStatus = (value: number, thresholds: { good: number; warning: number }) => {
    if (value <= thresholds.good) return { color: "text-success", icon: CheckCircle };
    if (value <= thresholds.warning) return { color: "text-warning", icon: AlertTriangle };
    return { color: "text-destructive", icon: AlertTriangle };
  };

  const handleAudioSettingChange = (key: keyof typeof audioSettings, value: boolean) => {
    setAudioSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleProcessingSettingChange = (key: keyof typeof processingSettings, value: boolean) => {
    updateProcessingSettings({ [key]: value });
  };

  const exportSettings = () => {
    const settings = {
      audio: audioSettings,
      processing: processingSettings,
      quality: recordingQuality[0],
      compression: compressionLevel[0],
      timestamp: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(settings, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'meeting-dashboard-settings.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-full flex flex-col space-y-6">
      {/* Recording Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Play className="h-5 w-5 text-primary" />
            Recording Controls
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              {isRecording ? (
                <div className="h-3 w-3 rounded-full bg-destructive animate-pulse" />
              ) : (
                <div className="h-3 w-3 rounded-full bg-muted" />
              )}
              <span className="text-sm font-medium">
                {isRecording ? "Recording Active" : "Recording Stopped"}
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              <Button 
                variant={isRecording ? "destructive" : "default"} 
                size="sm"
                disabled
              >
                {isRecording ? (
                  <>
                    <Square className="h-4 w-4 mr-2" />
                    Stop Recording
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Start Recording
                  </>
                )}
              </Button>
              
              <Button variant="outline" size="sm" disabled>
                <Pause className="h-4 w-4 mr-2" />
                Pause
              </Button>
            </div>
          </div>

          <div className="text-sm text-muted-foreground">
            Note: Recording controls are managed by the main recorder interface. This dashboard provides monitoring and configuration.
          </div>
        </CardContent>
      </Card>

      {/* Audio Source Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mic className="h-5 w-5 text-primary" />
            Audio Sources
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mic className="h-4 w-4" />
                <Label>Microphone</Label>
              </div>
              <Switch
                checked={audioSettings.microphoneEnabled}
                onCheckedChange={(value) => handleAudioSettingChange('microphoneEnabled', value)}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MonitorSpeaker className="h-4 w-4" />
                <Label>System Audio</Label>
              </div>
              <Switch
                checked={audioSettings.systemAudioEnabled}
                onCheckedChange={(value) => handleAudioSettingChange('systemAudioEnabled', value)}
              />
            </div>
          </div>

          <div className="space-y-3">
            <Label>Audio Processing</Label>
            <div className="grid grid-cols-1 gap-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Noise Reduction</Label>
                <Switch
                  checked={audioSettings.noiseReduction}
                  onCheckedChange={(value) => handleAudioSettingChange('noiseReduction', value)}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <Label className="text-sm">Auto Gain Control</Label>
                <Switch
                  checked={audioSettings.autoGainControl}
                  onCheckedChange={(value) => handleAudioSettingChange('autoGainControl', value)}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <Label className="text-sm">Echo Cancellation</Label>
                <Switch
                  checked={audioSettings.echoCancellation}
                  onCheckedChange={(value) => handleAudioSettingChange('echoCancellation', value)}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Processing Pipeline */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" />
            Processing Pipeline
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Real-time Cleaning</Label>
              <Switch
                checked={processingSettings.enableCleaning}
                onCheckedChange={(value) => handleProcessingSettingChange('enableCleaning', value)}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <Label>Smart Validation</Label>
              <Switch
                checked={processingSettings.enableValidation}
                onCheckedChange={(value) => handleProcessingSettingChange('enableValidation', value)}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <Label>Auto-correction</Label>
              <Switch
                checked={processingSettings.enableRealTimeCorrection}
                onCheckedChange={(value) => handleProcessingSettingChange('enableRealTimeCorrection', value)}
              />
            </div>
          </div>

          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Recording Quality (kHz)</Label>
              <Slider
                value={recordingQuality}
                onValueChange={setRecordingQuality}
                max={96}
                min={16}
                step={8}
              />
              <div className="text-sm text-muted-foreground">
                Current: {recordingQuality[0]} kHz
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Compression Level (%)</Label>
              <Slider
                value={compressionLevel}
                onValueChange={setCompressionLevel}
                max={100}
                min={25}
                step={5}
              />
              <div className="text-sm text-muted-foreground">
                Current: {compressionLevel[0]}%
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Performance Monitoring */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            Performance Monitor
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Cpu className="h-4 w-4" />
                  <Label className="text-sm">CPU Usage</Label>
                </div>
                <Badge 
                  variant={systemStats.cpuUsage > 80 ? "destructive" : systemStats.cpuUsage > 60 ? "default" : "secondary"}
                >
                  {systemStats.cpuUsage}%
                </Badge>
              </div>
              <Progress value={systemStats.cpuUsage} />
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <HardDrive className="h-4 w-4" />
                  <Label className="text-sm">Memory</Label>
                </div>
                <Badge variant="secondary">
                  {systemStats.memoryUsage}%
                </Badge>
              </div>
              <Progress value={systemStats.memoryUsage} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Network className="h-4 w-4" />
                <span>Network Latency</span>
              </div>
              <div className="font-medium">{systemStats.networkLatency}ms</div>
            </div>
            
            <div>
              <div className="flex items-center gap-2 mb-1">
                <RefreshCw className="h-4 w-4" />
                <span>Processing Delay</span>
              </div>
              <div className="font-medium">{systemStats.processingDelay}ms</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Export & Sharing */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5 text-primary" />
            Export & Sharing
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" size="sm" onClick={exportSettings}>
              <Download className="h-4 w-4 mr-2" />
              Export Settings
            </Button>
            
            <Button variant="outline" size="sm" disabled>
              <Share2 className="h-4 w-4 mr-2" />
              Share Session
            </Button>
          </div>
          
          <div className="text-xs text-muted-foreground">
            Export your dashboard configuration or share the current session with team members.
          </div>
        </CardContent>
      </Card>
    </div>
  );
};