import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, ChevronRight, Maximize, Minimize, Video, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import * as pdfjsLib from 'pdfjs-dist';
import { SEO } from '@/components/SEO';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

type ViewMode = 'video' | 'slides' | 'split';

export default function NRESPresentationPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('split');
  const [currentSlide, setCurrentSlide] = useState(1);
  const [totalSlides, setTotalSlides] = useState(0);
  const [isVideoFullscreen, setIsVideoFullscreen] = useState(false);
  const [isSlidesFullscreen, setIsSlidesFullscreen] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const slidesContainerRef = useRef<HTMLDivElement>(null);
  const pdfDocRef = useRef<any>(null);

  // Load PDF
  useEffect(() => {
    const loadPdf = async () => {
      try {
        const loadingTask = pdfjsLib.getDocument('/Rural_Collaboration_Governance_Framework.pdf');
        const pdf = await loadingTask.promise;
        pdfDocRef.current = pdf;
        setTotalSlides(pdf.numPages);
        renderSlide(1);
      } catch (error) {
        console.error('Error loading PDF:', error);
      }
    };

    loadPdf();
  }, []);

  const renderSlide = async (pageNum: number) => {
    if (!pdfDocRef.current || !canvasRef.current) return;

    try {
      const page = await pdfDocRef.current.getPage(pageNum);
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      
      // Calculate scale to fit container
      const container = canvas.parentElement;
      if (!container) return;
      
      const containerWidth = container.clientWidth;
      const viewport = page.getViewport({ scale: 1 });
      const scale = (containerWidth * 0.95) / viewport.width;
      const scaledViewport = page.getViewport({ scale });

      canvas.height = scaledViewport.height;
      canvas.width = scaledViewport.width;

      const renderContext = {
        canvasContext: context!,
        viewport: scaledViewport,
      };

      await page.render(renderContext).promise;
    } catch (error) {
      console.error('Error rendering slide:', error);
    }
  };

  // Re-render slide when view mode or slide number changes
  useEffect(() => {
    if (viewMode !== 'video') {
      renderSlide(currentSlide);
    }
  }, [currentSlide, viewMode]);

  const nextSlide = () => {
    if (currentSlide < totalSlides) {
      setCurrentSlide(currentSlide + 1);
    }
  };

  const previousSlide = () => {
    if (currentSlide > 1) {
      setCurrentSlide(currentSlide - 1);
    }
  };

  const toggleVideoFullscreen = () => {
    if (!videoContainerRef.current) return;

    if (!isVideoFullscreen) {
      if (videoContainerRef.current.requestFullscreen) {
        videoContainerRef.current.requestFullscreen();
      }
      setIsVideoFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
      setIsVideoFullscreen(false);
    }
  };

  const toggleSlidesFullscreen = () => {
    if (!slidesContainerRef.current) return;

    if (!isSlidesFullscreen) {
      if (slidesContainerRef.current.requestFullscreen) {
        slidesContainerRef.current.requestFullscreen();
      }
      setIsSlidesFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
      setIsSlidesFullscreen(false);
    }
  };

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (viewMode === 'video') return;
      
      switch (e.key) {
        case 'ArrowRight':
          nextSlide();
          break;
        case 'ArrowLeft':
          previousSlide();
          break;
        case 'f':
        case 'F':
          if (viewMode === 'slides') {
            toggleSlidesFullscreen();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [currentSlide, viewMode, totalSlides]);

  return (
    <div className="min-h-screen bg-background">
      <SEO 
        title="NRES Presentation | Notewell AI"
        description="View NRES presentation materials including video and governance framework slides"
      />

      {/* Header */}
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
              </Link>
              <h1 className="text-lg font-semibold">NRES Presentation</h1>
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                variant={viewMode === 'video' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('video')}
              >
                <Video className="w-4 h-4 mr-2" />
                Video
              </Button>
              <Button
                variant={viewMode === 'slides' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('slides')}
              >
                <FileText className="w-4 h-4 mr-2" />
                Slides
              </Button>
              <Button
                variant={viewMode === 'split' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('split')}
              >
                Split View
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        <div className={`grid gap-6 ${viewMode === 'split' ? 'lg:grid-cols-2' : 'grid-cols-1'}`}>
          
          {/* Video Section */}
          {(viewMode === 'video' || viewMode === 'split') && (
            <div 
              ref={videoContainerRef}
              className="relative bg-black rounded-lg overflow-hidden shadow-lg"
            >
              <video
                ref={videoRef}
                className="w-full aspect-video"
                controls
                src="/videos/nres25nov25.mp4"
              >
                Your browser does not support the video tag.
              </video>
              
              <Button
                variant="secondary"
                size="icon"
                className="absolute top-4 right-4 opacity-80 hover:opacity-100"
                onClick={toggleVideoFullscreen}
              >
                {isVideoFullscreen ? (
                  <Minimize className="w-4 h-4" />
                ) : (
                  <Maximize className="w-4 h-4" />
                )}
              </Button>

              {viewMode === 'video' && (
                <div className="p-4 bg-card">
                  <h2 className="text-xl font-semibold mb-2">NRES Presentation Video</h2>
                  <p className="text-sm text-muted-foreground">
                    25th November 2025 Recording
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Slides Section */}
          {(viewMode === 'slides' || viewMode === 'split') && (
            <div 
              ref={slidesContainerRef}
              className="relative bg-card rounded-lg overflow-hidden shadow-lg"
            >
              <div className="relative aspect-[4/3] bg-muted flex items-center justify-center">
                <canvas 
                  ref={canvasRef}
                  className="max-w-full max-h-full"
                />
              </div>

              {/* Slide Controls */}
              <div className="p-4 border-t border-border">
                <div className="flex items-center justify-between">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={previousSlide}
                    disabled={currentSlide === 1}
                  >
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    Previous
                  </Button>

                  <div className="text-sm font-medium">
                    Slide {currentSlide} of {totalSlides}
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={nextSlide}
                    disabled={currentSlide === totalSlides}
                  >
                    Next
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>

                <div className="flex items-center justify-between mt-3">
                  <p className="text-xs text-muted-foreground">
                    Use arrow keys to navigate • Press F for full-screen
                  </p>
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={toggleSlidesFullscreen}
                  >
                    {isSlidesFullscreen ? (
                      <Minimize className="w-4 h-4" />
                    ) : (
                      <Maximize className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>

              {viewMode === 'slides' && (
                <div className="p-4 border-t border-border bg-muted/30">
                  <h2 className="text-xl font-semibold mb-2">Rural Collaboration Governance Framework</h2>
                  <p className="text-sm text-muted-foreground">
                    Comprehensive governance framework for rural healthcare collaboration
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Instructions */}
        <div className="mt-6 p-4 bg-muted/50 rounded-lg">
          <h3 className="font-semibold mb-2">Presentation Controls</h3>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• Switch between Video, Slides, or Split View using the buttons above</li>
            <li>• Use arrow keys (← →) to navigate slides</li>
            <li>• Press F or click the maximise icon for full-screen mode</li>
            <li>• Video player has standard playback controls</li>
          </ul>
        </div>
      </main>
    </div>
  );
}
