import { useState, useRef, useCallback, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Camera, RotateCcw, X, SwitchCamera, AlertTriangle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { UploadedFile } from '@/types/ai4gp';

// Create click sound using Web Audio API
const playClickSound = () => {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = 1800;
    oscillator.type = 'square';
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.05);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.05);
  } catch (e) {
    // Silently fail if audio not available
  }
};

interface ChatCameraModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImagesCapture: (files: UploadedFile[]) => void;
}

export function ChatCameraModal({
  open,
  onOpenChange,
  onImagesCapture
}: ChatCameraModalProps) {
  const [isCapturing, setIsCapturing] = useState(false);
  const [isCameraLoading, setIsCameraLoading] = useState(false);
  const [glareWarning, setGlareWarning] = useState(false);
  const [capturedImages, setCapturedImages] = useState<{ dataUrl: string; name: string }[]>([]);
  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraIndex, setSelectedCameraIndex] = useState(0);
  const [isRotated, setIsRotated] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Enumerate available cameras
  const enumerateCameras = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cameras = devices.filter(device => device.kind === 'videoinput');
      console.log(`📷 Found ${cameras.length} camera(s):`, cameras.map(c => c.label || 'Unnamed'));
      setAvailableCameras(cameras);
      return cameras;
    } catch (err) {
      console.error('Failed to enumerate cameras:', err);
      return [];
    }
  }, []);

  const startCamera = useCallback(async (deviceId?: string) => {
    setIsCameraLoading(true);
    try {
      const constraints: MediaStreamConstraints = {
        video: deviceId 
          ? { deviceId: { exact: deviceId }, width: { ideal: 1920 }, height: { ideal: 1080 } }
          : { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      
      await enumerateCameras();
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play()
            .then(() => {
              setIsCapturing(true);
              setIsCameraLoading(false);
            })
            .catch((err) => {
              console.error('Video play error:', err);
              setIsCapturing(true);
              setIsCameraLoading(false);
            });
        };
      }
    } catch (err) {
      console.error('Camera error:', err);
      setIsCameraLoading(false);
      toast.error('Failed to access camera');
    }
  }, [enumerateCameras]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCapturing(false);
  }, []);

  // Start camera when modal opens
  useEffect(() => {
    if (open) {
      setCapturedImages([]);
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [open, startCamera, stopCamera]);

  const toggleCamera = useCallback(async () => {
    if (availableCameras.length < 2) return;
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    const nextIndex = (selectedCameraIndex + 1) % availableCameras.length;
    setSelectedCameraIndex(nextIndex);
    await startCamera(availableCameras[nextIndex].deviceId);
  }, [availableCameras, selectedCameraIndex, startCamera]);

  const captureImage = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const container = video.parentElement;
    if (!container) return;

    const containerRect = container.getBoundingClientRect();
    const videoWidth = video.videoWidth;
    const videoHeight = video.videoHeight;

    const videoRatio = videoWidth / videoHeight;
    const containerRatio = containerRect.width / containerRect.height;

    let cropX = 0, cropY = 0, cropWidth = videoWidth, cropHeight = videoHeight;

    if (videoRatio > containerRatio) {
      cropWidth = videoHeight * containerRatio;
      cropX = (videoWidth - cropWidth) / 2;
    } else {
      cropHeight = videoWidth / containerRatio;
      cropY = (videoHeight - cropHeight) / 2;
    }

    canvas.width = cropWidth;
    canvas.height = cropHeight;

    if (isRotated) {
      ctx.translate(canvas.width, canvas.height);
      ctx.rotate(Math.PI);
    }

    ctx.drawImage(
      video,
      cropX, cropY, cropWidth, cropHeight,
      0, 0, cropWidth, cropHeight
    );

    // Simple glare detection
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    let overexposedPixels = 0;
    const totalPixels = data.length / 4;
    
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] > 250 && data[i + 1] > 250 && data[i + 2] > 250) {
        overexposedPixels++;
      }
    }
    
    const overexposedRatio = overexposedPixels / totalPixels;
    if (overexposedRatio > 0.15) {
      setGlareWarning(true);
      setTimeout(() => setGlareWarning(false), 3000);
    }

    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const imageName = `Photo-${timestamp}.jpg`;

    playClickSound();
    setCapturedImages(prev => [...prev, { dataUrl, name: imageName }]);
  }, [isRotated]);

  const removeImage = (index: number) => {
    setCapturedImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleDone = () => {
    // Convert captured images to UploadedFile format
    const files: UploadedFile[] = capturedImages.map(img => ({
      name: img.name,
      type: 'image/jpeg',
      content: img.dataUrl,
      size: Math.round(img.dataUrl.length * 0.75), // Approximate size
      isLoading: false
    }));
    
    onImagesCapture(files);
    onOpenChange(false);
    toast.success(`${files.length} photo${files.length > 1 ? 's' : ''} added`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            Capture Photos
          </DialogTitle>
          <DialogDescription>
            Take photos directly from your camera. Tap the preview to capture.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Camera View */}
          <div
            className="relative aspect-[4/3] bg-black rounded-lg overflow-hidden cursor-pointer active:opacity-90"
            onClick={isCapturing ? captureImage : undefined}
          >
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`absolute inset-0 w-full h-full object-cover pointer-events-none transition-all ${
                isCapturing ? 'opacity-100' : 'opacity-0'
              } ${isRotated ? 'rotate-180' : ''}`}
            />
            
            {isCameraLoading && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center text-white">
                  <Loader2 className="h-12 w-12 animate-spin mx-auto mb-3" />
                  <p>Starting camera...</p>
                </div>
              </div>
            )}
            
            {isCapturing && glareWarning && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-yellow-500 text-black px-4 py-2 rounded-lg flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-sm font-medium">Glare detected - adjust angle</span>
              </div>
            )}
            
            {/* Camera controls */}
            {isCapturing && (
              <div className="absolute top-2 right-2 flex gap-2">
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsRotated(!isRotated);
                  }}
                  variant="outline"
                  size="sm"
                  className="bg-black/50 border-white/30 text-white hover:bg-black/70"
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (availableCameras.length > 1) {
                      toggleCamera();
                    } else {
                      toast.info('Only one camera detected');
                    }
                  }}
                  variant="outline"
                  size="sm"
                  className="bg-black/50 border-white/30 text-white hover:bg-black/70"
                  title={availableCameras.length > 1 ? `Switch camera (${selectedCameraIndex + 1}/${availableCameras.length})` : 'Switch camera'}
                >
                  <SwitchCamera className="h-4 w-4" />
                  {availableCameras.length > 1 && (
                    <span className="ml-1">{selectedCameraIndex + 1}/{availableCameras.length}</span>
                  )}
                </Button>
              </div>
            )}
            
            {/* Tap to capture hint */}
            {isCapturing && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/50 text-white px-3 py-1.5 rounded-full text-sm">
                Tap to capture
              </div>
            )}
          </div>
          
          <canvas ref={canvasRef} className="hidden" />
          
          {/* Captured thumbnails */}
          {capturedImages.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">{capturedImages.length} photo(s) captured</p>
              <div className="flex gap-2 flex-wrap">
                {capturedImages.map((img, index) => (
                  <div key={index} className="relative group">
                    <img
                      src={img.dataUrl}
                      alt={`Captured ${index + 1}`}
                      className="w-16 h-16 object-cover rounded-md border"
                    />
                    <Button
                      onClick={() => removeImage(index)}
                      variant="destructive"
                      size="icon"
                      className="absolute -top-2 -right-2 w-5 h-5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleDone}
              disabled={capturedImages.length === 0}
            >
              Add {capturedImages.length} Photo{capturedImages.length !== 1 ? 's' : ''}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
