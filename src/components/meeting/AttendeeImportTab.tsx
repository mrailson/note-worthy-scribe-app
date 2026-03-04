import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, Loader2, CheckSquare, Square, AlertTriangle, UserPlus, Check, X, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { FileProcessorManager } from '@/utils/fileProcessors/FileProcessorManager';
import { showToast } from '@/utils/toastWrapper';

interface ExtractedAttendee {
  name: string;
  email?: string;
  title?: string;
  role?: string;
  organization?: string;
  selected: boolean;
  isDuplicate: boolean;
}

interface ExistingAttendee {
  id: string;
  name: string;
  email?: string;
}

interface AttendeeImportTabProps {
  allAttendees: ExistingAttendee[];
  userPracticeIds: string[];
  userId: string;
  onImportComplete: (newAttendeeIds: string[]) => void;
}

export const AttendeeImportTab: React.FC<AttendeeImportTabProps> = ({
  allAttendees,
  userPracticeIds,
  userId,
  onImportComplete,
}) => {
  const [isExtracting, setIsExtracting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [extractedAttendees, setExtractedAttendees] = useState<ExtractedAttendee[]>([]);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);

  const checkDuplicate = useCallback((name: string) => {
    const normalised = name.trim().toLowerCase();
    return allAttendees.some(a => a.name.trim().toLowerCase() === normalised);
  }, [allAttendees]);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;
    const file = acceptedFiles[0];

    if (!FileProcessorManager.isSupported(file.name)) {
      showToast.error(`Unsupported file type: ${file.name}`);
      return;
    }

    setIsExtracting(true);
    setExtractedAttendees([]);
    setUploadedFileName(file.name);

    try {
      const processed = await FileProcessorManager.processFile(file);
      const text = processed.content;

      if (!text || text.trim().length < 5) {
        showToast.error('No text could be extracted from the file');
        setIsExtracting(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke('generate-demo-response', {
        body: { action: 'extract-attendees', text },
      });

      if (error) throw error;
      if (!data?.success || !Array.isArray(data.attendees)) {
        throw new Error(data?.error || 'Failed to extract attendees');
      }

      const mapped: ExtractedAttendee[] = data.attendees.map((a: any) => ({
        name: a.name,
        email: a.email || '',
        title: a.title || '',
        role: a.role || '',
        organization: a.organization || '',
        selected: true,
        isDuplicate: checkDuplicate(a.name),
      }));

      if (mapped.length === 0) {
        showToast.error('No attendees found in the document');
      } else {
        showToast.success(`Found ${mapped.length} attendee${mapped.length !== 1 ? 's' : ''}`);
      }

      setExtractedAttendees(mapped);
    } catch (err) {
      console.error('Import error:', err);
      showToast.error(err instanceof Error ? err.message : 'Failed to process file');
    } finally {
      setIsExtracting(false);
    }
  }, [checkDuplicate]);

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'text/csv': ['.csv'],
      'text/plain': ['.txt'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
    },
    maxSize: 15 * 1024 * 1024,
    multiple: false,
    noClick: true,
  });

  const toggleAll = (selected: boolean) => {
    setExtractedAttendees(prev => prev.map(a => ({ ...a, selected })));
  };

  const toggleOne = (index: number) => {
    setExtractedAttendees(prev => prev.map((a, i) => i === index ? { ...a, selected: !a.selected } : a));
  };

  const updateField = (index: number, field: keyof ExtractedAttendee, value: string) => {
    setExtractedAttendees(prev => prev.map((a, i) => {
      if (i !== index) return a;
      const updated = { ...a, [field]: value };
      if (field === 'name') updated.isDuplicate = checkDuplicate(value);
      return updated;
    }));
  };

  const removeOne = (index: number) => {
    setExtractedAttendees(prev => prev.filter((_, i) => i !== index));
  };

  const approveSelected = async () => {
    const toApprove = extractedAttendees.filter(a => a.selected && a.name.trim());
    if (toApprove.length === 0) {
      showToast.error('No attendees selected');
      return;
    }

    setIsSaving(true);
    const newIds: string[] = [];

    try {
      let validPracticeId: string | null = null;
      if (userPracticeIds[0]) {
        const { data: check } = await supabase
          .from('gp_practices')
          .select('id')
          .eq('id', userPracticeIds[0])
          .single();
        if (check) validPracticeId = userPracticeIds[0];
      }

      for (const attendee of toApprove) {
        const { data, error } = await supabase
          .from('attendees')
          .insert({
            user_id: userId,
            practice_id: validPracticeId,
            name: attendee.name.trim(),
            email: attendee.email?.trim() || null,
            title: attendee.title?.trim() || null,
            role: attendee.role?.trim() || null,
            organization: attendee.organization?.trim() || null,
            scope: 'local',
          })
          .select('id')
          .single();

        if (error) {
          console.error(`Failed to save ${attendee.name}:`, error);
        } else if (data) {
          newIds.push(data.id);
        }
      }

      showToast.success(`Imported ${newIds.length} attendee${newIds.length !== 1 ? 's' : ''}`, { section: 'meeting_manager' });
      setExtractedAttendees([]);
      setUploadedFileName(null);
      onImportComplete(newIds);
    } catch (err) {
      console.error('Approval error:', err);
      showToast.error('Failed to save attendees');
    } finally {
      setIsSaving(false);
    }
  };

  const selectedCount = extractedAttendees.filter(a => a.selected).length;
  const allSelected = extractedAttendees.length > 0 && selectedCount === extractedAttendees.length;

  return (
    <div className="space-y-4">
      {/* Upload zone */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
          isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-muted-foreground/50'
        }`}
        onClick={(e) => { e.stopPropagation(); open(); }}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center space-y-2">
          {isExtracting ? (
            <>
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Extracting attendees from {uploadedFileName}…</p>
            </>
          ) : (
            <>
              <Upload className="h-6 w-6 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {isDragActive ? 'Drop file here' : 'Drag & drop a file or click to browse'}
              </p>
              <p className="text-xs text-muted-foreground">
                Word, Excel, PDF, CSV, Text, or Image (max 15 MB)
              </p>
              <Button type="button" variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); open(); }}>
                Browse files
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Results */}
      {extractedAttendees.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">{extractedAttendees.length} attendee{extractedAttendees.length !== 1 ? 's' : ''} found</span>
              {uploadedFileName && <Badge variant="outline" className="text-xs">{uploadedFileName}</Badge>}
            </div>
            <Button variant="ghost" size="sm" onClick={() => toggleAll(!allSelected)}>
              {allSelected ? <Square className="h-4 w-4 mr-1" /> : <CheckSquare className="h-4 w-4 mr-1" />}
              {allSelected ? 'Deselect All' : 'Select All'}
            </Button>
          </div>

          <div className="space-y-2 max-h-[350px] overflow-y-auto">
            {extractedAttendees.map((attendee, index) => (
              <Card key={index} className={`transition-colors ${attendee.selected ? 'border-primary/50 bg-primary/5' : 'opacity-60'}`}>
                <CardContent className="p-3">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={attendee.selected}
                      onCheckedChange={() => toggleOne(index)}
                      className="mt-1"
                    />
                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs text-muted-foreground">Name *</Label>
                        <Input
                          value={attendee.name}
                          onChange={(e) => updateField(index, 'name', e.target.value)}
                          className="h-8 text-sm"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Email</Label>
                        <Input
                          value={attendee.email || ''}
                          onChange={(e) => updateField(index, 'email', e.target.value)}
                          className="h-8 text-sm"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Role</Label>
                        <Input
                          value={attendee.role || ''}
                          onChange={(e) => updateField(index, 'role', e.target.value)}
                          className="h-8 text-sm"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Organisation</Label>
                        <Input
                          value={attendee.organization || ''}
                          onChange={(e) => updateField(index, 'organization', e.target.value)}
                          className="h-8 text-sm"
                        />
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {attendee.isDuplicate && (
                        <Badge variant="outline" className="text-xs text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-950 dark:text-amber-400 whitespace-nowrap">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Exists
                        </Badge>
                      )}
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeOne(index)}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="outline" onClick={() => { setExtractedAttendees([]); setUploadedFileName(null); }}>
              Clear
            </Button>
            <Button onClick={approveSelected} disabled={isSaving || selectedCount === 0}>
              {isSaving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <UserPlus className="h-4 w-4 mr-2" />
              )}
              {isSaving ? 'Saving…' : `Approve ${selectedCount > 0 ? selectedCount : ''} Selected`}
            </Button>
          </div>
        </>
      )}
    </div>
  );
};
