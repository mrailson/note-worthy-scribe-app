import { useState, useCallback, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, User, Hash, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface QuickPatientEntryFormProps {
  sessionId: string;
  existingName?: string;
  existingNhsNumber?: string;
  existingDob?: string;
  onSave: () => void;
  onCancel: () => void;
}

export const QuickPatientEntryForm = ({
  sessionId,
  existingName = "",
  existingNhsNumber = "",
  existingDob = "",
  onSave,
  onCancel,
}: QuickPatientEntryFormProps) => {
  const [name, setName] = useState(existingName);
  const [nhsNumber, setNhsNumber] = useState(existingNhsNumber);
  const [dob, setDob] = useState(existingDob);
  const [isSaving, setIsSaving] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Focus name input on mount
  useEffect(() => {
    nameInputRef.current?.focus();
  }, []);

  // Format NHS number with spaces (123 456 7890)
  const formatNhsNumber = useCallback((value: string) => {
    // Remove all non-digits
    const digits = value.replace(/\D/g, '');
    
    // Format with spaces if 10 digits
    if (digits.length >= 10) {
      return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 10)}`;
    }
    
    return digits;
  }, []);

  const handleNhsChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatNhsNumber(e.target.value);
    setNhsNumber(formatted);
  }, [formatNhsNumber]);

  // Parse flexible DOB input
  const parseDob = useCallback((value: string): string => {
    // Already in YYYY-MM-DD format
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return value;
    }
    
    // DD/MM/YYYY format
    const ukFormat = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (ukFormat) {
      const [, day, month, year] = ukFormat;
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
    
    // Just year (e.g., "1975")
    if (/^\d{4}$/.test(value)) {
      return `${value}-01-01`;
    }
    
    // Return as-is if we can't parse
    return value;
  }, []);

  const handleSave = useCallback(async () => {
    // Validate name (min 2 chars if provided)
    const trimmedName = name.trim();
    if (trimmedName && trimmedName.length < 2) {
      toast.error('Name must be at least 2 characters');
      return;
    }

    setIsSaving(true);
    try {
      // Remove spaces from NHS number for storage
      const cleanNhs = nhsNumber.replace(/\s/g, '');
      const parsedDob = dob.trim() ? parseDob(dob.trim()) : null;

      const { error } = await supabase
        .from('gp_consultations')
        .update({
          patient_name: trimmedName || null,
          patient_nhs_number: cleanNhs || null,
          patient_dob: parsedDob,
          patient_context_confidence: trimmedName ? 1.0 : null, // Manual entry = full confidence
        })
        .eq('id', sessionId);

      if (error) throw error;

      toast.success(existingName ? 'Patient details updated' : 'Patient details added');
      onSave();
    } catch (error) {
      console.error('Failed to save patient details:', error);
      toast.error('Failed to save patient details');
    } finally {
      setIsSaving(false);
    }
  }, [name, nhsNumber, dob, sessionId, existingName, parseDob, onSave]);

  const handleClear = useCallback(async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('gp_consultations')
        .update({
          patient_name: null,
          patient_nhs_number: null,
          patient_dob: null,
          patient_context_confidence: null,
        })
        .eq('id', sessionId);

      if (error) throw error;

      toast.success('Patient details cleared');
      onSave();
    } catch (error) {
      console.error('Failed to clear patient details:', error);
      toast.error('Failed to clear patient details');
    } finally {
      setIsSaving(false);
    }
  }, [sessionId, onSave]);

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      onCancel();
    }
  }, [handleSave, onCancel]);

  const isEditing = !!existingName;

  return (
    <div className="space-y-3" onKeyDown={handleKeyDown}>
      <div className="flex items-center gap-2 mb-2">
        <User className="h-4 w-4 text-primary" />
        <h4 className="font-medium text-sm">
          {isEditing ? 'Edit Patient Identifier' : 'Add Patient Identifier'}
        </h4>
      </div>

      <div className="space-y-2">
        <div>
          <Label htmlFor="patient-name" className="text-xs text-muted-foreground">
            Name or Initials
          </Label>
          <div className="relative">
            <User className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              ref={nameInputRef}
              id="patient-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. JS, J.S., James S"
              className="h-8 text-sm pl-7"
            />
          </div>
        </div>

        <div>
          <Label htmlFor="patient-nhs" className="text-xs text-muted-foreground">
            NHS Number (optional)
          </Label>
          <div className="relative">
            <Hash className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              id="patient-nhs"
              value={nhsNumber}
              onChange={handleNhsChange}
              placeholder="e.g. 7384 or 123 456 7890"
              className="h-8 text-sm pl-7"
              maxLength={12}
            />
          </div>
        </div>

        <div>
          <Label htmlFor="patient-dob" className="text-xs text-muted-foreground">
            DOB (optional)
          </Label>
          <div className="relative">
            <Calendar className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              id="patient-dob"
              value={dob}
              onChange={(e) => setDob(e.target.value)}
              placeholder="e.g. 1975 or 15/03/1975"
              className="h-8 text-sm pl-7"
            />
          </div>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Quick identifier for your reference only. Press Enter to save.
      </p>

      <div className="flex items-center gap-2 pt-1">
        {isEditing && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClear}
            disabled={isSaving}
            className="text-destructive hover:text-destructive hover:bg-destructive/10 h-7 text-xs"
          >
            Clear
          </Button>
        )}
        <div className="flex-1" />
        <Button
          variant="ghost"
          size="sm"
          onClick={onCancel}
          disabled={isSaving}
          className="h-7 text-xs"
        >
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={isSaving}
          className="h-7 text-xs"
        >
          {isSaving ? (
            <>
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              Saving...
            </>
          ) : (
            'Save'
          )}
        </Button>
      </div>
    </div>
  );
};
