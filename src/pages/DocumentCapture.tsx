import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Camera,
  Check,
  Loader2,
  Upload,
  AlertTriangle,
  Trash2,
  GripVertical,
  SwitchCamera,
  X
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showToast } from '@/utils/toastWrapper';
import { compressLgImageFromDataUrl, DEFAULT_COMPRESSION_LEVEL } from '@/utils/lgImageCompressor';
import { generateULID } from '@/utils/ulid';

interface CapturedDoc {
  id: string;
  dataUrl: string;
  thumbnail: string;
  status: 'captured' | 'uploading' | 'uploaded' | 'error';
  errorMessage?: string;
}

interface SessionInfo {
  sessionId: string;
  patientLanguage: string;
  userId: string;
  isValid: boolean;
}

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

export default function DocumentCapture() {
  const { sessionToken } = useParams<{ sessionToken: string }>();
  const navigate = useNavigate();
  
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
  const [isValidating, setIsValidating] = useState(true);
  const [validationError, setValidationError] = useState<string | null>(null);
  
  const [documents, setDocuments] = useState<CapturedDoc[]>([]);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isCameraLoading, setIsCameraLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadComplete, setUploadComplete] = useState(false);
  
  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraIndex, setSelectedCameraIndex] = useState(0);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  // Validate session token on mount
  useEffect(() => {
    const validateToken = async () => {
      if (!sessionToken) {
        setValidationError('No session token provided');
        setIsValidating(false);
        return;
      }
      
      try {
        const { data, error } = await supabase.functions.invoke('validate-doc-capture-token', {
          body: { token: sessionToken }
        });
        
        if (error || !data?.valid) {
          setValidationError(data?.error || 'Invalid or expired session');
          setIsValidating(false);
          return;
        }
        
        setSessionInfo({
          sessionId: data.session_id,
          patientLanguage: data.patient_language,
          userId: data.user_id,
          isValid: true
        });
        setIsValidating(false);
      } catch (err: any) {
        console.error('Token validation error:', err);
        setValidationError('Unable to validate session');
        setIsValidating(false);
      }
    };
    
    validateToken();
  }, [sessionToken]);
  
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
  
  // Start camera
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
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      
      await enumerateCameras();
      setIsCapturing(true);
    } catch (err) {
      console.error('Camera error:', err);
      showToast.error('Unable to access camera. Please check permissions.');
    } finally {
      setIsCameraLoading(false);
    }
  }, [enumerateCameras]);
  
  // Stop camera
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCapturing(false);
  }, []);
  
  // Switch camera
  const switchCamera = useCallback(async () => {
    if (availableCameras.length < 2) return;
    
    stopCamera();
    const nextIndex = (selectedCameraIndex + 1) % availableCameras.length;
    setSelectedCameraIndex(nextIndex);
    await startCamera(availableCameras[nextIndex].deviceId);
  }, [availableCameras, selectedCameraIndex, stopCamera, startCamera]);
  
  // Capture photo
  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) return;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);
    
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    
    // Generate thumbnail
    const thumbCanvas = document.createElement('canvas');
    const thumbCtx = thumbCanvas.getContext('2d');
    const maxThumb = 150;
    let thumbW = video.videoWidth;
    let thumbH = video.videoHeight;
    
    if (thumbW > thumbH) {
      thumbH = (thumbH * maxThumb) / thumbW;
      thumbW = maxThumb;
    } else {
      thumbW = (thumbW * maxThumb) / thumbH;
      thumbH = maxThumb;
    }
    
    thumbCanvas.width = thumbW;
    thumbCanvas.height = thumbH;
    thumbCtx?.drawImage(video, 0, 0, thumbW, thumbH);
    const thumbnail = thumbCanvas.toDataURL('image/jpeg', 0.7);
    
    playClickSound();
    
    const newDoc: CapturedDoc = {
      id: generateULID(),
      dataUrl,
      thumbnail,
      status: 'captured'
    };
    
    setDocuments(prev => [...prev, newDoc]);
  }, []);
  
  // Remove document
  const removeDocument = useCallback((id: string) => {
    setDocuments(prev => prev.filter(doc => doc.id !== id));
  }, []);
  
  // Upload all documents
  const uploadAll = async () => {
    if (!sessionInfo || documents.length === 0) return;
    
    setIsUploading(true);
    setUploadProgress(0);
    
    let uploaded = 0;
    
    for (const doc of documents) {
      if (doc.status === 'uploaded') {
        uploaded++;
        continue;
      }
      
      // Update status to uploading
      setDocuments(prev => prev.map(d => 
        d.id === doc.id ? { ...d, status: 'uploading' as const } : d
      ));
      
      try {
        // Compress image before upload
        const compressedBlob = await compressLgImageFromDataUrl(doc.dataUrl, DEFAULT_COMPRESSION_LEVEL);
        
        // Convert blob to base64
        const reader = new FileReader();
        const base64Data = await new Promise<string>((resolve) => {
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(compressedBlob);
        });
        
        // Upload via edge function
        const { data, error } = await supabase.functions.invoke('upload-doc-capture', {
          body: {
            sessionToken,
            imageData: base64Data,
            fileName: `doc-${doc.id}.jpg`
          }
        });
        
        if (error) throw error;
        
        // Update status to uploaded
        setDocuments(prev => prev.map(d => 
          d.id === doc.id ? { ...d, status: 'uploaded' as const } : d
        ));
        
        uploaded++;
        setUploadProgress((uploaded / documents.length) * 100);
        
      } catch (err: any) {
        console.error('Upload error:', err);
        setDocuments(prev => prev.map(d => 
          d.id === doc.id ? { ...d, status: 'error' as const, errorMessage: err.message } : d
        ));
        uploaded++;
        setUploadProgress((uploaded / documents.length) * 100);
      }
    }
    
    setIsUploading(false);
    
    const successCount = documents.filter(d => d.status === 'uploaded').length;
    if (successCount === documents.length) {
      setUploadComplete(true);
      showToast.success(`${successCount} document(s) uploaded successfully`);
    } else {
      showToast.error('Some documents failed to upload');
    }
  };
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);
  
  // Loading state
  if (isValidating) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
          <p className="mt-4 text-muted-foreground">Validating session...</p>
        </div>
      </div>
    );
  }
  
  // Error state
  if (validationError || !sessionInfo) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-sm w-full">
          <CardContent className="pt-6 text-center">
            <AlertTriangle className="h-12 w-12 mx-auto text-destructive mb-4" />
            <h2 className="text-lg font-semibold mb-2">Session Invalid</h2>
            <p className="text-muted-foreground mb-4">
              {validationError || 'This session is no longer valid'}
            </p>
            <p className="text-sm text-muted-foreground">
              Please scan a new QR code from the translation service
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  // Upload complete state
  if (uploadComplete) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-sm w-full">
          <CardContent className="pt-6 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="text-lg font-semibold mb-2">Documents Uploaded</h2>
            <p className="text-muted-foreground mb-4">
              {documents.length} document(s) have been sent to the translation queue
            </p>
            <Button onClick={() => window.close()} className="w-full">
              Close Window
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-background flex flex-col" style={{ height: '100dvh' }}>
      {/* Header */}
      <div className="bg-primary text-primary-foreground px-4 py-3">
        <div className="flex items-center justify-between">
          <h1 className="font-semibold">Capture Documents</h1>
          <Badge variant="secondary" className="bg-primary-foreground/20">
            {documents.length} captured
          </Badge>
        </div>
      </div>
      
      {/* Camera view */}
      {isCapturing ? (
        <div className="flex-1 relative bg-black">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
          <canvas ref={canvasRef} className="hidden" />
          
          {/* Camera controls */}
          <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
            <div className="flex items-center justify-center gap-4">
              {availableCameras.length > 1 && (
                <Button
                  variant="outline"
                  size="icon"
                  onClick={switchCamera}
                  className="bg-white/20 border-white/30 hover:bg-white/30"
                >
                  <SwitchCamera className="h-5 w-5 text-white" />
                </Button>
              )}
              
              <Button
                size="lg"
                onClick={capturePhoto}
                className="w-16 h-16 rounded-full bg-white hover:bg-white/90"
              >
                <Camera className="h-8 w-8 text-black" />
              </Button>
              
              <Button
                variant="outline"
                size="icon"
                onClick={stopCamera}
                className="bg-white/20 border-white/30 hover:bg-white/30"
              >
                <X className="h-5 w-5 text-white" />
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col p-4 overflow-hidden">
          {/* Start camera button */}
          {documents.length === 0 && (
            <div className="flex-1 flex items-center justify-center">
              <Button
                size="lg"
                onClick={() => startCamera()}
                disabled={isCameraLoading}
                className="h-24 w-48 text-lg"
              >
                {isCameraLoading ? (
                  <Loader2 className="h-8 w-8 animate-spin" />
                ) : (
                  <>
                    <Camera className="h-8 w-8 mr-3" />
                    Start Camera
                  </>
                )}
              </Button>
            </div>
          )}
          
          {/* Captured documents grid */}
          {documents.length > 0 && (
            <div className="flex-1 overflow-auto">
              <div className="grid grid-cols-3 gap-2 mb-4">
                {documents.map((doc, index) => (
                  <div key={doc.id} className="relative aspect-[3/4]">
                    <img
                      src={doc.thumbnail}
                      alt={`Document ${index + 1}`}
                      className="w-full h-full object-cover rounded-lg border"
                    />
                    
                    {/* Status badge */}
                    <div className="absolute top-1 left-1">
                      {doc.status === 'uploaded' && (
                        <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                          <Check className="h-3 w-3 text-white" />
                        </div>
                      )}
                      {doc.status === 'uploading' && (
                        <div className="w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                          <Loader2 className="h-3 w-3 text-white animate-spin" />
                        </div>
                      )}
                      {doc.status === 'error' && (
                        <div className="w-5 h-5 bg-destructive rounded-full flex items-center justify-center">
                          <AlertTriangle className="h-3 w-3 text-white" />
                        </div>
                      )}
                    </div>
                    
                    {/* Remove button */}
                    {doc.status === 'captured' && (
                      <Button
                        variant="destructive"
                        size="icon"
                        className="absolute top-1 right-1 w-6 h-6"
                        onClick={() => removeDocument(doc.id)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                    
                    {/* Page number */}
                    <div className="absolute bottom-1 right-1 bg-black/60 text-white text-xs px-1.5 py-0.5 rounded">
                      {index + 1}
                    </div>
                  </div>
                ))}
                
                {/* Add more button */}
                <button
                  onClick={() => startCamera()}
                  disabled={isCameraLoading || isUploading}
                  className="aspect-[3/4] border-2 border-dashed border-muted-foreground/30 rounded-lg flex flex-col items-center justify-center text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                >
                  <Camera className="h-8 w-8 mb-1" />
                  <span className="text-xs">Add more</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* Upload progress */}
      {isUploading && (
        <div className="px-4 py-2 bg-muted">
          <Progress value={uploadProgress} className="h-2" />
          <p className="text-sm text-center text-muted-foreground mt-1">
            Uploading... {Math.round(uploadProgress)}%
          </p>
        </div>
      )}
      
      {/* Action buttons */}
      {documents.length > 0 && !isCapturing && !uploadComplete && (
        <div className="p-4 border-t bg-background">
          <Button
            size="lg"
            className="w-full"
            onClick={uploadAll}
            disabled={isUploading}
          >
            {isUploading ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="h-5 w-5 mr-2" />
                Upload {documents.filter(d => d.status !== 'uploaded').length} Document(s)
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
