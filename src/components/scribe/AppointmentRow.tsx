import { useState } from 'react';
import { TableRow, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { 
  Play, 
  MoreVertical, 
  Eye, 
  CheckCircle, 
  Clock, 
  AlertTriangle,
  Trash2,
  Phone,
  Link2
} from 'lucide-react';
import { format, isValid, parse } from 'date-fns';
import { Appointment, AppointmentStatus, APPOINTMENT_STATUS_LABELS, APPOINTMENT_STATUS_COLOURS } from '@/types/scribe';
import { formatNHSNumber } from '@/utils/nhsNumberValidator';

interface AppointmentRowProps {
  appointment: Appointment;
  age: number | null;
  onStartConsultation: (appointment: Appointment) => void;
  onViewConsultation: (consultationId: string) => void;
  onUpdateStatus: (appointmentId: string, status: AppointmentStatus) => Promise<boolean>;
  onDelete: (appointmentId: string) => Promise<boolean>;
  onAutoLink: (appointmentId: string, nhsNumber: string) => Promise<string | null>;
}

export const AppointmentRow = ({
  appointment,
  age,
  onStartConsultation,
  onViewConsultation,
  onUpdateStatus,
  onDelete,
  onAutoLink
}: AppointmentRowProps) => {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const handleStatusChange = async (status: AppointmentStatus) => {
    setIsUpdating(true);
    await onUpdateStatus(appointment.id, status);
    setIsUpdating(false);
  };

  const handleDelete = async () => {
    setIsUpdating(true);
    await onDelete(appointment.id);
    setIsUpdating(false);
    setShowDeleteDialog(false);
  };

  const handleAutoLink = async () => {
    if (appointment.nhs_number) {
      setIsUpdating(true);
      await onAutoLink(appointment.id, appointment.nhs_number);
      setIsUpdating(false);
    }
  };

  // Format DOB for display
  const formatDOB = (dob: string | undefined): string => {
    if (!dob) return '-';
    try {
      const date = new Date(dob);
      if (!isValid(date)) return '-';
      return format(date, 'dd/MM/yyyy');
    } catch {
      return '-';
    }
  };

  // Format time for display
  const formatTime = (time: string | undefined): string => {
    if (!time) return '-';
    // Handle HH:MM:SS format
    const parts = time.split(':');
    if (parts.length >= 2) {
      return `${parts[0]}:${parts[1]}`;
    }
    return time;
  };

  const statusIcon = {
    pending: <Clock className="h-3 w-3" />,
    in_progress: <Play className="h-3 w-3" />,
    completed: <CheckCircle className="h-3 w-3" />,
    requires_action: <AlertTriangle className="h-3 w-3" />
  };

  const isCompleted = appointment.status === 'completed';
  const strikethroughClass = isCompleted ? 'line-through text-muted-foreground' : '';

  return (
    <>
      <TableRow className={`${isUpdating ? 'opacity-50' : ''} ${isCompleted ? 'bg-muted/30' : ''}`}>
        <TableCell className={`font-medium whitespace-nowrap ${strikethroughClass}`}>
          {formatTime(appointment.appointment_time)}
        </TableCell>
        <TableCell className={`font-medium ${strikethroughClass}`}>{appointment.patient_name}</TableCell>
        <TableCell className={`font-mono text-sm ${strikethroughClass}`}>
          {appointment.nhs_number ? formatNHSNumber(appointment.nhs_number) : '-'}
        </TableCell>
        <TableCell className={`whitespace-nowrap ${strikethroughClass}`}>
          {formatDOB(appointment.date_of_birth)}
          {age !== null && (
            <span className="ml-1 text-muted-foreground">({age}y)</span>
          )}
        </TableCell>
        <TableCell className={`max-w-[150px] truncate ${strikethroughClass}`} title={appointment.address || undefined}>
          {appointment.postcode || '-'}
        </TableCell>
        <TableCell className={strikethroughClass}>
          {appointment.contact_number ? (
            <a 
              href={`tel:${appointment.contact_number}`}
              className={`flex items-center gap-1 ${isCompleted ? 'text-muted-foreground' : 'text-primary'} hover:underline`}
            >
              <Phone className="h-3 w-3" />
              {appointment.contact_number}
            </a>
          ) : '-'}
        </TableCell>
        <TableCell>
          <Badge className={`gap-1 ${APPOINTMENT_STATUS_COLOURS[appointment.status]}`}>
            {statusIcon[appointment.status]}
            {APPOINTMENT_STATUS_LABELS[appointment.status]}
          </Badge>
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-1">
            {!appointment.linked_consultation_id && appointment.status === 'pending' && (
              <Button
                size="sm"
                variant="default"
                className="gap-1"
                onClick={() => onStartConsultation(appointment)}
                disabled={isUpdating}
              >
                <Play className="h-3 w-3" />
                Start
              </Button>
            )}
            {appointment.linked_consultation_id && (
              <Button
                size="sm"
                variant="outline"
                className="gap-1"
                onClick={() => onViewConsultation(appointment.linked_consultation_id!)}
              >
                <Eye className="h-3 w-3" />
                View
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem 
                  onClick={() => handleStatusChange('pending')}
                  disabled={appointment.status === 'pending'}
                >
                  <Clock className="mr-2 h-4 w-4" />
                  Mark Pending
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => handleStatusChange('in_progress')}
                  disabled={appointment.status === 'in_progress'}
                >
                  <Play className="mr-2 h-4 w-4" />
                  Mark In Progress
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => handleStatusChange('completed')}
                  disabled={appointment.status === 'completed'}
                >
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Mark Completed
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => handleStatusChange('requires_action')}
                  disabled={appointment.status === 'requires_action'}
                >
                  <AlertTriangle className="mr-2 h-4 w-4" />
                  Requires Action
                </DropdownMenuItem>
                
                {appointment.nhs_number && !appointment.linked_consultation_id && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleAutoLink}>
                      <Link2 className="mr-2 h-4 w-4" />
                      Find Linked Consultation
                    </DropdownMenuItem>
                  </>
                )}
                
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={() => setShowDeleteDialog(true)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </TableCell>
      </TableRow>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Appointment</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove {appointment.patient_name} from the appointment list?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
