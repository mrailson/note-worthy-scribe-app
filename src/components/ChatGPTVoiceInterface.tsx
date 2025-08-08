import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { 
  Mic, 
  MicOff, 
  MessageSquare,
  Phone, 
  PhoneOff,
  Bot,
  User,
  Send,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Volume2,
  VolumeX
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { RealtimeChat } from '@/utils/RealtimeAudio';

interface ChatGPTVoiceInterfaceProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const ChatGPTVoiceInterface: React.FC<ChatGPTVoiceInterfaceProps> = ({ isOpen, onClose }) => {
  const { toast } = useToast();
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [hasPermission, setHasPermission] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [textInput, setTextInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const chatRef = useRef<RealtimeChat | null>(null);

  // Request microphone permission
  const requestMicrophonePermission = async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      setHasPermission(true);
      toast({
        title: "Microphone access granted",
        description: "You can now use voice chat",
      });
    } catch (err) {
      console.error('Microphone permission denied:', err);
      setError('Microphone access is required for voice conversation');
      toast({
        title: "Microphone access denied",
        description: "Please allow microphone access to use voice chat",
        variant: "destructive",
      });
    }
  };

  const handleMessage = (event: any) => {
    console.log('Received message:', event);
    
    // Handle different event types
    if (event.type === 'response.audio_transcript.delta') {
      // Update or create assistant message with transcript
      setMessages(prev => {
        const lastMessage = prev[prev.length - 1];
        if (lastMessage && lastMessage.role === 'assistant' && lastMessage.id === 'current-response') {
          return [
            ...prev.slice(0, -1),
            {
              ...lastMessage,
              content: lastMessage.content + event.delta
            }
          ];
        } else {
          return [
            ...prev,
            {
              id: 'current-response',
              role: 'assistant',
              content: event.delta,
              timestamp: new Date()
            }
          ];
        }
      });
    } else if (event.type === 'response.audio_transcript.done') {
      // Finalize the assistant message
      setMessages(prev => {
        const lastMessage = prev[prev.length - 1];
        if (lastMessage && lastMessage.id === 'current-response') {
          return [
            ...prev.slice(0, -1),
            {
              ...lastMessage,
              id: `msg-${Date.now()}`,
            }
          ];
        }
        return prev;
      });
      setIsSpeaking(false);
    } else if (event.type === 'response.audio.delta') {
      setIsSpeaking(true);
    } else if (event.type === 'response.audio.done') {
      setIsSpeaking(false);
    } else if (event.type === 'input_audio_buffer.speech_started') {
      console.log('User started speaking');
    } else if (event.type === 'input_audio_buffer.speech_stopped') {
      console.log('User stopped speaking');
    } else if (event.type === 'conversation.item.input_audio_transcription.completed') {
      // Add user message from transcription
      setMessages(prev => [
        ...prev,
        {
          id: `user-${Date.now()}`,
          role: 'user',
          content: event.transcript,
          timestamp: new Date()
        }
      ]);
    }
  };

  const startConversation = async () => {
    if (!hasPermission) {
      await requestMicrophonePermission();
      if (!hasPermission) return;
    }

    try {
      setIsConnecting(true);
      setError(null);
      
      chatRef.current = new RealtimeChat(handleMessage);
      await chatRef.current.init();
      
      setIsConnected(true);
      setIsConnecting(false);
      
      toast({
        title: "Connected to ChatGPT",
        description: "Voice interface is ready. Start speaking!",
      });
    } catch (error) {
      console.error('Error starting conversation:', error);
      setIsConnecting(false);
      setError(error instanceof Error ? error.message : 'Failed to start conversation');
      toast({
        title: "Connection failed",
        description: error instanceof Error ? error.message : 'Failed to start conversation',
        variant: "destructive",
      });
    }
  };

  const endConversation = () => {
    chatRef.current?.disconnect();
    setIsConnected(false);
    setIsSpeaking(false);
    setError(null);
    
    toast({
      title: "Disconnected",
      description: "Voice conversation ended",
    });
  };

  const sendTextMessage = async () => {
    if (!textInput.trim() || !chatRef.current) return;

    try {
      // Add user message to UI
      const userMessage: Message = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: textInput,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, userMessage]);

      // Send to ChatGPT
      await chatRef.current.sendMessage(textInput);
      setTextInput('');
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: "Failed to send message",
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    // Check if microphone permission is already granted
    navigator.permissions.query({ name: 'microphone' as PermissionName }).then((result) => {
      setHasPermission(result.state === 'granted');
    });
  }, []);

  useEffect(() => {
    return () => {
      chatRef.current?.disconnect();
    };
  }, []);

  // Reset when dialog closes
  useEffect(() => {
    if (!isOpen) {
      endConversation();
      setMessages([]);
      setTextInput('');
      setError(null);
    }
  }, [isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            ChatGPT Voice Assistant
            {isConnected && (
              <Badge variant="default" className="text-xs">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Connected
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 flex flex-col gap-4">
          {/* Error Alert */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Permission Alert */}
          {!hasPermission && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Microphone access is required for voice conversation. 
                <Button 
                  variant="link" 
                  className="p-0 ml-1 h-auto"
                  onClick={requestMicrophonePermission}
                >
                  Grant permission
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {/* Connection Controls */}
          <div className="flex items-center justify-center gap-4 p-4 bg-muted/50 rounded-lg">
            {!isConnected ? (
              <Button 
                onClick={startConversation}
                disabled={!hasPermission || isConnecting}
                size="lg"
                className="flex items-center gap-2"
              >
                {isConnecting ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Phone className="h-5 w-5" />
                )}
                {isConnecting ? 'Connecting...' : 'Start Voice Chat'}
              </Button>
            ) : (
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  {isSpeaking ? (
                    <>
                      <Volume2 className="h-5 w-5 text-primary animate-pulse" />
                      <span className="text-sm text-primary">ChatGPT is speaking...</span>
                    </>
                  ) : (
                    <>
                      <Mic className="h-5 w-5 text-green-500" />
                      <span className="text-sm text-muted-foreground">Listening...</span>
                    </>
                  )}
                </div>
                <Button 
                  onClick={endConversation}
                  variant="destructive"
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <PhoneOff className="h-4 w-4" />
                  End Chat
                </Button>
              </div>
            )}
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto space-y-3 p-4 border rounded-lg">
            {messages.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Start a voice conversation or send a text message</p>
              </div>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`flex gap-3 max-w-[80%] ${message.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                      message.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'
                    }`}>
                      {message.role === 'user' ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                    </div>
                    <div className={`rounded-lg p-3 ${
                      message.role === 'user' 
                        ? 'bg-primary text-primary-foreground' 
                        : 'bg-muted'
                    }`}>
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                      <p className="text-xs opacity-70 mt-1">
                        {message.timestamp.toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Text Input */}
          {isConnected && (
            <div className="flex gap-2">
              <Textarea
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder="Type a message or use voice..."
                className="flex-1 min-h-[60px] resize-none"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendTextMessage();
                  }
                }}
              />
              <Button 
                onClick={sendTextMessage}
                disabled={!textInput.trim()}
                size="sm"
                className="self-end"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ChatGPTVoiceInterface;