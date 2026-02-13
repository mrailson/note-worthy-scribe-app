import { useState, useCallback, useRef, useEffect } from 'react';
import { safeSetItem } from '@/utils/localStorageManager';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLGUploadQueue } from '@/contexts/LGUploadQueueContext';
import { extractPdfPages } from '@/utils/pdfPageExtractor';
import { generateULID } from '@/utils/ulid';
import { generateLGFilename } from '@/utils/lgFilenameGenerator';
import { toast } from 'sonner';
import { CapturedImage } from '@/hooks/useLGCapture';
import { DEFAULT_COMPRESSION_LEVEL, CompressionLevel } from '@/utils/lgImageCompressor';

interface WatchFolderState {
  isSupported: boolean;
  isWatching: boolean;
  folderName: string | null;
  processedFiles: string[];
}

export interface ActivityLogEntry {
  id: string;
  fileName: string;
  timestamp: Date;
  status: 'detected' | 'processing' | 'queued' | 'failed' | 'moved';
  error?: string;
}

// Pipeline file tracking for tabbed view
export interface WatchFolderFile {
  id: string;
  originalFilename: string;
  detectedAt: Date;
  stage: 'detected' | 'queuing' | 'queued' | 'uploading' | 'uploaded' | 'processing' | 'ocr' | 'summarising' | 'snomed' | 'complete' | 'failed';
  uploadProgress?: number;
  uploadedAt?: Date;
  patientId?: string;
  patientName?: string;
  pageCount?: number;
  fileSize?: number;
  aiCompletedAt?: Date;
  movedToImported: boolean;
  movedAt?: Date;
  savedToDone: boolean;
  lgFilename?: string;
  savedAt?: Date;
  error?: string;
}

