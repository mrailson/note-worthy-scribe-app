import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Mic } from 'lucide-react';

interface NavigationBlockerDialogProps {
  open: boolean;
  onStay: () => void;
  onLeave: () => void;
}

export const NavigationBlockerDialog = ({
  open,
  onStay,
  onLeave,
}: NavigationBlockerDialogProps) => {
  return (
    <AlertDialog open={open} onOpenChange={(o) => !o && onStay()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Mic className="h-5 w-5 text-destructive animate-pulse" />
            Recording in progress
          </AlertDialogTitle>
          <AlertDialogDescription>
            You have an active recording. Leaving this page will{' '}
            <strong>stop the recording</strong> and you may lose data.
            <br /><br />
            Are you sure you want to leave?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onStay}>
            Stay on page
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onLeave}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Leave &amp; stop recording
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
