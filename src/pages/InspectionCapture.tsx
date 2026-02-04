import { useState, useRef, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Camera, RotateCw, Upload, Check, AlertCircle, Loader2, ImagePlus, SwitchCamera } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showToast } from '@/utils/toastWrapper';

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

// Play success chime
const playSuccessChime = () => {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // Pleasant ascending chime
    const notes = [523, 659, 784]; // C5, E5, G5
    notes.forEach((freq, i) => {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = freq;
      oscillator.type = 'sine';
      
      const startTime = audioContext.currentTime + (i * 0.1);
      gainNode.gain.setValueAtTime(0.2, startTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + 0.15);
      
      oscillator.start(startTime);
      oscillator.stop(startTime + 0.15);
    });
  } catch (e) {
    // Silently fail
  }
};

// Helper to load image
const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

// Optimise image for upload
const dataUrlToOptimisedJpegBlob = async (
  dataUrl: string,
  opts: { maxDimension?: number; quality?: number } = {}
): Promise<Blob> => {
  const maxDimension = opts.maxDimension ?? 1600;
  const quality = opts.quality ?? 0.82;

  const img = await loadImage(dataUrl);
  const srcW = img.naturalWidth || img.width;
  const srcH = img.naturalHeight || img.height;

  if (!srcW || !srcH) {
    const res = await fetch(dataUrl);
    return await res.blob();
  }

  const scale = Math.min(1, maxDimension / Math.max(srcW, srcH));
  const outW = Math.max(1, Math.round(srcW * scale));
  const outH = Math.max(1, Math.round(srcH * scale));

  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    const res = await fetch(dataUrl);
    return await res.blob();
  }

  ctx.drawImage(img, 0, 0, outW, outH);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Failed to encode image'))),
      'image/jpeg',
      quality
    );
  });

  return blob;
};

interface CapturedImage {
  id: string;
  dataUrl: string;
  uploading: boolean;
  uploaded: boolean;
  error?: string;
}

