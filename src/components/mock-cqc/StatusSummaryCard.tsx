import { useState } from 'react';
import { FileDown, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface StatusItem {
  id: string;
  key: string;
  name: string;
  notes?: string | null;
  assignedTo?: string | null;
  fixByDate?: string | null;
  fixByPreset?: string | null;
  photoUrl?: string | null;
  photoFileName?: string | null;
}

interface StatusSummaryCardProps {
  icon: React.ElementType;
  iconColorClass: string;
  count: number;
  label: string;
  bgColorClass: string;
  items: StatusItem[];
  practiceName: string;
  onDownloadReport?: () => Promise<void>;
}

export const StatusSummaryCard = ({
  icon: Icon,
  iconColorClass,
  count,
  label,
  bgColorClass,
  items,
  practiceName,
  onDownloadReport
}: StatusSummaryCardProps) => {
  const { toast } = useToast();
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onDownloadReport) return;
    
    setIsDownloading(true);
    try {
      await onDownloadReport();
      toast({
        title: 'Report downloaded',
        description: `${label} report saved successfully`
      });
    } catch (error) {
      console.error('Download error:', error);
      toast({
        title: 'Download failed',
        description: 'Could not generate the report',
        variant: 'destructive'
      });
    } finally {
      setIsDownloading(false);
    }
  };

  const cardContent = (
    <div className={cn("flex items-center gap-2 p-2.5 rounded-lg", bgColorClass)}>
      <Icon className={cn("h-4 w-4", iconColorClass)} />
      <div className="flex-1">
        <p className={cn("text-base font-semibold", iconColorClass)}>{count}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
      {count > 0 && onDownloadReport && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 hover:bg-white/50"
          onClick={handleDownload}
          disabled={isDownloading}
          title={`Download ${label} Report`}
        >
          {isDownloading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <FileDown className="h-4 w-4 text-blue-600" />
          )}
        </Button>
      )}
    </div>
  );

  if (count === 0 || items.length === 0) {
    return cardContent;
  }

  return (
    <HoverCard openDelay={200} closeDelay={100}>
      <HoverCardTrigger asChild>
        <div className="cursor-pointer">
          {cardContent}
        </div>
      </HoverCardTrigger>
      <HoverCardContent className="w-80 max-h-80 overflow-y-auto" side="bottom" align="start">
        <div className="space-y-2">
          <div className="flex items-center gap-2 pb-2 border-b">
            <Icon className={cn("h-4 w-4", iconColorClass)} />
            <span className="font-semibold text-sm">{count} {label}</span>
          </div>
          <div className="space-y-2">
            {items.slice(0, 10).map((item) => (
              <div key={item.id} className="text-xs space-y-1 p-2 bg-muted/50 rounded">
                <p className="font-medium">{item.name}</p>
                {item.notes && (
                  <p className="text-muted-foreground line-clamp-2">{item.notes}</p>
                )}
                {item.assignedTo && (
                  <p className="text-muted-foreground">
                    <span className="font-medium">Assigned:</span> {item.assignedTo}
                  </p>
                )}
                {item.fixByDate && (
                  <p className="text-muted-foreground">
                    <span className="font-medium">Fix by:</span> {new Date(item.fixByDate).toLocaleDateString('en-GB')}
                  </p>
                )}
                {item.photoUrl && (
                  <div className="mt-1">
                    <img 
                      src={item.photoUrl} 
                      alt={item.photoFileName || 'Evidence'} 
                      className="h-10 w-10 object-cover rounded border"
                    />
                  </div>
                )}
              </div>
            ))}
            {items.length > 10 && (
              <p className="text-xs text-muted-foreground text-center py-1">
                +{items.length - 10} more items...
              </p>
            )}
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
};
