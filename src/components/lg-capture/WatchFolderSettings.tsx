import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  FolderSearch, FolderOpen, Check, X, Loader2, 
  ChevronDown, AlertTriangle, Trash2, Clock 
} from 'lucide-react';
import { useWatchFolder, ActivityLogEntry } from '@/hooks/useWatchFolder';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { format } from 'date-fns';

interface WatchFolderSettingsProps {
  practiceOds: string;
  uploaderName: string;
  batchId: string;
}

export default function WatchFolderSettings({ 
  practiceOds, 
  uploaderName, 
  batchId 
}: WatchFolderSettingsProps) {
  const [isOpen, setIsOpen] = useState(false);
  
  const {
    isSupported,
    isWatching,
    folderName,
    pollingInterval,
    processedFiles,
    recentActivity,
    selectFolder,
    startWatching,
    stopWatching,
    setPollingInterval,
    clearProcessedFiles
  } = useWatchFolder(practiceOds, uploaderName, batchId);

  // Check if in iframe
  const isInIframe = typeof window !== 'undefined' && window.self !== window.top;

  if (!isSupported) {
    return (
      <Card className="border-amber-200 bg-amber-50/50">
        <CardContent className="pt-4">
          <div className="flex items-center gap-3 text-amber-700">
            <AlertTriangle className="h-5 w-5 flex-shrink-0" />
            <div className="text-sm">
              {isInIframe ? (
                <>
                  <p className="font-medium">Watch Folder requires a new browser tab</p>
                  <p className="text-amber-600">This feature cannot work in the preview iframe. Open the app in a new tab using the external link icon.</p>
                </>
              ) : (
                <>
                  <p className="font-medium">Watch Folder requires Chrome or Edge</p>
                  <p className="text-amber-600">This feature uses the File System Access API which is not supported in your browser.</p>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getStatusIcon = (status: ActivityLogEntry['status']) => {
    switch (status) {
      case 'detected':
        return <FolderSearch className="h-3 w-3 text-blue-500" />;
      case 'processing':
        return <Loader2 className="h-3 w-3 text-amber-500 animate-spin" />;
      case 'queued':
        return <Check className="h-3 w-3 text-green-500" />;
      case 'failed':
        return <X className="h-3 w-3 text-red-500" />;
    }
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="pb-3 cursor-pointer hover:bg-muted/50 transition-colors">
            <CardTitle className="text-base flex items-center justify-between">
              <span className="flex items-center gap-2">
                <FolderOpen className="h-4 w-4" />
                Watch Folder
                {isWatching && (
                  <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-200">
                    <span className="w-2 h-2 bg-green-500 rounded-full mr-1.5 animate-pulse" />
                    Active
                  </Badge>
                )}
              </span>
              <ChevronDown className={cn("h-4 w-4 transition-transform", isOpen && "rotate-180")} />
            </CardTitle>
          </CardHeader>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <CardContent className="space-y-4">
            {/* Folder Selection */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Selected Folder</Label>
              <div className="flex items-center gap-2">
                <div className="flex-1 px-3 py-2 rounded-md bg-muted text-sm">
                  {folderName || 'No folder selected'}
                </div>
                <Button variant="outline" onClick={selectFolder} disabled={isWatching}>
                  <FolderSearch className="h-4 w-4 mr-2" />
                  {folderName ? 'Change' : 'Select'}
                </Button>
              </div>
            </div>

            {/* Controls */}
            {folderName && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Switch
                    id="watch-enabled"
                    checked={isWatching}
                    onCheckedChange={(checked) => checked ? startWatching() : stopWatching()}
                  />
                  <Label htmlFor="watch-enabled" className="text-sm">
                    Auto-import new PDFs
                  </Label>
                </div>

                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <Select
                    value={String(pollingInterval)}
                    onValueChange={(v) => setPollingInterval(Number(v))}
                    disabled={isWatching}
                  >
                    <SelectTrigger className="w-24 h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10 sec</SelectItem>
                      <SelectItem value="30">30 sec</SelectItem>
                      <SelectItem value="60">1 min</SelectItem>
                      <SelectItem value="120">2 min</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* Activity Log */}
            {recentActivity.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Recent Activity</Label>
                  <span className="text-xs text-muted-foreground">
                    {processedFiles.length} files processed
                  </span>
                </div>
                <ScrollArea className="h-32 rounded-md border">
                  <div className="p-2 space-y-1">
                    {recentActivity.map(entry => (
                      <div key={entry.id} className="flex items-center gap-2 text-xs py-1">
                        {getStatusIcon(entry.status)}
                        <span className="truncate flex-1">{entry.fileName}</span>
                        <span className="text-muted-foreground">
                          {format(entry.timestamp, 'HH:mm:ss')}
                        </span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}

            {/* Clear History */}
            {processedFiles.length > 0 && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={clearProcessedFiles}
                className="text-muted-foreground"
              >
                <Trash2 className="h-3 w-3 mr-1" />
                Clear processed files history
              </Button>
            )}

            {/* Help Text */}
            <p className="text-xs text-muted-foreground">
              When enabled, this folder is checked every {pollingInterval} seconds for new PDF files. 
              New files are automatically queued for processing. Files are only processed once.
            </p>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}