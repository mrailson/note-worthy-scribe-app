import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Paperclip, Link2, Upload, X, FileText, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EvidenceFile {
  type: string;
  url?: string;
  id?: string;
  name: string;
}

interface EvidenceAttachmentProps {
  files: EvidenceFile[];
  onFilesChange: (files: EvidenceFile[]) => void;
}

export const EvidenceAttachment = ({ files, onFilesChange }: EvidenceAttachmentProps) => {
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkName, setLinkName] = useState('');

  const handleAddLink = () => {
    if (!linkUrl.trim() || !linkName.trim()) return;
    
    const newFile: EvidenceFile = {
      type: 'link',
      url: linkUrl.trim(),
      name: linkName.trim()
    };
    
    onFilesChange([...files, newFile]);
    setLinkUrl('');
    setLinkName('');
    setShowLinkInput(false);
  };

  const handleRemoveFile = (index: number) => {
    const newFiles = files.filter((_, i) => i !== index);
    onFilesChange(newFiles);
  };

  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFiles = event.target.files;
    if (!uploadedFiles) return;

    // For now, we'll store file info locally (in a real implementation, upload to storage)
    const newFiles: EvidenceFile[] = Array.from(uploadedFiles).map(file => ({
      type: 'file',
      name: file.name,
      // In production, this would be a URL from Supabase storage
      url: URL.createObjectURL(file)
    }));

    onFilesChange([...files, ...newFiles]);
    event.target.value = ''; // Reset input
  }, [files, onFilesChange]);

  return (
    <div className="space-y-3">
      <label className="text-sm font-medium flex items-center gap-2">
        <Paperclip className="h-4 w-4" />
        Evidence Attachments
      </label>

      {/* Attached Files List */}
      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((file, index) => (
            <div 
              key={index}
              className="flex items-center justify-between p-2 bg-muted/50 rounded-lg border"
            >
              <div className="flex items-center gap-2 min-w-0">
                {file.type === 'link' ? (
                  <Link2 className="h-4 w-4 text-blue-600 flex-shrink-0" />
                ) : (
                  <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                )}
                <span className="text-sm truncate">{file.name}</span>
              </div>
              <div className="flex items-center gap-1">
                {file.url && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => window.open(file.url, '_blank')}
                  >
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                  onClick={() => handleRemoveFile(index)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Link Form */}
      {showLinkInput && (
        <div className="space-y-2 p-3 bg-muted/30 rounded-lg border">
          <Input
            placeholder="Link name (e.g., 'Safeguarding Policy 2024')"
            value={linkName}
            onChange={(e) => setLinkName(e.target.value)}
          />
          <Input
            placeholder="URL (e.g., https://...)"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            type="url"
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={handleAddLink} disabled={!linkUrl || !linkName}>
              Add Link
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowLinkInput(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      {!showLinkInput && (
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowLinkInput(true)}
            className="flex items-center gap-2"
          >
            <Link2 className="h-4 w-4" />
            Add Link
          </Button>
          <label className="cursor-pointer">
            <Button variant="outline" size="sm" className="flex items-center gap-2" asChild>
              <span>
                <Upload className="h-4 w-4" />
                Upload File
              </span>
            </Button>
            <input
              type="file"
              className="hidden"
              multiple
              accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
              onChange={handleFileUpload}
            />
          </label>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Attach evidence documents, links to policies, or references to where evidence is stored.
      </p>
    </div>
  );
};