export default function InspectionCapture() {
  const { shortCode } = useParams<{ shortCode: string }>();
  const [isValidating, setIsValidating] = useState(true);
  const [isValid, setIsValid] = useState(false);
  const [validationError, setValidationError] = useState<string>('');
  const [elementInfo, setElementInfo] = useState<{ key: string; name: string } | null>(null);
  const [sessionId, setSessionId] = useState<string>('');
  
  const [isCapturing, setIsCapturing] = useState(false);
  const [isCameraLoading, setIsCameraLoading] = useState(false);
  const [capturedImages, setCapturedImages] = useState<CapturedImage[]>([]);
  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraIndex, setSelectedCameraIndex] = useState(0);
  const [uploadCount, setUploadCount] = useState(0);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Validate session on mount
  useEffect(() => {
    if (!shortCode) {
      setIsValidating(false);
      setValidationError('No session provided');
      return;
    }
    
    validateSession();
  }, [shortCode]);

  const validateSession = async () => {
    try {
      const { data, error } = await supabase
        .from('mock_inspection_capture_sessions')
        .select('id, expires_at, is_active, element_id')
        .eq('short_code', shortCode)
        .single();

      if (error || !data) {
        setValidationError('Session not found');
        setIsValidating(false);
        return;
      }

      const now = new Date();
      const expiresAt = new Date(data.expires_at);

      if (!data.is_active || expiresAt < now) {
        setValidationError('Session has expired');
        setIsValidating(false);
        return;
      }

      setSessionId(data.id);
      
      // Get element info
      const { data: elementData } = await supabase
        .from('mock_inspection_elements')
        .select('element_key, element_name')
        .eq('id', data.element_id)
        .single();
      
      if (elementData) {
        setElementInfo({ key: elementData.element_key, name: elementData.element_name });
      }

      // Notify desktop that phone connected
      const channel = supabase.channel(`inspection-connection-${data.id}`);
      await channel.subscribe();
      await channel.send({
        type: 'broadcast',
        event: 'phone_connected',
        payload: {}
      });
      supabase.removeChannel(channel);

      setIsValid(true);
      setIsValidating(false);
      
      // Auto-start camera
      startCamera();
    } catch (err) {
      console.error('Validation error:', err);
      setValidationError('Failed to validate session');
      setIsValidating(false);
    }
  };

  const startCamera = async () => {
    setIsCameraLoading(true);
    try {
      // Get available cameras
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cameras = devices.filter(d => d.kind === 'videoinput');
      setAvailableCameras(cameras);

      // Prefer back camera
      const backCamera = cameras.find(c => 
        c.label.toLowerCase().includes('back') || 
        c.label.toLowerCase().includes('rear')
      );
      const cameraIndex = backCamera ? cameras.indexOf(backCamera) : 0;
      setSelectedCameraIndex(cameraIndex);

      const constraints: MediaStreamConstraints = {
        video: {
          deviceId: cameras[cameraIndex]?.deviceId ? { exact: cameras[cameraIndex].deviceId } : undefined,
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setIsCapturing(true);
    } catch (err) {
      console.error('Camera error:', err);
      showToast.error('Could not access camera');
    } finally {
      setIsCameraLoading(false);
    }
  };

  const switchCamera = async () => {
    if (availableCameras.length <= 1) return;

    const nextIndex = (selectedCameraIndex + 1) % availableCameras.length;
    setSelectedCameraIndex(nextIndex);

    // Stop current stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          deviceId: { exact: availableCameras[nextIndex].deviceId },
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch (err) {
      console.error('Switch camera error:', err);
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    playClickSound();

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    const newImage: CapturedImage = {
      id: crypto.randomUUID(),
      dataUrl,
      uploading: false,
      uploaded: false
    };

    setCapturedImages(prev => [...prev, newImage]);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        const newImage: CapturedImage = {
          id: crypto.randomUUID(),
          dataUrl,
          uploading: false,
          uploaded: false
        };
        setCapturedImages(prev => [...prev, newImage]);
      };
      reader.readAsDataURL(file);
    });

    event.target.value = '';
  };

  const uploadImages = async () => {
    const imagesToUpload = capturedImages.filter(img => !img.uploaded && !img.uploading);
    if (imagesToUpload.length === 0) return;

    for (const image of imagesToUpload) {
      setCapturedImages(prev =>
        prev.map(img => img.id === image.id ? { ...img, uploading: true } : img)
      );

      try {
        const blob = await dataUrlToOptimisedJpegBlob(image.dataUrl);
        const reader = new FileReader();
        
        const base64 = await new Promise<string>((resolve) => {
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });

        const { data, error } = await supabase.functions.invoke('upload-inspection-capture', {
          body: {
            sessionId,
            imageData: base64,
            fileName: `inspection-${Date.now()}.jpg`
          }
        });

        if (error || !data?.success) {
          throw new Error(data?.error || 'Upload failed');
        }

        playSuccessChime();
        setUploadCount(prev => prev + 1);

        setCapturedImages(prev =>
          prev.map(img => img.id === image.id ? { ...img, uploading: false, uploaded: true } : img)
        );

        showToast.success('Photo uploaded!');
      } catch (err) {
        console.error('Upload error:', err);
        setCapturedImages(prev =>
          prev.map(img => img.id === image.id ? { ...img, uploading: false, error: 'Upload failed' } : img)
        );
        showToast.error('Failed to upload photo');
      }
    }
  };

  const removeImage = (id: string) => {
    setCapturedImages(prev => prev.filter(img => img.id !== id));
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  if (isValidating) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <Card className="p-6 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-3" />
          <p>Validating session...</p>
        </Card>
      </div>
    );
  }

  if (!isValid) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <Card className="p-6 text-center max-w-sm">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-3" />
          <h2 className="text-lg font-semibold mb-2">Session Invalid</h2>
          <p className="text-muted-foreground">{validationError}</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="bg-primary text-primary-foreground p-4 text-center">
        <h1 className="text-lg font-semibold">CQC Inspection Evidence</h1>
        {elementInfo && (
          <p className="text-sm opacity-90 mt-1">
            {elementInfo.key}: {elementInfo.name}
          </p>
        )}
        {uploadCount > 0 && (
          <p className="text-sm text-green-300 mt-1">
            ✓ {uploadCount} photo{uploadCount !== 1 ? 's' : ''} uploaded
          </p>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 p-4 overflow-auto">
        <Card className="overflow-hidden">
          <div className="p-4 space-y-4">
            {/* Camera Preview - Smaller with border like LG Capture */}
            <div
              className="relative aspect-[3/4] bg-black rounded-lg overflow-hidden border-4 border-primary cursor-pointer active:opacity-90"
              onClick={isCapturing ? capturePhoto : undefined}
            >
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                // @ts-ignore - webkit attribute for iOS
                webkit-playsinline="true"
                className={`absolute inset-0 w-full h-full object-cover pointer-events-none transition-all ${
                  isCapturing ? 'opacity-100' : 'opacity-0'
                }`}
              />
              <canvas ref={canvasRef} className="hidden" />

              {isCameraLoading && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center text-white">
                    <Loader2 className="h-12 w-12 animate-spin mx-auto mb-3" />
                    <p>Starting camera...</p>
                  </div>
                </div>
              )}

              {/* Camera controls overlay */}
              {isCapturing && availableCameras.length > 1 && (
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    switchCamera();
                  }}
                  variant="outline"
                  size="icon"
                  className="absolute top-2 right-2 bg-background/80 hover:bg-background"
                >
                  <SwitchCamera className="h-4 w-4" />
                </Button>
              )}

              {/* Tap to capture hint */}
              {isCapturing && (
                <div className="absolute bottom-4 left-0 right-0 text-center">
                  <span className="bg-black/60 text-white px-3 py-1 rounded-full text-sm">
                    Tap to capture
                  </span>
                </div>
              )}
            </div>

            {/* Capture Button */}
            <Button
              onClick={capturePhoto}
              disabled={!isCapturing}
              className="w-full h-14 text-lg"
              size="lg"
            >
              <Camera className="mr-2 h-6 w-6" />
              Capture Photo
            </Button>

            {/* Captured Images */}
            {capturedImages.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">
                  Captured ({capturedImages.length})
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {capturedImages.map((img) => (
                    <div key={img.id} className="relative">
                      <img
                        src={img.dataUrl}
                        alt="Captured"
                        className="w-full aspect-square object-cover rounded-lg border"
                      />
                      {img.uploading && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-lg">
                          <Loader2 className="h-4 w-4 animate-spin text-white" />
                        </div>
                      )}
                      {img.uploaded && (
                        <div className="absolute inset-0 bg-green-500/50 flex items-center justify-center rounded-lg">
                          <Check className="h-5 w-5 text-white" />
                        </div>
                      )}
                      {!img.uploaded && !img.uploading && (
                        <button
                          onClick={() => removeImage(img.id)}
                          className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full w-5 h-5 text-xs flex items-center justify-center"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Gallery upload option */}
            <div className="pt-2 border-t">
              <label className="cursor-pointer">
                <Button variant="outline" className="w-full" asChild>
                  <span>
                    <ImagePlus className="mr-2 h-4 w-4" />
                    Choose from Gallery
                  </span>
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </label>
            </div>
          </div>
        </Card>
      </div>

      {/* Sticky Upload Button */}
      {capturedImages.filter(img => !img.uploaded).length > 0 && (
        <div className="sticky bottom-0 p-4 bg-background border-t" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
          <Button
            onClick={uploadImages}
            disabled={capturedImages.filter(img => !img.uploaded && !img.uploading).length === 0}
            className="w-full h-14 text-lg bg-green-600 hover:bg-green-700"
            size="lg"
          >
            <Upload className="mr-2 h-6 w-6" />
            Upload {capturedImages.filter(img => !img.uploaded && !img.uploading).length} Photo{capturedImages.filter(img => !img.uploaded && !img.uploading).length !== 1 ? 's' : ''}
          </Button>
        </div>
      )}
    </div>
  );
}
