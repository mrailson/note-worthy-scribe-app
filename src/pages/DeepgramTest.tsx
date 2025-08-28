import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Mic, MicOff, Loader2, Smartphone, Zap, Bot, Radio } from 'lucide-react';
import { DeepgramRealtimeTranscriber, TranscriptData as DeepgramTranscriptData } from '@/utils/DeepgramRealtimeTranscriber';
import { BrowserSpeechTranscriber, TranscriptData as BrowserTranscriptData } from '@/utils/BrowserSpeechTranscriber';
import { OpenAIRealtimeTranscriber, TranscriptData as OpenAITranscriptData } from '@/utils/OpenAIRealtimeTranscriber';
import { WhisperTranscriber, TranscriptData as WhisperTranscriptData } from '@/utils/WhisperTranscriber';
import { toast } from 'sonner';

type ServiceType = 'browser' | 'openai' | 'whisper' | 'deepgram';

interface ServiceData {
  isRecording: boolean;
  transcriptData: any[];
  currentTranscript: string;
  status: string;
  isLoading: boolean;
  transcriber: any;
}

const DeepgramTest = () => {
  const [activeService, setActiveService] = useState<ServiceType>('browser');
  const [services, setServices] = useState<Record<ServiceType, ServiceData>>({
    browser: {
      isRecording: false,
      transcriptData: [],
      currentTranscript: '',
      status: 'Disconnected',
      isLoading: false,
      transcriber: null
    },
    openai: {
      isRecording: false,
      transcriptData: [],
      currentTranscript: '',
      status: 'Disconnected',
      isLoading: false,
      transcriber: null
    },
    whisper: {
      isRecording: false,
      transcriptData: [],
      currentTranscript: '',
      status: 'Disconnected',
      isLoading: false,
      transcriber: null
    },
    deepgram: {
      isRecording: false,
      transcriptData: [],
      currentTranscript: '',
      status: 'Disconnected',
      isLoading: false,
      transcriber: null
    }
  });

  const createServiceCallbacks = (serviceType: ServiceType) => {
    const onTranscription = (data: any) => {
      console.log(`${serviceType} transcription received:`, data);
      
      setServices(prev => {
        const service = prev[serviceType];
        if (data.is_final || data.isFinal) {
          return {
            ...prev,
            [serviceType]: {
              ...service,
              transcriptData: [...service.transcriptData, data],
              currentTranscript: ''
            }
          };
        } else {
          return {
            ...prev,
            [serviceType]: {
              ...service,
              currentTranscript: data.text
            }
          };
        }
      });
    };

    const onError = (error: string) => {
      console.error(`${serviceType} error:`, error);
      toast.error(`${serviceType} error: ${error}`);
      
      setServices(prev => ({
        ...prev,
        [serviceType]: {
          ...prev[serviceType],
          status: `Error: ${error}`,
          isRecording: false,
          isLoading: false
        }
      }));
    };

    const onStatusChange = (status: string) => {
      console.log(`${serviceType} status changed:`, status);
      
      setServices(prev => ({
        ...prev,
        [serviceType]: {
          ...prev[serviceType],
          status
        }
      }));
    };

    const onSummary = (summary: string) => {
      console.log(`${serviceType} summary received:`, summary);
      toast.success(`${serviceType} summary generated`);
    };

    return { onTranscription, onError, onStatusChange, onSummary };
  };

  useEffect(() => {
    return () => {
      // Cleanup all services
      Object.values(services).forEach(service => {
        if (service.transcriber) {
          service.transcriber.stopTranscription();
        }
      });
    };
  }, []);

  const startRecording = async (serviceType: ServiceType) => {
    try {
      setServices(prev => ({
        ...prev,
        [serviceType]: {
          ...prev[serviceType],
          isLoading: true,
          status: 'Connecting...'
        }
      }));
      
      const callbacks = createServiceCallbacks(serviceType);
      let transcriber;

      switch (serviceType) {
        case 'browser':
          transcriber = new BrowserSpeechTranscriber(
            callbacks.onTranscription,
            callbacks.onError,
            callbacks.onStatusChange,
            callbacks.onSummary
          );
          break;
        case 'openai':
          transcriber = new OpenAIRealtimeTranscriber(
            callbacks.onTranscription,
            callbacks.onError,
            callbacks.onStatusChange
          );
          break;
        case 'whisper':
          transcriber = new WhisperTranscriber(
            callbacks.onTranscription,
            callbacks.onError,
            callbacks.onStatusChange,
            callbacks.onSummary
          );
          break;
        case 'deepgram':
          transcriber = new DeepgramRealtimeTranscriber(
            callbacks.onTranscription,
            callbacks.onError,
            callbacks.onStatusChange,
            callbacks.onSummary
          );
          break;
        default:
          throw new Error('Unknown service type');
      }

      await transcriber.startTranscription();
      
      setServices(prev => ({
        ...prev,
        [serviceType]: {
          ...prev[serviceType],
          transcriber,
          isRecording: true,
          isLoading: false
        }
      }));
      
      toast.success(`${serviceType} recording started`);
    } catch (error) {
      console.error(`Failed to start ${serviceType} recording:`, error);
      toast.error(`Failed to start ${serviceType} recording`);
      
      setServices(prev => ({
        ...prev,
        [serviceType]: {
          ...prev[serviceType],
          isLoading: false,
          status: 'Failed to connect'
        }
      }));
    }
  };

  const stopRecording = (serviceType: ServiceType) => {
    const service = services[serviceType];
    if (service.transcriber) {
      service.transcriber.stopTranscription();
      
      setServices(prev => ({
        ...prev,
        [serviceType]: {
          ...prev[serviceType],
          isRecording: false,
          status: 'Disconnected'
        }
      }));
      
      toast.success(`${serviceType} recording stopped`);
    }
  };

  const clearTranscripts = (serviceType: ServiceType) => {
    setServices(prev => ({
      ...prev,
      [serviceType]: {
        ...prev[serviceType],
        transcriptData: [],
        currentTranscript: ''
      }
    }));
    toast.success(`${serviceType} transcripts cleared`);
  };

  const renderServicePanel = (serviceType: ServiceType) => {
    const service = services[serviceType];
    const serviceNames = {
      browser: 'Browser Speech API',
      openai: 'OpenAI Realtime',
      whisper: 'Whisper AI (Local)',
      deepgram: 'Deepgram Realtime'
    };
    
    const serviceIcons = {
      browser: <Smartphone className="w-4 h-4" />,
      openai: <Zap className="w-4 h-4" />,
      whisper: <Bot className="w-4 h-4" />,
      deepgram: <Radio className="w-4 h-4" />
    };

    return (
      <div className="space-y-4">
        {/* Service Controls */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {serviceIcons[serviceType]}
                <span>{serviceNames[serviceType]}</span>
              </div>
              <Badge variant={service.isRecording ? 'default' : 'secondary'}>
                {service.status}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              {!service.isRecording ? (
                <Button
                  onClick={() => startRecording(serviceType)}
                  disabled={service.isLoading}
                  className="flex items-center gap-2"
                >
                  {service.isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mic className="w-4 h-4" />}
                  {service.isLoading ? 'Connecting...' : 'Start Recording'}
                </Button>
              ) : (
                <Button
                  onClick={() => stopRecording(serviceType)}
                  variant="destructive"
                  className="flex items-center gap-2"
                >
                  <MicOff className="w-4 h-4" />
                  Stop Recording
                </Button>
              )}
              
              <Button
                onClick={() => clearTranscripts(serviceType)}
                variant="outline"
                disabled={service.transcriptData.length === 0}
              >
                Clear
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Live Transcript */}
        {(service.isRecording || service.currentTranscript) && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Live Transcript
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="p-4 bg-muted/50 rounded-lg min-h-[60px]">
                <p className="text-muted-foreground italic">
                  {service.currentTranscript || 'Listening...'}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Final Transcripts */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Transcription Results</span>
              <Badge variant="outline">
                {service.transcriptData.length} segments
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {service.transcriptData.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No transcriptions yet. Start recording to see results.
                </p>
              ) : (
                service.transcriptData.map((data, index) => (
                  <div
                    key={index}
                    className="p-3 bg-card border rounded-lg space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="text-xs">
                        Segment {index + 1}
                      </Badge>
                      {data.confidence && (
                        <Badge variant="secondary" className="text-xs">
                          {(data.confidence * 100).toFixed(0)}% confidence
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm">{data.text}</p>
                    {data.speaker && (
                      <p className="text-xs text-muted-foreground">
                        Speaker: {data.speaker}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Debug Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Debug Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium">Status:</span> {service.status}
              </div>
              <div>
                <span className="font-medium">Recording:</span> {service.isRecording ? 'Yes' : 'No'}
              </div>
              <div>
                <span className="font-medium">Total Segments:</span> {service.transcriptData.length}
              </div>
              <div>
                <span className="font-medium">Total Words:</span>{' '}
                {service.transcriptData.reduce((acc, data) => acc + data.text.split(' ').length, 0)}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-background p-2 md:p-4">
      <div className="max-w-6xl mx-auto space-y-4 md:space-y-6">
        {/* Header */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Multi-Service Microphone Test</span>
              <div className="flex gap-2">
                {Object.entries(services).map(([type, service]) => (
                  <Badge 
                    key={type} 
                    variant={service.isRecording ? 'default' : 'secondary'}
                    className="capitalize"
                  >
                    {type}: {service.status}
                  </Badge>
                ))}
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Test and compare different speech-to-text services. Each service can be started independently to compare accuracy and performance.
            </p>
          </CardContent>
        </Card>

        {/* Consolidated Transcription */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Consolidated Transcription</span>
              <Badge variant="outline">
                {Object.values(services).reduce((acc, service) => acc + service.transcriptData.length, 0)} total segments
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 max-h-[500px] overflow-y-auto">
              {Object.values(services).every(service => service.transcriptData.length === 0) ? (
                <p className="text-muted-foreground text-center py-8">
                  No transcriptions available. Start recording with any service to see consolidated results.
                </p>
              ) : (
                <div className="space-y-3">
                  {Object.entries(services).map(([serviceType, service]) => {
                    if (service.transcriptData.length === 0) return null;
                    
                    const serviceNames = {
                      browser: 'Browser Speech API',
                      openai: 'OpenAI Realtime',
                      whisper: 'Whisper AI',
                      deepgram: 'Deepgram Realtime'
                    };

                    const serviceIcons = {
                      browser: <Smartphone className="w-4 h-4" />,
                      openai: <Zap className="w-4 h-4" />,
                      whisper: <Bot className="w-4 h-4" />,
                      deepgram: <Radio className="w-4 h-4" />
                    };

                    const fullText = service.transcriptData.map(data => data.text).join(' ');
                    
                    return (
                      <div key={serviceType} className="p-4 bg-muted/30 rounded-lg border">
                        <div className="flex items-center gap-2 mb-3">
                          {serviceIcons[serviceType as ServiceType]}
                          <h3 className="font-semibold text-sm">{serviceNames[serviceType as ServiceType]}</h3>
                          <Badge variant="secondary" className="text-xs">
                            {service.transcriptData.length} segments
                          </Badge>
                        </div>
                        <p className="text-sm leading-relaxed">
                          {fullText || 'No transcription available'}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Service Tabs */}
        <div className="w-full">
          <div className="flex overflow-x-auto pb-2 mb-4 scrollbar-hide border-b">
            {[
              { key: 'browser', icon: Smartphone, label: 'Browser' },
              { key: 'openai', icon: Zap, label: 'OpenAI' },
              { key: 'whisper', icon: Bot, label: 'Whisper' },
              { key: 'deepgram', icon: Radio, label: 'Deepgram' }
            ].map(({ key, icon: Icon, label }) => (
              <button
                key={key}
                onClick={() => setActiveService(key as ServiceType)}
                className={`flex-shrink-0 flex items-center gap-2 px-4 py-3 mx-1 rounded-lg border text-sm font-medium transition-colors whitespace-nowrap ${
                  activeService === key 
                    ? 'bg-primary text-primary-foreground border-primary' 
                    : 'bg-card hover:bg-accent border-border'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{label}</span>
              </button>
            ))}
          </div>
          
          {/* Active Service Panel */}
          <div>
            {renderServicePanel(activeService)}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeepgramTest;