import { useState, useRef, useCallback, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Camera, RotateCcw, Upload, SwitchCamera, AlertTriangle, Loader2, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

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

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = src;
  });

const dataUrlToOptimisedJpegBlob = async (
  dataUrl: string,
  opts: { maxDimension?: number; quality?: number } = {}
): Promise<Blob> => {
  const maxDimension = opts.maxDimension ?? 1600;
  const quality = opts.quality ?? 0.82;

  const img = await loadImage(dataUrl);
  const srcW = img.naturalWidth || img.width;
  const srcH = img.naturalHeight || img.height;

  // Defensive fallback
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

export default function AIChatCapture() {
  const { sessionToken, shortCode } = useParams<{ sessionToken?: string; shortCode?: string }>();
  const [isValidating, setIsValidating] = useState(true);
  const [isValid, setIsValid] = useState(false);
  const [validationError, setValidationError] = useState<string>('');
  const [cameraAutoStarted, setCameraAutoStarted] = useState(false);
  const [resolvedSessionId, setResolvedSessionId] = useState<string>('');
  
  const [isCapturing, setIsCapturing] = useState(false);
  const [isCameraLoading, setIsCameraLoading] = useState(false);
  const [glareWarning, setGlareWarning] = useState(false);
  const [capturedImages, setCapturedImages] = useState<CapturedImage[]>([]);
  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraIndex, setSelectedCameraIndex] = useState(0);
  const [isRotated, setIsRotated] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Validate session token or short code on mount
  useEffect(() => {
    if (!sessionToken && !shortCode) {
      setIsValidating(false);
      setValidationError('No session provided');
      return;
    }
    
    validateToken();
  }, [sessionToken, shortCode]);

  const validateToken = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('validate-ai-chat-capture-token', {
        body: shortCode ? { shortCode } : { token: sessionToken }
      });
      
      if (error || !data?.valid) {
        setValidationError(data?.error || 'Invalid or expired session');
        setIsValid(false);
      } else {
        setIsValid(true);
        setResolvedSessionId(data.session_id);
      }
    } catch (err) {
      console.error('Validation error:', err);
      setValidationError('Failed to validate session');
    } finally {
      setIsValidating(false);
    }
  };

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
    } catch (err) {
      console.error('Camera error:', err);
      setIsCameraLoading(false);
      toast.error('Failed to access camera. Please use file upload instead.');
    }
  }, [enumerateCameras]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCapturing(false);
  }, []);

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
    const id = crypto.randomUUID();

    playClickSound();
    setCapturedImages(prev => [...prev, { id, dataUrl, uploading: false, uploaded: false }]);
  }, [isRotated]);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        const id = crypto.randomUUID();
        setCapturedImages(prev => [...prev, { id, dataUrl, uploading: false, uploaded: false }]);
      };
      reader.readAsDataURL(file);
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const removeImage = (id: string) => {
    setCapturedImages(prev => prev.filter(img => img.id !== id));
  };

  const uploadImage = async (image: CapturedImage) => {
    if (image.uploading || image.uploaded) return;
    
    setCapturedImages(prev => prev.map(img => 
      img.id === image.id ? { ...img, uploading: true } : img
    ));
    
    try {
      // iOS Safari can fail with large images; compress before upload.
      const blob = await dataUrlToOptimisedJpegBlob(image.dataUrl, {
        maxDimension: 1600,
        quality: 0.82,
      });
      
      const formData = new FormData();
      // Use shortCode if available, otherwise token
      if (shortCode) {
        formData.append('shortCode', shortCode);
      } else {
        formData.append('token', sessionToken!);
      }
      formData.append('file', blob, `photo-${Date.now()}.jpg`);

      // supabase.functions.invoke DOES support FormData and will attach apikey/auth headers.
      const { data, error } = await supabase.functions.invoke('upload-ai-chat-capture', {
        body: formData,
      });

      if (error || !data?.success) {
        const message = (data && typeof data === 'object' && 'error' in data)
          ? (data as any).error
          : undefined;
        throw new Error(message || error?.message || 'Upload failed');
      }
      
      setCapturedImages(prev => prev.map(img => 
        img.id === image.id ? { ...img, uploading: false, uploaded: true } : img
      ));
      toast.success('Photo uploaded');
    } catch (err) {
      console.error('Upload error:', err);
      const message = err instanceof Error ? err.message : 'Upload failed';
      setCapturedImages(prev => prev.map(img => 
        img.id === image.id ? { ...img, uploading: false, error: message } : img
      ));
      toast.error(message);
    }
  };

  const uploadAllImages = async () => {
    const pendingImages = capturedImages.filter(img => !img.uploaded && !img.uploading);
    for (const img of pendingImages) {
      await uploadImage(img);
    }
  };

  // Cleanup camera on unmount
  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  // Auto-start camera once session is validated
  useEffect(() => {
    if (isValid && !cameraAutoStarted && !isCapturing && !isCameraLoading) {
      setCameraAutoStarted(true);
      startCamera();
    }
  }, [isValid, cameraAutoStarted, isCapturing, isCameraLoading, startCamera]);

  // Show loading state
  if (isValidating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-muted-foreground">Validating session...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show error state
  if (!isValid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-center text-destructive">Session Invalid</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <X className="h-16 w-16 mx-auto mb-4 text-destructive" />
            <p className="text-muted-foreground">{validationError}</p>
            <p className="text-sm text-muted-foreground mt-2">
              Please scan a new QR code or request a new link.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const pendingCount = capturedImages.filter(img => !img.uploaded).length;
  const uploadedCount = capturedImages.filter(img => img.uploaded).length;

  return (
    <div className="min-h-[100dvh] bg-background p-4 pb-[calc(env(safe-area-inset-bottom)+4rem)]">
      <div className="max-w-lg mx-auto space-y-4 pb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Camera className="h-5 w-5" />
              Capture Photos
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Take or upload photos to send to your chat session
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Camera View */}
            {(isCapturing || isCameraLoading) ? (
              <div
                className="relative aspect-[3/4] bg-black rounded-lg overflow-hidden cursor-pointer active:opacity-90"
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
                    <span className="text-sm font-medium">Glare detected</span>
                  </div>
                )}
                
                {/* Camera controls */}
                {isCapturing && (
                  <>
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
                      {availableCameras.length > 1 && (
                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleCamera();
                          }}
                          variant="outline"
                          size="sm"
                          className="bg-black/50 border-white/30 text-white hover:bg-black/70"
                        >
                          <SwitchCamera className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    
                    {/* Upload from gallery button */}
                    <div className="absolute top-2 left-2">
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          fileInputRef.current?.click();
                        }}
                        variant="outline"
                        size="sm"
                        className="bg-black/50 border-white/30 text-white hover:bg-black/70"
                      >
                        <Upload className="h-4 w-4 mr-1.5" />
                        Upload
                      </Button>
                    </div>
                  </>
                )}
                
                {/* Tap to capture hint */}
                {isCapturing && (
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/50 text-white px-3 py-1.5 rounded-full text-sm">
                    Tap to capture
                  </div>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <Button
                  onClick={() => startCamera()}
                  className="h-20 flex flex-col items-center justify-center gap-2"
                  size="lg"
                >
                  <Camera className="h-8 w-8" />
                  <span>Use Camera</span>
                </Button>
                
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="h-20 flex flex-col items-center justify-center gap-2"
                  size="lg"
                >
                  <Upload className="h-8 w-8" />
                  <span>Upload Files</span>
                </Button>
              </div>
            )}
            
            <canvas ref={canvasRef} className="hidden" />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileUpload}
              className="hidden"
            />
          </CardContent>
        </Card>

        {/* Captured Images */}
        {capturedImages.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">
                Captured Photos ({uploadedCount}/{capturedImages.length} uploaded)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-2">
                {capturedImages.map((img) => (
                  <div key={img.id} className="relative aspect-square">
                    <img
                      src={img.dataUrl}
                      alt="Captured"
                      className={`w-full h-full object-cover rounded-lg ${img.uploaded ? 'opacity-50' : ''}`}
                    />
                    
                    {img.uploaded && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Check className="h-8 w-8 text-green-600" />
                      </div>
                    )}
                    
                    {img.uploading && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-lg">
                        <Loader2 className="h-6 w-6 animate-spin text-white" />
                      </div>
                    )}

                    {!!img.error && !img.uploading && !img.uploaded && (
                      <div className="absolute inset-0 flex items-center justify-center bg-background/90 rounded-lg p-2">
                        <p className="text-xs text-destructive text-center leading-snug">
                          {img.error}
                        </p>
                      </div>
                    )}
                    
                    {!img.uploaded && !img.uploading && (
                      <Button
                        onClick={() => removeImage(img.id)}
                        variant="destructive"
                        size="icon"
                        className="absolute top-1 right-1 h-6 w-6 rounded-full"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
              
              {pendingCount > 0 && (
                <div className="hidden sm:block">
                  <Button
                    onClick={uploadAllImages}
                    className="w-full"
                    size="lg"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Upload {pendingCount} Photo{pendingCount > 1 ? 's' : ''}
                  </Button>
                </div>
              )}
              
              {uploadedCount > 0 && pendingCount === 0 && (
                <div className="text-center text-green-600 font-medium">
                  <Check className="h-5 w-5 inline mr-2" />
                  All photos uploaded successfully!
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* iPhone/Safari: keep upload CTA above the browser UI */}
        {pendingCount > 0 && (
          <div className="sm:hidden sticky bottom-0 -mx-4 px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+1rem)] bg-background/95 backdrop-blur border-t border-border">
            <Button onClick={uploadAllImages} className="w-full" size="lg">
              <Upload className="h-4 w-4 mr-2" />
              Upload {pendingCount} Photo{pendingCount > 1 ? 's' : ''}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
