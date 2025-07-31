import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { 
  MessageSquare, 
  Mic, 
  MicOff, 
  Upload, 
  File, 
  Download,
  Send,
  Loader2,
  X,
  AlertCircle
} from "lucide-react";
import { toast } from "sonner";
import { SimpleFileUpload } from "@/components/SimpleFileUpload";

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  files?: UploadedFile[];
}

interface UploadedFile {
  name: string;
  type: string;
  content: string;
  size: number;
}

interface AudioRecorderProps {
  onAudioData: (audioData: Float32Array) => void;
}

class AudioRecorder {
  private stream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;

  constructor(private onAudioData: (audioData: Float32Array) => void) {}

  async start() {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 24000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      this.audioContext = new AudioContext({
        sampleRate: 24000,
      });

      this.source = this.audioContext.createMediaStreamSource(this.stream);
      this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);

      this.processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        this.onAudioData(new Float32Array(inputData));
      };

      this.source.connect(this.processor);
      this.processor.connect(this.audioContext.destination);
    } catch (error) {
      console.error('Error accessing microphone:', error);
      throw error;
    }
  }

  stop() {
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }
    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }
}

const encodeAudioForAPI = (float32Array: Float32Array): string => {
  const int16Array = new Int16Array(float32Array.length);
  for (let i = 0; i < float32Array.length; i++) {
    const s = Math.max(-1, Math.min(1, float32Array[i]));
    int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }
  const uint8Array = new Uint8Array(int16Array.buffer);
  let binary = '';
  const chunkSize = 0x8000;
  
  for (let i = 0; i < uint8Array.length; i += chunkSize) {
    const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length));
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  
  return btoa(binary);
};

interface EnhancedCQCAIProps {
  practiceContext?: any;
  onClose?: () => void;
}

