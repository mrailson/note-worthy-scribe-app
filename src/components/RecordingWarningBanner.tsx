import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, Mic } from 'lucide-react';
import { useRecording } from '@/contexts/RecordingContext';

interface RecordingWarningBannerProps {
  operation?: string;
  className?: string;
}

export const RecordingWarningBanner = ({ 
  operation = 'this operation', 
  className = '' 
}: RecordingWarningBannerProps) => {
  const { isRecording } = useRecording();

  if (!isRecording) return null;

  return (
    <Alert variant="destructive" className={`mb-4 ${className}`}>
      <AlertTriangle className="h-4 w-4" />
      <AlertDescription className="flex items-center gap-2">
        <Mic className="h-4 w-4 animate-pulse text-red-500" />
        <span>
          Recording in progress. {operation} will be paused to prevent audio interference.
        </span>
      </AlertDescription>
    </Alert>
  );
};