import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  Loader2, 
  Download, 
  ImageIcon,
  Zap,
  Mic,
  MicOff
} from "lucide-react";

interface QuickImageModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const QuickImageModal = ({ open, onOpenChange }: QuickImageModalProps) => {
  const { user } = useAuth();
  
  // State
  const [quickPrompt, setQuickPrompt] = useState("");
  const [quickModalImage, setQuickModalImage] = useState<string | null>(null);
  const [isQuickGenerating, setIsQuickGenerating] = useState(false);
  const [useRunware, setUseRunware] = useState(true);
  
  // Voice Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [audioChunks, setAudioChunks] = useState<Blob[]>([]);

  const handleQuickGenerate = async () => {
    if (!quickPrompt.trim()) {
      toast.error("Please enter a prompt");
      return;
    }

    setIsQuickGenerating(true);
    setQuickModalImage(null);

    try {
      const serviceName = useRunware ? 'runware-image-generation' : 'advanced-image-generation';
      const requestFormData = new FormData();
      
      requestFormData.append('prompt', quickPrompt);
      requestFormData.append('size', '1024x1024');
      requestFormData.append('quality', 'high');
      requestFormData.append('mode', 'generation');

      const { data, error } = await supabase.functions.invoke(serviceName, {
        body: requestFormData
      });

      if (error) {
        throw new Error(error.message || 'Failed to generate image');
      }

      if (data.success) {
        setQuickModalImage(data.imageData);
        const serviceName = useRunware ? "Runware" : "OpenAI GPT";
        toast.success(`Quick image generated with ${serviceName}!`);
      } else {
        throw new Error(data.error || "Failed to generate image");
      }
    } catch (error: any) {
      console.error("Error in quick generation:", error);
      toast.error(error.message || "Failed to generate image");
    } finally {
      setIsQuickGenerating(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          sampleRate: 44100,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      
      const recorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      const chunks: Blob[] = [];
      
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };
      
      recorder.onstop = async () => {
        const audioBlob = new Blob(chunks, { type: 'audio/webm' });
        await processAudioToText(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };
      
      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
      setAudioChunks(chunks);
      
      toast.success("Recording started - speak now!");
    } catch (error: any) {
      console.error("Error starting recording:", error);
      toast.error("Failed to start recording. Please check microphone permissions.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
      setIsRecording(false);
      setMediaRecorder(null);
      toast.success("Recording stopped - processing...");
    }
  };

  const processAudioToText = async (audioBlob: Blob) => {
    try {
      // Convert blob to base64
      const arrayBuffer = await audioBlob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      let binaryString = '';
      const chunkSize = 0x8000;
      
      for (let i = 0; i < uint8Array.length; i += chunkSize) {
        const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length));
        binaryString += String.fromCharCode.apply(null, Array.from(chunk));
      }
      
      const base64Audio = btoa(binaryString);
      
      // Send to Supabase edge function for transcription
      const { data, error } = await supabase.functions.invoke('speech-to-text', {
        body: { audio: base64Audio }
      });

      if (error) {
        throw new Error(error.message || 'Failed to transcribe audio');
      }

      if (data?.text) {
        // Append transcribed text to existing prompt
        setQuickPrompt(prev => prev ? `${prev} ${data.text}` : data.text);
        toast.success("Voice transcription added!");
      } else {
        throw new Error('No transcription received');
      }
    } catch (error: any) {
      console.error("Error processing audio:", error);
      toast.error(error.message || "Failed to process audio");
    }
  };

  const handleModalClose = (newOpen: boolean) => {
    if (!newOpen && isRecording) {
      stopRecording();
    }
    onOpenChange(newOpen);
    
    // Clear state when closing
    if (!newOpen) {
      setQuickPrompt("");
      setQuickModalImage(null);
      setIsQuickGenerating(false);
    }
  };

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={handleModalClose}>
      <DialogContent className="max-w-7xl max-h-[90vh] overflow-hidden p-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Quick Image Generator
          </DialogTitle>
        </DialogHeader>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-6 h-[80vh]">
          {/* Left Side - Input */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="quick-prompt">Describe your image</Label>
              <p className="text-xs text-muted-foreground">(The more descriptive, the better!)</p>
              <div className="relative">
                <Textarea
                  id="quick-prompt"
                  value={quickPrompt}
                  onChange={(e) => setQuickPrompt(e.target.value)}
                  placeholder="A professional NHS poster about flu vaccinations with clean design, bold text, blue color scheme..."
                  className="min-h-[200px] resize-none pr-12"
                />
                <Button
                  type="button"
                  size="sm"
                  variant={isRecording ? "destructive" : "outline"}
                  className="absolute bottom-2 right-2"
                  onClick={isRecording ? stopRecording : startRecording}
                  disabled={isQuickGenerating}
                >
                  {isRecording ? (
                    <MicOff className="h-4 w-4" />
                  ) : (
                    <Mic className="h-4 w-4" />
                  )}
                </Button>
              </div>
              {isRecording && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground animate-pulse">
                  <div className="w-2 h-2 bg-red-500 rounded-full animate-ping"></div>
                  Recording... Click the mic to stop
                </div>
              )}
            </div>
            
            <div className="flex items-center space-x-3 p-4 bg-muted/30 rounded-md">
              <Switch
                id="quick-service-toggle"
                checked={useRunware}
                onCheckedChange={setUseRunware}
              />
              <Label htmlFor="quick-service-toggle" className="flex items-center gap-2">
                <span className={useRunware ? 'font-medium' : 'text-muted-foreground'}>
                  {useRunware ? 'Runware (Fast)' : 'OpenAI GPT (Creative)'}
                </span>
              </Label>
            </div>
            
            <Button 
              onClick={handleQuickGenerate}
              disabled={isQuickGenerating || !quickPrompt.trim()}
              className="w-full"
              size="lg"
            >
              {isQuickGenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <ImageIcon className="mr-2 h-4 w-4" />
                  Generate Image
                </>
              )}
            </Button>
          </div>
          
          {/* Right Side - Output */}
          <div className="flex flex-col">
            <Label className="mb-2">Generated Image</Label>
            <div className="flex-1 border-2 border-dashed border-muted rounded-lg flex items-center justify-center bg-muted/10">
              {quickModalImage ? (
                <div className="relative w-full h-full">
                  <img 
                    src={quickModalImage} 
                    alt="Generated image"
                    className="w-full h-full object-contain rounded-lg"
                  />
                  <div className="absolute bottom-4 right-4 space-x-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        const link = document.createElement('a');
                        link.href = quickModalImage;
                        link.download = `quick-generated-${Date.now()}.png`;
                        link.click();
                      }}
                    >
                      <Download className="mr-1 h-3 w-3" />
                      Download
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center text-muted-foreground">
                  <ImageIcon className="h-12 w-12 mx-auto mb-3" />
                  <p>Your generated image will appear here</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};