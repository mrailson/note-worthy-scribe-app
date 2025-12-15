import { useState } from 'react';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  FolderOpen, AlertTriangle, FileText, Upload, Brain, 
  ArrowRightLeft, CheckCircle2, Loader2, XCircle, Clock,
  Trash2
} from 'lucide-react';
import { useWatchFolder, WatchFolderFile } from '@/hooks/useWatchFolder';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';

interface WatchFolderPipelineViewProps {
  practiceOds: string;
  uploaderName: string;
  batchId: string;
}

export default function WatchFolderPipelineView({ 
  practiceOds, 
  uploaderName, 
  batchId 
}: WatchFolderPipelineViewProps) {
  const {
    isSupported,
    isWatching,
    folderName,
    enableWatchFolder,
    disableWatchFolder,
    needsReselect,
    pipelineFiles,
    clearPipelineFiles
  } = useWatchFolder(practiceOds, uploaderName, batchId);

  const [activeTab, setActiveTab] = useState('detected');

  // Display name: actual folder or saved name that needs re-selection
  const displayFolderName = folderName || needsReselect.savedWatchName;
  const showReselectWarning = !folderName && needsReselect.watchFolder;

  // Check if in iframe
  const isInIframe = typeof window !== 'undefined' && window.self !== window.top;

  // Filter files by pipeline stage
  const detectedFiles = pipelineFiles.filter(f => 
    f.stage === 'detected' || f.stage === 'queuing'
  );
  const uploadedFiles = pipelineFiles.filter(f => 
    f.stage === 'uploading' || f.stage === 'uploaded'
  );
  const aiProcessingFiles = pipelineFiles.filter(f => 
    f.stage === 'processing' || f.stage === 'ocr' || f.stage === 'summarising' || f.stage === 'snomed'
  );
  const movedFiles = pipelineFiles.filter(f => f.movedToImported);
  const doneFiles = pipelineFiles.filter(f => f.savedToDone);

  if (!isSupported) {
    return (
      <div className="flex items-center gap-3 p-3 rounded-lg border border-amber-200 bg-amber-50/50 text-amber-700">
        <AlertTriangle className="h-4 w-4 flex-shrink-0" />
        <span className="text-sm">
          {isInIframe 
            ? 'Watch Folder requires a new browser tab' 
            : 'Watch Folder requires Chrome or Edge'}
        </span>
      </div>
    );
  }

  const handleToggle = async (checked: boolean) => {
    if (checked) {
      await enableWatchFolder();
    } else {
      disableWatchFolder();
    }
  };

  const formatTime = (date: Date) => format(date, 'HH:mm:ss');

  const getStageIcon = (file: WatchFolderFile) => {
    switch (file.stage) {
      case 'detected':
        return <FileText className="h-4 w-4 text-blue-500" />;
      case 'queuing':
        return <Loader2 className="h-4 w-4 text-amber-500 animate-spin" />;
      case 'queued':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'uploading':
        return <Upload className="h-4 w-4 text-amber-500 animate-pulse" />;
      case 'uploaded':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'processing':
      case 'ocr':
      case 'summarising':
      case 'snomed':
        return <Brain className="h-4 w-4 text-purple-500 animate-pulse" />;
      case 'complete':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStageBadge = (file: WatchFolderFile) => {
    const stageLabels: Record<string, { label: string; className: string }> = {
      detected: { label: 'Detected', className: 'bg-blue-100 text-blue-700' },
      queuing: { label: 'Queuing...', className: 'bg-amber-100 text-amber-700' },
      queued: { label: 'Queued', className: 'bg-green-100 text-green-700' },
      uploading: { label: 'Uploading', className: 'bg-amber-100 text-amber-700' },
      uploaded: { label: 'Uploaded', className: 'bg-green-100 text-green-700' },
      processing: { label: 'Processing', className: 'bg-purple-100 text-purple-700' },
      ocr: { label: 'OCR', className: 'bg-purple-100 text-purple-700' },
      summarising: { label: 'Summarising', className: 'bg-purple-100 text-purple-700' },
      snomed: { label: 'SNOMED', className: 'bg-purple-100 text-purple-700' },
      complete: { label: 'Complete', className: 'bg-green-100 text-green-700' },
      failed: { label: 'Failed', className: 'bg-red-100 text-red-700' }
    };
    
    const config = stageLabels[file.stage] || { label: file.stage, className: 'bg-muted' };
    return (
      <Badge className={cn('text-xs', config.className)}>
        {config.label}
      </Badge>
    );
  };

  const FileRow = ({ file, showExtra }: { file: WatchFolderFile; showExtra?: 'patient' | 'lgName' }) => (
    <div className="flex items-center justify-between py-2 px-3 border-b last:border-b-0 hover:bg-muted/50">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {getStageIcon(file)}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate">{file.originalFilename}</p>
          {showExtra === 'patient' && file.patientName && (
            <p className="text-xs text-muted-foreground">{file.patientName} • {file.pageCount} pages</p>
          )}
          {showExtra === 'lgName' && file.lgFilename && (
            <p className="text-xs text-green-600 font-mono truncate">{file.lgFilename}</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {getStageBadge(file)}
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {formatTime(file.detectedAt)}
        </span>
      </div>
    </div>
  );

  const EmptyState = ({ message }: { message: string }) => (
    <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
      <FileText className="h-8 w-8 mb-2 opacity-50" />
      <p className="text-sm">{message}</p>
    </div>
  );

  const tabCounts = {
    detected: detectedFiles.length,
    uploaded: uploadedFiles.length,
    ai: aiProcessingFiles.length,
    moved: movedFiles.length,
    done: doneFiles.length
  };

  return (
    <div className="space-y-3">
      {/* Main toggle row */}
      <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
        <div className="flex items-center gap-3">
          <Switch
            id="watch-folder-toggle"
            checked={isWatching}
            onCheckedChange={handleToggle}
          />
          <label 
            htmlFor="watch-folder-toggle" 
            className="text-sm font-medium cursor-pointer flex items-center gap-2"
          >
            <FolderOpen className="h-4 w-4" />
            Watch Folder
          </label>
        </div>
        
        <div className="flex items-center gap-2">
          {displayFolderName && (
            <span className={cn(
              "text-sm px-2 py-0.5 rounded",
              showReselectWarning ? "bg-amber-100 text-amber-700" : "bg-muted text-muted-foreground"
            )}>
              {displayFolderName}
            </span>
          )}
          {isWatching && (
            <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-200">
              <span className="w-2 h-2 bg-green-500 rounded-full mr-1.5 animate-pulse" />
              Active
            </Badge>
          )}
        </div>
      </div>

      {/* Re-selection warning */}
      {showReselectWarning && (
        <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 rounded-md text-amber-700 text-xs">
          <AlertTriangle className="h-3 w-3 flex-shrink-0" />
          <span>Re-select required after page refresh</span>
        </div>
      )}

      {/* Pipeline tabs - only show when watching or has files */}
      {(isWatching || pipelineFiles.length > 0) && (
        <div className="border rounded-lg bg-card">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <div className="border-b px-2 pt-2">
              <TabsList className="h-9 w-full grid grid-cols-5 gap-1">
                <TabsTrigger value="detected" className="text-xs px-2">
                  Detected {tabCounts.detected > 0 && <Badge variant="secondary" className="ml-1 h-5 px-1.5">{tabCounts.detected}</Badge>}
                </TabsTrigger>
                <TabsTrigger value="uploaded" className="text-xs px-2">
                  Uploaded {tabCounts.uploaded > 0 && <Badge variant="secondary" className="ml-1 h-5 px-1.5">{tabCounts.uploaded}</Badge>}
                </TabsTrigger>
                <TabsTrigger value="ai" className="text-xs px-2">
                  AI {tabCounts.ai > 0 && <Badge variant="secondary" className="ml-1 h-5 px-1.5">{tabCounts.ai}</Badge>}
                </TabsTrigger>
                <TabsTrigger value="moved" className="text-xs px-2">
                  Moved {tabCounts.moved > 0 && <Badge variant="secondary" className="ml-1 h-5 px-1.5">{tabCounts.moved}</Badge>}
                </TabsTrigger>
                <TabsTrigger value="done" className="text-xs px-2">
                  Done {tabCounts.done > 0 && <Badge variant="secondary" className="ml-1 h-5 px-1.5">{tabCounts.done}</Badge>}
                </TabsTrigger>
              </TabsList>
            </div>

            <ScrollArea className="h-[200px]">
              <TabsContent value="detected" className="m-0">
                {detectedFiles.length > 0 ? (
                  detectedFiles.map(file => <FileRow key={file.id} file={file} />)
                ) : (
                  <EmptyState message="No files detected yet" />
                )}
              </TabsContent>

              <TabsContent value="uploaded" className="m-0">
                {uploadedFiles.length > 0 ? (
                  uploadedFiles.map(file => <FileRow key={file.id} file={file} />)
                ) : (
                  <EmptyState message="No files uploading" />
                )}
              </TabsContent>

              <TabsContent value="ai" className="m-0">
                {aiProcessingFiles.length > 0 ? (
                  aiProcessingFiles.map(file => <FileRow key={file.id} file={file} showExtra="patient" />)
                ) : (
                  <EmptyState message="No files processing" />
                )}
              </TabsContent>

              <TabsContent value="moved" className="m-0">
                {movedFiles.length > 0 ? (
                  movedFiles.map(file => (
                    <div key={file.id} className="flex items-center justify-between py-2 px-3 border-b last:border-b-0">
                      <div className="flex items-center gap-2">
                        <ArrowRightLeft className="h-4 w-4 text-green-500" />
                        <span className="text-sm">{file.originalFilename}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className="bg-green-100 text-green-700 text-xs">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Moved
                        </Badge>
                        {file.movedAt && (
                          <span className="text-xs text-muted-foreground">{formatTime(file.movedAt)}</span>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <EmptyState message="No files moved yet" />
                )}
              </TabsContent>

              <TabsContent value="done" className="m-0">
                {doneFiles.length > 0 ? (
                  doneFiles.map(file => (
                    <div key={file.id} className="py-2 px-3 border-b last:border-b-0">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                          <span className="text-sm font-medium">{file.patientName || file.originalFilename}</span>
                        </div>
                        {file.savedAt && (
                          <span className="text-xs text-muted-foreground">{formatTime(file.savedAt)}</span>
                        )}
                      </div>
                      {file.lgFilename && (
                        <p className="text-xs text-green-600 font-mono mt-1 pl-6 truncate">
                          {file.lgFilename}
                        </p>
                      )}
                    </div>
                  ))
                ) : (
                  <EmptyState message="No files completed yet" />
                )}
              </TabsContent>
            </ScrollArea>

            {pipelineFiles.length > 0 && (
              <div className="border-t px-3 py-2 flex justify-end">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={clearPipelineFiles}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  <Trash2 className="h-3 w-3 mr-1" />
                  Clear History
                </Button>
              </div>
            )}
          </Tabs>
        </div>
      )}

      {/* Help text */}
      <div className="text-xs text-muted-foreground px-1 space-y-0.5">
        <p>Checks folder every 30 seconds for new PDFs</p>
        <p>• Source PDFs moved to "Imported to AI for processing"</p>
        <p>• Completed PDFs saved to "Done"</p>
      </div>
    </div>
  );
}
