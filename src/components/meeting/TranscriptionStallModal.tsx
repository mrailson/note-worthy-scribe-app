import React from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw, Square, Clock } from "lucide-react";

interface TranscriptionStallModalProps {
  isOpen: boolean;
  onClose: () => void;
  onReconnect: () => void;
  onStopRecording: () => void;
  onKeepWaiting: () => void;
  stalledDurationSeconds: number;
  lastChunkTime: Date | null;
}

export const TranscriptionStallModal: React.FC<TranscriptionStallModalProps> = ({
  isOpen,
  onClose,
  onReconnect,
  onStopRecording,
  onKeepWaiting,
  stalledDurationSeconds,
  lastChunkTime
}) => {
  const formatDuration = (seconds: number): string => {
    if (seconds < 60) return `${seconds} seconds`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return remainingSeconds > 0 
      ? `${minutes}m ${remainingSeconds}s` 
      : `${minutes} minute${minutes > 1 ? 's' : ''}`;
  };

  const formatTime = (date: Date | null): string => {
    if (!date) return 'Unknown';
    return date.toLocaleTimeString('en-GB', { 
      hour: '2-digit', 
      minute: '2-digit'
    });
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5 animate-pulse" />
            Recording May Have Stopped
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>
                No transcription activity has been detected for{' '}
                <span className="font-semibold text-foreground">
                  {formatDuration(stalledDurationSeconds)}
                </span>.
              </p>
              
              <div className="bg-muted/50 rounded-lg p-3 space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span>Last chunk received: {formatTime(lastChunkTime)}</span>
                </div>
              </div>

              <p className="text-sm">
                This could be caused by:
              </p>
              <ul className="text-sm list-disc list-inside space-y-1 text-muted-foreground">
                <li>Browser tab was in the background</li>
                <li>Network connection was interrupted</li>
                <li>Microphone was disconnected</li>
                <li>Device went to sleep</li>
              </ul>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={() => {
              onKeepWaiting();
              onClose();
            }}
            className="w-full sm:w-auto"
          >
            Keep Waiting
          </Button>
          
          <Button
            variant="secondary"
            onClick={() => {
              onReconnect();
              onClose();
            }}
            className="w-full sm:w-auto gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Try to Reconnect
          </Button>
          
          <Button
            variant="destructive"
            onClick={() => {
              onStopRecording();
              onClose();
            }}
            className="w-full sm:w-auto gap-2"
          >
            <Square className="h-4 w-4" />
            Stop Recording
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
