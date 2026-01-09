import { useState, useEffect } from 'react';
import { format, isToday, isYesterday, differenceInDays, getDay } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Refrigerator, Plus, QrCode, AlertTriangle, Settings, Thermometer, CheckCircle, XCircle, User, Pencil, Download, Wifi, WifiOff } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { showToast } from '@/utils/toastWrapper';
import QRCode from 'qrcode-svg';
import { Document, Paragraph, TextRun, Table as DocxTable, TableCell as DocxTableCell, TableRow as DocxTableRow, Packer, WidthType, AlignmentType, BorderStyle } from 'docx';
import { saveAs } from 'file-saver';

interface Fridge {
  id: string;
  fridge_name: string;
  location: string;
  min_temp_celsius: number;
  max_temp_celsius: number;
  qr_code_data: string;
  is_active: boolean;
  is_online: boolean;
  created_at: string;
  latest_reading?: {
    temperature_celsius: number;
    recorded_at: string;
    is_within_range: boolean;
  };
  alert_count?: number;
}

interface TemperatureReading {
  id: string;
  temperature_celsius: number;
  recorded_at: string;
  is_within_range: boolean;
  notes?: string;
  recorded_by?: string;
  recorded_by_initials?: string;
  recorder_email?: string;
}

export const FridgeManagement = () => {
  const { user } = useAuth();
  const [fridges, setFridges] = useState<Fridge[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedFridge, setSelectedFridge] = useState<Fridge | null>(null);
  const [qrCodeFridge, setQrCodeFridge] = useState<Fridge | null>(null);
  const [editFridge, setEditFridge] = useState<Fridge | null>(null);
  const [temperatureHistory, setTemperatureHistory] = useState<TemperatureReading[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [formData, setFormData] = useState({
    fridge_name: '',
    location: '',
    min_temp_celsius: 2.0,
    max_temp_celsius: 8.0
  });
  const [editFormData, setEditFormData] = useState({
    fridge_name: '',
    location: ''
  });

  useEffect(() => {
    loadFridges();
    
    // Set up real-time subscription to refresh when new temperature readings are added
    const channel = supabase
      .channel('fridge-temperature-updates')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'fridge_temperature_readings'
        },
        () => {
          console.log('New temperature reading detected, refreshing fridge data...');
          loadFridges();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadFridges = async () => {
    try {
      // First get all fridges
      const { data: fridgeData, error: fridgeError } = await supabase
        .from('practice_fridges')
        .select('*')
        .order('created_at', { ascending: false });

      if (fridgeError) throw fridgeError;

      // Get the latest temperature reading for all fridges in a single query (avoid N+1)
      const ids = (fridgeData || []).map(f => f.id);
      const latestByFridge: Record<string, { temperature_celsius: number; recorded_at: string; is_within_range: boolean }> = {};
      if (ids.length > 0) {
        const { data: readingsData, error: readingsError } = await supabase
          .from('fridge_temperature_readings')
          .select('fridge_id, temperature_celsius, recorded_at, is_within_range')
          .in('fridge_id', ids)
          .order('recorded_at', { ascending: false });

        if (readingsError) throw readingsError;

        for (const r of (readingsData || []) as any[]) {
          // first occurrence after ordering desc is the latest per fridge
          if (!latestByFridge[(r as any).fridge_id]) {
            latestByFridge[(r as any).fridge_id] = {
              temperature_celsius: (r as any).temperature_celsius,
              recorded_at: (r as any).recorded_at,
              is_within_range: (r as any).is_within_range,
            };
          }
        }
      }

      const fridgesWithReadings = (fridgeData || []).map(fridge => ({
        ...fridge,
        latest_reading: latestByFridge[fridge.id] || null,
      }));

      // Get alert counts for each fridge
      const fridgeIds = fridgeData?.map(f => f.id) || [];
      const { data: alertData } = await supabase
        .from('fridge_temperature_alerts')
        .select('fridge_id')
        .in('fridge_id', fridgeIds)
        .is('acknowledged_at', null);

      const alertCounts = alertData?.reduce((acc: { [key: string]: number }, alert) => {
        acc[alert.fridge_id] = (acc[alert.fridge_id] || 0) + 1;
        return acc;
      }, {}) || {};

      const fridgesWithAlerts = fridgesWithReadings.map(fridge => ({
        ...fridge,
        alert_count: alertCounts[fridge.id] || 0
      }));

      setFridges(fridgesWithAlerts);
      console.log('Fridges loaded with latest readings:', fridgesWithAlerts);
    } catch (error) {
      console.error('Error loading fridges:', error);
      showToast.error('Failed to load fridges', { section: 'system' });
    } finally {
      setLoading(false);
    }
  };

  const loadTemperatureHistory = async (fridgeId: string) => {
    setHistoryLoading(true);
    try {
      const { data, error } = await supabase
        .from('fridge_temperature_readings')
        .select(`
          id,
          temperature_celsius,
          recorded_at,
          is_within_range,
          notes,
          recorded_by,
          recorded_by_initials
        `)
        .eq('fridge_id', fridgeId)
        .order('recorded_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      // Get user emails for the recorded_by user IDs
      const userIds = data?.map(r => r.recorded_by).filter(Boolean) || [];
      let userEmails: { [key: string]: string } = {};
      
      if (userIds.length > 0) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('user_id, email')
          .in('user_id', userIds);
        
        userEmails = profileData?.reduce((acc, profile) => {
          acc[profile.user_id] = profile.email;
          return acc;
        }, {} as { [key: string]: string }) || {};
      }

      const formattedData = data?.map(reading => ({
        ...reading,
        recorder_email: reading.recorded_by 
          ? userEmails[reading.recorded_by] || 'Unknown' 
          : (reading.recorded_by_initials ? `Initials: ${reading.recorded_by_initials}` : 'QR Scan and Input')
      })) || [];

      setTemperatureHistory(formattedData);
    } catch (error) {
      console.error('Error loading temperature history:', error);
      showToast.error('Failed to load temperature history', { section: 'system' });
    } finally {
      setHistoryLoading(false);
    }
  };

  const generateQRCodeData = (fridgeId: string) => {
    // Always use current origin to ensure QR codes work after deployment/domain changes
    const baseUrl = window.location.origin;
    return `${baseUrl}/public/fridge-temp/${fridgeId}`;
  };

  const updateAllQRCodes = async () => {
    try {
      const updates = fridges.map(fridge => ({
        id: fridge.id,
        qr_code_data: generateQRCodeData(fridge.id)
      }));

      for (const update of updates) {
        const { error } = await supabase
          .from('practice_fridges')
          .update({ qr_code_data: update.qr_code_data })
          .eq('id', update.id);

        if (error) {
          console.error(`Error updating QR code for fridge ${update.id}:`, error);
        }
      }

      showToast.success('All QR codes updated to current domain', { section: 'system' });
      loadFridges(); // Reload to show updated data
    } catch (error) {
      console.error('Error updating QR codes:', error);
      showToast.error('Failed to update QR codes', { section: 'system' });
    }
  };

  const handleCreateFridge = async () => {
    if (!user) {
      showToast.error('User not authenticated', { section: 'system' });
      return;
    }

    console.log('Creating fridge with data:', formData);

    try {
      // Validate form data
      if (!formData.fridge_name.trim()) {
        showToast.error('Fridge name is required', { section: 'system' });
        return;
      }
      if (!formData.location.trim()) {
        showToast.error('Location is required', { section: 'system' });
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
        showToast.error('No practice found for user. Please contact your administrator.', { section: 'system' });
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
      showToast.success('Fridge created successfully', { section: 'system' });
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
      showToast.error(`Failed to create fridge: ${error instanceof Error ? error.message : 'Unknown error'}`, { section: 'system' });
    }
  };

  const formatReadingDateTime = (dateString: string) => {
    const date = new Date(dateString);
    const time = format(date, 'HH:mm');
    
    if (isToday(date)) {
      return `Today ${time}`;
    } else if (isYesterday(date)) {
      return `Yesterday ${time}`;
    } else {
      return format(date, 'dd/MM/yyyy HH:mm');
    }
  };

  const isReadingOverdue = (dateString: string) => {
    const recordedDate = new Date(dateString);
    const today = new Date();
    const daysSince = differenceInDays(today, recordedDate);
    const todayDayOfWeek = getDay(today); // 0 = Sunday, 1 = Monday, etc.
    
    // If today is Monday (1), allow up to 3 days ago (Friday)
    if (todayDayOfWeek === 1) {
      return daysSince > 3;
    }
    
    // For any other day, anything beyond yesterday is overdue
    return daysSince > 1;
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

  const handleEditFridge = async () => {
    if (!editFridge) return;

    try {
      if (!editFormData.fridge_name.trim()) {
        showToast.error('Fridge name is required', { section: 'system' });
        return;
      }
      if (!editFormData.location.trim()) {
        showToast.error('Location is required', { section: 'system' });
        return;
      }

      const { error } = await supabase
        .from('practice_fridges')
        .update({
          fridge_name: editFormData.fridge_name,
          location: editFormData.location
        })
        .eq('id', editFridge.id);

      if (error) throw error;

      showToast.success('Fridge updated successfully', { section: 'system' });
      setEditFridge(null);
      setEditFormData({ fridge_name: '', location: '' });
      loadFridges();
    } catch (error) {
      console.error('Error updating fridge:', error);
      showToast.error('Failed to update fridge', { section: 'system' });
    }
  };

  const toggleFridgeStatus = async (fridge: Fridge, newStatus: boolean) => {
    if (!user) {
      showToast.error('User not authenticated', { section: 'system' });
      return;
    }

    try {
      // Update fridge status
      const { error: updateError } = await supabase
        .from('practice_fridges')
        .update({ is_online: newStatus })
        .eq('id', fridge.id);

      if (updateError) throw updateError;

      // Log the status change
      const { error: logError } = await supabase
        .from('fridge_status_changes')
        .insert({
          fridge_id: fridge.id,
          changed_by: user.id,
          previous_status: fridge.is_online,
          new_status: newStatus,
          notes: `Status changed from ${fridge.is_online ? 'Online' : 'Offline'} to ${newStatus ? 'Online' : 'Offline'}`
        });

      if (logError) throw logError;

      showToast.success(`Fridge is now ${newStatus ? 'online' : 'offline'}`, { section: 'system' });
      loadFridges();
    } catch (error) {
      console.error('Error toggling fridge status:', error);
      showToast.error('Failed to update fridge status', { section: 'system' });
    }
  };

  const downloadTemperatureHistoryAsWord = async (fridge: Fridge) => {
    if (temperatureHistory.length === 0) {
      showToast.error('No temperature readings to export', { section: 'system' });
      return;
    }

    try {
      // Create header section
      const headerParagraphs = [
        new Paragraph({
          text: 'Fridge Temperature Monitoring Report',
          heading: 'Heading1',
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 }
        }),
        new Paragraph({
          text: `Fridge Name: ${fridge.fridge_name}`,
          spacing: { after: 100 }
        }),
        new Paragraph({
          text: `Location: ${fridge.location}`,
          spacing: { after: 100 }
        }),
        new Paragraph({
          text: `Temperature Range: ${fridge.min_temp_celsius}°C - ${fridge.max_temp_celsius}°C`,
          spacing: { after: 100 }
        }),
        new Paragraph({
          text: `Report Generated: ${new Date().toLocaleDateString('en-GB')} ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`,
          spacing: { after: 100 }
        }),
        new Paragraph({
          text: `Total Readings: ${temperatureHistory.length}`,
          spacing: { after: 300 }
        })
      ];

      // Create table header
      const tableRows = [
        new DocxTableRow({
          children: [
            new DocxTableCell({
              children: [new Paragraph({ children: [new TextRun({ text: 'Date', bold: true })] })],
              width: { size: 2000, type: WidthType.DXA }
            }),
            new DocxTableCell({
              children: [new Paragraph({ children: [new TextRun({ text: 'Time', bold: true })] })],
              width: { size: 1500, type: WidthType.DXA }
            }),
            new DocxTableCell({
              children: [new Paragraph({ children: [new TextRun({ text: 'Temperature (°C)', bold: true })] })],
              width: { size: 1800, type: WidthType.DXA }
            }),
            new DocxTableCell({
              children: [new Paragraph({ children: [new TextRun({ text: 'Status', bold: true })] })],
              width: { size: 1500, type: WidthType.DXA }
            }),
            new DocxTableCell({
              children: [new Paragraph({ children: [new TextRun({ text: 'Recorded By', bold: true })] })],
              width: { size: 2500, type: WidthType.DXA }
            }),
            new DocxTableCell({
              children: [new Paragraph({ children: [new TextRun({ text: 'Notes', bold: true })] })],
              width: { size: 3000, type: WidthType.DXA }
            })
          ]
        })
      ];

      // Add data rows
      temperatureHistory.forEach(reading => {
        const recordedDate = new Date(reading.recorded_at);
        const recordedBy = reading.recorded_by 
          ? (reading.recorder_email || 'Unknown User')
          : (reading.recorded_by_initials ? `Initials: ${reading.recorded_by_initials}` : 'QR Scan');
        
        tableRows.push(
          new DocxTableRow({
            children: [
              new DocxTableCell({
                children: [new Paragraph(recordedDate.toLocaleDateString('en-GB'))]
              }),
              new DocxTableCell({
                children: [new Paragraph(recordedDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }))]
              }),
              new DocxTableCell({
                children: [new Paragraph(reading.temperature_celsius.toString())]
              }),
              new DocxTableCell({
                children: [new Paragraph(reading.is_within_range ? 'In Range' : 'Out of Range')]
              }),
              new DocxTableCell({
                children: [new Paragraph(recordedBy)]
              }),
              new DocxTableCell({
                children: [new Paragraph(reading.notes || '-')]
              })
            ]
          })
        );
      });

      const table = new DocxTable({
        rows: tableRows,
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: {
          top: { style: BorderStyle.SINGLE, size: 1 },
          bottom: { style: BorderStyle.SINGLE, size: 1 },
          left: { style: BorderStyle.SINGLE, size: 1 },
          right: { style: BorderStyle.SINGLE, size: 1 },
          insideHorizontal: { style: BorderStyle.SINGLE, size: 1 },
          insideVertical: { style: BorderStyle.SINGLE, size: 1 }
        }
      });

      // Create document
      const doc = new Document({
        sections: [{
          properties: {},
          children: [...headerParagraphs, table]
        }]
      });

      // Generate and download
      const blob = await Packer.toBlob(doc);
      const fileName = `${fridge.fridge_name.replace(/[^a-z0-9]/gi, '_')}_Temperature_Log_${format(new Date(), 'dd-MM-yyyy')}.docx`;
      saveAs(blob, fileName);
      
      showToast.success('Temperature log downloaded successfully', { section: 'system' });
    } catch (error) {
      console.error('Error generating Word document:', error);
      showToast.error('Failed to generate document', { section: 'system' });
    }
  };

  const printQRCode = (fridge: Fridge) => {
    const qrSvg = generateQRCodeSVG(generateQRCodeData(fridge.id));
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
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={updateAllQRCodes}>
            <QrCode className="mr-2 h-4 w-4" />
            Update All QR Codes
          </Button>
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
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {fridges.map((fridge) => (
          <Card key={fridge.id} className={`relative ${!fridge.is_online ? 'opacity-75 border-dashed' : ''}`}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Refrigerator className="h-5 w-5" />
                    <a 
                      href={generateQRCodeData(fridge.id)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline cursor-pointer"
                      title="Click to open temperature entry form"
                    >
                      {fridge.fridge_name}
                    </a>
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditFridge(fridge);
                      setEditFormData({
                        fridge_name: fridge.fridge_name,
                        location: fridge.location
                      });
                    }}
                    className="h-8 w-8 p-0"
                    title="Edit Fridge"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setQrCodeFridge(fridge)}
                    className="h-8 w-8 p-0"
                    title="Show QR Code"
                  >
                    <QrCode className="h-4 w-4" />
                  </Button>
                </div>
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
              <div className="flex items-center justify-between p-3 rounded bg-muted/50 border">
                <div className="flex items-center gap-2">
                  {fridge.is_online ? (
                    <Wifi className="h-4 w-4 text-green-600" />
                  ) : (
                    <WifiOff className="h-4 w-4 text-red-600" />
                  )}
                  <span className="text-sm font-medium">
                    {fridge.is_online ? 'Online' : 'Offline'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Recording:</span>
                  <Switch
                    checked={fridge.is_online}
                    onCheckedChange={(checked) => toggleFridgeStatus(fridge, checked)}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span>Range:</span>
                <span className="font-mono">
                  {fridge.min_temp_celsius}°C - {fridge.max_temp_celsius}°C
                </span>
              </div>

              {fridge.latest_reading ? (
                <>
                  <div className="flex items-center justify-between text-sm p-2 rounded bg-muted">
                    <div className="flex items-center gap-2">
                      <span>Latest:</span>
                      {(() => {
                        const recordedDate = new Date(fridge.latest_reading.recorded_at);
                        const today = new Date();
                        const isRecordedToday = recordedDate.toDateString() === today.toDateString();
                        const isWithinRange = fridge.latest_reading.is_within_range;
                        const statusColor = isRecordedToday && isWithinRange ? 'bg-green-500' : 'bg-red-500';
                        const statusTitle = isRecordedToday && isWithinRange 
                          ? 'Recorded today & within range' 
                          : !isRecordedToday 
                            ? 'No reading recorded today' 
                            : 'Out of range';
                        return (
                          <div className={`w-3 h-3 rounded-full ${statusColor}`} title={statusTitle} />
                        );
                      })()}
                    </div>
                    <div className="flex items-center gap-2">
                      <Thermometer className="h-4 w-4" />
                      <span className={`font-mono ${fridge.latest_reading.is_within_range ? 'text-green-600' : 'text-red-600'}`}>
                        {fridge.latest_reading.temperature_celsius}°C
                      </span>
                    </div>
                  </div>
                  
                  <div className="text-xs text-center p-2 rounded bg-muted/50">
                    <span className="text-muted-foreground">Last recorded: </span>
                    <span className={`font-medium ${
                      isReadingOverdue(fridge.latest_reading.recorded_at) ? 'text-red-600' : ''
                    }`}>
                      {formatReadingDateTime(fridge.latest_reading.recorded_at)}
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between text-sm p-2 rounded bg-muted">
                    <div className="flex items-center gap-2">
                      <span>Latest:</span>
                      <div 
                        className="w-3 h-3 rounded-full bg-red-500" 
                        title="No readings recorded yet"
                      />
                    </div>
                    <span className="text-sm text-muted-foreground">No readings</span>
                  </div>
                  
                  <div className="text-xs text-center p-2 rounded bg-muted/50">
                    <span className="text-muted-foreground">Created: </span>
                    <span className="font-medium">
                      {formatReadingDateTime(fridge.created_at)}
                    </span>
                  </div>
                </>
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
                  onClick={() => {
                    setSelectedFridge(fridge);
                    loadTemperatureHistory(fridge.id);
                  }}
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

      {/* Details Modal */}
      <Dialog open={!!selectedFridge} onOpenChange={(open) => !open && setSelectedFridge(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Refrigerator className="h-5 w-5" />
              {selectedFridge?.fridge_name} - Temperature History
            </DialogTitle>
          </DialogHeader>
          
          {selectedFridge && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <Button
                  variant="outline"
                  onClick={() => downloadTemperatureHistoryAsWord(selectedFridge)}
                  disabled={temperatureHistory.length === 0}
                  className="gap-2"
                >
                  <Download className="h-4 w-4" />
                  Download as Word Document
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
                <div>
                  <strong>Location:</strong> {selectedFridge.location}
                </div>
                <div>
                  <strong>Temperature Range:</strong> {selectedFridge.min_temp_celsius}°C - {selectedFridge.max_temp_celsius}°C
                </div>
                <div>
                  <strong>Created:</strong> {new Date(selectedFridge.created_at).toLocaleDateString('en-GB')}
                </div>
                <div>
                  <strong>Status:</strong> {selectedFridge.is_active ? 'Active' : 'Inactive'}
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-4">Recent Temperature Readings (Last 50)</h3>
                {historyLoading ? (
                  <div className="flex items-center justify-center p-8">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                  </div>
                ) : (
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date & Time</TableHead>
                          <TableHead>Temperature</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Recorded By</TableHead>
                          <TableHead>Notes</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {temperatureHistory.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                              No temperature readings recorded yet
                            </TableCell>
                          </TableRow>
                        ) : (
                          temperatureHistory.map((reading) => (
                            <TableRow key={reading.id}>
                              <TableCell>
                                <div className="font-mono text-sm">
                                  <div>{new Date(reading.recorded_at).toLocaleDateString('en-GB')}</div>
                                  <div className="text-muted-foreground">
                                    {new Date(reading.recorded_at).toLocaleTimeString('en-GB', { 
                                      hour: '2-digit', 
                                      minute: '2-digit' 
                                    })}
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Thermometer className="h-4 w-4" />
                                  <span className={`font-mono ${reading.is_within_range ? 'text-green-600' : 'text-red-600'}`}>
                                    {reading.temperature_celsius}°C
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant={reading.is_within_range ? 'default' : 'destructive'} className="flex items-center gap-1 w-fit">
                                  {reading.is_within_range ? (
                                    <>
                                      <CheckCircle className="h-3 w-3" />
                                      In Range
                                    </>
                                  ) : (
                                    <>
                                      <XCircle className="h-3 w-3" />
                                      Out of Range
                                    </>
                                  )}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2 text-sm">
                                  <User className="h-4 w-4 text-muted-foreground" />
                                  {reading.recorder_email}
                                </div>
                              </TableCell>
                              <TableCell>
                                <span className="text-sm text-muted-foreground">
                                  {reading.notes || '-'}
                                </span>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Fridge Modal */}
      <Dialog open={!!editFridge} onOpenChange={(open) => !open && setEditFridge(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Fridge</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit_fridge_name">Fridge Name</Label>
              <Input
                id="edit_fridge_name"
                value={editFormData.fridge_name}
                onChange={(e) => setEditFormData(prev => ({ ...prev, fridge_name: e.target.value }))}
                placeholder="e.g., Main Vaccine Fridge"
              />
            </div>
            <div>
              <Label htmlFor="edit_location">Location</Label>
              <Input
                id="edit_location"
                value={editFormData.location}
                onChange={(e) => setEditFormData(prev => ({ ...prev, location: e.target.value }))}
                placeholder="e.g., Nurse Station Room 1"
              />
            </div>
            
            {/* Online/Offline Toggle */}
            {editFridge && (
              <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/50">
                <div className="flex items-center gap-3">
                  {editFridge.is_online ? (
                    <Wifi className="h-5 w-5 text-green-600" />
                  ) : (
                    <WifiOff className="h-5 w-5 text-red-600" />
                  )}
                  <div>
                    <Label className="text-base font-medium">Recording Status</Label>
                    <p className="text-sm text-muted-foreground">
                      {editFridge.is_online ? 'Temperature recording is enabled' : 'Temperature recording is disabled'}
                    </p>
                  </div>
                </div>
                <Switch
                  checked={editFridge.is_online}
                  onCheckedChange={(checked) => toggleFridgeStatus(editFridge, checked)}
                />
              </div>
            )}
            
            <Button onClick={handleEditFridge} className="w-full">
              Update Fridge
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* QR Code Modal */}
      <Dialog open={!!qrCodeFridge} onOpenChange={(open) => !open && setQrCodeFridge(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5" />
              QR Code - {qrCodeFridge?.fridge_name}
            </DialogTitle>
          </DialogHeader>
          
          {qrCodeFridge && (
            <div className="space-y-4">
              <div className="text-center p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground mb-2">
                  <strong>Location:</strong> {qrCodeFridge.location}
                </p>
                <p className="text-sm text-muted-foreground">
                  <strong>Temperature Range:</strong> {qrCodeFridge.min_temp_celsius}°C - {qrCodeFridge.max_temp_celsius}°C
                </p>
              </div>

              <div 
                className="bg-white p-6 rounded-lg flex items-center justify-center"
                dangerouslySetInnerHTML={{ __html: generateQRCodeSVG(generateQRCodeData(qrCodeFridge.id)) }}
              />

              <div className="text-center">
                <p className="text-sm font-medium mb-2">Scan to record temperature</p>
                <Button
                  variant="outline"
                  onClick={() => printQRCode(qrCodeFridge)}
                  className="w-full"
                >
                  Print QR Code
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

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