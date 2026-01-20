import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { CalendarIcon, Upload, RefreshCw, Trash2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useScribeAppointments } from '@/hooks/useScribeAppointments';
import { AppointmentImportModal } from './AppointmentImportModal';
import { AppointmentRow } from './AppointmentRow';
import { Appointment, AppointmentStatus, APPOINTMENT_STATUS_LABELS, PatientContext } from '@/types/scribe';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

interface MyAppointmentsTabProps {
  onStartConsultation: (patientContext: PatientContext) => void;
  onViewConsultation: (consultationId: string) => void;
}

export const MyAppointmentsTab = ({ onStartConsultation, onViewConsultation }: MyAppointmentsTabProps) => {
  const [showImportModal, setShowImportModal] = useState(false);
  const appointments = useScribeAppointments();

  const handleImport = async (text: string, sessionDate: Date, sessionName?: string): Promise<boolean> => {
    const parsed = appointments.parseAppointmentText(text);
    return await appointments.importAppointments(parsed, sessionDate, sessionName);
  };

  const handleStartConsultation = (apt: Appointment) => {
    // Convert appointment to patient context
    const patientContext: PatientContext = {
      name: apt.patient_name,
      nhsNumber: apt.nhs_number,
      dateOfBirth: apt.date_of_birth,
      address: apt.address,
      postcode: apt.postcode,
      contactNumber: apt.contact_number
    };
    
    // Mark as in progress
    appointments.updateAppointmentStatus(apt.id, 'in_progress');
    
    onStartConsultation(patientContext);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <CardTitle className="text-xl">My Appointments</CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              {/* Date Picker */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("justify-start text-left font-normal", "w-[180px]")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(appointments.selectedDate, "dd MMM yyyy")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar
                    mode="single"
                    selected={appointments.selectedDate}
                    onSelect={(date) => date && appointments.setSelectedDate(date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>

              {/* Status Filter */}
              <Select value={appointments.statusFilter} onValueChange={(v) => appointments.setStatusFilter(v as AppointmentStatus | 'all')}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {Object.entries(APPOINTMENT_STATUS_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button variant="outline" size="icon" onClick={() => appointments.fetchAppointments()}>
                <RefreshCw className="h-4 w-4" />
              </Button>

              <Button onClick={() => setShowImportModal(true)} className="gap-2">
                <Upload className="h-4 w-4" />
                Import
              </Button>

              {appointments.appointments.length > 0 && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="icon" className="text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Clear All Appointments</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will remove all {appointments.appointments.length} appointments for {format(appointments.selectedDate, 'dd MMM yyyy')}. This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => appointments.clearDayAppointments()} className="bg-destructive text-destructive-foreground">
                        Clear All
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {appointments.isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : appointments.appointments.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p className="mb-4">No appointments for {format(appointments.selectedDate, 'dd MMM yyyy')}</p>
              <Button onClick={() => setShowImportModal(true)} variant="outline" className="gap-2">
                <Upload className="h-4 w-4" />
                Import Appointments
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[80px]">Time</TableHead>
                    <TableHead>Patient Name</TableHead>
                    <TableHead>NHS Number</TableHead>
                    <TableHead>DOB (Age)</TableHead>
                    <TableHead>Postcode</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[120px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {appointments.appointments.map((apt) => (
                    <AppointmentRow
                      key={apt.id}
                      appointment={apt}
                      age={appointments.calculateAge(apt.date_of_birth)}
                      onStartConsultation={handleStartConsultation}
                      onViewConsultation={onViewConsultation}
                      onUpdateStatus={appointments.updateAppointmentStatus}
                      onDelete={appointments.deleteAppointment}
                      onAutoLink={appointments.autoLinkConsultation}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <AppointmentImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImport={handleImport}
      />
    </div>
  );
};
