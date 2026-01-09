import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { SimpleFileUpload } from '@/components/SimpleFileUpload';
import { useMeetingTemplates } from '@/hooks/useMeetingTemplates';
import { 
  Upload, 
  FileText, 
  Download, 
  Trash2, 
  Eye,
  FileIcon,
  BookOpen,
  Palette
} from 'lucide-react';
import { showToast } from '@/utils/toastWrapper';

const categoryIcons = {
  format: FileText,
  instruction: BookOpen,
  style: Palette
};

const categoryColors = {
  format: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  instruction: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  style: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300'
};

export const MeetingTemplatesTab: React.FC = () => {
  const {
    templates,
    isLoading,
    isUploading,
    fetchTemplates,
    uploadTemplate,
    deleteTemplate,
    downloadTemplate,
    getTemplateContent
  } = useMeetingTemplates();

  const [selectedCategory, setSelectedCategory] = useState<'format' | 'instruction' | 'style'>('format');
  const [description, setDescription] = useState('');
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<any>(null);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const handleFileUpload = async (files: File[]) => {
    if (files.length === 0) return;

    const file = files[0];
    
    // Validate file type
    const allowedTypes = ['.txt', '.docx', '.pdf', '.json', '.md'];
    const fileExt = '.' + file.name.split('.').pop()?.toLowerCase();
    
    if (!allowedTypes.includes(fileExt)) {
      showToast.error('Please upload .txt, .docx, .pdf, .json, or .md files only', { section: 'meeting_manager' });
      return;
    }

    await uploadTemplate(file, selectedCategory, description);
    setDescription('');
  };

  const handlePreview = async (template: any) => {
    if (template.file_type === 'text/plain' || template.file_type === 'application/json') {
      const content = await getTemplateContent(template);
      setPreviewContent(content);
      setPreviewTemplate(template);
    } else {
      showToast.info('Preview is only available for text and JSON files', { section: 'meeting_manager' });
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'Unknown size';
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    return `${(kb / 1024).toFixed(1)} MB`;
  };

  const groupedTemplates = templates.reduce((acc, template) => {
    if (!acc[template.category]) acc[template.category] = [];
    acc[template.category].push(template);
    return acc;
  }, {} as Record<string, typeof templates>);

  return (
    <div className="space-y-6">
      {/* Upload Section */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Upload New Template
        </h3>
        
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Category</label>
              <Select value={selectedCategory} onValueChange={(value: any) => setSelectedCategory(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="format">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Format Templates
                    </div>
                  </SelectItem>
                  <SelectItem value="instruction">
                    <div className="flex items-center gap-2">
                      <BookOpen className="h-4 w-4" />
                      Instructions
                    </div>
                  </SelectItem>
                  <SelectItem value="style">
                    <div className="flex items-center gap-2">
                      <Palette className="h-4 w-4" />
                      Style Guides
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="text-sm font-medium mb-2 block">Description (Optional)</label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description of this template..."
                className="h-10"
              />
            </div>
          </div>

          <SimpleFileUpload
            onFileUpload={handleFileUpload}
            accept=".txt,.docx,.pdf,.json,.md"
            maxSize={5}
            multiple={false}
            className="border-dashed border-2 border-muted-foreground/25"
          />
          
          {isUploading && (
            <div className="text-sm text-muted-foreground">Uploading template...</div>
          )}
        </div>
      </Card>

      {/* Templates List */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading templates...</div>
        ) : templates.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No templates uploaded yet. Upload your first template above.
          </div>
        ) : (
          Object.entries(groupedTemplates).map(([category, categoryTemplates]) => {
            const Icon = categoryIcons[category as keyof typeof categoryIcons];
            return (
              <Card key={category} className="p-4">
                <h4 className="font-medium mb-3 flex items-center gap-2 capitalize">
                  <Icon className="h-4 w-4" />
                  {category} Templates ({categoryTemplates.length})
                </h4>
                
                <div className="space-y-2">
                  {categoryTemplates.map((template) => (
                    <div key={template.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-3 flex-1">
                        <FileIcon className="h-4 w-4 text-muted-foreground" />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{template.file_name}</div>
                          <div className="text-sm text-muted-foreground flex items-center gap-2">
                            <Badge variant="outline" className={categoryColors[template.category]}>
                              {template.category}
                            </Badge>
                            <span>{formatFileSize(template.file_size)}</span>
                            <span>•</span>
                            <span>{new Date(template.created_at).toLocaleDateString()}</span>
                          </div>
                          {template.description && (
                            <div className="text-xs text-muted-foreground mt-1 truncate">
                              {template.description}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-1">
                        {(template.file_type === 'text/plain' || template.file_type === 'application/json') && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handlePreview(template)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => downloadTemplate(template)}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteTemplate(template.id, template.file_path)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            );
          })
        )}
      </div>

      {/* Preview Modal */}
      {previewContent && previewTemplate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-2xl max-h-[80vh] m-4">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-semibold">Preview: {previewTemplate.file_name}</h3>
              <Button variant="ghost" size="sm" onClick={() => setPreviewContent(null)}>
                ×
              </Button>
            </div>
            <div className="p-4 overflow-auto max-h-[60vh]">
              <pre className="whitespace-pre-wrap text-sm font-mono bg-muted/50 p-4 rounded-lg">
                {previewContent}
              </pre>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};