import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileText, MessageSquare, Mic, Presentation, Video, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { DocumentUploadPanel } from '@/components/notebook/DocumentUploadPanel';
import { DocumentQAPanel } from '@/components/notebook/DocumentQAPanel';
import { AudioOverviewPanel } from '@/components/notebook/AudioOverviewPanel';
import { AudioHistoryPanel } from '@/components/notebook/AudioHistoryPanel';
import { SlideDeckPanel } from '@/components/notebook/SlideDeckPanel';
import { SlideVideoGenerator } from '@/components/notebook/SlideVideoGenerator';
import type { UploadedFile } from '@/types/ai4gp';
import type { AudioSession } from '@/hooks/useAudioOverviewHistory';
import type { PresentationSession } from '@/hooks/usePresentationHistory';

const NotebookStudio = () => {
  const navigate = useNavigate();
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [activeTab, setActiveTab] = useState('upload');
  const [loadedAudioSession, setLoadedAudioSession] = useState<AudioSession | null>(null);
  const [loadedPresentationSession, setLoadedPresentationSession] = useState<PresentationSession | null>(null);

  const handleFilesUploaded = (files: UploadedFile[]) => {
    setUploadedFiles(prev => [...prev, ...files]);
  };

  const handleRemoveFile = (fileName: string) => {
    setUploadedFiles(prev => prev.filter(f => f.name !== fileName));
  };

  const handleLoadAudioSession = (session: AudioSession) => {
    setLoadedAudioSession(session);
    setActiveTab('audio');
  };

  const handleLoadPresentationSession = (session: PresentationSession) => {
    setLoadedPresentationSession(session);
    setActiveTab('slides');
  };

  return (
    <>
      <Helmet>
        <title>Notewell Studio | Create Audio, Slides & Videos</title>
        <meta name="description" content="AI-powered content creation studio for generating audio overviews, presentations, and videos from your documents" />
      </Helmet>

      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
        <div className="container mx-auto px-4 py-8 max-w-7xl">
          {/* Header */}
          <div className="mb-8">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/')}
              className="mb-4"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Home
            </Button>
            
            <div className="flex items-center gap-4 mb-2">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                <FileText className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                  Notewell Studio
                </h1>
                <p className="text-muted-foreground mt-1">
                  Transform your documents into audio overviews, presentations, and videos
                </p>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <Card className="border-2 shadow-xl">
            <CardContent className="p-6">
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid grid-cols-6 w-full mb-6">
                  <TabsTrigger value="upload" className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    <span className="hidden sm:inline">Upload</span>
                  </TabsTrigger>
                  <TabsTrigger value="audio" className="flex items-center gap-2">
                    <Mic className="h-4 w-4" />
                    <span className="hidden sm:inline">Audio</span>
                  </TabsTrigger>
                  <TabsTrigger value="audio-history" className="flex items-center gap-2">
                    <Mic className="h-4 w-4" />
                    <span className="hidden sm:inline">History</span>
                  </TabsTrigger>
                  <TabsTrigger value="qa" className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    <span className="hidden sm:inline">Q&A</span>
                  </TabsTrigger>
                  <TabsTrigger value="slides" className="flex items-center gap-2">
                    <Presentation className="h-4 w-4" />
                    <span className="hidden sm:inline">Slides</span>
                  </TabsTrigger>
                  <TabsTrigger value="video" className="flex items-center gap-2">
                    <Video className="h-4 w-4" />
                    <span className="hidden sm:inline">Video</span>
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="upload" className="space-y-4">
                  <DocumentUploadPanel
                    uploadedFiles={uploadedFiles}
                    onFilesUploaded={handleFilesUploaded}
                    onRemoveFile={handleRemoveFile}
                  />
                </TabsContent>

                <TabsContent value="qa" className="space-y-4">
                  <DocumentQAPanel uploadedFiles={uploadedFiles} />
                </TabsContent>

                <TabsContent value="audio" className="space-y-4">
                  <AudioOverviewPanel 
                    uploadedFiles={uploadedFiles}
                    loadedSession={loadedAudioSession}
                    onSessionLoaded={() => setLoadedAudioSession(null)}
                  />
                </TabsContent>

                <TabsContent value="audio-history" className="space-y-4">
                  <AudioHistoryPanel onLoadSession={handleLoadAudioSession} />
                </TabsContent>

                <TabsContent value="slides" className="space-y-4">
                  <SlideDeckPanel 
                    uploadedFiles={uploadedFiles}
                    onLoadSession={handleLoadPresentationSession}
                    loadedSession={loadedPresentationSession}
                  />
                </TabsContent>

                <TabsContent value="video" className="space-y-4">
                  <SlideVideoGenerator uploadedFiles={uploadedFiles} />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* Quick Stats */}
          {uploadedFiles.length > 0 && (
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card className="border-primary/20">
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-primary">{uploadedFiles.length}</p>
                  <p className="text-sm text-muted-foreground">Documents Uploaded</p>
                </CardContent>
              </Card>
              <Card className="border-accent/20">
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-accent">
                    {Math.round(uploadedFiles.reduce((sum, f) => sum + (f.size || 0), 0) / 1024)} KB
                  </p>
                  <p className="text-sm text-muted-foreground">Total Size</p>
                </CardContent>
              </Card>
              <Card className="border-secondary/20">
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-secondary-foreground">Ready</p>
                  <p className="text-sm text-muted-foreground">Status</p>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default NotebookStudio;
