import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface DocumentFile {
  id: string;
  name: string;
  type: 'pdf' | 'word' | 'image' | 'text' | 'rtf' | 'email' | 'unknown';
  size: number;
  status: 'pending' | 'parsing' | 'parsed' | 'failed';
  extractedText?: string;
  error?: string;
}

interface FolderAnalysisState {
  isSupported: boolean;
  isProcessing: boolean;
  folderName: string | null;
  documents: DocumentFile[];
  combinedText: string | null;
}

// Check if running in iframe (showDirectoryPicker doesn't work in cross-origin iframes)
const isInIframe = typeof window !== 'undefined' && window.self !== window.top;

export function useFolderDocumentAnalysis() {
  const apiSupported = typeof window !== 'undefined' && 'showDirectoryPicker' in window;
  const isSupported = apiSupported && !isInIframe;
  
  const [state, setState] = useState<FolderAnalysisState>({
    isSupported,
    isProcessing: false,
    folderName: null,
    documents: [],
    combinedText: null
  });

  const directoryHandleRef = useRef<FileSystemDirectoryHandle | null>(null);

  const getFileType = (name: string, mimeType?: string): DocumentFile['type'] => {
    const ext = name.toLowerCase().split('.').pop();
    if (ext === 'pdf') return 'pdf';
    if (ext === 'docx' || ext === 'doc') return 'word';
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(ext || '')) return 'image';
    if (ext === 'txt' || ext === 'text') return 'text';
    if (ext === 'rtf') return 'rtf';
    if (['eml', 'msg', 'emlx'].includes(ext || '')) return 'email';
    return 'unknown';
  };

  const parseDocument = async (file: File, fileType: DocumentFile['type']): Promise<string> => {
    if (fileType === 'unknown') {
      throw new Error('Unsupported file type');
    }

    // Convert file to base64 data URL
    const arrayBuffer = await file.arrayBuffer();
    const base64 = btoa(
      new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
    );
    const mimeType = file.type || 'application/octet-stream';
    const dataUrl = `data:${mimeType};base64,${base64}`;

    // Call edge function to extract text
    const { data, error } = await supabase.functions.invoke('extract-document-text', {
      body: {
        fileType: fileType === 'word' ? 'word' : fileType,
        dataUrl,
        fileName: file.name
      }
    });

    if (error) {
      throw new Error(`Failed to parse document: ${error.message}`);
    }

    return data?.text || data?.extractedText || '';
  };

  const selectAndProcessFolder = useCallback(async () => {
    if (!isSupported) {
      toast.error('Folder selection is not supported in your browser. Please use Chrome or Edge.');
      return;
    }

    try {
      // @ts-ignore - TypeScript doesn't know about showDirectoryPicker
      const handle = await window.showDirectoryPicker({
        mode: 'read'
      });

      directoryHandleRef.current = handle;
      
      setState(prev => ({
        ...prev,
        isProcessing: true,
        folderName: handle.name,
        documents: [],
        combinedText: null
      }));

      // Collect all supported files
      const files: { handle: FileSystemFileHandle; name: string }[] = [];
      
      // @ts-ignore
      for await (const [name, entryHandle] of handle.entries()) {
        if (entryHandle.kind === 'file') {
          const fileType = getFileType(name);
          if (fileType !== 'unknown') {
            files.push({ handle: entryHandle as FileSystemFileHandle, name });
          }
        }
      }

      if (files.length === 0) {
        toast.error('No supported documents found in folder. Supported: PDF, Word, Images, TXT, RTF, Email (EML/MSG)');
        setState(prev => ({ ...prev, isProcessing: false }));
        return;
      }

      // Create document entries
      const documents: DocumentFile[] = files.map((f, idx) => ({
        id: `doc-${idx}`,
        name: f.name,
        type: getFileType(f.name),
        size: 0,
        status: 'pending' as const
      }));

      setState(prev => ({ ...prev, documents }));

      // Process each file
      const extractedTexts: string[] = [];
      
      for (let i = 0; i < files.length; i++) {
        const { handle: fileHandle, name } = files[i];
        
        setState(prev => ({
          ...prev,
          documents: prev.documents.map((d, idx) => 
            idx === i ? { ...d, status: 'parsing' as const } : d
          )
        }));

        try {
          const file = await fileHandle.getFile();
          const fileType = getFileType(name);
          const text = await parseDocument(file, fileType);
          
          extractedTexts.push(`\n\n=== DOCUMENT: ${name} ===\n\n${text}`);
          
          setState(prev => ({
            ...prev,
            documents: prev.documents.map((d, idx) => 
              idx === i ? { ...d, status: 'parsed' as const, extractedText: text, size: file.size } : d
            )
          }));
        } catch (err) {
          console.error(`Failed to parse ${name}:`, err);
          setState(prev => ({
            ...prev,
            documents: prev.documents.map((d, idx) => 
              idx === i ? { ...d, status: 'failed' as const, error: err instanceof Error ? err.message : 'Unknown error' } : d
            )
          }));
        }
      }

      const combinedText = extractedTexts.join('\n');
      
      setState(prev => ({
        ...prev,
        isProcessing: false,
        combinedText
      }));

      const successCount = documents.filter(d => d.status !== 'failed').length;
      toast.success(`Processed ${successCount} of ${files.length} documents`);

    } catch (err) {
      console.error('Folder selection error:', err);
      if ((err as Error).name !== 'AbortError') {
        toast.error('Failed to access folder');
      }
      setState(prev => ({ ...prev, isProcessing: false }));
    }
  }, [isSupported]);

  const reset = useCallback(() => {
    directoryHandleRef.current = null;
    setState({
      isSupported,
      isProcessing: false,
      folderName: null,
      documents: [],
      combinedText: null
    });
  }, [isSupported]);

  return {
    ...state,
    selectAndProcessFolder,
    reset
  };
}
