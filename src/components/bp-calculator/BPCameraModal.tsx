import { useState, useRef, useCallback, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Camera, X, RotateCcw, SwitchCamera, AlertTriangle, Loader2, Check } from 'lucide-react';

// Convert data URL to Blob without using fetch (to avoid CSP issues)
const dataURLtoBlob = (dataURL: string): Blob => {
  const arr = dataURL.split(',');
  const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
};

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

interface BPCameraModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCapture: (files: File[]) => void;
}

export function BPCameraModal({ open, onOpenChange, onCapture }: BPCameraModalProps) {
  const [isCapturing, setIsCapturing] = useState(false);
  const [isCameraLoading, setIsCameraLoading] = useState(false);
  const [glareWarning, setGlareWarning] = useState(false);
  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraIndex, setSelectedCameraIndex] = useState(0);
  const [isRotated, setIsRotated] = useState(false);
  const [capturedImages, setCapturedImages] = useState<string[]>([]);
  const [showFlash, setShowFlash] = useState(false);
  
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
      setCapturedImages([]);
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
    
    playClickSound();
    
    // Flash effect
    setShowFlash(true);
    setTimeout(() => setShowFlash(false), 150);
    
    // Add to captured images array
    setCapturedImages(prev => [...prev, dataUrl]);
  }, [isRotated]);

  const handleDone = useCallback(() => {
    console.log('[BPCameraModal] handleDone called, capturedImages:', capturedImages.length);
    
    if (capturedImages.length === 0) {
      console.log('[BPCameraModal] No images captured, closing modal');
      stopCamera();
      onOpenChange(false);
      return;
    }
    
    try {
      // Convert all data URLs to Files using dataURLtoBlob (avoids CSP fetch issues)
      console.log('[BPCameraModal] Converting', capturedImages.length, 'images to files');
      const files: File[] = capturedImages.map((dataUrl, index) => {
        const blob = dataURLtoBlob(dataUrl);
        return new File([blob], `bp-photo-${Date.now()}-${index + 1}.jpg`, { type: 'image/jpeg' });
      });
      
      console.log('[BPCameraModal] Created files:', files.map(f => f.name));
      
      // Stop camera first, then pass files and close
      stopCamera();
      setCapturedImages([]);
      console.log('[BPCameraModal] Calling onCapture with', files.length, 'files');
      onCapture(files);
      onOpenChange(false);
    } catch (err) {
      console.error('[BPCameraModal] Error in handleDone:', err);
    }
  }, [capturedImages, onCapture, onOpenChange, stopCamera]);

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
          />
          
          {/* Flash effect */}
          {showFlash && (
            <div className="absolute inset-0 bg-white z-20 animate-pulse" />
          )}
          
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
          
          {/* Page count badge */}
          {capturedImages.length > 0 && (
            <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-green-600 text-white px-4 py-2 rounded-full text-sm font-medium z-10">
              {capturedImages.length} page{capturedImages.length !== 1 ? 's' : ''} captured
            </div>
          )}
          
          {/* Camera controls - only show when capturing */}
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
          
          {/* Capture button and Done button */}
          {isCapturing && (
            <div className="absolute bottom-4 left-0 right-0 flex flex-col items-center gap-3 z-10">
              <div className="flex items-center gap-4">
                <Button
                  onClick={captureImage}
                  size="lg"
                  className="h-16 w-16 rounded-full bg-white hover:bg-gray-100 text-black shadow-lg"
                >
                  <Camera className="h-8 w-8" />
                </Button>
                {capturedImages.length > 0 && (
                  <Button
                    onClick={handleDone}
                    size="lg"
                    className="h-14 px-6 bg-green-600 hover:bg-green-700 text-white shadow-lg rounded-full"
                  >
                    <Check className="h-5 w-5 mr-2" />
                    Done
                  </Button>
                )}
              </div>
              <div className="bg-black/60 text-white px-4 py-2 rounded-full text-sm">
                <span>
                  {capturedImages.length === 0 
                    ? 'Tap to capture BP readings (multiple pages supported)'
                    : 'Take more photos or tap Done when finished'}
                </span>
              </div>
            </div>
          )}
          
          <canvas ref={canvasRef} className="hidden" />
        </div>
      </DialogContent>
    </Dialog>
  );
}