const EnhancedCQCAI = ({ practiceContext, onClose }: EnhancedCQCAIProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [showFileUpload, setShowFileUpload] = useState(false);
  
  const audioRecorderRef = useRef<AudioRecorder | null>(null);
  const audioChunksRef = useRef<Float32Array[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleFileUpload = async (files: File[]) => {
    const processedFiles: UploadedFile[] = [];
    
    for (const file of files) {
      try {
        let content = '';
        
        if (file.type.startsWith('text/') || file.type === 'application/pdf') {
          // For text files and PDFs, read as text
          content = await file.text();
        } else {
          // For other files, just store metadata
          content = `[${file.type} file - ${file.size} bytes]`;
        }

        processedFiles.push({
          name: file.name,
          type: file.type,
          content: content.substring(0, 10000), // Limit content length
          size: file.size
        });
      } catch (error) {
        console.error('Error processing file:', file.name, error);
        toast.error(`Failed to process file: ${file.name}`);
      }
    }

    setUploadedFiles(prev => [...prev, ...processedFiles]);
    setShowFileUpload(false);
    toast.success(`${processedFiles.length} file(s) uploaded successfully`);
  };

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const startRecording = async () => {
    try {
      audioChunksRef.current = [];
      
      audioRecorderRef.current = new AudioRecorder((audioData) => {
        audioChunksRef.current.push(audioData);
      });

      await audioRecorderRef.current.start();
      setIsRecording(true);
      toast.success("Recording started - speak your question");
    } catch (error) {
      console.error('Error starting recording:', error);
      toast.error('Failed to start recording. Please check microphone permissions.');
    }
  };

  const stopRecording = async () => {
    if (!audioRecorderRef.current || audioChunksRef.current.length === 0) {
      setIsRecording(false);
      return;
    }

    try {
      audioRecorderRef.current.stop();
      setIsRecording(false);
      setIsLoading(true);

      // Combine all audio chunks
      const totalLength = audioChunksRef.current.reduce((acc, chunk) => acc + chunk.length, 0);
      const combinedAudio = new Float32Array(totalLength);
      let offset = 0;
      
      for (const chunk of audioChunksRef.current) {
        combinedAudio.set(chunk, offset);
        offset += chunk.length;
      }

      // Encode audio for API
      const encodedAudio = encodeAudioForAPI(combinedAudio);

      // Send to transcription service
      const response = await supabase.functions.invoke('openai-realtime-session', {
        body: {
          type: 'transcription',
          audio: encodedAudio
        }
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      const transcribedText = response.data.text;
      
      if (transcribedText && transcribedText.trim()) {
        setCurrentMessage(transcribedText);
        toast.success("Audio transcribed successfully");
      } else {
        toast.error("No speech detected in the recording");
      }

    } catch (error) {
      console.error('Error processing recording:', error);
      toast.error('Failed to process recording');
    } finally {
      setIsLoading(false);
      audioChunksRef.current = [];
    }
  };

  const handleSendMessage = async () => {
    if (!currentMessage.trim() && uploadedFiles.length === 0) return;
    if (isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: currentMessage || '[Files uploaded]',
      timestamp: new Date(),
      files: uploadedFiles.length > 0 ? [...uploadedFiles] : undefined
    };

    setMessages(prev => [...prev, userMessage]);
    setCurrentMessage('');
    setIsLoading(true);

    try {
      // Prepare context with uploaded files
      const enhancedContext = {
        ...practiceContext,
        uploadedFiles: uploadedFiles
      };

      const response = await supabase.functions.invoke('cqc-ai-assistant', {
        body: {
          messages: [...messages, userMessage],
          practiceContext: enhancedContext
        }
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.data.response,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);
      
      // Clear uploaded files after successful response
      setUploadedFiles([]);

    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to get AI response: ' + (error as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const exportChatSession = () => {
    const chatData = {
      session_date: new Date().toISOString(),
      messages: messages,
      practice_context: practiceContext,
      uploaded_files: uploadedFiles.map(f => ({
        name: f.name,
        type: f.type,
        size: f.size
      }))
    };

    const blob = new Blob([JSON.stringify(chatData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cqc-chat-session-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast.success("Chat session exported successfully");
  };

  return (
    <Card className="w-full h-[600px] flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Ask CQC Assistant
          </CardTitle>
          <CardDescription>
            Get instant answers about CQC compliance with voice, text, and file support
          </CardDescription>
        </div>
        <div className="flex gap-2">
          {messages.length > 0 && (
            <Button variant="outline" size="sm" onClick={exportChatSession}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          )}
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setShowFileUpload(!showFileUpload)}
          >
            <Upload className="h-4 w-4 mr-2" />
            Files
          </Button>
          {onClose && (
            <Button variant="outline" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col space-y-4">
        {/* File Upload Section */}
        {showFileUpload && (
          <div className="border rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">Upload Documents</h4>
              <Button variant="ghost" size="sm" onClick={() => setShowFileUpload(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <SimpleFileUpload
              onFileUpload={handleFileUpload}
              accept=".txt,.pdf,.doc,.docx,.json"
              maxSize={10}
              multiple={true}
              className="border-dashed"
            />
          </div>
        )}

        {/* Uploaded Files */}
        {uploadedFiles.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Uploaded Files:</h4>
            <div className="flex flex-wrap gap-2">
              {uploadedFiles.map((file, index) => (
                <Badge key={index} variant="secondary" className="flex items-center gap-1">
                  <File className="h-3 w-3" />
                  {file.name}
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-4 w-4 p-0 ml-1"
                    onClick={() => removeFile(index)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto space-y-3 border rounded p-3">
          {messages.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg mb-2">Ask me anything about CQC compliance!</p>
              <div className="text-sm space-y-1">
                <p>Try: "What evidence do I need for Fire Safety?"</p>
                <p>Or: "Review my infection control policy"</p>
                <p>You can also upload documents or use voice input</p>
              </div>
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] p-3 rounded-lg ${
                    message.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  }`}
                >
                  <div className="whitespace-pre-wrap">{message.content}</div>
                  {message.files && message.files.length > 0 && (
                    <div className="mt-2 text-xs opacity-70">
                      📎 {message.files.length} file(s) attached
                    </div>
                  )}
                  <div className="text-xs opacity-70 mt-1">
                    {message.timestamp.toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))
          )}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-muted p-3 rounded-lg flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Thinking...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Section */}
        <div className="space-y-3">
          <div className="flex gap-2">
            <Textarea
              value={currentMessage}
              onChange={(e) => setCurrentMessage(e.target.value)}
              placeholder="Ask about CQC compliance... (or use voice input)"
              className="flex-1"
              rows={2}
              disabled={isLoading}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
            />
            <div className="flex flex-col gap-2">
              <Button
                onClick={isRecording ? stopRecording : startRecording}
                variant={isRecording ? "destructive" : "outline"}
                size="icon"
                disabled={isLoading}
              >
                {isRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </Button>
              <Button 
                onClick={handleSendMessage}
                disabled={(!currentMessage.trim() && uploadedFiles.length === 0) || isLoading}
                size="icon"
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          
          {isRecording && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-2 rounded">
              <AlertCircle className="h-4 w-4" />
              Recording... Click the microphone button again to stop and transcribe
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default EnhancedCQCAI;