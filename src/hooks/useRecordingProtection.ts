import { useEffect, useRef, useState } from 'react';
import { useToast } from "@/hooks/use-toast";
import { useIsIPhone } from "@/hooks/use-mobile";

interface UseRecordingProtectionProps {
  isRecording: boolean;
  recordingDuration: number;
  wordCount: number;
  onStopRecording: () => void;
}

export const useRecordingProtection = ({
  isRecording,
  recordingDuration,
  wordCount,
  onStopRecording,
}: UseRecordingProtectionProps) => {
  const { toast } = useToast();
  const isIPhone = useIsIPhone();
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [doubleClickProtection, setDoubleClickProtection] = useState(false);
  const [isPreparingToStop, setIsPreparingToStop] = useState(false);
  const lastClickTimeRef = useRef<number>(0);
  const doubleClickTimeoutRef = useRef<NodeJS.Timeout>();
  const originalTitleRef = useRef<string>('');

  // Store original page title
  useEffect(() => {
    if (!originalTitleRef.current) {
      originalTitleRef.current = document.title;
    }
  }, []);

  // Update page title and favicon during recording
  useEffect(() => {
    if (isRecording) {
      const formatDuration = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
      };

      document.title = `🔴 Recording ${formatDuration(recordingDuration)} - ${originalTitleRef.current}`;
      
      // Update favicon to show recording status
      const link = document.querySelector("link[rel*='icon']") as HTMLLinkElement;
      if (link) {
        link.href = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="%23dc2626"/></svg>';
      }
    } else {
      document.title = originalTitleRef.current;
      
      // Restore original favicon
      const link = document.querySelector("link[rel*='icon']") as HTMLLinkElement;
      if (link) {
        link.href = '/favicon.ico';
      }
    }

    return () => {
      if (!isRecording) {
        document.title = originalTitleRef.current;
      }
    };
  }, [isRecording, recordingDuration]);

  // beforeunload protection during recording
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (isRecording) {
        event.preventDefault();
        event.returnValue = 'You have an active recording that will be lost if you leave this page. Are you sure?';
        return event.returnValue;
      }
    };

    if (isRecording) {
      window.addEventListener('beforeunload', handleBeforeUnload);
      return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }
  }, [isRecording]);

  // Page visibility change handling - log only, no toast
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (isRecording && document.visibilityState === 'hidden' && !isIPhone) {
        console.log('📱 Tab hidden while recording - recording continues in background');
      }
    };

    if (isRecording) {
      document.addEventListener('visibilitychange', handleVisibilityChange);
      return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }
  }, [isRecording]);

  // Reset preparing state when dialog is closed without confirming
  useEffect(() => {
    if (!showConfirmDialog && isPreparingToStop && isRecording) {
      setIsPreparingToStop(false);
    }
  }, [showConfirmDialog, isPreparingToStop, isRecording]);

  const handleStopWithConfirmation = () => {
    setIsPreparingToStop(true);
    const shouldShowConfirmation = recordingDuration >= 15; // 15+ seconds always confirms
    
    if (shouldShowConfirmation) {
      setShowConfirmDialog(true);
    } else {
      onStopRecording();
    }
  };

  const handleDoubleClickProtection = () => {
    const now = Date.now();
    const timeSinceLastClick = now - lastClickTimeRef.current;
    
    if (timeSinceLastClick < 500) {
      // Double click detected within 500ms
      clearTimeout(doubleClickTimeoutRef.current);
      setDoubleClickProtection(false);
      handleStopWithConfirmation();
    } else {
      // First click - show warning and wait for second click
      lastClickTimeRef.current = now;
      setDoubleClickProtection(true);
      
      // Only show toast on non-iPhone devices
      if (!isIPhone) {
        toast({
          title: "🔄 Double-click to stop",
          description: "Click the mic icon again to confirm stopping",
          duration: 2000,
        });
      }

      // Reset double-click protection after 3 seconds
      doubleClickTimeoutRef.current = setTimeout(() => {
        setDoubleClickProtection(false);
      }, 3000);
    }
  };

  const confirmStopRecording = () => {
    setShowConfirmDialog(false);
    setIsPreparingToStop(false);
    onStopRecording();
  };

  // Cleanup timeouts
  useEffect(() => {
    return () => {
      if (doubleClickTimeoutRef.current) {
        clearTimeout(doubleClickTimeoutRef.current);
      }
    };
  }, []);

  return {
    showConfirmDialog,
    setShowConfirmDialog,
    handleStopWithConfirmation,
    handleDoubleClickProtection,
    confirmStopRecording,
    doubleClickProtection,
    isPreparingToStop,
  };
};