import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, Loader2 } from 'lucide-react';
import { STOCK_IMAGE_CATEGORIES } from '@/hooks/useStockImages';
import { toast } from 'sonner';

interface StockImageUploaderProps {
  onUpload: (params: {
    file: File;
    title: string;
    category: string;
    tags: string[];
    description?: string;
  }) => Promise<void>;
  isUploading: boolean;
}

export const StockImageUploader: React.FC<StockImageUploaderProps> = ({ onUpload, isUploading }) => {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<string>('');
  const [tags, setTags] = useState('');
  const [description, setDescription] = useState('');
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);

  const onDrop = useCallback((accepted: File[]) => {
    setPendingFiles(prev => [...prev, ...accepted]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'] },
    multiple: true,
  });

  const handleUpload = async () => {
    if (!category) {
      toast.error('Please select a category');
      return;
    }
    if (pendingFiles.length === 0) {
      toast.error('Please add at least one image');
      return;
    }

    const parsedTags = tags.split(',').map(t => t.trim()).filter(Boolean);

    for (const file of pendingFiles) {
      const fileTitle = title || file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');
      await onUpload({
        file,
        title: pendingFiles.length === 1 ? (title || fileTitle) : fileTitle,
        category,
        tags: parsedTags,
        description: description || undefined,
      });
    }

    // Reset form
    setTitle('');
    setTags('');
    setDescription('');
    setPendingFiles([]);
  };

  return (
    <div className="border rounded-lg p-4 space-y-3 bg-muted/20">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Title (optional for bulk)</Label>
          <Input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Image title"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Category *</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger>
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              {STOCK_IMAGE_CATEGORIES.map(cat => (
                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Tags (comma-separated)</Label>
        <Input
          value={tags}
          onChange={e => setTags(e.target.value)}
          placeholder="e.g. consultation, diverse, NHS"
        />
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Description</Label>
        <Input
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Optional description"
        />
      </div>

      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
          isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-muted-foreground/50'
        }`}
      >
        <input {...getInputProps()} />
        <Upload className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
        <p className="text-xs text-muted-foreground">
          {pendingFiles.length > 0
            ? `${pendingFiles.length} file(s) selected`
            : 'Drop images here or click to browse'}
        </p>
      </div>

      <Button
        onClick={handleUpload}
        disabled={isUploading || pendingFiles.length === 0 || !category}
        className="w-full"
        size="sm"
      >
        {isUploading ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Uploading...
          </>
        ) : (
          <>
            <Upload className="h-4 w-4 mr-2" />
            Upload {pendingFiles.length > 0 ? `${pendingFiles.length} image(s)` : ''}
          </>
        )}
      </Button>
    </div>
  );
};