// Fixed polling interval - 30 seconds
const POLLING_INTERVAL_SECONDS = 30;

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
  
  // Pipeline files for tabbed view
  const [pipelineFiles, setPipelineFiles] = useState<WatchFolderFile[]>([]);
  
  // Load saved folder name from localStorage
  const getSavedFolderName = () => {
    try {
      const saved = localStorage.getItem('lg_watch_settings');
      if (saved) {
        return JSON.parse(saved).folderName || null;
      }
    } catch {
      // Ignore parse errors
    }
    return null;
  };

  const savedFolderName = getSavedFolderName();

  // Note: FileSystemDirectoryHandle cannot be persisted across page refreshes
  // We store names for display but handles must be re-selected after refresh
  const [state, setState] = useState<WatchFolderState>({
    isSupported,
    isWatching: false,
    folderName: null, // Don't show saved name without valid handle
    processedFiles: []
  });

  // Track if watch folder needs re-selection (was saved but handle lost on refresh)
  const [needsReselect, setNeedsReselect] = useState({
    watchFolder: !!savedFolderName,
    savedWatchName: savedFolderName as string | null
  });

  const directoryHandleRef = useRef<FileSystemDirectoryHandle | null>(null);
  const importedFolderHandleRef = useRef<FileSystemDirectoryHandle | null>(null);
  const doneFolderHandleRef = useRef<FileSystemDirectoryHandle | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const processedFilesRef = useRef<Set<string>>(new Set());
  const patientOutputMapRef = useRef<Map<string, string>>(new Map()); // patientId -> original filename
  
  // Track if we're in iframe for error messaging
  const inIframe = isInIframe;

  // Save folder name to localStorage
  const saveFolderName = useCallback((folderName: string | null) => {
    try {
      localStorage.setItem('lg_watch_settings', JSON.stringify({ folderName }));
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
    safeSetItem('lg_watch_processed_files', JSON.stringify(files));
    setState(prev => ({ ...prev, processedFiles: files }));
  }, []);

  // Activity logging (simplified, just console log for debugging)
  const logActivity = useCallback((fileName: string, status: string) => {
    console.log(`[Watch Folder] ${fileName}: ${status}`);
  }, []);

  // Update pipeline file stage
  const updatePipelineFile = useCallback((fileId: string, updates: Partial<WatchFolderFile>) => {
    setPipelineFiles(prev => prev.map(f => 
      f.id === fileId ? { ...f, ...updates } : f
    ));
  }, []);

  // Add new file to pipeline
  const addPipelineFile = useCallback((file: WatchFolderFile) => {
    setPipelineFiles(prev => [file, ...prev]);
  }, []);

  // Clear all pipeline files
  const clearPipelineFiles = useCallback(() => {
    setPipelineFiles([]);
  }, []);

  // When users refresh, files already saved into the local "Done" folder won't be in memory.
  // Load existing PDFs from the Done subfolder so the Done tab reflects what's actually on disk.
  const loadExistingDoneFiles = useCallback(async () => {
    const doneHandle = doneFolderHandleRef.current as any;
    if (!doneHandle) return;

    try {
      const found: WatchFolderFile[] = [];

      for await (const [name, handle] of doneHandle.entries()) {
        if (handle?.kind !== 'file') continue;
        if (!name?.toLowerCase?.().endsWith('.pdf')) continue;

        const file = await (handle as FileSystemFileHandle).getFile();
        const when = new Date(file.lastModified || Date.now());

        // Parse patient name and page count from LG filename pattern:
        // Lloyd_George_Record_XX_of_YY_Surname_Forename_NHS_DD_MMM_YYYY.pdf
        let parsedPatientName: string | undefined;
        let parsedPageCount: number | undefined;
        
        const lgMatch = name.match(/Lloyd_George_Record_(\d+)_of_(\d+)_([^_]+)_([^_]+)_(\d+)_/);
        if (lgMatch) {
          parsedPageCount = parseInt(lgMatch[2], 10);
          parsedPatientName = `${lgMatch[4]} ${lgMatch[3]}`; // Forename Surname
        }

        found.push({
          id: crypto.randomUUID(),
          originalFilename: name,
          detectedAt: when,
          stage: 'complete',
          movedToImported: false,
          savedToDone: true,
          lgFilename: name,
          savedAt: when,
          pageCount: parsedPageCount,
          fileSize: file.size,
          patientName: parsedPatientName,
        });
      }

      if (found.length === 0) return;

      setPipelineFiles((prev) => {
        const existing = new Set(
          prev.map((p) => (p.lgFilename || p.originalFilename).toLowerCase())
        );
        const additions = found.filter((f) => !existing.has(f.lgFilename!.toLowerCase()));
        return additions.length ? [...additions, ...prev] : prev;
      });

      console.log(`[Watch Folder] Loaded ${found.length} existing file(s) from Done folder`);
    } catch (err) {
      console.error('[Watch Folder] Failed to load existing Done files:', err);
    }
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
      
      logActivity(fileName, 'moved');
      console.log(`[Watch Folder] Successfully moved ${fileName} to 'Imported to AI for processing' folder`);
    } catch (err) {
      console.error('[Watch Folder] Error moving file to imported folder:', err);
      // Don't fail the whole process if move fails
    }
  }, [logActivity]);

  const processFile = useCallback(async (file: File, fileHandle?: FileSystemFileHandle) => {
    if (!user?.id || !practiceOds || !uploaderName) {
      logActivity(file.name, 'failed: Settings not configured');
      return;
    }

    // Add to pipeline tracking
    const pipelineFileId = crypto.randomUUID();
    const pipelineFile: WatchFolderFile = {
      id: pipelineFileId,
      originalFilename: file.name,
      detectedAt: new Date(),
      stage: 'detected',
      movedToImported: false,
      savedToDone: false
    };
    addPipelineFile(pipelineFile);

    logActivity(file.name, 'detected');

    try {
      updatePipelineFile(pipelineFileId, { stage: 'queuing' });
      logActivity(file.name, 'processing');

      // Extract pages from PDF - NO page removal, PDFs are pre-cleansed
      // Use preserveQuality=true to extract original embedded images (much smaller file size)
      const pages = await extractPdfPages(file, 150, undefined, false, true);

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

      updatePipelineFile(pipelineFileId, { 
        stage: 'uploading', 
        patientId, 
        pageCount: pages.length 
      });

      // Convert to CapturedImage format - NO filtering, PDFs are pre-cleansed
      // Include blob for efficient upload (avoids re-encoding from dataUrl)
      const capturedImages: CapturedImage[] = pages.map((page, index) => ({
        id: `${patientId}-page-${index + 1}`,
        dataUrl: page.dataUrl,
        timestamp: Date.now(),
        blob: page.blob
      }));

      // Queue for upload with user's compression settings
      const compressionLevel = parseInt(localStorage.getItem('lg_compression_level') || String(DEFAULT_COMPRESSION_LEVEL), 10) as CompressionLevel;
      const preserveQuality = localStorage.getItem('lg_preserve_quality') !== 'false'; // Default to true
      queuePatient(patientId, practiceOds, capturedImages, {
        compressionLevel,
        preserveQuality
      });

      // Mark as processed
      processedFilesRef.current.add(file.name);
      saveProcessedFiles();

      updatePipelineFile(pipelineFileId, { stage: 'queued' });
      logActivity(file.name, 'queued');
      toast.success(`Auto-imported: ${file.name}`);

      // Move to imported folder if we have write access and file handle
      if (fileHandle) {
        await moveToImportedFolder(file.name, fileHandle);
        updatePipelineFile(pipelineFileId, { movedToImported: true, movedAt: new Date() });
      }

    } catch (err) {
      console.error('Error processing watched file:', file.name, err);
      updatePipelineFile(pipelineFileId, { 
        stage: 'failed', 
        error: err instanceof Error ? err.message : 'Unknown error' 
      });
      logActivity(file.name, `failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }, [user?.id, practiceOds, uploaderName, batchId, queuePatient, logActivity, saveProcessedFiles, moveToImportedFolder, addPipelineFile, updatePipelineFile]);

  const pollFolder = useCallback(async () => {
    if (!directoryHandleRef.current) {
      console.log('[Watch Folder] No directory handle, skipping poll');
      return;
    }

    console.log('[Watch Folder] Polling folder for new PDFs...');
    console.log('[Watch Folder] Already processed files:', Array.from(processedFilesRef.current));

    try {
      // Iterate through files in the directory using async iterator
      const dirHandle = directoryHandleRef.current as any;
      let foundFiles = 0;
      let newFiles = 0;
      
      // Use async iterator pattern for directory entries
      for await (const [name, handle] of dirHandle.entries()) {
        if (handle.kind === 'file' && name.toLowerCase().endsWith('.pdf')) {
          foundFiles++;
          console.log(`[Watch Folder] Found PDF: ${name}`);
          
          // Skip already processed files
          if (processedFilesRef.current.has(name)) {
            console.log(`[Watch Folder] Skipping already processed: ${name}`);
            continue;
          }

          newFiles++;
          console.log(`[Watch Folder] Processing new file: ${name}`);
          
          // Get the file
          const file = await (handle as FileSystemFileHandle).getFile();
          
          // Process the file and pass the handle for moving
          await processFile(file, handle as FileSystemFileHandle);
        }
      }
      
      console.log(`[Watch Folder] Poll complete: ${foundFiles} PDFs found, ${newFiles} new files processed`);
    } catch (err) {
      console.error('[Watch Folder] Error polling folder:', err);
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
        mode: 'readwrite' // Need write access to create subfolders and move files
      });

      directoryHandleRef.current = handle;
      
      // Auto-create subfolders
      try {
        importedFolderHandleRef.current = await (handle as any).getDirectoryHandle('Imported to AI for processing', { create: true });
        doneFolderHandleRef.current = await (handle as any).getDirectoryHandle('Done', { create: true });
        console.log('[Watch Folder] Created/verified subfolders');

        // Populate Done tab with any PDFs already in the Done subfolder (e.g. after refresh)
        await loadExistingDoneFiles();
      } catch (subfolderErr) {
        console.error('[Watch Folder] Failed to create subfolders:', subfolderErr);
        toast.error('Failed to create subfolders');
        return;
      }
      
      setState(prev => ({ 
        ...prev, 
        folderName: handle.name,
        isWatching: false 
      }));
      saveFolderName(handle.name);
      
      // Clear needsReselect for watch folder
      setNeedsReselect(prev => ({ ...prev, watchFolder: false, savedWatchName: null }));

      toast.success(`Folder selected: ${handle.name} (subfolders created)`);
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
  }, [state.isSupported, inIframe, saveFolderName, loadExistingDoneFiles]);

  // Save completed PDF to Done subfolder
  const saveToDoneFolder = useCallback(async (pdfBlob: Blob, fileName: string) => {
    if (!doneFolderHandleRef.current) {
      console.log('[Watch Folder] No Done folder handle, skipping auto-save');
      return false;
    }

    try {
      const fileHandle = await doneFolderHandleRef.current.getFileHandle(fileName, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(pdfBlob);
      await writable.close();
      
      toast.success(`Saved to Done: ${fileName}`);
      return true;
    } catch (err) {
      console.error('[Watch Folder] Error saving to Done folder:', err);
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

    // Start polling with fixed 30 second interval
    pollingIntervalRef.current = setInterval(pollFolder, POLLING_INTERVAL_SECONDS * 1000);
    
    // Do an immediate poll
    pollFolder();

    setState(prev => ({ ...prev, isWatching: true }));
    toast.success('Watch folder enabled - checking every 30 seconds');
  }, [pollFolder, practiceOds, uploaderName]);

  const stopWatching = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    setState(prev => ({ ...prev, isWatching: false }));
  }, []);

  // Enable watch folder - combined folder select + start watching
  const enableWatchFolder = useCallback(async () => {
    if (!state.isSupported) {
      if (inIframe) {
        toast.error('Watch Folder requires opening the app in a new tab');
      } else {
        toast.error('Watch Folder requires Chrome or Edge browser');
      }
      return;
    }

    try {
      // If no folder handle, open picker
      if (!directoryHandleRef.current) {
        // @ts-ignore - TypeScript doesn't know about showDirectoryPicker
        const handle = await window.showDirectoryPicker({
          mode: 'readwrite'
        });

        directoryHandleRef.current = handle;
        
        // Auto-create subfolders
        try {
          importedFolderHandleRef.current = await (handle as any).getDirectoryHandle('Imported to AI for processing', { create: true });
          doneFolderHandleRef.current = await (handle as any).getDirectoryHandle('Done', { create: true });

          // Populate Done tab with any PDFs already in the Done subfolder (e.g. after refresh)
          await loadExistingDoneFiles();
        } catch (subfolderErr) {
          console.error('[Watch Folder] Failed to create subfolders:', subfolderErr);
          toast.error('Failed to create subfolders');
          return;
        }
        
        setState(prev => ({ ...prev, folderName: handle.name }));
        saveFolderName(handle.name);
        setNeedsReselect({ watchFolder: false, savedWatchName: null });
      }

      // Start watching
      if (!practiceOds || !uploaderName) {
        toast.error('Please configure practice settings first');
        return;
      }

      pollingIntervalRef.current = setInterval(pollFolder, POLLING_INTERVAL_SECONDS * 1000);
      pollFolder();
      setState(prev => ({ ...prev, isWatching: true }));
      toast.success('Watch folder enabled - checking every 30 seconds');
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      if (err instanceof DOMException && err.name === 'SecurityError') {
        toast.error('Watch Folder requires opening the app in a new tab');
        return;
      }
      console.error('Error enabling watch folder:', err);
      toast.error('Failed to enable watch folder');
    }
  }, [state.isSupported, inIframe, pollFolder, practiceOds, uploaderName, saveFolderName, loadExistingDoneFiles]);

  // Disable watch folder
  const disableWatchFolder = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    setState(prev => ({ ...prev, isWatching: false }));
    toast.success('Watch folder disabled');
  }, []);

  const clearProcessedFiles = useCallback(() => {
    processedFilesRef.current.clear();
    localStorage.removeItem('lg_watch_processed_files');
    setState(prev => ({ ...prev, processedFiles: [] }));
  }, []);

  // Subscribe to patient completions and auto-download PDFs to Done folder
  useEffect(() => {
    if (!state.folderName || !user?.id) return;
    
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
            
            if (!doneFolderHandleRef.current) {
              console.log('[Watch Folder] No Done folder handle available');
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
              
              // Log available patient data for debugging
              console.log('[Watch Folder] Patient data for filename:', {
                ai_extracted_name: patient.ai_extracted_name,
                ai_extracted_nhs: patient.ai_extracted_nhs,
                ai_extracted_dob: patient.ai_extracted_dob,
                patient_name: patient.patient_name,
                nhs_number: patient.nhs_number,
                dob: patient.dob,
                pdf_split_count: patient.pdf_split_count
              });
              
              // Generate proper Lloyd George filename from patient data
              const outputFileName = generateLGFilename({
                patientName: patient.ai_extracted_name || patient.patient_name,
                nhsNumber: patient.ai_extracted_nhs || patient.nhs_number,
                dob: patient.ai_extracted_dob || patient.dob,
                partNumber: 1,
                totalParts: patient.pdf_split_count || 1
              });
              
              console.log('[Watch Folder] Generated filename:', outputFileName);
              
              // Save to Done subfolder
              const saved = await saveToDoneFolder(data, outputFileName);
              
              if (saved) {
                // Remove from tracking map
                patientOutputMapRef.current.delete(patient.id);
                
                // Update pipeline file to show in Done tab
                const pipelineFile = pipelineFiles.find(f => f.patientId === patient.id);
                if (pipelineFile) {
                  updatePipelineFile(pipelineFile.id, { 
                    savedToDone: true, 
                    savedAt: new Date(),
                    lgFilename: outputFileName,
                    patientName: patient.ai_extracted_name || patient.patient_name
                  });
                }
                
                logActivity(outputFileName, 'saved to Done');
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
  }, [user?.id, state.folderName, saveToDoneFolder, logActivity, pipelineFiles, updatePipelineFile]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  // Subscribe to patient status updates for pipeline tracking
  useEffect(() => {
    if (!user?.id || pipelineFiles.length === 0) return;
    
    const channel = supabase
      .channel('watch-folder-pipeline-updates')
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
          
          // Find matching pipeline file by patientId
          const pipelineFile = pipelineFiles.find(f => f.patientId === patient.id);
          if (!pipelineFile) return;
          
          // Update stage based on job_status
          let newStage: WatchFolderFile['stage'] = pipelineFile.stage;
          let patientName = pipelineFile.patientName;
          let lgFilename = pipelineFile.lgFilename;
          
          switch (patient.job_status) {
            case 'uploading':
              newStage = 'uploading';
              break;
            case 'queued':
              newStage = 'queued';
              break;
            case 'processing':
              newStage = 'processing';
              break;
            case 'succeeded':
              newStage = 'complete';
              patientName = patient.ai_extracted_name || patient.patient_name;
              if (patient.pdf_url) {
                lgFilename = generateLGFilename({
                  patientName: patient.ai_extracted_name || patient.patient_name,
                  nhsNumber: patient.ai_extracted_nhs || patient.nhs_number,
                  dob: patient.ai_extracted_dob || patient.dob,
                  partNumber: 1,
                  totalParts: patient.pdf_split_count || 1
                });
              }
              break;
            case 'failed':
              newStage = 'failed';
              break;
          }
          
          updatePipelineFile(pipelineFile.id, { 
            stage: newStage,
            patientName,
            lgFilename,
            ...(newStage === 'complete' ? { aiCompletedAt: new Date() } : {})
          });
        }
      )
      .subscribe();
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, pipelineFiles, updatePipelineFile]);

  return {
    ...state,
    selectFolder,
    saveToDoneFolder,
    startWatching,
    stopWatching,
    enableWatchFolder,
    disableWatchFolder,
    clearProcessedFiles,
    hasDoneFolder: !!doneFolderHandleRef.current,
    needsReselect,
    pipelineFiles,
    clearPipelineFiles
  };
}