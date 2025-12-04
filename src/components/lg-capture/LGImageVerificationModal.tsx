import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Check, X, Pencil, ZoomIn, ZoomOut, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface SnomedItemForVerification {
  domain: string;
  term: string;
  code: string;
  date?: string;
  confidence: number;
  evidence?: string;
  source_page?: number | null;
  index: number; // Position in original array for updates
}

interface LGImageVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: SnomedItemForVerification | null;
  practiceOds: string;
  patientId: string;
  snomedJsonUrl: string | null;
  onItemUpdated: () => void; // Callback to refresh parent data
}

export function LGImageVerificationModal({
  isOpen,
  onClose,
  item,
  practiceOds,
  patientId,
  snomedJsonUrl,
  onItemUpdated,
}: LGImageVerificationModalProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [isEditing, setIsEditing] = useState(false);
  const [editedTerm, setEditedTerm] = useState('');
  const [editedCode, setEditedCode] = useState('');
  const [saving, setSaving] = useState(false);

  // Fetch image when modal opens with a valid source_page
  useEffect(() => {
    if (!isOpen || !item || typeof item.source_page !== 'number') {
      setImageUrl(null);
      setError(null);
      return;
    }

    const fetchImage = async () => {
      setLoading(true);
      setError(null);
      setZoom(1);

      try {
        // source_page is 0-indexed, files are named page_001.jpg, page_002.jpg, etc.
        const pageNumber = String(item.source_page! + 1).padStart(3, '0');
        const imagePath = `${practiceOds}/${patientId}/raw/page_${pageNumber}.jpg`;

        const { data, error: urlError } = await supabase.storage
          .from('lg')
          .createSignedUrl(imagePath, 300); // 5 minute expiry

        if (urlError) {
          throw new Error(urlError.message);
        }

        setImageUrl(data.signedUrl);
      } catch (err) {
        console.error('Failed to fetch image:', err);
        setError('Could not load source image');
      } finally {
        setLoading(false);
      }
    };

    fetchImage();
  }, [isOpen, item, practiceOds, patientId]);

  // Reset edit state when item changes
  useEffect(() => {
    if (item) {
      setEditedTerm(item.term);
      setEditedCode(item.code);
      setIsEditing(false);
    }
  }, [item]);

  const handleConfirm = async () => {
    toast({
      title: 'Confirmed',
      description: `"${item?.term}" verified as correct`,
    });
    onClose();
  };

  const updateSnomedJson = async (
    action: 'remove' | 'edit',
    updates?: { term: string; code: string }
  ) => {
    if (!snomedJsonUrl || !item) return;

    setSaving(true);
    try {
      // Download current SNOMED JSON
      const snomedPath = snomedJsonUrl.replace('lg/', '');
      const { data: snomedFile, error: downloadError } = await supabase.storage
        .from('lg')
        .download(snomedPath);

      if (downloadError) throw downloadError;

      const snomedData = JSON.parse(await snomedFile.text());

      // Find the domain array (diagnoses, surgeries, allergies, immunisations)
      const domainKey = item.domain.toLowerCase() === 'diagnosis' ? 'diagnoses' :
                        item.domain.toLowerCase() === 'surgery' ? 'surgeries' :
                        item.domain.toLowerCase() === 'allergy' ? 'allergies' :
                        item.domain.toLowerCase() === 'immunisation' ? 'immunisations' : null;

      if (!domainKey || !snomedData[domainKey]) {
        throw new Error('Invalid domain');
      }

      // Find the item by matching term and code
      const domainArray = snomedData[domainKey] as any[];
      const itemIndex = domainArray.findIndex(
        (i: any) => i.term === item.term && i.code === item.code
      );

      if (itemIndex === -1) {
        throw new Error('Item not found in SNOMED data');
      }

      if (action === 'remove') {
        // Remove the item
        domainArray.splice(itemIndex, 1);
      } else if (action === 'edit' && updates) {
        // Update the item
        domainArray[itemIndex] = {
          ...domainArray[itemIndex],
          term: updates.term,
          code: updates.code,
        };
      }

      // Upload updated JSON
      const updatedJson = JSON.stringify(snomedData, null, 2);
      const { error: uploadError } = await supabase.storage
        .from('lg')
        .upload(snomedPath, new Blob([updatedJson], { type: 'application/json' }), {
          upsert: true,
        });

      if (uploadError) throw uploadError;

      toast({
        title: action === 'remove' ? 'Removed' : 'Updated',
        description: action === 'remove' 
          ? `"${item.term}" removed from SNOMED codes`
          : `SNOMED code updated successfully`,
      });

      onItemUpdated();
      onClose();
    } catch (err) {
      console.error('Failed to update SNOMED:', err);
      toast({
        title: 'Error',
        description: 'Failed to update SNOMED codes',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = () => updateSnomedJson('remove');

  const handleSaveEdit = () => {
    if (!editedTerm.trim() || !editedCode.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Term and code are required',
        variant: 'destructive',
      });
      return;
    }
    updateSnomedJson('edit', { term: editedTerm.trim(), code: editedCode.trim() });
  };

  if (!item) return null;

  const pdfPageNumber = typeof item.source_page === 'number' ? item.source_page + 2 : null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-6xl max-h-[95vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Verify SNOMED Code
            {pdfPageNumber && (
              <Badge variant="outline" className="ml-2">PDF Page {pdfPageNumber}</Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Left: Image viewer */}
          <div className="relative border rounded-lg overflow-hidden bg-muted/20">
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            )}
            {error && (
              <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                <div className="text-center p-4">
                  <AlertTriangle className="h-8 w-8 mx-auto mb-2" />
                  <p className="text-sm">{error}</p>
                </div>
              </div>
            )}
            {imageUrl && !loading && (
              <ScrollArea className="h-[600px]">
                <div className="p-2 flex items-start justify-center">
                  <img
                    src={imageUrl}
                    alt={`Scan page ${item.source_page! + 1}`}
                    style={{ transform: `scale(${zoom})`, transformOrigin: 'top center' }}
                    className="max-h-[580px] w-auto object-contain"
                  />
                </div>
              </ScrollArea>
            )}
            {!loading && !error && !imageUrl && typeof item.source_page !== 'number' && (
              <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                <p className="text-sm">No source page available</p>
              </div>
            )}
            
            {/* Zoom controls */}
            {imageUrl && (
              <div className="absolute bottom-2 right-2 flex gap-1">
                <Button
                  variant="secondary"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setZoom(Math.max(0.5, zoom - 0.25))}
                >
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <Button
                  variant="secondary"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setZoom(Math.min(3, zoom + 0.25))}
                >
                  <ZoomIn className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          {/* Right: Item details */}
          <div className="space-y-4">
            <div className="p-4 bg-muted/30 rounded-lg space-y-3">
              <div className="flex items-center gap-2">
                <Badge variant="outline">{item.domain}</Badge>
                <Badge 
                  variant={item.confidence >= 0.8 ? 'default' : item.confidence >= 0.6 ? 'secondary' : 'outline'}
                >
                  {Math.round(item.confidence * 100)}% confidence
                </Badge>
              </div>

              {isEditing ? (
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="edit-term">Term</Label>
                    <Input
                      id="edit-term"
                      value={editedTerm}
                      onChange={(e) => setEditedTerm(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-code">SNOMED Code</Label>
                    <Input
                      id="edit-code"
                      value={editedCode}
                      onChange={(e) => setEditedCode(e.target.value)}
                      className="mt-1 font-mono"
                    />
                  </div>
                </div>
              ) : (
                <>
                  <div>
                    <p className="text-xs text-muted-foreground">Term</p>
                    <p className="font-medium">{item.term}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">SNOMED Code</p>
                    <p className="font-mono text-sm">{item.code}</p>
                  </div>
                </>
              )}

              {item.date && (
                <div>
                  <p className="text-xs text-muted-foreground">Date</p>
                  <p className="text-sm">{item.date}</p>
                </div>
              )}

              {item.evidence && (
                <div>
                  <p className="text-xs text-muted-foreground">Evidence from OCR</p>
                  <p className="text-sm italic text-muted-foreground bg-muted/50 p-2 rounded">
                    "{item.evidence}"
                  </p>
                </div>
              )}
            </div>

            {item.confidence < 0.6 && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 text-sm">
                  <AlertTriangle className="h-4 w-4" />
                  Low confidence - please verify against source
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="flex-wrap gap-2">
          {isEditing ? (
            <>
              <Button variant="outline" onClick={() => setIsEditing(false)} disabled={saving}>
                Cancel Edit
              </Button>
              <Button onClick={handleSaveEdit} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Save Changes
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="destructive"
                onClick={handleRemove}
                disabled={saving}
                className="mr-auto"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <X className="h-4 w-4 mr-2" />}
                Remove
              </Button>
              <Button variant="outline" onClick={() => setIsEditing(true)} disabled={saving}>
                <Pencil className="h-4 w-4 mr-2" />
                Edit
              </Button>
              <Button onClick={handleConfirm} disabled={saving}>
                <Check className="h-4 w-4 mr-2" />
                Confirm Correct
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
