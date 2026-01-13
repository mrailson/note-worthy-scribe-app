import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, ClipboardPaste, Image, Sparkles, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { parseAttendeesFromText } from '@/utils/meeting/parseAttendeesFromText';
import { BulkImportPreview } from './BulkImportPreview';

export interface ParsedAttendee {
  id: string;
  name: string;
  email?: string;
  organization?: string;
  organizationType?: string;
  role?: string;
  title?: string;
  selected: boolean;
  isDuplicate?: boolean;
  isNew?: boolean;
  confidence?: number;
}

interface BulkAttendeeImporterProps {
  existingAttendees: Array<{ name: string; email?: string }>;
  onImport: (attendees: ParsedAttendee[]) => Promise<void>;
  onCancel: () => void;
}

export function BulkAttendeeImporter({ existingAttendees, onImport, onCancel }: BulkAttendeeImporterProps) {
  const [pasteText, setPasteText] = useState('');
  const [parsedAttendees, setParsedAttendees] = useState<ParsedAttendee[] | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [importSource, setImportSource] = useState<'paste' | 'file' | 'email'>('paste');

  const normalizeForComparison = (str: string) => str.toLowerCase().trim().replace(/\s+/g, ' ');

  const checkForDuplicates = useCallback((attendees: ParsedAttendee[]): ParsedAttendee[] => {
    const existingNames = new Set(existingAttendees.map(a => normalizeForComparison(a.name)));
    const existingEmails = new Set(
      existingAttendees
        .filter(a => a.email)
        .map(a => normalizeForComparison(a.email!))
    );

    return attendees.map(attendee => {
      const nameMatch = existingNames.has(normalizeForComparison(attendee.name));
      const emailMatch = attendee.email && existingEmails.has(normalizeForComparison(attendee.email));
      const isDuplicate = nameMatch || emailMatch;
      
      return {
        ...attendee,
        isDuplicate,
        isNew: !isDuplicate,
        selected: !isDuplicate, // Auto-deselect duplicates
      };
    });
  }, [existingAttendees]);

  const parseTextInput = useCallback((text: string) => {
    if (!text.trim()) {
      toast.error('Please enter some text to parse');
      return;
    }

    setIsParsing(true);
    
    try {
      const parsed = parseAttendeesFromText(text);
      
      if (parsed.length === 0) {
        toast.error('No attendees found in the text. Try a different format.');
        setIsParsing(false);
        return;
      }

      const attendeesWithIds: ParsedAttendee[] = parsed.map((a, index) => ({
        id: `parsed-${index}-${Date.now()}`,
        name: a.name,
        organization: a.organization,
        role: a.role,
        selected: true,
        confidence: 0.9,
      }));

      const withDuplicateCheck = checkForDuplicates(attendeesWithIds);
      setParsedAttendees(withDuplicateCheck);
      
      const duplicateCount = withDuplicateCheck.filter(a => a.isDuplicate).length;
      const newCount = withDuplicateCheck.filter(a => a.isNew).length;
      
      toast.success(
        `Found ${withDuplicateCheck.length} attendees` + 
        (duplicateCount > 0 ? ` (${duplicateCount} duplicates auto-deselected)` : '')
      );
    } catch (error) {
      console.error('Parse error:', error);
      toast.error('Failed to parse attendees');
    } finally {
      setIsParsing(false);
    }
  }, [checkForDuplicates]);

  const parseEmailInput = useCallback((text: string) => {
    if (!text.trim()) {
      toast.error('Please paste email headers or a distribution list');
      return;
    }

    setIsParsing(true);
    
    try {
      const attendees: ParsedAttendee[] = [];
      const seenEmails = new Set<string>();
      
      // Parse various email formats
      // Format: "Name" <email@domain.com> or Name <email@domain.com>
      const emailWithNameRegex = /"?([^"<]+)"?\s*<([^>]+)>/g;
      let match;
      
      while ((match = emailWithNameRegex.exec(text)) !== null) {
        const name = match[1].trim();
        const email = match[2].trim().toLowerCase();
        
        if (!seenEmails.has(email) && name) {
          seenEmails.add(email);
          attendees.push({
            id: `email-${attendees.length}-${Date.now()}`,
            name,
            email,
            selected: true,
            confidence: 0.95,
          });
        }
      }
      
      // Also parse simple email addresses
      const simpleEmailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
      while ((match = simpleEmailRegex.exec(text)) !== null) {
        const email = match[1].toLowerCase();
        if (!seenEmails.has(email)) {
          seenEmails.add(email);
          // Try to derive name from email
          const namePart = email.split('@')[0];
          const name = namePart
            .replace(/[._]/g, ' ')
            .replace(/\d+/g, '')
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ')
            .trim();
          
          if (name) {
            attendees.push({
              id: `email-${attendees.length}-${Date.now()}`,
              name,
              email,
              selected: true,
              confidence: 0.7,
            });
          }
        }
      }
      
      // Also try the regular text parser as fallback
      const textParsed = parseAttendeesFromText(text);
      for (const a of textParsed) {
        const normalizedName = normalizeForComparison(a.name);
        const alreadyAdded = attendees.some(
          existing => normalizeForComparison(existing.name) === normalizedName
        );
        
        if (!alreadyAdded) {
          attendees.push({
            id: `text-${attendees.length}-${Date.now()}`,
            name: a.name,
            organization: a.organization,
            role: a.role,
            selected: true,
            confidence: 0.85,
          });
        }
      }
      
      if (attendees.length === 0) {
        toast.error('No email addresses or names found');
        setIsParsing(false);
        return;
      }

      const withDuplicateCheck = checkForDuplicates(attendees);
      setParsedAttendees(withDuplicateCheck);
      
      const duplicateCount = withDuplicateCheck.filter(a => a.isDuplicate).length;
      toast.success(
        `Found ${attendees.length} attendees from email` +
        (duplicateCount > 0 ? ` (${duplicateCount} duplicates)` : '')
      );
    } catch (error) {
      console.error('Email parse error:', error);
      toast.error('Failed to parse email addresses');
    } finally {
      setIsParsing(false);
    }
  }, [checkForDuplicates]);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;
    
    setIsParsing(true);
    const file = acceptedFiles[0];
    
    try {
      // Handle text files
      if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
        const text = await file.text();
        parseTextInput(text);
        return;
      }
      
      // Handle CSV files
      if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
        const text = await file.text();
        const lines = text.split('\n').filter(l => l.trim());
        
        if (lines.length === 0) {
          toast.error('CSV file is empty');
          setIsParsing(false);
          return;
        }
        
        // Try to detect header row
        const firstLine = lines[0].toLowerCase();
        const hasHeader = firstLine.includes('name') || firstLine.includes('email');
        const dataLines = hasHeader ? lines.slice(1) : lines;
        
        const attendees: ParsedAttendee[] = [];
        
        for (let i = 0; i < dataLines.length; i++) {
          const line = dataLines[i];
          const parts = line.split(',').map(p => p.trim().replace(/^["']|["']$/g, ''));
          
          if (parts.length >= 1 && parts[0]) {
            attendees.push({
              id: `csv-${i}-${Date.now()}`,
              name: parts[0],
              email: parts[1] || undefined,
              organization: parts[2] || undefined,
              role: parts[3] || undefined,
              selected: true,
              confidence: 0.95,
            });
          }
        }
        
        if (attendees.length === 0) {
          toast.error('No attendees found in CSV');
          setIsParsing(false);
          return;
        }
        
        const withDuplicateCheck = checkForDuplicates(attendees);
        setParsedAttendees(withDuplicateCheck);
        toast.success(`Imported ${attendees.length} attendees from CSV`);
        return;
      }
      
      // For other file types, try to read as text
      const text = await file.text();
      parseTextInput(text);
      
    } catch (error) {
      console.error('File read error:', error);
      toast.error('Failed to read file');
    } finally {
      setIsParsing(false);
    }
  }, [parseTextInput, checkForDuplicates]);

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: {
      'text/plain': ['.txt'],
      'text/csv': ['.csv'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
    },
    maxFiles: 1,
    noClick: true,
    noKeyboard: true,
  });

  const handleParse = () => {
    if (importSource === 'email') {
      parseEmailInput(pasteText);
    } else {
      parseTextInput(pasteText);
    }
  };

  const handleBack = () => {
    setParsedAttendees(null);
    setPasteText('');
  };

  // Show preview if we have parsed attendees
  if (parsedAttendees) {
    return (
      <BulkImportPreview
        attendees={parsedAttendees}
        onAttendeeChange={setParsedAttendees}
        onImport={onImport}
        onBack={handleBack}
        onCancel={onCancel}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center pb-4 border-b">
        <h2 className="text-xl font-semibold text-foreground">Bulk Import Attendees</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Import multiple attendees at once from various sources
        </p>
      </div>

      <Tabs value={importSource} onValueChange={(v) => setImportSource(v as typeof importSource)} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="paste" className="gap-2">
            <ClipboardPaste className="h-4 w-4" />
            Paste List
          </TabsTrigger>
          <TabsTrigger value="file" className="gap-2">
            <FileText className="h-4 w-4" />
            Upload File
          </TabsTrigger>
          <TabsTrigger value="email" className="gap-2">
            <Mail className="h-4 w-4" />
            Email Headers
          </TabsTrigger>
        </TabsList>

        <TabsContent value="paste" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Paste Attendee List</CardTitle>
              <CardDescription>
                Paste a list of names from Teams, Outlook, or any text source
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder={`Paste attendee names here. Supported formats:\n\n• One name per line\n• Comma-separated: John Smith, Jane Doe\n• With organisation: John Smith (NHS Trust)\n• With role: John Smith - GP Partner\n• Teams format: John Smith (Guest)\n• Outlook format: Smith, John`}
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                className="min-h-[200px] font-mono text-sm"
              />
              
              <div className="flex gap-3 justify-end">
                <Button variant="outline" onClick={onCancel}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleParse} 
                  disabled={!pasteText.trim() || isParsing}
                  className="gap-2"
                >
                  <Sparkles className="h-4 w-4" />
                  {isParsing ? 'Parsing...' : 'Parse Attendees'}
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <Card className="p-4">
              <h4 className="font-medium mb-2 flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                Supported Formats
              </h4>
              <ul className="text-muted-foreground space-y-1 text-xs">
                <li>• Teams participant lists</li>
                <li>• Outlook meeting invites</li>
                <li>• Simple name lists</li>
                <li>• CSV format</li>
              </ul>
            </Card>
            <Card className="p-4">
              <h4 className="font-medium mb-2 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                Auto-Detection
              </h4>
              <ul className="text-muted-foreground space-y-1 text-xs">
                <li>• Names & organisations</li>
                <li>• Roles & titles</li>
                <li>• Duplicate detection</li>
                <li>• Email addresses</li>
              </ul>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="file" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Upload File</CardTitle>
              <CardDescription>
                Drag and drop or browse for a file containing attendee names
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div
                {...getRootProps()}
                className={`
                  border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
                  transition-colors duration-200
                  ${isDragActive 
                    ? 'border-primary bg-primary/5' 
                    : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50'
                  }
                `}
                onClick={open}
              >
                <input {...getInputProps()} />
                <Upload className={`h-10 w-10 mx-auto mb-4 ${isDragActive ? 'text-primary' : 'text-muted-foreground'}`} />
                {isDragActive ? (
                  <p className="text-primary font-medium">Drop the file here...</p>
                ) : (
                  <>
                    <p className="font-medium text-foreground">Drag & drop a file here</p>
                    <p className="text-sm text-muted-foreground mt-1">or click to browse</p>
                    <p className="text-xs text-muted-foreground mt-3">
                      Supports: .txt, .csv, .xlsx
                    </p>
                  </>
                )}
              </div>
              
              <div className="flex justify-end mt-4">
                <Button variant="outline" onClick={onCancel}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="email" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Paste Email Headers</CardTitle>
              <CardDescription>
                Paste email To/CC fields, distribution lists, or Outlook address book entries
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder={`Paste email addresses here. Supported formats:\n\n• "John Smith" <john.smith@nhs.net>\n• John Smith <john@example.com>; Jane Doe <jane@example.com>\n• To: john@nhs.net, jane@nhs.net\n• Distribution list entries`}
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                className="min-h-[200px] font-mono text-sm"
              />
              
              <div className="flex gap-3 justify-end">
                <Button variant="outline" onClick={onCancel}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleParse} 
                  disabled={!pasteText.trim() || isParsing}
                  className="gap-2"
                >
                  <Mail className="h-4 w-4" />
                  {isParsing ? 'Parsing...' : 'Extract Contacts'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
