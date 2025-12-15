import { useState, useRef, useCallback, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Camera, X, RotateCcw, SwitchCamera, AlertTriangle, Loader2 } from 'lucide-react';
// Toast messages removed from LG Capture service
import { generateULID } from '@/utils/ulid';
import { CapturedImage } from '@/hooks/useLGCapture';

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

interface LGCameraModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCapture: (image: CapturedImage) => void;
  capturedCount: number;
  maxPages: number;
}

export function LGCameraModal({ 
  open, 
  onOpenChange, 
  onCapture, 
  capturedCount,
  maxPages 
}: LGCameraModalProps) {
  const [isCapturing, setIsCapturing] = useState(false);
  const [isCameraLoading, setIsCameraLoading] = useState(false);
  const [glareWarning, setGlareWarning] = useState(false);
  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraIndex, setSelectedCameraIndex] = useState(0);
  const [isRotated, setIsRotated] = useState(false);
  const [sessionCaptureCount, setSessionCaptureCount] = useState(0);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Enumerate available cameras
  const enumerateCameras = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cameras = devices.filter(device => device.kind === 'videoinput');
      setAvailableCameras(cameras);
    } catch (err) {
      console.error('Failed to enumerate cameras:', err);
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
      
      setTimeout(() => {
        setIsCameraLoading(prev => {
          if (prev) {
            console.warn('Camera init timeout - forcing UI');
            setIsCapturing(true);
            return false;
          }
          return prev;
        });
      }, 3000);
    } catch (err) {
      console.error('Camera error:', err);
      setIsCameraLoading(false);
      onOpenChange(false);
    }
  }, [enumerateCameras, onOpenChange]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCapturing(false);
    setIsCameraLoading(false);
  }, []);

  // Start camera when modal opens
  useEffect(() => {
    if (open) {
      setSessionCaptureCount(0);
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
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
    
    const newImage: CapturedImage = {
      id: generateULID(),
      dataUrl,
      timestamp: Date.now(),
    };

    if (capturedCount + sessionCaptureCount >= maxPages) {
      return;
    }

    playClickSound();
    setSessionCaptureCount(prev => prev + 1);
    onCapture(newImage);
  }, [capturedCount, sessionCaptureCount, maxPages, isRotated, onCapture]);

  const handleClose = () => {
    stopCamera();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden">
        <div className="relative aspect-[3/4] bg-black">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            webkit-playsinline="true"
            className={`absolute inset-0 w-full h-full object-cover pointer-events-none transition-all ${
              isCapturing ? 'opacity-100' : 'opacity-0'
            } ${isRotated ? 'rotate-180' : ''}`}
            onClick={isCapturing ? captureImage : undefined}
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
            <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-yellow-500 text-black px-4 py-2 rounded-lg flex items-center gap-2 z-10">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm font-medium">Glare detected - adjust angle</span>
            </div>
          )}
          
          {/* Close button */}
          <Button
            onClick={handleClose}
            variant="outline"
            size="icon"
            className="absolute top-2 left-2 bg-black/50 border-white/30 text-white hover:bg-black/70 z-10"
          >
            <X className="h-5 w-5" />
          </Button>
          
          {/* Camera controls */}
          {isCapturing && (
            <div className="absolute top-2 right-2 flex gap-2 z-10">
              <Button
                onClick={() => setIsRotated(!isRotated)}
                variant="outline"
                size="sm"
                className="bg-black/50 border-white/30 text-white hover:bg-black/70"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
              {availableCameras.length > 1 && (
                <Button
                  onClick={toggleCamera}
                  variant="outline"
                  size="sm"
                  className="bg-black/50 border-white/30 text-white hover:bg-black/70"
                >
                  <SwitchCamera className="h-4 w-4 mr-1" />
                  {selectedCameraIndex + 1}/{availableCameras.length}
                </Button>
              )}
            </div>
          )}
          
          {/* Capture button and counter */}
          {isCapturing && (
            <div className="absolute bottom-4 left-0 right-0 flex flex-col items-center gap-3 z-10">
              <Button
                onClick={captureImage}
                size="lg"
                className="h-16 w-16 rounded-full bg-white hover:bg-gray-100 text-black shadow-lg"
              >
                <Camera className="h-8 w-8" />
              </Button>
              <div className="bg-black/60 text-white px-4 py-2 rounded-full text-sm">
                {sessionCaptureCount > 0 ? (
                  <span>{sessionCaptureCount} captured this session • {capturedCount + sessionCaptureCount} total</span>
                ) : (
                  <span>Tap button or screen to capture</span>
                )}
              </div>
            </div>
          )}
          
          <canvas ref={canvasRef} className="hidden" />
        </div>
        
        {/* Done button */}
        {sessionCaptureCount > 0 && (
          <div className="p-4 bg-background">
            <Button
              onClick={handleClose}
              className="w-full h-12 bg-green-600 hover:bg-green-700"
            >
              Done ({sessionCaptureCount} captured)
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
