import { useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useSurveyImport, ImportedQuestion, ImportResult } from '@/hooks/useSurveyImport';
import { useDropzone } from 'react-dropzone';
import { 
  Upload, 
  FileText, 
  Image, 
  Table, 
  Presentation, 
  FileSpreadsheet,
  Loader2,
  Trash2,
  Plus,
  GripVertical,
  AlertCircle,
  CheckCircle2,
  Pencil,
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SurveyImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (title: string, questions: ImportedQuestion[]) => void;
  currentTitle?: string;
}

const questionTypeLabels: Record<string, string> = {
  rating: 'Rating (1-5)',
  text: 'Free Text',
  multiple_choice: 'Multiple Choice',
  yes_no: 'Yes/No',
  scale: 'Scale (1-10)',
};

const ACCEPTED_FILES = {
  'application/msword': ['.doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/vnd.ms-excel': ['.xls'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'application/vnd.ms-powerpoint': ['.ppt'],
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
  'application/pdf': ['.pdf'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/gif': ['.gif'],
  'image/webp': ['.webp'],
};

export function SurveyImportModal({ open, onOpenChange, onImport, currentTitle }: SurveyImportModalProps) {
  const { processFile, isProcessing, progress } = useSurveyImport();
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [editingTitle, setEditingTitle] = useState<string>('');
  const [editingQuestions, setEditingQuestions] = useState<ImportedQuestion[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingOptionIndex, setEditingOptionIndex] = useState<number | null>(null);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;
    
    const file = acceptedFiles[0];
    const result = await processFile(file);
    
    if (result) {
      setImportResult(result);
      setEditingTitle(result.title);
      setEditingQuestions(result.questions.map(q => ({ ...q })));
    }
  }, [processFile]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED_FILES,
    maxFiles: 1,
    disabled: isProcessing,
  });

  const handleReset = () => {
    setImportResult(null);
    setEditingTitle('');
    setEditingQuestions([]);
    setEditingIndex(null);
  };

  const handleClose = () => {
    handleReset();
    onOpenChange(false);
  };

  const handleImport = () => {
    if (editingQuestions.length === 0) return;
    onImport(editingTitle, editingQuestions);
    handleClose();
  };

  const updateQuestion = (index: number, updates: Partial<ImportedQuestion>) => {
    setEditingQuestions(prev => 
      prev.map((q, i) => i === index ? { ...q, ...updates } : q)
    );
  };

  const removeQuestion = (index: number) => {
    setEditingQuestions(prev => prev.filter((_, i) => i !== index));
    if (editingIndex === index) setEditingIndex(null);
  };

  const addQuestion = () => {
    setEditingQuestions(prev => [
      ...prev,
      {
        question_text: '',
        question_type: 'rating',
        options: [],
        is_required: true,
        confidence: 1.0,
      },
    ]);
    setEditingIndex(editingQuestions.length);
  };

  const addOption = (questionIndex: number) => {
    const q = editingQuestions[questionIndex];
    updateQuestion(questionIndex, { options: [...q.options, ''] });
    setEditingOptionIndex(q.options.length);
  };

  const updateOption = (questionIndex: number, optionIndex: number, value: string) => {
    const q = editingQuestions[questionIndex];
    const newOptions = [...q.options];
    newOptions[optionIndex] = value;
    updateQuestion(questionIndex, { options: newOptions });
  };

  const removeOption = (questionIndex: number, optionIndex: number) => {
    const q = editingQuestions[questionIndex];
    updateQuestion(questionIndex, { 
      options: q.options.filter((_, i) => i !== optionIndex) 
    });
  };

  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 0.8) {
      return <Badge variant="default" className="bg-green-500/20 text-green-700 border-green-300"><CheckCircle2 className="h-3 w-3 mr-1" />High</Badge>;
    }
    if (confidence >= 0.5) {
      return <Badge variant="secondary" className="bg-amber-500/20 text-amber-700 border-amber-300"><AlertCircle className="h-3 w-3 mr-1" />Medium</Badge>;
    }
    return <Badge variant="outline" className="bg-red-500/10 text-red-700 border-red-300"><AlertCircle className="h-3 w-3 mr-1" />Low</Badge>;
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Import Survey Questions</DialogTitle>
          <DialogDescription>
            Upload a Word document, Excel spreadsheet, PowerPoint, PDF, or image (including handwritten notes) to extract survey questions.
          </DialogDescription>
        </DialogHeader>

        {!importResult ? (
          <div className="space-y-4">
            <div
              {...getRootProps()}
              className={cn(
                'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
                isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50',
                isProcessing && 'opacity-50 cursor-not-allowed'
              )}
            >
              <input {...getInputProps()} />
              
              {isProcessing ? (
                <div className="space-y-3">
                  <Loader2 className="h-10 w-10 mx-auto animate-spin text-primary" />
                  <p className="text-sm font-medium">{progress || 'Processing...'}</p>
                </div>
              ) : (
                <>
                  <Upload className="h-10 w-10 mx-auto mb-4 text-muted-foreground" />
                  <p className="font-medium mb-2">
                    {isDragActive ? 'Drop the file here' : 'Drag & drop a file here, or click to browse'}
                  </p>
                  <div className="flex items-center justify-center gap-2 flex-wrap text-muted-foreground text-sm">
                    <span className="flex items-center gap-1"><FileText className="h-4 w-4" />Word</span>
                    <span className="flex items-center gap-1"><FileSpreadsheet className="h-4 w-4" />Excel</span>
                    <span className="flex items-center gap-1"><Presentation className="h-4 w-4" />PowerPoint</span>
                    <span className="flex items-center gap-1"><Table className="h-4 w-4" />PDF</span>
                    <span className="flex items-center gap-1"><Image className="h-4 w-4" />Images</span>
                  </div>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col min-h-0 space-y-4">
            {/* Title Editor */}
            <div className="space-y-2">
              <Label htmlFor="import-title">Survey Title</Label>
              <Input
                id="import-title"
                value={editingTitle}
                onChange={(e) => setEditingTitle(e.target.value)}
                placeholder="Enter survey title..."
              />
              {currentTitle && editingTitle !== currentTitle && (
                <p className="text-xs text-muted-foreground">
                  This will update the current title "{currentTitle}"
                </p>
              )}
            </div>

            {/* Questions List */}
            <div className="flex items-center justify-between">
              <Label>Extracted Questions ({editingQuestions.length})</Label>
              <Button variant="outline" size="sm" onClick={addQuestion}>
                <Plus className="h-4 w-4 mr-1" />
                Add Question
              </Button>
            </div>

            <ScrollArea className="flex-1 min-h-0 -mx-6 px-6">
              <div className="space-y-3 pb-4">
                {editingQuestions.length === 0 ? (
                  <div className="text-center py-8 border-2 border-dashed rounded-lg">
                    <p className="text-muted-foreground">No questions extracted. Add questions manually or try a different file.</p>
                  </div>
                ) : (
                  editingQuestions.map((question, index) => (
                    <div
                      key={index}
                      className={cn(
                        'border rounded-lg p-4 space-y-3 transition-colors',
                        editingIndex === index ? 'border-primary bg-primary/5' : 'bg-card'
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div className="text-muted-foreground mt-1 cursor-grab">
                          <GripVertical className="h-4 w-4" />
                        </div>
                        
                        <div className="flex-1 space-y-3">
                          <div className="flex items-start justify-between gap-2">
                            <span className="font-medium text-sm text-muted-foreground">Q{index + 1}</span>
                            <div className="flex items-center gap-2">
                              {getConfidenceBadge(question.confidence)}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => setEditingIndex(editingIndex === index ? null : index)}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive hover:text-destructive"
                                onClick={() => removeQuestion(index)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>

                          {editingIndex === index ? (
                            <div className="space-y-3">
                              <Input
                                value={question.question_text}
                                onChange={(e) => updateQuestion(index, { question_text: e.target.value })}
                                placeholder="Enter question text..."
                                autoFocus
                              />
                              
                              <div className="flex items-center gap-4">
                                <div className="flex-1">
                                  <Select
                                    value={question.question_type}
                                    onValueChange={(value) => updateQuestion(index, { 
                                      question_type: value as ImportedQuestion['question_type'] 
                                    })}
                                  >
                                    <SelectTrigger className="h-9">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {Object.entries(questionTypeLabels).map(([value, label]) => (
                                        <SelectItem key={value} value={value}>{label}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                
                                <div className="flex items-center gap-2">
                                  <Switch
                                    id={`required-${index}`}
                                    checked={question.is_required}
                                    onCheckedChange={(checked) => updateQuestion(index, { is_required: checked })}
                                  />
                                  <Label htmlFor={`required-${index}`} className="text-sm">Required</Label>
                                </div>
                              </div>

                              {question.question_type === 'multiple_choice' && (
                                <div className="space-y-2 pl-4 border-l-2 border-muted">
                                  <Label className="text-xs text-muted-foreground">Options</Label>
                                  {question.options.map((option, optIndex) => (
                                    <div key={optIndex} className="flex items-center gap-2">
                                      <Input
                                        value={option}
                                        onChange={(e) => updateOption(index, optIndex, e.target.value)}
                                        placeholder={`Option ${optIndex + 1}`}
                                        className="h-8"
                                        autoFocus={editingOptionIndex === optIndex}
                                      />
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 shrink-0"
                                        onClick={() => removeOption(index, optIndex)}
                                      >
                                        <X className="h-3.5 w-3.5" />
                                      </Button>
                                    </div>
                                  ))}
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 text-xs"
                                    onClick={() => addOption(index)}
                                  >
                                    <Plus className="h-3 w-3 mr-1" />
                                    Add Option
                                  </Button>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div>
                              <p className="text-sm">{question.question_text || <span className="text-muted-foreground italic">Empty question</span>}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant="outline" className="text-xs">{questionTypeLabels[question.question_type]}</Badge>
                                {question.is_required && <Badge variant="secondary" className="text-xs">Required</Badge>}
                                {question.question_type === 'multiple_choice' && question.options.length > 0 && (
                                  <span className="text-xs text-muted-foreground">{question.options.length} options</span>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>

            {/* Actions */}
            <div className="flex items-center justify-between pt-4 border-t">
              <Button variant="outline" onClick={handleReset}>
                Upload Different File
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleClose}>
                  Cancel
                </Button>
                <Button onClick={handleImport} disabled={editingQuestions.length === 0}>
                  Import {editingQuestions.length} Question{editingQuestions.length !== 1 ? 's' : ''}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
