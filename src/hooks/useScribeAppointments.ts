import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { showToast } from '@/utils/toastWrapper';
import { Appointment, AppointmentStatus } from '@/types/scribe';
import { format, differenceInYears, parse, isValid } from 'date-fns';

interface ParsedAppointment {
  appointment_time?: string;
  patient_name: string;
  nhs_number?: string;
  date_of_birth?: string;
  address?: string;
  postcode?: string;
  contact_number?: string;
  reason?: string;
  appointment_type?: string;
  reviewing_clinician?: string;
}

export const useScribeAppointments = () => {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [statusFilter, setStatusFilter] = useState<AppointmentStatus | 'all'>('all');

  // Fetch appointments for the selected date
  const fetchAppointments = useCallback(async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      
      let query = supabase
        .from('gp_appointments')
        .select('*')
        .eq('user_id', user.id)
        .eq('session_date', dateStr)
        .order('appointment_time', { ascending: true });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;

      if (error) throw error;
      setAppointments(data || []);
    } catch (error) {
      console.error('Failed to fetch appointments:', error);
      showToast.error('Failed to load appointments');
    } finally {
      setIsLoading(false);
    }
  }, [user, selectedDate, statusFilter]);

  // Auto-fetch when date or filter changes
  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  // Parse text content to extract appointments
  const parseAppointmentText = useCallback((text: string): ParsedAppointment[] => {
    const appointments: ParsedAppointment[] = [];
    
    // Split by time patterns (08:00, 08:10, etc.)
    const timePattern = /(\d{1,2}:\d{2})/g;
    const lines = text.split('\n');
    
    let currentAppointment: Partial<ParsedAppointment> = {};
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;
      
      // Check if line starts with a time
      const timeMatch = trimmedLine.match(/^(\d{1,2}:\d{2})/);
      if (timeMatch) {
        // Save previous appointment if exists
        if (currentAppointment.patient_name) {
          appointments.push(currentAppointment as ParsedAppointment);
        }
        currentAppointment = { appointment_time: timeMatch[1] };
      }
      
      // Extract NHS number (10 digits, possibly with spaces)
      const nhsMatch = trimmedLine.match(/NHS[:\s]*(\d[\d\s]{8,11}\d)/i) || 
                       trimmedLine.match(/(\d{3}\s?\d{3}\s?\d{4})/);
      if (nhsMatch) {
        currentAppointment.nhs_number = nhsMatch[1].replace(/\s/g, '');
      }
      
      // Extract name patterns (Mr/Mrs/Miss/Ms/Dr followed by name)
      const nameMatch = trimmedLine.match(/((?:Mr|Mrs|Miss|Ms|Dr|Master)\.?\s+[\w\s]+?)(?:\s+NHS|$|\d{2}\s+\w{3}\s+\d{4})/i);
      if (nameMatch && !currentAppointment.patient_name) {
        currentAppointment.patient_name = nameMatch[1].trim();
      }
      
      // Extract date of birth (DD Mon YYYY or DD/MM/YYYY)
      const dobMatch = trimmedLine.match(/(\d{1,2}\s+\w{3}\s+\d{4})/i) ||
                       trimmedLine.match(/(\d{1,2}\/\d{1,2}\/\d{4})/);
      if (dobMatch) {
        try {
          let parsedDate: Date | null = null;
          if (dobMatch[1].includes('/')) {
            parsedDate = parse(dobMatch[1], 'dd/MM/yyyy', new Date());
          } else {
            parsedDate = parse(dobMatch[1], 'd MMM yyyy', new Date());
          }
          if (isValid(parsedDate)) {
            currentAppointment.date_of_birth = format(parsedDate, 'yyyy-MM-dd');
          }
        } catch (e) {
          // Ignore parsing errors
        }
      }
      
      // Extract phone numbers
      const phoneMatch = trimmedLine.match(/(0\d{10}|\+44\d{10}|07\d{9})/);
      if (phoneMatch) {
        currentAppointment.contact_number = phoneMatch[1];
      }
      
      // Extract postcode
      const postcodeMatch = trimmedLine.match(/([A-Z]{1,2}\d{1,2}[A-Z]?\s*\d[A-Z]{2})/i);
      if (postcodeMatch) {
        currentAppointment.postcode = postcodeMatch[1].toUpperCase();
        
        // Try to extract address (text before postcode)
        const beforePostcode = trimmedLine.split(postcodeMatch[1])[0];
        if (beforePostcode && beforePostcode.length > 10) {
          // Clean up the address - remove phone numbers and NHS numbers
          let address = beforePostcode
            .replace(/0\d{10}|\+44\d{10}|07\d{9}/g, '')
            .replace(/NHS[:\s]*\d[\d\s]{8,11}\d/gi, '')
            .replace(/\d{1,2}\s+\w{3}\s+\d{4}/gi, '')
            .trim();
          if (address) {
            currentAppointment.address = address;
          }
        }
      }
      
      // Extract appointment type
      if (trimmedLine.toLowerCase().includes('telephone')) {
        currentAppointment.appointment_type = 'Telephone';
      } else if (trimmedLine.toLowerCase().includes('face to face') || trimmedLine.toLowerCase().includes('f2f')) {
        currentAppointment.appointment_type = 'Face to Face';
      } else if (trimmedLine.toLowerCase().includes('video')) {
        currentAppointment.appointment_type = 'Video';
      }
      
      // Extract reason if present
      if (trimmedLine.toLowerCase().includes('reason:')) {
        const reasonMatch = trimmedLine.match(/reason:\s*(.+?)(?:\.|;|$)/i);
        if (reasonMatch) {
          currentAppointment.reason = reasonMatch[1].trim();
        }
      }
    }
    
    // Don't forget the last appointment
    if (currentAppointment.patient_name) {
      appointments.push(currentAppointment as ParsedAppointment);
    }
    
    // Filter out placeholder entries (like "RH GP Phone Red", "GP's Admin")
    return appointments.filter(apt => 
      apt.patient_name && 
      !apt.patient_name.toLowerCase().includes('admin') &&
      !apt.patient_name.toLowerCase().includes('phone red') &&
      !apt.patient_name.toLowerCase().includes('f2f red')
    );
  }, []);

  // Import appointments from parsed data
  const importAppointments = useCallback(async (
    parsedAppointments: ParsedAppointment[],
    sessionDate: Date,
    sessionName?: string
  ): Promise<boolean> => {
    if (!user) {
      showToast.error('Not authenticated');
      return false;
    }

    if (parsedAppointments.length === 0) {
      showToast.error('No valid appointments found to import');
      return false;
    }

    setIsLoading(true);
    try {
      const dateStr = format(sessionDate, 'yyyy-MM-dd');
      
      const appointmentsToInsert = parsedAppointments.map(apt => ({
        user_id: user.id,
        session_date: dateStr,
        session_name: sessionName || `Appointments - ${format(sessionDate, 'dd MMM yyyy')}`,
        appointment_time: apt.appointment_time,
        patient_name: apt.patient_name,
        nhs_number: apt.nhs_number,
        date_of_birth: apt.date_of_birth,
        address: apt.address,
        postcode: apt.postcode,
        contact_number: apt.contact_number,
        reason: apt.reason,
        appointment_type: apt.appointment_type,
        reviewing_clinician: apt.reviewing_clinician,
        status: 'pending' as AppointmentStatus
      }));

      const { error } = await supabase
        .from('gp_appointments')
        .insert(appointmentsToInsert);

      if (error) throw error;

      showToast.success(`Imported ${parsedAppointments.length} appointments`);
      
      // Refresh if viewing the same date
      if (format(sessionDate, 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd')) {
        await fetchAppointments();
      }
      
      return true;
    } catch (error) {
      console.error('Failed to import appointments:', error);
      showToast.error('Failed to import appointments');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [user, selectedDate, fetchAppointments]);

  // Update appointment status
  const updateAppointmentStatus = useCallback(async (
    appointmentId: string,
    status: AppointmentStatus,
    linkedConsultationId?: string
  ): Promise<boolean> => {
    try {
      const updates: Partial<Appointment> = { status };
      if (linkedConsultationId) {
        updates.linked_consultation_id = linkedConsultationId;
      }

      const { error } = await supabase
        .from('gp_appointments')
        .update(updates)
        .eq('id', appointmentId);

      if (error) throw error;

      // Update local state
      setAppointments(prev => 
        prev.map(apt => 
          apt.id === appointmentId 
            ? { ...apt, status, linked_consultation_id: linkedConsultationId || apt.linked_consultation_id }
            : apt
        )
      );

      showToast.success(`Status updated to ${status.replace('_', ' ')}`);
      return true;
    } catch (error) {
      console.error('Failed to update appointment status:', error);
      showToast.error('Failed to update status');
      return false;
    }
  }, []);

  // Link appointment to a consultation (auto-link by NHS number)
  const autoLinkConsultation = useCallback(async (appointmentId: string, nhsNumber: string): Promise<string | null> => {
    if (!user || !nhsNumber) return null;

    try {
      // Find the most recent consultation with matching NHS number
      const { data, error } = await supabase
        .from('gp_consultations')
        .select('id')
        .eq('user_id', user.id)
        .eq('patient_nhs_number', nhsNumber)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        // Update the appointment with the linked consultation
        await supabase
          .from('gp_appointments')
          .update({ linked_consultation_id: data.id })
          .eq('id', appointmentId);

        // Update local state
        setAppointments(prev =>
          prev.map(apt =>
            apt.id === appointmentId
              ? { ...apt, linked_consultation_id: data.id }
              : apt
          )
        );

        return data.id;
      }
      
      return null;
    } catch (error) {
      console.error('Failed to auto-link consultation:', error);
      return null;
    }
  }, [user]);

  // Delete appointment
  const deleteAppointment = useCallback(async (appointmentId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('gp_appointments')
        .delete()
        .eq('id', appointmentId);

      if (error) throw error;

      setAppointments(prev => prev.filter(apt => apt.id !== appointmentId));
      showToast.success('Appointment removed');
      return true;
    } catch (error) {
      console.error('Failed to delete appointment:', error);
      showToast.error('Failed to delete appointment');
      return false;
    }
  }, []);

  // Clear all appointments for a date
  const clearDayAppointments = useCallback(async (): Promise<boolean> => {
    if (!user) return false;

    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      
      const { error } = await supabase
        .from('gp_appointments')
        .delete()
        .eq('user_id', user.id)
        .eq('session_date', dateStr);

      if (error) throw error;

      setAppointments([]);
      showToast.success('All appointments cleared for this day');
      return true;
    } catch (error) {
      console.error('Failed to clear appointments:', error);
      showToast.error('Failed to clear appointments');
      return false;
    }
  }, [user, selectedDate]);

  // Calculate age from DOB
  const calculateAge = useCallback((dob: string | undefined): number | null => {
    if (!dob) return null;
    try {
      const birthDate = new Date(dob);
      if (!isValid(birthDate)) return null;
      return differenceInYears(new Date(), birthDate);
    } catch {
      return null;
    }
  }, []);

  return {
    appointments,
    isLoading,
    selectedDate,
    statusFilter,
    setSelectedDate,
    setStatusFilter,
    fetchAppointments,
    parseAppointmentText,
    importAppointments,
    updateAppointmentStatus,
    autoLinkConsultation,
    deleteAppointment,
    clearDayAppointments,
    calculateAge
  };
};
