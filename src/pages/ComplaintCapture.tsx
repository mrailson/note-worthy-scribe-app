import { useState, useRef, useCallback, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Camera, Upload, Loader2, CheckCircle, AlertCircle, Image, RotateCcw, X } from 'lucide-react';
import { showToast } from '@/utils/toastWrapper';
import { supabase } from '@/integrations/supabase/client';

export default function ComplaintCapture() {
  const { shortCode } = useParams<{ shortCode: string }>();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const [isValidating, setIsValidating] = useState(true);
  const [isValid, setIsValid] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadCount, setUploadCount] = useState(0);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  
  // Validate session on mount
  useEffect(() => {
    const validateSession = async () => {
      if (!shortCode) {
        setIsValid(false);
        setIsValidating(false);
        return;
      }
      
      try {
        const { data, error } = await supabase
          .from('complaint_capture_sessions')
          .select('id, expires_at, is_active')
          .eq('short_code', shortCode)
          .single();
        
        if (error || !data) {
          setIsValid(false);
          setIsValidating(false);
          return;
        }
        
        // Check if session is active and not expired
        const now = new Date();
        const expiresAt = new Date(data.expires_at);
        
        if (!data.is_active || expiresAt < now) {
          setIsValid(false);
          setIsValidating(false);
          return;
        }
        
        setSessionId(data.id);
        setIsValid(true);
      } catch (error) {
        console.error('Validation error:', error);
        setIsValid(false);
      } finally {
        setIsValidating(false);
      }
    };
    
    validateSession();
  }, [shortCode]);
  
  // Cleanup camera on unmount
  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [cameraStream]);
  
  // Start camera
  const startCamera = async () => {
    try {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 1920 }, height: { ideal: 1080 } }
      });
      
      setCameraStream(stream);
      setCameraActive(true);
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (error) {
      console.error('Camera error:', error);
      showToast.error('Could not access camera');
    }
  };
  
  // Stop camera
  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setCameraActive(false);
    setCapturedImage(null);
  };
  
  // Switch camera
  const switchCamera = async () => {
    const newMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(newMode);
    
    if (cameraActive) {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }
      
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: newMode, width: { ideal: 1920 }, height: { ideal: 1080 } }
        });
        
        setCameraStream(stream);
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
      } catch (error) {
        console.error('Camera switch error:', error);
      }
    }
  };
  
  // Capture photo from camera
  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
      setCapturedImage(dataUrl);
    }
  };
  
  // Retake photo
  const retakePhoto = () => {
    setCapturedImage(null);
  };
  
  // Compress image for upload
  const compressImage = async (dataUrl: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = document.createElement('img');
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 1600;
        
        let width = img.width;
        let height = img.height;
        
        if (width > maxDim || height > maxDim) {
          const scale = maxDim / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, width, height);
        }
        
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.src = dataUrl;
    });
  };
  
  // Upload image
  const uploadImage = async (dataUrl: string, fileName: string) => {
    if (!sessionId) return;
    
    setIsUploading(true);
    
    try {
      // Compress image
      const compressedDataUrl = await compressImage(dataUrl);
      
      // Call edge function to handle upload
      const { data, error } = await supabase.functions.invoke('upload-complaint-capture', {
        body: {
          sessionId,
          imageData: compressedDataUrl,
          fileName
        }
      });
      
      if (error) throw error;
      
      if (data?.success) {
        setUploadCount(prev => prev + 1);
        setCapturedImage(null);
        showToast.success('Photo uploaded successfully');
      } else {
        throw new Error(data?.error || 'Upload failed');
      }
    } catch (error) {
      console.error('Upload error:', error);
      showToast.error('Failed to upload photo');
    } finally {
      setIsUploading(false);
    }
  };
  
  // Handle camera capture upload
  const handleCameraUpload = () => {
    if (capturedImage) {
      uploadImage(capturedImage, `complaint-capture-${Date.now()}.jpg`);
    }
  };
  
  // Handle file selection
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !sessionId) return;
    
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) {
        showToast.error('Only images are supported');
        continue;
      }
      
      try {
        const reader = new FileReader();
        reader.onload = async (event) => {
          const dataUrl = event.target?.result as string;
          if (dataUrl) {
            await uploadImage(dataUrl, file.name);
          }
        };
        reader.readAsDataURL(file);
      } catch (error) {
        console.error('File read error:', error);
        showToast.error('Failed to read file');
      }
    }
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };
  
  // Loading state
  if (isValidating) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="py-12 text-center">
            <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
            <p className="mt-4 text-muted-foreground">Validating session...</p>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  // Invalid session
  if (!isValid) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="py-12 text-center">
            <AlertCircle className="h-12 w-12 mx-auto text-destructive" />
            <h2 className="mt-4 text-lg font-semibold">Session Invalid or Expired</h2>
            <p className="mt-2 text-muted-foreground">
              This capture link is no longer valid. Please scan a new QR code from the Complaints system.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-background">
      {/* Hidden canvas for capture */}
      <canvas ref={canvasRef} className="hidden" />
      
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileSelect}
        className="hidden"
      />
      
      {/* Camera View */}
      {cameraActive && (
        <div className="fixed inset-0 bg-black z-50 flex flex-col">
          {/* Camera preview or captured image */}
          <div className="flex-1 relative">
            {capturedImage ? (
              <img 
                src={capturedImage} 
                alt="Captured" 
                className="w-full h-full object-contain"
              />
            ) : (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
            )}
            
            {/* Close button */}
            <button
              onClick={stopCamera}
              className="absolute top-4 right-4 bg-black/50 rounded-full p-2"
            >
              <X className="h-6 w-6 text-white" />
            </button>
            
            {/* Switch camera button */}
            {!capturedImage && (
              <button
                onClick={switchCamera}
                className="absolute top-4 left-4 bg-black/50 rounded-full p-2"
              >
                <RotateCcw className="h-6 w-6 text-white" />
              </button>
            )}
          </div>
          
          {/* Camera controls */}
          <div className="bg-black p-6 pb-safe flex items-center justify-center gap-6">
            {capturedImage ? (
              <>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={retakePhoto}
                  className="border-white text-white hover:bg-white/20"
                >
                  Retake
                </Button>
                <Button
                  size="lg"
                  onClick={handleCameraUpload}
                  disabled={isUploading}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-5 w-5 mr-2" />
                      Upload
                    </>
                  )}
                </Button>
              </>
            ) : (
              <button
                onClick={capturePhoto}
                className="w-16 h-16 bg-white rounded-full border-4 border-gray-300 flex items-center justify-center"
              >
                <div className="w-12 h-12 bg-white rounded-full border-2 border-gray-400" />
              </button>
            )}
          </div>
        </div>
      )}
      
      {/* Main UI */}
      <div className="p-4 pb-safe max-w-md mx-auto">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="flex items-center justify-center gap-2">
              <Camera className="h-6 w-6" />
              Capture Complaint Documents
            </CardTitle>
          </CardHeader>
          
          <CardContent className="space-y-6">
            {/* Upload count */}
            {uploadCount > 0 && (
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 text-center">
                <CheckCircle className="h-8 w-8 mx-auto text-green-600" />
                <p className="mt-2 font-medium text-green-700 dark:text-green-400">
                  {uploadCount} photo(s) uploaded
                </p>
                <p className="text-sm text-green-600 dark:text-green-500">
                  Synced to desktop automatically
                </p>
              </div>
            )}
            
            {/* Camera button */}
            <Button
              className="w-full h-24 text-lg"
              onClick={startCamera}
              disabled={isUploading}
            >
              <Camera className="h-8 w-8 mr-3" />
              Take Photo
            </Button>
            
            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">or</span>
              </div>
            </div>
            
            {/* Gallery button */}
            <Button
              variant="outline"
              className="w-full h-16"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
            >
              <Image className="h-6 w-6 mr-2" />
              Choose from Gallery
            </Button>
            
            {/* Instructions */}
            <div className="text-center text-sm text-muted-foreground space-y-1">
              <p>Take clear photos of complaint letters or documents</p>
              <p>Photos will sync to the desktop automatically</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
