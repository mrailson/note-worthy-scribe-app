import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Thermometer, Refrigerator, AlertCircle, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

interface Fridge {
  id: string;
  fridge_name: string;
  location: string;
  min_temp_celsius: number;
  max_temp_celsius: number;
}

export const FridgeTemperatureEntry = () => {
  const { fridgeId } = useParams<{ fridgeId: string }>();
  const navigate = useNavigate();
  const { user, hasModuleAccess } = useAuth();
  const isPublicAccess = window.location.pathname.includes('/public/');
  const [fridge, setFridge] = useState<Fridge | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [temperature, setTemperature] = useState('');
  const [notes, setNotes] = useState('');
  const [recordingSuccess, setRecordingSuccess] = useState<{
    temperature: number;
    fridgeName: string;
    recordedAt: Date;
  } | null>(null);

  useEffect(() => {
    // Skip access check for public QR code access
    if (!isPublicAccess && !hasModuleAccess('fridge_monitoring_access')) {
      toast.error('You do not have access to fridge monitoring');
      navigate('/');
      return;
    }
    
    loadFridge();
  }, [fridgeId, hasModuleAccess, navigate, isPublicAccess]);

  const loadFridge = async () => {
    if (!fridgeId) return;

    try {
      const { data, error } = await supabase
        .from('practice_fridges')
        .select('*')
        .eq('id', fridgeId)
        .eq('is_active', true)
        .single();

      if (error) throw error;
      setFridge(data);
    } catch (error) {
      console.error('Error loading fridge:', error);
      toast.error('Fridge not found or not accessible');
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('🟡 Form submitted!');
    
    if (!fridge || !temperature) {
      toast.error('Please enter a temperature value');
      return;
    }

    const tempValue = parseFloat(temperature);
    if (isNaN(tempValue)) {
      toast.error('Please enter a valid temperature');
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
        notes: notes.trim() || null,
        is_within_range: isWithinRange
      });

      const { data, error } = await supabase
        .from('fridge_temperature_readings')
        .insert({
          fridge_id: fridge.id,
          temperature_celsius: tempValue,
          recorded_by: recordedBy,
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
        recordedAt: new Date()
      });

      // Reset form
      setTemperature('');
      setNotes('');
      
    } catch (error) {
      console.error('💥 Catch block error:', error);
      toast.error(`Error: ${error instanceof Error ? error.message : 'Failed to record temperature'}`);
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
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="text-center py-8">
            <AlertCircle className="mx-auto h-12 w-12 text-destructive mb-4" />
            <h3 className="text-lg font-semibold mb-2">Fridge Not Found</h3>
            <p className="text-muted-foreground">The requested fridge could not be found or is not active.</p>
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
            <CardHeader className="text-center">
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