import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Save, Music, AlertTriangle, CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Mp3Bitrate } from '@/utils/audioTranscoder';

type FormatOption = 'wav' | 'mp3_128' | 'mp3_64' | 'mp3_32' | 'mp3_16';

interface FormatConfig {
  label: string;
  description: string;
  sizePerSecond: string;
  size30s: string;
  quality: string;
  qualityColor: string;
  format: 'wav' | 'mp3';
  bitrate?: Mp3Bitrate;
}

const FORMAT_OPTIONS: Record<FormatOption, FormatConfig> = {
  wav: {
    label: 'WAV (16-bit PCM)',
    description: 'Lossless, highest quality',
    sizePerSecond: '~32KB/s',
    size30s: '~960KB',
    quality: 'Highest',
    qualityColor: 'bg-green-500',
    format: 'wav'
  },
  mp3_128: {
    label: 'MP3 128kbps',
    description: 'High quality, 50% smaller',
    sizePerSecond: '~16KB/s',
    size30s: '~480KB',
    quality: 'High',
    qualityColor: 'bg-emerald-500',
    format: 'mp3',
    bitrate: 128
  },
  mp3_64: {
    label: 'MP3 64kbps',
    description: 'Good for speech, 75% smaller',
    sizePerSecond: '~8KB/s',
    size30s: '~240KB',
    quality: 'Good',
    qualityColor: 'bg-blue-500',
    format: 'mp3',
    bitrate: 64
  },
  mp3_32: {
    label: 'MP3 32kbps',
    description: 'Acceptable for speech, 87% smaller',
    sizePerSecond: '~4KB/s',
    size30s: '~120KB',
    quality: 'Acceptable',
    qualityColor: 'bg-yellow-500',
    format: 'mp3',
    bitrate: 32
  },
  mp3_16: {
    label: 'MP3 16kbps',
    description: 'Minimum for intelligible speech, 94% smaller',
    sizePerSecond: '~2KB/s',
    size30s: '~60KB',
    quality: 'Minimum',
    qualityColor: 'bg-orange-500',
    format: 'mp3',
    bitrate: 16
  }
};

export function TranscriptionAudioSettings() {
  const [selectedFormat, setSelectedFormat] = useState<FormatOption>('wav');
  const [originalFormat, setOriginalFormat] = useState<FormatOption>('wav');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchSetting();
  }, []);

  const fetchSetting = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('system_settings')
        .select('setting_value')
        .eq('setting_key', 'transcription_audio_format')
        .maybeSingle();

      if (error) {
        console.error('Error fetching setting:', error);
        return;
      }

      if (data?.setting_value) {
        const parsed = typeof data.setting_value === 'string' 
          ? JSON.parse(data.setting_value) 
          : data.setting_value;
        
        const format = parsed.format || 'wav';
        const bitrate = parsed.mp3_bitrate || 64;
        
        const formatKey = format === 'wav' ? 'wav' : `mp3_${bitrate}` as FormatOption;
        setSelectedFormat(formatKey);
        setOriginalFormat(formatKey);
      }
    } catch (err) {
      console.error('Error fetching transcription audio format:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      
      const config = FORMAT_OPTIONS[selectedFormat];
      const settingValue = {
        format: config.format,
        mp3_bitrate: config.bitrate || 64
      };

      const { error } = await supabase
        .from('system_settings')
        .update({ 
          setting_value: settingValue,
          updated_at: new Date().toISOString()
        })
        .eq('setting_key', 'transcription_audio_format');

      if (error) throw error;

      setOriginalFormat(selectedFormat);
      toast.success(`Audio format updated to ${config.label}`);
    } catch (err) {
      console.error('Error saving setting:', err);
      toast.error('Failed to save audio format setting');
    } finally {
      setIsSaving(false);
    }
  };

  const hasChanges = selectedFormat !== originalFormat;
  const isLowBitrate = selectedFormat === 'mp3_16' || selectedFormat === 'mp3_32';

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Music className="h-5 w-5" />
            Transcription Audio Format
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Music className="h-5 w-5" />
          Transcription Audio Format
        </CardTitle>
        <CardDescription>
          Choose the audio format for transcription chunks. MP3 significantly reduces file sizes 
          for better scalability, whilst WAV provides lossless quality.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <RadioGroup 
          value={selectedFormat} 
          onValueChange={(value) => setSelectedFormat(value as FormatOption)}
          className="space-y-3"
        >
          {(Object.entries(FORMAT_OPTIONS) as [FormatOption, FormatConfig][]).map(([key, config]) => (
            <div 
              key={key}
              className={`flex items-start space-x-3 p-4 rounded-lg border transition-colors ${
                selectedFormat === key 
                  ? 'border-primary bg-primary/5' 
                  : 'border-border hover:bg-muted/50'
              }`}
            >
              <RadioGroupItem value={key} id={key} className="mt-1" />
              <Label htmlFor={key} className="flex-1 cursor-pointer">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium">{config.label}</span>
                  <Badge variant="outline" className="text-xs">
                    {config.size30s} / 30s
                  </Badge>
                  <div className={`w-2 h-2 rounded-full ${config.qualityColor}`} />
                  <span className="text-xs text-muted-foreground">{config.quality}</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {config.description}
                </p>
              </Label>
            </div>
          ))}
        </RadioGroup>

        {isLowBitrate && (
          <Alert variant="default" className="border-yellow-500/50 bg-yellow-500/10">
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
            <AlertDescription className="text-sm">
              Lower bitrates may affect transcription accuracy for complex speech patterns. 
              Recommended for testing purposes before production use.
            </AlertDescription>
          </Alert>
        )}

        <div className="flex items-center justify-between pt-4 border-t">
          <div className="text-sm text-muted-foreground">
            {hasChanges ? (
              <span className="text-amber-500">Unsaved changes</span>
            ) : (
              <span className="flex items-center gap-1">
                <CheckCircle className="h-4 w-4 text-green-500" />
                Settings saved
              </span>
            )}
          </div>
          <Button 
            onClick={handleSave} 
            disabled={!hasChanges || isSaving}
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
