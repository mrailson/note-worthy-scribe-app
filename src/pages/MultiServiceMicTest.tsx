import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Mic, MicOff, Loader2, Download, Save, Clock, Hash } from 'lucide-react';
import { DeepgramRealtimeTranscriber, TranscriptData as DeepgramTranscriptData } from '@/utils/DeepgramRealtimeTranscriber';
import { BrowserSpeechTranscriber, TranscriptData as BrowserTranscriptData } from '@/utils/BrowserSpeechTranscriber';
import { WhisperTranscriber, TranscriptData as WhisperTranscriptData } from '@/utils/WhisperTranscriber';
import { toast } from 'sonner';

interface ServiceResult {
  name: string;
  status: string;
  transcriptData: any[];
  currentTranscript: string;
  isActive: boolean;
  transcriber: any;
  startTime: Date | null;
  wordCount: number;
  fullTranscript: string;
}

const MultiServiceMicTest = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionStartTime, setSessionStartTime] = useState<Date | null>(null);
  
  const [services, setServices] = useState<Record<string, ServiceResult>>({
    browser: {
      name: 'Browser Speech API',
      status: 'Disconnected',
      transcriptData: [],
      currentTranscript: '',
      isActive: false,
      transcriber: null,
      startTime: null,
      wordCount: 0,
      fullTranscript: ''
    },
    whisper: {
      name: 'Whisper AI',
      status: 'Disconnected',
      transcriptData: [],
      currentTranscript: '',
      isActive: false,
      transcriber: null,
      startTime: null,
      wordCount: 0,
      fullTranscript: ''
    },
    deepgram: {
      name: 'Deepgram Realtime',
      status: 'Disconnected',
      transcriptData: [],
      currentTranscript: '',
      isActive: false,
      transcriber: null,
      startTime: null,
      wordCount: 0,
      fullTranscript: ''
    }
  });

  const createServiceCallbacks = (serviceKey: string) => {
    const onTranscription = (data: any) => {
      console.log(`${serviceKey} transcription:`, data);
      
      setServices(prev => {
        const service = prev[serviceKey];
        let updatedService = { ...service };
        
        if (data.is_final || data.isFinal) {
          const newTranscript = data.text;
          const updatedFullTranscript = service.fullTranscript + ' ' + newTranscript;
          const wordCount = updatedFullTranscript.trim().split(/\s+/).length;
          
          updatedService = {
            ...service,
            transcriptData: [...service.transcriptData, data],
            currentTranscript: '',
            fullTranscript: updatedFullTranscript,
            wordCount: wordCount
          };
        } else {
          updatedService = {
            ...service,
            currentTranscript: data.text
          };
        }
        
        return {
          ...prev,
          [serviceKey]: updatedService
        };
      });
    };

    const onError = (error: string) => {
      console.error(`${serviceKey} error:`, error);
      toast.error(`${serviceKey} error: ${error}`);
      
      setServices(prev => ({
        ...prev,
        [serviceKey]: {
          ...prev[serviceKey],
          status: `Error: ${error}`,
          isActive: false
        }
      }));
    };

    const onStatusChange = (status: string) => {
      console.log(`${serviceKey} status:`, status);
      
      setServices(prev => ({
        ...prev,
        [serviceKey]: {
          ...prev[serviceKey],
          status
        }
      }));
    };

    const onSummary = (summary: string) => {
      console.log(`${serviceKey} summary:`, summary);
    };

    return { onTranscription, onError, onStatusChange, onSummary };
  };

  const startAllServices = async () => {
    setIsLoading(true);
    setSessionStartTime(new Date());
    
    try {
      const servicePromises = Object.keys(services).map(async (serviceKey) => {
        try {
          const callbacks = createServiceCallbacks(serviceKey);
          let transcriber;

          switch (serviceKey) {
            case 'browser':
              transcriber = new BrowserSpeechTranscriber(
                callbacks.onTranscription,
                callbacks.onError,
                callbacks.onStatusChange,
                callbacks.onSummary
              );
              break;
            case 'whisper':
              const EDGE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/speech-to-text-chunked`;
              transcriber = new WhisperTranscriber(
                EDGE_URL,
                (payload) => {
                  const text = payload?.data?.text || payload?.text || '';
                  if (text.trim()) {
                    callbacks.onTranscription({
                      text: text.trim(),
                      is_final: true,
                      confidence: 0.95,
                      speaker: 'Speaker'
                    });
                  }
                },
                (err) => callbacks.onError(err.message)
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
              throw new Error(`Unknown service: ${serviceKey}`);
          }

          await transcriber.startTranscription();
          
          setServices(prev => ({
            ...prev,
            [serviceKey]: {
              ...prev[serviceKey],
              transcriber,
              isActive: true,
              startTime: new Date()
            }
          }));
          
          console.log(`${serviceKey} started successfully`);
        } catch (error) {
          console.error(`Failed to start ${serviceKey}:`, error);
          setServices(prev => ({
            ...prev,
            [serviceKey]: {
              ...prev[serviceKey],
              status: `Failed: ${error}`,
              isActive: false
            }
          }));
        }
      });

      await Promise.all(servicePromises);
      setIsRecording(true);
      toast.success('All services started');
    } catch (error) {
      console.error('Error starting services:', error);
      toast.error('Failed to start some services');
    } finally {
      setIsLoading(false);
    }
  };

  const stopAllServices = () => {
    Object.entries(services).forEach(([key, service]) => {
      if (service.transcriber && service.isActive) {
        service.transcriber.stopTranscription();
      }
    });

    setServices(prev => {
      const updated = { ...prev };
      Object.keys(updated).forEach(key => {
        updated[key] = {
          ...updated[key],
          isActive: false,
          status: 'Disconnected'
        };
      });
      return updated;
    });

    setIsRecording(false);
    toast.success('All services stopped');
  };

  const clearAllResults = () => {
    setServices(prev => {
      const updated = { ...prev };
      Object.keys(updated).forEach(key => {
        updated[key] = {
          ...updated[key],
          transcriptData: [],
          currentTranscript: '',
          fullTranscript: '',
          wordCount: 0,
          startTime: null
        };
      });
      return updated;
    });
    setSessionStartTime(null);
    toast.success('All results cleared');
  };

  const saveIndividualTranscript = (serviceKey: string) => {
    const service = services[serviceKey];
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    const content = `=== ${service.name} Transcription Results ===
Session Date: ${sessionStartTime?.toLocaleString() || 'Unknown'}
Service Start Time: ${service.startTime?.toLocaleString() || 'Unknown'}
Recording Duration: ${service.startTime ? Math.round((new Date().getTime() - service.startTime.getTime()) / 1000) : 0} seconds
Word Count: ${service.wordCount}
Status: ${service.status}

=== FULL TRANSCRIPT ===
${service.fullTranscript.trim() || 'No transcription recorded'}

=== INDIVIDUAL SEGMENTS ===
${service.transcriptData.map((segment, index) => 
  `Segment ${index + 1}: ${segment.text}${segment.confidence ? ` (${(segment.confidence * 100).toFixed(0)}% confidence)` : ''}`
).join('\n')}

Generated: ${new Date().toLocaleString()}
`;

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${serviceKey}-transcript-${timestamp}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    toast.success(`${service.name} transcript saved`);
  };

  const saveAllTranscripts = () => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    let content = `=== MULTI-SERVICE MICROPHONE TEST RESULTS ===
Session Date: ${sessionStartTime?.toLocaleString() || 'Unknown'}
Generated: ${new Date().toLocaleString()}

=== SUMMARY ===
`;

    Object.entries(services).forEach(([key, service]) => {
      content += `
${service.name}:
  - Status: ${service.status}
  - Word Count: ${service.wordCount}
  - Recording Duration: ${service.startTime ? Math.round((new Date().getTime() - service.startTime.getTime()) / 1000) : 0}s
  - Segments: ${service.transcriptData.length}`;
    });

    content += `\n\n=== FULL TRANSCRIPTS BY SERVICE ===\n`;

    Object.entries(services).forEach(([key, service]) => {
      content += `\n\n--- ${service.name.toUpperCase()} ---
Full Transcript: ${service.fullTranscript.trim() || 'No transcription recorded'}

Individual Segments:
${service.transcriptData.map((segment, index) => 
  `${index + 1}. ${segment.text}${segment.confidence ? ` (${(segment.confidence * 100).toFixed(0)}% confidence)` : ''}`
).join('\n')}
`;
    });

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `multi-service-transcription-${timestamp}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    toast.success('All transcripts saved to file');
  };

  useEffect(() => {
    return () => {
      // Cleanup on unmount
      Object.values(services).forEach(service => {
        if (service.transcriber && service.isActive) {
          service.transcriber.stopTranscription();
        }
      });
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-background p-2 md:p-4">
      <div className="max-w-7xl mx-auto space-y-4 md:space-y-6">
        {/* Header */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Multi-Service Microphone Test</span>
              <div className="flex items-center gap-2">
                {sessionStartTime && (
                  <Badge variant="outline" className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Started: {sessionStartTime.toLocaleTimeString()}
                  </Badge>
                )}
                <Badge variant={isRecording ? 'default' : 'secondary'}>
                  {isRecording ? 'Recording Active' : 'Stopped'}
                </Badge>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <p className="text-muted-foreground">
                Test all speech-to-text services simultaneously from one microphone input. Compare accuracy and performance in real-time.
              </p>
              
              <div className="flex gap-2">
                {!isRecording ? (
                  <Button
                    onClick={startAllServices}
                    disabled={isLoading}
                    className="flex items-center gap-2"
                  >
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mic className="w-4 h-4" />}
                    {isLoading ? 'Starting...' : 'Start All Services'}
                  </Button>
                ) : (
                  <Button
                    onClick={stopAllServices}
                    variant="destructive"
                    className="flex items-center gap-2"
                  >
                    <MicOff className="w-4 h-4" />
                    Stop All
                  </Button>
                )}
                
                <Button
                  onClick={clearAllResults}
                  variant="outline"
                  disabled={isRecording}
                >
                  Clear All
                </Button>
                
                <Button
                  onClick={saveAllTranscripts}
                  variant="outline"
                  className="flex items-center gap-2"
                  disabled={Object.values(services).every(s => s.wordCount === 0)}
                >
                  <Download className="w-4 h-4" />
                  Save All
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Service Results */}
        <div className="w-full">
          <div className="flex overflow-x-auto pb-2 mb-4 scrollbar-hide border-b">
            {Object.entries(services).map(([key, service]) => (
              <div
                key={key}
                className={`flex-shrink-0 flex items-center gap-2 px-4 py-3 mx-1 rounded-lg border text-sm font-medium transition-colors whitespace-nowrap ${
                  service.isActive 
                    ? 'bg-primary text-primary-foreground border-primary' 
                    : 'bg-card border-border'
                }`}
              >
                <div className="w-3 h-3 rounded-full" style={{
                  backgroundColor: service.isActive ? '#10b981' : '#6b7280'
                }} />
                <span>{service.name}</span>
                <Badge variant="secondary" className="text-xs">
                  {service.wordCount}
                </Badge>
              </div>
            ))}
          </div>
        </div>
        {/* Service Results Grid */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:gap-6">
          {Object.entries(services).map(([key, service]) => (
            <Card key={key} className="h-fit">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="text-lg">{service.name}</span>
                  <div className="flex items-center gap-2">
                    <Badge variant={service.isActive ? 'default' : 'secondary'}>
                      {service.status}
                    </Badge>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Service Stats */}
                <div className="grid grid-cols-2 gap-4 p-3 bg-muted/50 rounded-lg">
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1 text-sm text-muted-foreground">
                      <Hash className="w-3 h-3" />
                      Words
                    </div>
                    <div className="text-xl font-semibold">{service.wordCount}</div>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1 text-sm text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      Segments
                    </div>
                    <div className="text-xl font-semibold">{service.transcriptData.length}</div>
                  </div>
                </div>

                {/* Live Transcript */}
                {(service.isActive || service.currentTranscript) && (
                  <div>
                    <h4 className="text-sm font-medium mb-2 text-muted-foreground">Live Transcript:</h4>
                    <div className="p-3 bg-muted/30 rounded-lg min-h-[60px] border-l-4 border-primary">
                      <p className="text-sm italic">
                        {service.currentTranscript || 'Listening...'}
                      </p>
                    </div>
                  </div>
                )}

                {/* Full Transcript */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-medium text-muted-foreground">Full Transcript:</h4>
                    <Button
                      onClick={() => saveIndividualTranscript(key)}
                      variant="ghost"
                      size="sm"
                      className="flex items-center gap-1"
                      disabled={service.wordCount === 0}
                    >
                      <Save className="w-3 h-3" />
                      Save
                    </Button>
                  </div>
                  <div className="p-3 bg-card border rounded-lg max-h-[200px] overflow-y-auto">
                    {service.fullTranscript ? (
                      <p className="text-sm whitespace-pre-wrap">{service.fullTranscript}</p>
                    ) : (
                      <p className="text-muted-foreground text-sm text-center py-4">
                        No transcription yet. Start recording to see results.
                      </p>
                    )}
                  </div>
                </div>

                {/* Recent Segments */}
                {service.transcriptData.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-2 text-muted-foreground">
                      Recent Segments ({service.transcriptData.slice(-3).length} of {service.transcriptData.length}):
                    </h4>
                    <div className="space-y-2 max-h-[120px] overflow-y-auto">
                      {service.transcriptData.slice(-3).map((segment, index) => (
                        <div key={index} className="p-2 bg-muted/20 rounded text-xs">
                          <div className="flex items-center justify-between mb-1">
                            <Badge variant="outline" className="text-xs">
                              #{service.transcriptData.length - 3 + index + 1}
                            </Badge>
                            {segment.confidence && (
                              <span className="text-muted-foreground">
                                {(segment.confidence * 100).toFixed(0)}%
                              </span>
                            )}
                          </div>
                          <p>{segment.text}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};

export default MultiServiceMicTest;