import { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Camera, RotateCcw, Trash2, GripVertical, Upload, X, AlertTriangle, FastForward, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { CapturedImage } from '@/hooks/useLGCapture';
import { generateULID } from '@/utils/ulid';

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

interface LGCameraCaptureProps {
  images: CapturedImage[];
  onImagesChange: (images: CapturedImage[]) => void;
  onFinish: () => void;
  maxPages?: number;
  isProcessing?: boolean;
}

export function LGCameraCapture({ 
  images, 
  onImagesChange, 
  onFinish,
  maxPages = 300,
  isProcessing = false
}: LGCameraCaptureProps) {
  const [isCapturing, setIsCapturing] = useState(false);
  const [isCameraLoading, setIsCameraLoading] = useState(false);
  const [glareWarning, setGlareWarning] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Callback ref to connect stream when video element mounts
  const setVideoRef = useCallback((el: HTMLVideoElement | null) => {
    videoRef.current = el;
    if (el && streamRef.current && isCameraLoading && !isCapturing) {
      el.srcObject = streamRef.current;
      el.onloadedmetadata = () => {
        el.play()
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
  }, [isCameraLoading, isCapturing]);

  const startCamera = useCallback(async () => {
    setIsCameraLoading(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });
      
      streamRef.current = stream;
      
      // If video element already exists, connect immediately
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
      
      // Fallback timeout
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
      toast.error('Failed to access camera. Please use file upload instead.');
    }
  }, []);

  // Auto-start camera on mount
  useEffect(() => {
    startCamera();
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [startCamera]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCapturing(false);
  }, []);

  const captureImage = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);

    // Simple glare detection (check for overexposed areas)
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

    if (images.length >= maxPages) {
      toast.error(`Maximum ${maxPages} pages allowed`);
      return;
    }

    playClickSound();
    onImagesChange([...images, newImage]);
    toast.success(`Page ${images.length + 1} captured`);
  }, [images, onImagesChange, maxPages]);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const remainingSlots = maxPages - images.length;
    const filesToProcess = Array.from(files).slice(0, remainingSlots);

    filesToProcess.forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        const newImage: CapturedImage = {
          id: generateULID(),
          dataUrl,
          timestamp: Date.now(),
        };
        onImagesChange([...images, newImage]);
      };
      reader.readAsDataURL(file);
    });

    if (files.length > remainingSlots) {
      toast.warning(`Only ${remainingSlots} more pages allowed. Some files were skipped.`);
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [images.length, maxPages, onImagesChange]);

  const rotateImage = useCallback((index: number) => {
    const image = images[index];
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      canvas.width = img.height;
      canvas.height = img.width;
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate(Math.PI / 2);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);

      const newDataUrl = canvas.toDataURL('image/jpeg', 0.9);
      const newImages = [...images];
      newImages[index] = { ...image, dataUrl: newDataUrl };
      onImagesChange(newImages);
    };
    img.src = image.dataUrl;
  }, [images, onImagesChange]);

  const deleteImage = useCallback((index: number) => {
    const newImages = images.filter((_, i) => i !== index);
    onImagesChange(newImages);
    toast.success('Page removed');
  }, [images, onImagesChange]);

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newImages = [...images];
    const [draggedItem] = newImages.splice(draggedIndex, 1);
    newImages.splice(index, 0, draggedItem);
    onImagesChange(newImages);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  return (
    <div className="space-y-4">
      {/* Camera View - shows loading, then camera, or buttons */}
      {(isCapturing || isCameraLoading) ? (
        <Card>
          <CardContent className="p-4 space-y-4">
            <div 
              className="relative aspect-[3/4] bg-black rounded-lg overflow-hidden cursor-pointer active:opacity-90"
              onClick={isCapturing ? captureImage : undefined}
            >
              <video
                ref={setVideoRef}
                autoPlay
                playsInline
                muted
                webkit-playsinline="true"
                className={`absolute inset-0 w-full h-full object-cover pointer-events-none transition-opacity ${
                  isCapturing ? 'opacity-100' : 'opacity-0'
                }`}
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
              {/* Tap to capture hint */}
              {isCapturing && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/50 text-white px-3 py-1.5 rounded-full text-sm">
                  Tap to capture
                </div>
              )}
            </div>
            
            {isCapturing && (
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  onClick={stopCamera}
                  size="lg"
                >
                  <X className="h-5 w-5 mr-2" />
                  Close Camera
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <Button
            onClick={startCamera}
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
          
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileUpload}
            className="hidden"
          />
        </div>
      )}

      <canvas ref={canvasRef} className="hidden" />

      {/* Page Count */}
      <div className="text-center py-2 bg-muted/50 rounded-lg">
        <span className="text-2xl font-bold text-primary">{images.length}</span>
        <span className="text-muted-foreground ml-2">pages captured</span>
      </div>

      {/* Finish Button - above images for better mobile layout */}
      {images.length > 0 && (
        <Button
          onClick={onFinish}
          disabled={isProcessing}
          className="w-full h-14 text-lg bg-green-600 hover:bg-green-700"
          size="lg"
        >
          <FastForward className="mr-2 h-5 w-5" />
          Done, Next Patient ({images.length} pages)
        </Button>
      )}

      {/* Image Grid */}
      {images.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Drag to reorder pages. Page 1 will be first in the PDF.
          </p>
          
          <div className="grid grid-cols-3 gap-3">
            {images.map((image, index) => (
              <div
                key={image.id}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragEnd={handleDragEnd}
                className={`relative aspect-[3/4] bg-muted rounded-lg overflow-hidden cursor-move border-2 ${
                  draggedIndex === index ? 'border-primary opacity-50' : 'border-transparent'
                }`}
              >
                <img
                  src={image.dataUrl}
                  alt={`Page ${index + 1}`}
                  className="absolute inset-0 w-full h-full object-cover"
                />
                
                {/* Page number badge */}
                <div className="absolute top-1 left-1 bg-primary text-primary-foreground text-xs font-bold px-2 py-1 rounded">
                  {index + 1}
                </div>
                
                {/* Drag handle */}
                <div className="absolute top-1 right-1 bg-black/50 text-white p-1 rounded">
                  <GripVertical className="h-3 w-3" />
                </div>
                
                {/* Action buttons */}
                <div className="absolute bottom-1 right-1 flex gap-1">
                  <button
                    onClick={() => rotateImage(index)}
                    className="bg-black/50 text-white p-1.5 rounded hover:bg-black/70"
                    title="Rotate 90°"
                  >
                    <RotateCcw className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => deleteImage(index)}
                    className="bg-destructive/80 text-white p-1.5 rounded hover:bg-destructive"
                    title="Delete"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
