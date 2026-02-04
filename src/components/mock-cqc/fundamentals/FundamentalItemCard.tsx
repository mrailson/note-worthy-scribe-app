import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { 
  Check, 
  AlertTriangle, 
  MinusCircle, 
  Camera,
  ChevronDown,
  ChevronRight,
  Trash2,
  ExternalLink
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getStatusColor, getStatusLabel, FundamentalItem } from './fundamentalsConfig';
import { InspectionQRCaptureModal } from '../InspectionQRCaptureModal';

interface FundamentalRecord {
  id: string;
  session_id: string;
  category: string;
  item_key: string;
  item_name: string;
  status: string;
  notes: string | null;
  photo_url: string | null;
  photo_file_name: string | null;
  checked_at: string | null;
}

interface FundamentalItemCardProps {
  item: FundamentalItem;
  record?: FundamentalRecord;
  sessionId: string;
  onUpdate: (updates: Partial<FundamentalRecord>) => void;
}

export const FundamentalItemCard = ({ 
  item, 
  record, 
  sessionId,
  onUpdate 
}: FundamentalItemCardProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [notes, setNotes] = useState(record?.notes || '');

  const status = record?.status || 'not_checked';

  const handleStatusChange = (newStatus: string) => {
    onUpdate({ status: newStatus });
  };

  const handleNotesBlur = () => {
    if (notes !== record?.notes) {
      onUpdate({ notes: notes || null });
    }
  };

  const handlePhotoReceived = (images: { id: string; file_name: string; file_url: string }[]) => {
    if (images.length > 0) {
      // Use the first image
      onUpdate({ 
        photo_url: images[0].file_url, 
        photo_file_name: images[0].file_name 
      });
    }
  };

  const handleRemovePhoto = () => {
    onUpdate({ photo_url: null, photo_file_name: null });
  };

  return (
    <>
      <Card className={cn(
        "border transition-all",
        status === 'verified' && "border-green-300 bg-green-50/50",
        status === 'issue_found' && "border-red-300 bg-red-50/50"
      )}>
        <div className="p-3">
          {/* Header row */}
          <div className="flex items-start justify-between gap-3">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex items-start gap-2 text-left flex-1 min-w-0"
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4 mt-0.5 flex-shrink-0 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 mt-0.5 flex-shrink-0 text-muted-foreground" />
              )}
              <div className="min-w-0">
                <h4 className="font-medium text-sm">{item.name}</h4>
                <p className="text-xs text-muted-foreground line-clamp-2">{item.description}</p>
              </div>
            </button>
            <Badge className={cn("flex-shrink-0 text-xs", getStatusColor(status))}>
              {getStatusLabel(status)}
            </Badge>
          </div>

          {/* Expanded content */}
          {isExpanded && (
            <div className="mt-4 space-y-4 pl-6">
              {/* Status buttons */}
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant={status === 'verified' ? 'default' : 'outline'}
                  onClick={() => handleStatusChange('verified')}
                  className={cn(
                    "gap-1.5",
                    status === 'verified' && "bg-green-600 hover:bg-green-700"
                  )}
                >
                  <Check className="h-3.5 w-3.5" />
                  Verified
                </Button>
                <Button
                  size="sm"
                  variant={status === 'issue_found' ? 'default' : 'outline'}
                  onClick={() => handleStatusChange('issue_found')}
                  className={cn(
                    "gap-1.5",
                    status === 'issue_found' && "bg-red-600 hover:bg-red-700"
                  )}
                >
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Issue Found
                </Button>
                <Button
                  size="sm"
                  variant={status === 'not_applicable' ? 'default' : 'outline'}
                  onClick={() => handleStatusChange('not_applicable')}
                  className={cn(
                    "gap-1.5",
                    status === 'not_applicable' && "bg-gray-600 hover:bg-gray-700"
                  )}
                >
                  <MinusCircle className="h-3.5 w-3.5" />
                  N/A
                </Button>
              </div>

              {/* Photo evidence */}
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Camera className="h-4 w-4" />
                  Photo Evidence
                </label>
                
                {record?.photo_url ? (
                  <div className="flex items-center gap-3 p-2 bg-muted/50 rounded-lg">
                    <img 
                      src={record.photo_url} 
                      alt={record.photo_file_name || 'Evidence'} 
                      className="h-16 w-16 object-cover rounded"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{record.photo_file_name}</p>
                      <div className="flex gap-2 mt-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2"
                          onClick={() => window.open(record.photo_url!, '_blank')}
                        >
                          <ExternalLink className="h-3 w-3 mr-1" />
                          View
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-destructive hover:text-destructive"
                          onClick={handleRemovePhoto}
                        >
                          <Trash2 className="h-3 w-3 mr-1" />
                          Remove
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowQRModal(true)}
                    className="gap-2"
                  >
                    <Camera className="h-4 w-4" />
                    Capture Photo
                  </Button>
                )}
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Notes</label>
                <Textarea
                  placeholder="Add any notes about this item..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  onBlur={handleNotesBlur}
                  rows={2}
                  className="text-sm"
                />
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* QR Capture Modal */}
      <InspectionQRCaptureModal
        open={showQRModal}
        onOpenChange={setShowQRModal}
        elementId={record?.id || item.key}
        elementKey={item.key}
        elementName={item.name}
        onImagesReceived={handlePhotoReceived}
      />
    </>
  );
};
