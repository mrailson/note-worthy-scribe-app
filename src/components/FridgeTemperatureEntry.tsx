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
    console.log('🔵 Record Temperature button clicked!');
    console.log('Fridge:', fridge);
    console.log('Temperature:', temperature);
    console.log('User:', user);
    console.log('Is Public Access:', isPublicAccess);
    
    if (!fridge || !temperature) {
      console.log('❌ Missing fridge or temperature');
      return;
    }
    
    // For public access, we don't require user authentication
    if (!isPublicAccess && !user) {
      console.log('❌ Not public access and no user authenticated');
      return;
    }

    console.log('✅ Validation passed, attempting to record temperature...');


    setSubmitting(true);
    try {
      const tempValue = parseFloat(temperature);
      
      if (isNaN(tempValue)) {
        toast.error('Please enter a valid temperature');
        return;
      }

      const isWithinRange = tempValue >= fridge.min_temp_celsius && tempValue <= fridge.max_temp_celsius;

      const { error } = await supabase
        .from('fridge_temperature_readings')
        .insert([{
          fridge_id: fridge.id,
          temperature_celsius: tempValue,
          recorded_by: user?.id || null, // Allow null for public access
          notes: notes.trim() || null,
          is_within_range: isWithinRange
        }]);

      if (error) {
        console.error('❌ Supabase insert error:', error);
        throw error;
      }
      
      console.log('✅ Temperature recorded successfully to database');
      
      if (isWithinRange) {
        toast.success('Temperature recorded successfully');
      } else {
        toast.warning('Temperature recorded - Alert generated for out of range reading');
      }

      // Reset form
      setTemperature('');
      setNotes('');
    } catch (error) {
      console.error('Error recording temperature:', error);
      toast.error('Failed to record temperature');
    } finally {
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
                disabled={submitting || !temperature}
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