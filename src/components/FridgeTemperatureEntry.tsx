import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Thermometer, Refrigerator, AlertCircle, CheckCircle, X } from 'lucide-react';
import { showToast } from '@/utils/toastWrapper';
import { addDays, getDay, format } from 'date-fns';

interface Fridge {
  id: string;
  fridge_name: string;
  location: string;
  min_temp_celsius: number;
  max_temp_celsius: number;
}

export const FridgeTemperatureEntry = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, hasModuleAccess } = useAuth();
  const isPublicAccess = window.location.pathname.includes('/public/');
  const [fridge, setFridge] = useState<Fridge | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [temperature, setTemperature] = useState('');
  const [initials, setInitials] = useState('');
  const [notes, setNotes] = useState('');
  const [recordingSuccess, setRecordingSuccess] = useState<{
    temperature: number;
    fridgeName: string;
    recordedAt: Date;
    initials?: string;
  } | null>(null);

  useEffect(() => {
    // Skip access check for public QR code access
    if (!isPublicAccess && !hasModuleAccess('fridge_monitoring_access')) {
      showToast.error('You do not have access to fridge monitoring', { section: 'system' });
      navigate('/');
      return;
    }
    
    loadFridge();
  }, [id, hasModuleAccess, navigate, isPublicAccess]);

  const getNextWorkingDay = (fromDate: Date = new Date()): string => {
    let nextDay = addDays(fromDate, 1);
    let dayOfWeek = getDay(nextDay);
    
    // Skip weekends (0 = Sunday, 6 = Saturday)
    while (dayOfWeek === 0 || dayOfWeek === 6) {
      nextDay = addDays(nextDay, 1);
      dayOfWeek = getDay(nextDay);
    }
    
    return format(nextDay, 'EEEE, d MMMM yyyy');
  };

  const loadFridge = async () => {
    if (!id) return;

    try {
      const { data, error } = await supabase
        .from('practice_fridges')
        .select('*')
        .eq('id', id)
        .eq('is_active', true)
        .single();

      if (error) {
        console.error('Error loading fridge:', error);
        // Check if fridge exists but is inactive
        const { data: inactiveFridge } = await supabase
          .from('practice_fridges')
          .select('fridge_name, is_active')
          .eq('id', id)
          .single();
        
        if (inactiveFridge && !inactiveFridge.is_active) {
          showToast.error(`Fridge "${inactiveFridge.fridge_name}" is inactive`, { section: 'system' });
        } else {
          showToast.error(`Fridge not found. The QR code may be outdated. ID: ${id}`, { section: 'system' });
        }
        throw error;
      }
      setFridge(data);
    } catch (error) {
      console.error('Error loading fridge:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('🟡 Form submitted!');
    
    if (!fridge || !temperature) {
      showToast.error('Please enter a temperature value', { section: 'system' });
      return;
    }

    if (!initials.trim()) {
      showToast.error('Please enter your initials', { section: 'system' });
      return;
    }

    if (initials.trim().length > 2) {
      showToast.error('Initials must be 2 characters or less', { section: 'system' });
      return;
    }

    const tempValue = parseFloat(temperature);
    if (isNaN(tempValue)) {
      showToast.error('Please enter a valid temperature', { section: 'system' });
      return;
    }

    console.log('🟢 Starting database insert...');
    setSubmitting(true);
    
    try {
      const isWithinRange = tempValue >= fridge.min_temp_celsius && tempValue <= fridge.max_temp_celsius;
      const recordedBy = user?.id || null;

      console.log('🔵 Inserting with data:', {
        fridge_id: fridge.id,
        temperature_celsius: tempValue,
        recorded_by: recordedBy,
        recorded_by_initials: initials.trim().toUpperCase(),
        notes: notes.trim() || null,
        is_within_range: isWithinRange
      });

      const { data, error } = await supabase
        .from('fridge_temperature_readings')
        .insert({
          fridge_id: fridge.id,
          temperature_celsius: tempValue,
          recorded_by: recordedBy,
          recorded_by_initials: initials.trim().toUpperCase(),
          notes: notes.trim() || null,
          is_within_range: isWithinRange
        })
        .select();

      console.log('🟣 Database response:', { data, error });

      if (error) {
        console.error('❌ Database error:', error);
        throw new Error(error.message);
      }
      
      console.log('✅ Success! Data inserted:', data);
      
      // Show success screen with recorded data
      setRecordingSuccess({
        temperature: tempValue,
        fridgeName: fridge.fridge_name,
        recordedAt: new Date(),
        initials: initials.trim().toUpperCase()
      });

      // Reset form
      setTemperature('');
      setInitials('');
      setNotes('');
      
    } catch (error) {
      console.error('💥 Catch block error:', error);
      showToast.error(`Error: ${error instanceof Error ? error.message : 'Failed to record temperature'}`, { section: 'system' });
    } finally {
      console.log('🔄 Finally block - resetting submitting state');
      setSubmitting(false);
    }
  };

  const isWithinRange = () => {
    if (!temperature || !fridge) return null;
    const temp = parseFloat(temperature);
    if (isNaN(temp)) return null;
    return temp >= fridge.min_temp_celsius && temp <= fridge.max_temp_celsius;
  };

  const withinRange = isWithinRange();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!fridge) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="text-center py-8">
            <AlertCircle className="mx-auto h-12 w-12 text-destructive mb-4" />
            <h3 className="text-lg font-semibold mb-2">Fridge Not Found</h3>
            <p className="text-muted-foreground mb-4">
              The requested fridge could not be found or is not active.
            </p>
            <div className="bg-muted p-3 rounded-lg text-xs text-left space-y-1">
              <p><strong>QR Code Fridge ID:</strong></p>
              <p className="font-mono break-all">{id}</p>
              <p className="text-muted-foreground mt-2">
                This QR code may be outdated. Please print a new QR code from the Fridge Management dashboard.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show thank you screen after successful recording
  if (recordingSuccess) {
    return (
      <div className="min-h-screen bg-gradient-subtle p-4">
        <div className="max-w-md mx-auto">
          <Card>
            <CardHeader className="text-center relative">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setRecordingSuccess(null)}
                className="absolute right-2 top-2"
                title="Close"
              >
                <X className="h-4 w-4" />
              </Button>
              <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <CardTitle className="text-xl text-green-700">Thank You!</CardTitle>
              <p className="text-muted-foreground">Temperature recorded successfully</p>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="bg-muted p-4 rounded-lg space-y-3">
                <div className="flex justify-between">
                  <span className="font-medium">Fridge:</span>
                  <span>{recordingSuccess.fridgeName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">Temperature:</span>
                  <span className="font-bold">{recordingSuccess.temperature}°C</span>
                </div>
                {recordingSuccess.initials && (
                  <div className="flex justify-between">
                    <span className="font-medium">Recorded by:</span>
                    <span className="font-bold">{recordingSuccess.initials}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="font-medium">Date:</span>
                  <span>{recordingSuccess.recordedAt.toLocaleDateString('en-GB')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">Time:</span>
                  <span>{recordingSuccess.recordedAt.toLocaleTimeString('en-GB', { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  })}</span>
                </div>
              </div>

              <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 p-4 rounded-lg text-center">
                <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                  Next check due on
                </p>
                <p className="text-lg font-semibold text-blue-700 dark:text-blue-300 mt-1">
                  {getNextWorkingDay(recordingSuccess.recordedAt)}
                </p>
              </div>

              <div className="space-y-3">
                <Button
                  onClick={() => setRecordingSuccess(null)}
                  className="w-full"
                  variant="outline"
                >
                  Record Another Temperature
                </Button>
                
                {!isPublicAccess && (
                  <Button
                    onClick={() => navigate('/practice-admin/fridges')}
                    className="w-full"
                  >
                    Back to Dashboard
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-subtle p-4">
      <div className="max-w-md mx-auto">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <Refrigerator className="w-8 h-8 text-primary" />
            </div>
            <CardTitle className="text-xl">{fridge.fridge_name}</CardTitle>
            <p className="text-muted-foreground">{fridge.location}</p>
            <div className="text-sm bg-muted p-2 rounded">
              <strong>Target Range:</strong> {fridge.min_temp_celsius}°C - {fridge.max_temp_celsius}°C
            </div>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="temperature" className="text-base font-semibold">
                  Temperature Reading
                </Label>
                <div className="relative">
                  <Thermometer className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
                  <Input
                    id="temperature"
                    type="number"
                    step="0.1"
                    value={temperature}
                    onChange={(e) => setTemperature(e.target.value)}
                    placeholder="e.g., 5.2"
                    className={`pl-10 text-lg text-center ${
                      withinRange === true ? 'border-green-500 bg-green-50' :
                      withinRange === false ? 'border-red-500 bg-red-50' : ''
                    }`}
                    required
                  />
                  <div className="absolute right-3 top-3 text-muted-foreground">°C</div>
                </div>
                
                {withinRange !== null && (
                  <div className={`flex items-center gap-2 text-sm ${
                    withinRange ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {withinRange ? (
                      <>
                        <CheckCircle className="h-4 w-4" />
                        <span>Temperature is within range</span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="h-4 w-4" />
                        <span>Temperature is outside acceptable range</span>
                      </>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="initials" className="text-base font-semibold">
                  Your Initials
                </Label>
                <Input
                  id="initials"
                  type="text"
                  value={initials}
                  onChange={(e) => {
                    const value = e.target.value.toUpperCase();
                    if (value.length <= 2) {
                      setInitials(value);
                    }
                  }}
                  placeholder="e.g., AB"
                  maxLength={2}
                  className="text-lg text-center uppercase"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Enter 2 characters maximum
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes (Optional)</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any observations or comments..."
                  className="resize-none"
                  rows={3}
                />
              </div>

              <Button
                type="submit"
                className="w-full text-lg py-6"
                disabled={submitting || !temperature.trim()}
              >
                {submitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Recording...
                  </>
                ) : (
                  'Record Temperature'
                )}
              </Button>
            </form>

            {!isPublicAccess && (
              <div className="mt-6 text-center">
                <Button
                  variant="outline"
                  onClick={() => navigate('/practice-admin/fridges')}
                  className="text-sm"
                >
                  Back to Dashboard
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};