import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { FolderOpen, AlertTriangle } from 'lucide-react';
import { useWatchFolder } from '@/hooks/useWatchFolder';
import { cn } from '@/lib/utils';

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
  const {
    isSupported,
    isWatching,
    folderName,
    enableWatchFolder,
    disableWatchFolder,
    needsReselect
  } = useWatchFolder(practiceOds, uploaderName, batchId);

  // Display name: actual folder or saved name that needs re-selection
  const displayFolderName = folderName || needsReselect.savedWatchName;
  const showReselectWarning = !folderName && needsReselect.watchFolder;

  // Check if in iframe
  const isInIframe = typeof window !== 'undefined' && window.self !== window.top;

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

  return (
    <div className="space-y-2">
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

      {/* Help text */}
      <div className="text-xs text-muted-foreground px-1 space-y-0.5">
        <p>Checks folder every 30 seconds for new PDFs</p>
        <p>• Source PDFs moved to "Imported to AI for processing"</p>
        <p>• Completed PDFs saved to "Done"</p>
      </div>
    </div>
  );
}
