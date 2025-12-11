import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLGUploadQueue } from '@/contexts/LGUploadQueueContext';
import { extractPdfPages } from '@/utils/pdfPageExtractor';
import { generateULID } from '@/utils/ulid';
import { generateLGFilename } from '@/utils/lgFilenameGenerator';
import { toast } from 'sonner';
import { CapturedImage } from '@/hooks/useLGCapture';

interface WatchFolderState {
  isSupported: boolean;
  isWatching: boolean;
  folderName: string | null;
  pollingInterval: number;
  processedFiles: string[];
  recentActivity: ActivityLogEntry[];
  importedFolderName: string | null;
  outputFolderName: string | null;
}

export interface ActivityLogEntry {
  id: string;
  fileName: string;
  timestamp: Date;
  status: 'detected' | 'processing' | 'queued' | 'failed' | 'moved';
  error?: string;
}

// Check if running in iframe (showDirectoryPicker doesn't work in cross-origin iframes)
const isInIframe = typeof window !== 'undefined' && window.self !== window.top;

export function useWatchFolder(
  practiceOds: string,
  uploaderName: string,
  batchId: string
) {
  const { user } = useAuth();
  const { queuePatient } = useLGUploadQueue();
  
  // showDirectoryPicker requires Chrome/Edge AND cannot work in iframes
  const apiSupported = typeof window !== 'undefined' && 'showDirectoryPicker' in window;
  const isSupported = apiSupported && !isInIframe;
  
  // Load saved settings from localStorage
  const getSavedSettings = () => {
    try {
      const saved = localStorage.getItem('lg_watch_settings');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {
      // Ignore parse errors
    }
    return {};
  };

  const savedSettings = getSavedSettings();

  const [state, setState] = useState<WatchFolderState>({
    isSupported,
    isWatching: false,
    folderName: savedSettings.folderName || null,
    pollingInterval: savedSettings.pollingInterval || 30,
    processedFiles: [],
    recentActivity: [],
    importedFolderName: null,
    outputFolderName: savedSettings.outputFolderName || null
  });

  const directoryHandleRef = useRef<FileSystemDirectoryHandle | null>(null);
  const importedFolderHandleRef = useRef<FileSystemDirectoryHandle | null>(null);
  const outputFolderHandleRef = useRef<FileSystemDirectoryHandle | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const processedFilesRef = useRef<Set<string>>(new Set());
  const patientOutputMapRef = useRef<Map<string, string>>(new Map()); // patientId -> original filename
  
  // Track if we're in iframe for error messaging
  const inIframe = isInIframe;

  // Save settings to localStorage
  const saveSettings = useCallback((updates: Partial<{ folderName: string | null; outputFolderName: string | null; pollingInterval: number }>) => {
    try {
      const current = getSavedSettings();
      const newSettings = { ...current, ...updates };
      localStorage.setItem('lg_watch_settings', JSON.stringify(newSettings));
    } catch {
      // Ignore save errors
    }
  }, []);

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

  // Move file to "Imported to AI for processing" subfolder
  const moveToImportedFolder = useCallback(async (fileName: string, fileHandle: FileSystemFileHandle) => {
    if (!directoryHandleRef.current) {
      console.log('[Watch Folder] No directory handle, cannot move file');
      return;
    }

    try {
      console.log('[Watch Folder] Moving file to imported folder:', fileName);
      
      // Get or create the imported subfolder within the watch folder
      const dirHandle = directoryHandleRef.current as any;
      
      // Create the imported folder if it doesn't exist
      let importedFolder: FileSystemDirectoryHandle;
      try {
        importedFolder = await dirHandle.getDirectoryHandle('Imported to AI for processing', { create: true });
        console.log('[Watch Folder] Got/created imported folder');
      } catch (folderErr) {
        console.error('[Watch Folder] Failed to create imported folder:', folderErr);
        return;
      }
      
      // Get the file content
      const file = await fileHandle.getFile();
      const arrayBuffer = await file.arrayBuffer();
      console.log('[Watch Folder] Read file content, size:', arrayBuffer.byteLength);
      
      // Create the file in the imported folder
      const newFileHandle = await (importedFolder as any).getFileHandle(fileName, { create: true });
      const writable = await newFileHandle.createWritable();
      await writable.write(arrayBuffer);
      await writable.close();
      console.log('[Watch Folder] Wrote file to imported folder');
      
      // Delete the original file
      try {
        await dirHandle.removeEntry(fileName);
        console.log('[Watch Folder] Removed original file');
      } catch (removeErr) {
        console.warn('[Watch Folder] Could not remove original file:', removeErr);
      }
      
      addActivity({ fileName, status: 'moved' });
      console.log(`[Watch Folder] Successfully moved ${fileName} to 'Imported to AI for processing' folder`);
    } catch (err) {
      console.error('[Watch Folder] Error moving file to imported folder:', err);
      // Don't fail the whole process if move fails
    }
  }, [addActivity]);

  const processFile = useCallback(async (file: File, fileHandle?: FileSystemFileHandle) => {
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
      
      // Store mapping for later PDF download
      patientOutputMapRef.current.set(patientId, file.name);
      
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

      // Move to imported folder if we have write access and file handle
      if (fileHandle) {
        await moveToImportedFolder(file.name, fileHandle);
      }

    } catch (err) {
      console.error('Error processing watched file:', file.name, err);
      addActivity({ 
        fileName: file.name, 
        status: 'failed', 
        error: err instanceof Error ? err.message : 'Unknown error' 
      });
    }
  }, [user?.id, practiceOds, uploaderName, batchId, queuePatient, addActivity, saveProcessedFiles, moveToImportedFolder]);

  const pollFolder = useCallback(async () => {
    if (!directoryHandleRef.current) return;

    try {
      // Iterate through files in the directory using async iterator
      const dirHandle = directoryHandleRef.current as any;
      
      // Use async iterator pattern for directory entries
      for await (const [name, handle] of dirHandle.entries()) {
        if (handle.kind === 'file' && name.toLowerCase().endsWith('.pdf')) {
          // Skip already processed files
          if (processedFilesRef.current.has(name)) continue;

          // Get the file
          const file = await (handle as FileSystemFileHandle).getFile();
          
          // Process the file and pass the handle for moving
          await processFile(file, handle as FileSystemFileHandle);
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
      if (inIframe) {
        toast.error('Watch Folder requires opening the app in a new tab (not in preview iframe)');
      } else {
        toast.error('Watch Folder requires Chrome or Edge browser');
      }
      return;
    }

    try {
      // @ts-ignore - TypeScript doesn't know about showDirectoryPicker
      const handle = await window.showDirectoryPicker({
        mode: 'readwrite' // Need write access to move files
      });

      directoryHandleRef.current = handle;
      setState(prev => ({ 
        ...prev, 
        folderName: handle.name,
        isWatching: false 
      }));
      saveSettings({ folderName: handle.name });

      toast.success(`Folder selected: ${handle.name}`);
    } catch (err) {
      // User cancelled
      if (err instanceof DOMException && err.name === 'AbortError') return;
      
      // Handle iframe security error specifically
      if (err instanceof DOMException && err.name === 'SecurityError') {
        toast.error('Watch Folder requires opening the app in a new tab. Click the external link icon to open in new window.');
        return;
      }
      
      console.error('Error selecting folder:', err);
      toast.error('Failed to select folder');
    }
  }, [state.isSupported, inIframe, saveSettings]);

  const selectOutputFolder = useCallback(async () => {
    if (!state.isSupported) {
      toast.error('This feature requires Chrome or Edge browser');
      return;
    }

    try {
      // @ts-ignore - TypeScript doesn't know about showDirectoryPicker
      const handle = await window.showDirectoryPicker({
        mode: 'readwrite'
      });

      outputFolderHandleRef.current = handle;
      setState(prev => ({ 
        ...prev, 
        outputFolderName: handle.name
      }));
      saveSettings({ outputFolderName: handle.name });

      toast.success(`Output folder selected: ${handle.name}`);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      console.error('Error selecting output folder:', err);
      toast.error('Failed to select output folder');
    }
  }, [state.isSupported, saveSettings]);

  // Save completed PDF to output folder
  const saveToOutputFolder = useCallback(async (pdfBlob: Blob, fileName: string) => {
    if (!outputFolderHandleRef.current) {
      console.log('No output folder selected, skipping auto-save');
      return false;
    }

    try {
      const fileHandle = await outputFolderHandleRef.current.getFileHandle(fileName, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(pdfBlob);
      await writable.close();
      
      toast.success(`Saved to AI Completed: ${fileName}`);
      return true;
    } catch (err) {
      console.error('Error saving to output folder:', err);
      return false;
    }
  }, []);

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
    saveSettings({ pollingInterval: seconds });
    
    // Restart polling with new interval if currently watching
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = setInterval(pollFolder, seconds * 1000);
    }
  }, [pollFolder, saveSettings]);

  // Restart service - stops and clears state, allows re-selecting folders
  const restartService = useCallback(() => {
    // Stop watching
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    
    // Clear folder handles
    directoryHandleRef.current = null;
    outputFolderHandleRef.current = null;
    importedFolderHandleRef.current = null;
    
    // Reset state but keep settings in localStorage
    setState(prev => ({
      ...prev,
      isWatching: false,
      folderName: null,
      outputFolderName: null,
      recentActivity: []
    }));
    
    toast.success('Watch folder service restarted. Please re-select folders.');
  }, []);

  const clearProcessedFiles = useCallback(() => {
    processedFilesRef.current.clear();
    localStorage.removeItem('lg_watch_processed_files');
    setState(prev => ({ ...prev, processedFiles: [] }));
    toast.success('Processed files list cleared');
  }, []);

  // Subscribe to patient completions and auto-download PDFs
  // Use state value to trigger re-subscription when output folder is selected
  useEffect(() => {
    if (!state.outputFolderName || !user?.id) return;
    
    console.log('[Watch Folder] Subscribing to patient completions for PDF auto-download');
    
    const channel = supabase
      .channel('watch-folder-completions')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'lg_patients',
          filter: `user_id=eq.${user.id}`
        },
        async (payload) => {
          const patient = payload.new as any;
          console.log('[Watch Folder] Patient update received:', patient.id, patient.job_status);
          
          // Check if this patient just completed (status changed to succeeded)
          if (patient.job_status === 'succeeded' && patient.pdf_url) {
            // Check if this patient was from Watch Folder
            const originalFileName = patientOutputMapRef.current.get(patient.id);
            console.log('[Watch Folder] Original filename for patient:', originalFileName);
            
            if (!originalFileName) {
              console.log('[Watch Folder] Patient not from Watch Folder, skipping');
              return;
            }
            
            if (!outputFolderHandleRef.current) {
              console.log('[Watch Folder] No output folder handle available');
              return;
            }
            
            try {
              console.log('[Watch Folder] Downloading completed PDF:', patient.pdf_url);
              
              // Extract the storage path from the URL
              let storagePath = patient.pdf_url;
              // Handle different URL formats
              if (storagePath.includes('/lg/')) {
                storagePath = storagePath.split('/lg/').pop() || storagePath;
              }
              
              // Download the PDF from Supabase
              const { data, error } = await supabase.storage
                .from('lg')
                .download(storagePath);
              
              if (error || !data) {
                console.error('[Watch Folder] Failed to download completed PDF:', error);
                return;
              }
              
              // Generate proper Lloyd George filename from patient data
              const outputFileName = generateLGFilename({
                patientName: patient.ai_extracted_name || patient.patient_name,
                nhsNumber: patient.ai_extracted_nhs || patient.nhs_number,
                dob: patient.ai_extracted_dob || patient.dob,
                partNumber: 1,
                totalParts: patient.pdf_split_count || 1
              });
              
              console.log('[Watch Folder] Saving to output folder:', outputFileName);
              
              // Save to output folder
              const saved = await saveToOutputFolder(data, outputFileName);
              
              if (saved) {
                // Remove from tracking map
                patientOutputMapRef.current.delete(patient.id);
                
                addActivity({ 
                  fileName: outputFileName, 
                  status: 'moved' // Show as saved/moved
                });
              }
              
            } catch (err) {
              console.error('[Watch Folder] Error auto-downloading PDF:', err);
            }
          }
        }
      )
      .subscribe();
    
    return () => {
      console.log('[Watch Folder] Unsubscribing from patient completions');
      supabase.removeChannel(channel);
    };
  }, [user?.id, state.outputFolderName, saveToOutputFolder, addActivity]);

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
    selectOutputFolder,
    saveToOutputFolder,
    startWatching,
    stopWatching,
    setPollingInterval,
    clearProcessedFiles,
    restartService,
    hasOutputFolder: !!outputFolderHandleRef.current
  };
}