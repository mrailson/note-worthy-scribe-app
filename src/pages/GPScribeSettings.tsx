import { useState, useEffect } from "react";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Save, Plus, Edit, Trash2, Building2, UserCheck, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

interface PracticeDetail {
  id: string;
  practice_name: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
}

interface SpecialistService {
  id: string;
  service_name: string;
  department?: string;
  hospital_name?: string;
  contact_person?: string;
  phone?: string;
  email?: string;
  address?: string;
  specialty_type?: string;
  notes?: string;
  is_default: boolean;
}

interface GPSignatureSettings {
  id?: string;
  gp_name: string;
  qualifications?: string;
  practice_name?: string;
  practice_id?: string;
  job_title?: string;
  gmc_number?: string;
}

const GPScribeSettings = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  
  const [practices, setPractices] = useState<PracticeDetail[]>([]);
  const [specialistServices, setSpecialistServices] = useState<SpecialistService[]>([]);
  const [gpSignature, setGpSignature] = useState<GPSignatureSettings>({
    gp_name: "",
    qualifications: "",
    practice_name: "",
    practice_id: "",
    job_title: "",
    gmc_number: ""
  });
  
  const [newService, setNewService] = useState<Partial<SpecialistService>>({
    service_name: "",
    department: "",
    hospital_name: "",
    contact_person: "",
    phone: "",
    email: "",
    address: "",
    specialty_type: "",
    notes: "",
    is_default: false
  });
  
  const [editingService, setEditingService] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    await Promise.all([
      loadPractices(),
      loadSpecialistServices(),
      loadGPSignature()
    ]);
  };

  const loadPractices = async () => {
    try {
      const { data, error } = await supabase
        .from('practice_details')
        .select('*')
        .eq('user_id', user?.id);

      if (error) throw error;
      setPractices(data || []);
    } catch (error: any) {
      toast.error(`Error loading practices: ${error.message}`);
    }
  };

  const loadSpecialistServices = async () => {
    try {
      const { data, error } = await supabase
        .from('specialist_services')
        .select('*')
        .eq('user_id', user?.id)
        .order('service_name');

      if (error) throw error;
      setSpecialistServices(data || []);
    } catch (error: any) {
      toast.error(`Error loading specialist services: ${error.message}`);
    }
  };

  const loadGPSignature = async () => {
    try {
      const { data, error } = await supabase
        .from('gp_signature_settings')
        .select('*')
        .eq('user_id', user?.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      
      if (data) {
        setGpSignature(data);
      }
    } catch (error: any) {
      console.log('No existing GP signature settings found');
    }
  };

  const saveGPSignature = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      const signatureData = {
        ...gpSignature,
        user_id: user.id
      };

      if (gpSignature.id) {
        // Update existing
        const { error } = await supabase
          .from('gp_signature_settings')
          .update(signatureData)
          .eq('id', gpSignature.id);
        
        if (error) throw error;
      } else {
        // Insert new
        const { data, error } = await supabase
          .from('gp_signature_settings')
          .insert([signatureData])
          .select()
          .single();
        
        if (error) throw error;
        setGpSignature(data);
      }

      toast.success("GP signature settings saved successfully");
    } catch (error: any) {
      toast.error(`Error saving GP signature: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const addSpecialistService = async () => {
    if (!user || !newService.service_name?.trim()) return;

    setIsLoading(true);
    try {
      const serviceData = {
        service_name: newService.service_name,
        department: newService.department || null,
        hospital_name: newService.hospital_name || null,
        contact_person: newService.contact_person || null,
        phone: newService.phone || null,
        email: newService.email || null,
        address: newService.address || null,
        specialty_type: newService.specialty_type || null,
        notes: newService.notes || null,
        is_default: newService.is_default || false,
        user_id: user.id
      };

      const { data, error } = await supabase
        .from('specialist_services')
        .insert([serviceData])
        .select()
        .single();

      if (error) throw error;

      setSpecialistServices(prev => [...prev, data]);
      setNewService({
        service_name: "",
        department: "",
        hospital_name: "",
        contact_person: "",
        phone: "",
        email: "",
        address: "",
        specialty_type: "",
        notes: "",
        is_default: false
      });
      
      toast.success("Specialist service added successfully");
    } catch (error: any) {
      toast.error(`Error adding specialist service: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const updateSpecialistService = async (service: SpecialistService) => {
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('specialist_services')
        .update(service)
        .eq('id', service.id);

      if (error) throw error;

      setSpecialistServices(prev => 
        prev.map(s => s.id === service.id ? service : s)
      );
      setEditingService(null);
      
      toast.success("Specialist service updated successfully");
    } catch (error: any) {
      toast.error(`Error updating specialist service: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const deleteSpecialistService = async (serviceId: string) => {
    if (!confirm("Are you sure you want to delete this specialist service?")) return;

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('specialist_services')
        .delete()
        .eq('id', serviceId);

      if (error) throw error;

      setSpecialistServices(prev => prev.filter(s => s.id !== serviceId));
      toast.success("Specialist service deleted successfully");
    } catch (error: any) {
      toast.error(`Error deleting specialist service: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/5">
      <Header onNewMeeting={() => {}} />
      
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="flex items-center gap-4 mb-8">
          <Button
            variant="outline"
            onClick={() => navigate('/gp-scribe')}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to GP Scribe
          </Button>
          <h1 className="text-3xl font-bold">GP Scribe Settings</h1>
        </div>

        <Tabs defaultValue="signature" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="signature" className="flex items-center gap-2">
              <UserCheck className="h-4 w-4" />
              GP Signature
            </TabsTrigger>
            <TabsTrigger value="practices" className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Practice Details
            </TabsTrigger>
            <TabsTrigger value="specialists" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Specialist Services
            </TabsTrigger>
          </TabsList>

          {/* GP Signature Settings */}
          <TabsContent value="signature">
            <Card>
              <CardHeader>
                <CardTitle>GP Signature Settings</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Configure your default signature details for referral letters and clinical notes.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="gp_name">GP Name *</Label>
                    <Input
                      id="gp_name"
                      value={gpSignature.gp_name}
                      onChange={(e) => setGpSignature(prev => ({ ...prev, gp_name: e.target.value }))}
                      placeholder="Dr. John Smith"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="qualifications">Qualifications</Label>
                    <Input
                      id="qualifications"
                      value={gpSignature.qualifications || ""}
                      onChange={(e) => setGpSignature(prev => ({ ...prev, qualifications: e.target.value }))}
                      placeholder="MBBS, MRCGP, DRCOG"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="job_title">Job Title</Label>
                    <Input
                      id="job_title"
                      value={gpSignature.job_title || ""}
                      onChange={(e) => setGpSignature(prev => ({ ...prev, job_title: e.target.value }))}
                      placeholder="General Practitioner"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="gmc_number">GMC Number</Label>
                    <Input
                      id="gmc_number"
                      value={gpSignature.gmc_number || ""}
                      onChange={(e) => setGpSignature(prev => ({ ...prev, gmc_number: e.target.value }))}
                      placeholder="1234567"
                    />
                  </div>
                  
                  <div className="md:col-span-2">
                    <Label htmlFor="practice_select">Practice</Label>
                    <Select
                      value={gpSignature.practice_id || ""}
                      onValueChange={(value) => {
                        const selectedPractice = practices.find(p => p.id === value);
                        setGpSignature(prev => ({
                          ...prev,
                          practice_id: value,
                          practice_name: selectedPractice?.practice_name || ""
                        }));
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a practice" />
                      </SelectTrigger>
                      <SelectContent>
                        {practices.map((practice) => (
                          <SelectItem key={practice.id} value={practice.id}>
                            {practice.practice_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="flex justify-end">
                  <Button onClick={saveGPSignature} disabled={isLoading || !gpSignature.gp_name}>
                    <Save className="h-4 w-4 mr-2" />
                    Save Signature Settings
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Practice Details */}
          <TabsContent value="practices">
            <Card>
              <CardHeader>
                <CardTitle>Practice Details</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Manage your practice details. Go to the main Settings page to add new practices.
                </p>
              </CardHeader>
              <CardContent>
                {practices.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground mb-4">No practices configured yet.</p>
                    <Button onClick={() => navigate('/settings')}>
                      Go to Settings to Add Practice
                    </Button>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {practices.map((practice) => (
                      <div key={practice.id} className="border rounded-lg p-4">
                        <h3 className="font-semibold text-lg">{practice.practice_name}</h3>
                        <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                          {practice.address && <p>📍 {practice.address}</p>}
                          {practice.phone && <p>📞 {practice.phone}</p>}
                          {practice.email && <p>✉️ {practice.email}</p>}
                          {practice.website && <p>🌐 {practice.website}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Specialist Services */}
          <TabsContent value="specialists">
            <Card>
              <CardHeader>
                <CardTitle>Specialist Services</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Maintain a list of specialist services for auto-population in referral letters.
                </p>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Add New Service */}
                <div className="border rounded-lg p-4 bg-accent/10">
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    Add New Specialist Service
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="new_service_name">Service Name *</Label>
                      <Input
                        id="new_service_name"
                        value={newService.service_name || ""}
                        onChange={(e) => setNewService(prev => ({ ...prev, service_name: e.target.value }))}
                        placeholder="Cardiology"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="new_department">Department</Label>
                      <Input
                        id="new_department"
                        value={newService.department || ""}
                        onChange={(e) => setNewService(prev => ({ ...prev, department: e.target.value }))}
                        placeholder="Cardiology Department"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="new_hospital">Hospital/Clinic</Label>
                      <Input
                        id="new_hospital"
                        value={newService.hospital_name || ""}
                        onChange={(e) => setNewService(prev => ({ ...prev, hospital_name: e.target.value }))}
                        placeholder="General Hospital"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="new_contact_person">Contact Person</Label>
                      <Input
                        id="new_contact_person"
                        value={newService.contact_person || ""}
                        onChange={(e) => setNewService(prev => ({ ...prev, contact_person: e.target.value }))}
                        placeholder="Dr. Sarah Johnson"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="new_phone">Phone</Label>
                      <Input
                        id="new_phone"
                        value={newService.phone || ""}
                        onChange={(e) => setNewService(prev => ({ ...prev, phone: e.target.value }))}
                        placeholder="01234 567890"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="new_email">Email</Label>
                      <Input
                        id="new_email"
                        type="email"
                        value={newService.email || ""}
                        onChange={(e) => setNewService(prev => ({ ...prev, email: e.target.value }))}
                        placeholder="cardiology@hospital.nhs.uk"
                      />
                    </div>
                    
                    <div className="md:col-span-2">
                      <Label htmlFor="new_address">Address</Label>
                      <Textarea
                        id="new_address"
                        value={newService.address || ""}
                        onChange={(e) => setNewService(prev => ({ ...prev, address: e.target.value }))}
                        placeholder="123 Hospital Road, City, Postcode"
                        rows={2}
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="new_specialty">Specialty Type</Label>
                      <Input
                        id="new_specialty"
                        value={newService.specialty_type || ""}
                        onChange={(e) => setNewService(prev => ({ ...prev, specialty_type: e.target.value }))}
                        placeholder="Interventional Cardiology"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="new_notes">Notes</Label>
                      <Input
                        id="new_notes"
                        value={newService.notes || ""}
                        onChange={(e) => setNewService(prev => ({ ...prev, notes: e.target.value }))}
                        placeholder="Additional notes..."
                      />
                    </div>
                  </div>
                  
                  <div className="flex justify-end mt-4">
                    <Button 
                      onClick={addSpecialistService} 
                      disabled={isLoading || !newService.service_name}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Service
                    </Button>
                  </div>
                </div>

                {/* Existing Services */}
                <div className="space-y-4">
                  <h3 className="font-semibold">Existing Services</h3>
                  {specialistServices.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">
                      No specialist services added yet.
                    </p>
                  ) : (
                    <div className="grid gap-4">
                      {specialistServices.map((service) => (
                        <div key={service.id} className="border rounded-lg p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <h4 className="font-semibold">{service.service_name}</h4>
                                {service.is_default && (
                                  <Badge variant="secondary">Default</Badge>
                                )}
                              </div>
                              <div className="text-sm text-muted-foreground space-y-1">
                                {service.department && <p><strong>Department:</strong> {service.department}</p>}
                                {service.hospital_name && <p><strong>Hospital:</strong> {service.hospital_name}</p>}
                                {service.contact_person && <p><strong>Contact:</strong> {service.contact_person}</p>}
                                {service.phone && <p><strong>Phone:</strong> {service.phone}</p>}
                                {service.email && <p><strong>Email:</strong> {service.email}</p>}
                                {service.address && <p><strong>Address:</strong> {service.address}</p>}
                                {service.specialty_type && <p><strong>Specialty:</strong> {service.specialty_type}</p>}
                                {service.notes && <p><strong>Notes:</strong> {service.notes}</p>}
                              </div>
                            </div>
                            <div className="flex gap-2 ml-4">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setEditingService(service.id)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => deleteSpecialistService(service.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default GPScribeSettings;
