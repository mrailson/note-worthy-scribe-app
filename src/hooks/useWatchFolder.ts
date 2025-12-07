import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLGUploadQueue } from '@/contexts/LGUploadQueueContext';
import { extractPdfPages } from '@/utils/pdfPageExtractor';
import { generateULID } from '@/utils/ulid';
import { toast } from 'sonner';
import { CapturedImage } from '@/hooks/useLGCapture';

interface WatchFolderState {
  isSupported: boolean;
  isWatching: boolean;
  folderName: string | null;
  pollingInterval: number;
  processedFiles: string[];
  recentActivity: ActivityLogEntry[];
}

export interface ActivityLogEntry {
  id: string;
  fileName: string;
  timestamp: Date;
  status: 'detected' | 'processing' | 'queued' | 'failed';
  error?: string;
}

export function useWatchFolder(
  practiceOds: string,
  uploaderName: string,
  batchId: string
) {
  const { user } = useAuth();
  const { queuePatient } = useLGUploadQueue();
  
  const [state, setState] = useState<WatchFolderState>({
    isSupported: typeof window !== 'undefined' && 'showDirectoryPicker' in window,
    isWatching: false,
    folderName: null,
    pollingInterval: 30,
    processedFiles: [],
    recentActivity: []
  });

  const directoryHandleRef = useRef<FileSystemDirectoryHandle | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const processedFilesRef = useRef<Set<string>>(new Set());

  // Load processed files from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('lg_watch_processed_files');
    if (stored) {
      try {
        const files = JSON.parse(stored) as string[];
        processedFilesRef.current = new Set(files);
        setState(prev => ({ ...prev, processedFiles: files }));
      } catch {
        // Ignore parse errors
      }
    }
  }, []);

  // Save processed files to localStorage
  const saveProcessedFiles = useCallback(() => {
    const files = Array.from(processedFilesRef.current);
    localStorage.setItem('lg_watch_processed_files', JSON.stringify(files));
    setState(prev => ({ ...prev, processedFiles: files }));
  }, []);

  const addActivity = useCallback((entry: Omit<ActivityLogEntry, 'id' | 'timestamp'>) => {
    const newEntry: ActivityLogEntry = {
      ...entry,
      id: crypto.randomUUID(),
      timestamp: new Date()
    };
    setState(prev => ({
      ...prev,
      recentActivity: [newEntry, ...prev.recentActivity].slice(0, 50)
    }));
  }, []);

  const processFile = useCallback(async (file: File) => {
    if (!user?.id || !practiceOds || !uploaderName) {
      addActivity({ fileName: file.name, status: 'failed', error: 'Settings not configured' });
      return;
    }

    addActivity({ fileName: file.name, status: 'detected' });

    try {
      addActivity({ fileName: file.name, status: 'processing' });

      // Extract pages from PDF
      const pages = await extractPdfPages(file, 150, undefined, true);

      // Create patient record
      const patientId = generateULID();
      
      const { error: insertError } = await supabase
        .from('lg_patients')
        .insert({
          id: patientId,
          user_id: user.id,
          practice_ods: practiceOds,
          uploader_name: uploaderName,
          job_status: 'draft',
          images_count: pages.length,
          sex: 'unknown',
          batch_id: batchId
        });

      if (insertError) {
        throw new Error(`Failed to create patient record: ${insertError.message}`);
      }

      // Convert to CapturedImage format
      const capturedImages: CapturedImage[] = pages
        .filter(p => !p.isBlank)
        .map((page, index) => ({
          id: `${patientId}-page-${index + 1}`,
          dataUrl: page.dataUrl,
          timestamp: Date.now()
        }));

      // Queue for upload
      queuePatient(patientId, practiceOds, capturedImages);

      // Mark as processed
      processedFilesRef.current.add(file.name);
      saveProcessedFiles();

      addActivity({ fileName: file.name, status: 'queued' });
      toast.success(`Auto-imported: ${file.name}`);

    } catch (err) {
      console.error('Error processing watched file:', file.name, err);
      addActivity({ 
        fileName: file.name, 
        status: 'failed', 
        error: err instanceof Error ? err.message : 'Unknown error' 
      });
    }
  }, [user?.id, practiceOds, uploaderName, batchId, queuePatient, addActivity, saveProcessedFiles]);

  const pollFolder = useCallback(async () => {
    if (!directoryHandleRef.current) return;

    try {
      // Iterate through files in the directory using async iterator
      const dirHandle = directoryHandleRef.current as any;
      const entries: FileSystemHandle[] = [];
      
      // Use async iterator pattern for directory entries
      for await (const [name, handle] of dirHandle.entries()) {
        if (handle.kind === 'file' && name.toLowerCase().endsWith('.pdf')) {
          // Skip already processed files
          if (processedFilesRef.current.has(name)) continue;

          // Get the file
          const file = await (handle as FileSystemFileHandle).getFile();
          
          // Process the file
          await processFile(file);
        }
      }
    } catch (err) {
      console.error('Error polling folder:', err);
      // Handle permission errors - folder may have been moved/deleted
      if (err instanceof DOMException && err.name === 'NotAllowedError') {
        stopWatching();
        toast.error('Folder access lost. Please re-select the watch folder.');
      }
    }
  }, [processFile]);

  const selectFolder = useCallback(async () => {
    if (!state.isSupported) {
      toast.error('Watch Folder requires Chrome or Edge browser');
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
        folderName: handle.name,
        isWatching: false 
      }));

      toast.success(`Folder selected: ${handle.name}`);
    } catch (err) {
      // User cancelled
      if (err instanceof DOMException && err.name === 'AbortError') return;
      console.error('Error selecting folder:', err);
      toast.error('Failed to select folder');
    }
  }, [state.isSupported]);

  const startWatching = useCallback(() => {
    if (!directoryHandleRef.current) {
      toast.error('Please select a folder first');
      return;
    }

    if (!practiceOds || !uploaderName) {
      toast.error('Please configure practice settings first');
      return;
    }

    // Start polling
    pollingIntervalRef.current = setInterval(pollFolder, state.pollingInterval * 1000);
    
    // Do an immediate poll
    pollFolder();

    setState(prev => ({ ...prev, isWatching: true }));
    toast.success('Watch folder enabled - new PDFs will be auto-imported');
  }, [pollFolder, state.pollingInterval, practiceOds, uploaderName]);

  const stopWatching = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    setState(prev => ({ ...prev, isWatching: false }));
  }, []);

  const setPollingInterval = useCallback((seconds: number) => {
    setState(prev => ({ ...prev, pollingInterval: seconds }));
    
    // Restart polling with new interval if currently watching
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = setInterval(pollFolder, seconds * 1000);
    }
  }, [pollFolder]);

  const clearProcessedFiles = useCallback(() => {
    processedFilesRef.current.clear();
    localStorage.removeItem('lg_watch_processed_files');
    setState(prev => ({ ...prev, processedFiles: [] }));
    toast.success('Processed files list cleared');
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  return {
    ...state,
    selectFolder,
    startWatching,
    stopWatching,
    setPollingInterval,
    clearProcessedFiles
  };
}