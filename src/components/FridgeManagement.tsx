import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Refrigerator, Plus, QrCode, AlertTriangle, Settings, Thermometer } from 'lucide-react';
import { toast } from 'sonner';
import QRCode from 'qrcode-svg';

interface Fridge {
  id: string;
  fridge_name: string;
  location: string;
  min_temp_celsius: number;
  max_temp_celsius: number;
  qr_code_data: string;
  is_active: boolean;
  created_at: string;
  latest_reading?: {
    temperature_celsius: number;
    recorded_at: string;
    is_within_range: boolean;
  };
  alert_count?: number;
}

export const FridgeManagement = () => {
  const { user } = useAuth();
  const [fridges, setFridges] = useState<Fridge[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedFridge, setSelectedFridge] = useState<Fridge | null>(null);
  const [formData, setFormData] = useState({
    fridge_name: '',
    location: '',
    min_temp_celsius: 2.0,
    max_temp_celsius: 8.0
  });

  useEffect(() => {
    loadFridges();
  }, []);

  const loadFridges = async () => {
    try {
      const { data, error } = await supabase
        .from('practice_fridges')
        .select(`
          *,
          latest_reading:fridge_temperature_readings(
            temperature_celsius,
            recorded_at,
            is_within_range
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get alert counts for each fridge
      const fridgeIds = data?.map(f => f.id) || [];
      const { data: alertData } = await supabase
        .from('fridge_temperature_alerts')
        .select('fridge_id')
        .in('fridge_id', fridgeIds)
        .is('acknowledged_at', null);

      const alertCounts = alertData?.reduce((acc: { [key: string]: number }, alert) => {
        acc[alert.fridge_id] = (acc[alert.fridge_id] || 0) + 1;
        return acc;
      }, {}) || {};

      const fridgesWithAlerts = data?.map(fridge => ({
        ...fridge,
        latest_reading: fridge.latest_reading?.[0] || null,
        alert_count: alertCounts[fridge.id] || 0
      })) || [];

      setFridges(fridgesWithAlerts);
    } catch (error) {
      console.error('Error loading fridges:', error);
      toast.error('Failed to load fridges');
    } finally {
      setLoading(false);
    }
  };

  const generateQRCodeData = (fridgeId: string) => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/public/fridge-temp/${fridgeId}`;
  };

  const handleCreateFridge = async () => {
    if (!user) {
      toast.error('User not authenticated');
      return;
    }

    console.log('Creating fridge with data:', formData);

    try {
      // Validate form data
      if (!formData.fridge_name.trim()) {
        toast.error('Fridge name is required');
        return;
      }
      if (!formData.location.trim()) {
        toast.error('Location is required');
        return;
      }

      // Get user's practice ID - find any role with a practice_id
      const { data: practiceData, error: practiceError } = await supabase
        .from('user_roles')
        .select('practice_id')
        .eq('user_id', user.id)
        .not('practice_id', 'is', null);

      console.log('Practice data:', practiceData, 'Error:', practiceError);

      if (practiceError || !practiceData || practiceData.length === 0) {
        toast.error('No practice found for user. Please contact your administrator.');
        return;
      }

      // Use the first practice_id found
      const practice_id = practiceData[0].practice_id;

      const fridgeId = crypto.randomUUID();
      const qrCodeData = generateQRCodeData(fridgeId);

      console.log('Inserting fridge with ID:', fridgeId);

      const { error } = await supabase
        .from('practice_fridges')
        .insert([{
          id: fridgeId,
          practice_id: practice_id,
          fridge_name: formData.fridge_name,
          location: formData.location,
          min_temp_celsius: formData.min_temp_celsius,
          max_temp_celsius: formData.max_temp_celsius,
          qr_code_data: qrCodeData,
          created_by: user.id
        }]);

      if (error) {
        console.error('Supabase insert error:', error);
        throw error;
      }

      console.log('Fridge created successfully');
      toast.success('Fridge created successfully');
      setIsCreateModalOpen(false);
      setFormData({
        fridge_name: '',
        location: '',
        min_temp_celsius: 2.0,
        max_temp_celsius: 8.0
      });
      loadFridges();
    } catch (error) {
      console.error('Error creating fridge:', error);
      toast.error(`Failed to create fridge: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const generateQRCodeSVG = (qrCodeData: string) => {
    const qr = new QRCode({
      content: qrCodeData,
      width: 200,
      height: 200,
      padding: 4,
      background: '#ffffff',
      color: '#000000',
      ecl: 'M'
    });
    return qr.svg();
  };

  const printQRCode = (fridge: Fridge) => {
    const qrSvg = generateQRCodeSVG(fridge.qr_code_data);
    const printContent = `
      <div style="text-align: center; padding: 20px; font-family: Arial, sans-serif;">
        <h2>${fridge.fridge_name}</h2>
        <p><strong>Location:</strong> ${fridge.location}</p>
        <p><strong>Temperature Range:</strong> ${fridge.min_temp_celsius}°C - ${fridge.max_temp_celsius}°C</p>
        <div style="margin: 20px 0;">
          ${qrSvg}
        </div>
        <p><strong>Scan to record temperature</strong></p>
      </div>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>QR Code - ${fridge.fridge_name}</title>
            <style>
              body { margin: 0; padding: 20px; }
              @media print { body { padding: 0; } }
            </style>
          </head>
          <body>${printContent}</body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Fridge Temperature Monitoring</h2>
          <p className="text-muted-foreground">Manage refrigerators and monitor temperatures for compliance</p>
        </div>
        
        <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Fridge
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Fridge</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="fridge_name">Fridge Name</Label>
                <Input
                  id="fridge_name"
                  value={formData.fridge_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, fridge_name: e.target.value }))}
                  placeholder="e.g., Main Vaccine Fridge"
                />
              </div>
              <div>
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  value={formData.location}
                  onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                  placeholder="e.g., Nurse Station Room 1"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="min_temp">Min Temperature (°C)</Label>
                  <Input
                    id="min_temp"
                    type="number"
                    step="0.1"
                    value={formData.min_temp_celsius}
                    onChange={(e) => setFormData(prev => ({ ...prev, min_temp_celsius: parseFloat(e.target.value) }))}
                  />
                </div>
                <div>
                  <Label htmlFor="max_temp">Max Temperature (°C)</Label>
                  <Input
                    id="max_temp"
                    type="number"
                    step="0.1"
                    value={formData.max_temp_celsius}
                    onChange={(e) => setFormData(prev => ({ ...prev, max_temp_celsius: parseFloat(e.target.value) }))}
                  />
                </div>
              </div>
              <Button 
                onClick={() => {
                  console.log('Create button clicked!');
                  handleCreateFridge();
                }} 
                className="w-full"
              >
                Create Fridge
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {fridges.map((fridge) => (
          <Card key={fridge.id} className="relative">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Refrigerator className="h-5 w-5" />
                  {fridge.fridge_name}
                </CardTitle>
                {fridge.alert_count > 0 && (
                  <Badge variant="destructive" className="flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    {fridge.alert_count}
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">{fridge.location}</p>
            </CardHeader>
            
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span>Range:</span>
                <span className="font-mono">
                  {fridge.min_temp_celsius}°C - {fridge.max_temp_celsius}°C
                </span>
              </div>

              {fridge.latest_reading && (
                <div className="flex items-center justify-between text-sm p-2 rounded bg-muted">
                  <span>Latest:</span>
                  <div className="flex items-center gap-2">
                    <Thermometer className="h-4 w-4" />
                    <span className={`font-mono ${fridge.latest_reading.is_within_range ? 'text-green-600' : 'text-red-600'}`}>
                      {fridge.latest_reading.temperature_celsius}°C
                    </span>
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => printQRCode(fridge)}
                  className="flex-1"
                >
                  <QrCode className="mr-2 h-4 w-4" />
                  Print QR
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedFridge(fridge)}
                  className="flex-1"
                >
                  <Settings className="mr-2 h-4 w-4" />
                  Details
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {fridges.length === 0 && (
        <Card className="text-center py-8">
          <CardContent>
            <Refrigerator className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No fridges configured</h3>
            <p className="text-muted-foreground mb-4">
              Add your first fridge to start monitoring temperatures
            </p>
            <Button onClick={() => setIsCreateModalOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Your First Fridge
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};