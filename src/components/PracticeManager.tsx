import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Building, Plus, Edit, Trash2, Check, X, Globe, Search, Database, Upload, Image } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { showToast } from "@/utils/toastWrapper";


interface PracticeDetail {
  id: string;
  practice_name: string;
  address: string;
  website: string;
  phone: string;
  email: string;
  pcn_code: string;
  is_default: boolean;
  use_for_all_meetings: boolean;
  logo_url?: string;
  footer_text?: string;
  show_page_numbers?: boolean;
}

interface PracticeManagerProps {
  onPracticeChange?: (practice: PracticeDetail | null) => void;
}

export const PracticeManager = ({ onPracticeChange }: PracticeManagerProps) => {
  const [practices, setPractices] = useState<PracticeDetail[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [gpPractices, setGpPractices] = useState<any[]>([]);
  const [showGpSearch, setShowGpSearch] = useState(false);
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [formData, setFormData] = useState({
    practice_name: "",
    address: "",
    website: "",
    phone: "",
    email: "",
    pcn_code: "",
    is_default: false,
    use_for_all_meetings: true,
    logo_url: "",
    footer_text: "",
    show_page_numbers: true
  });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string>("");
  

  useEffect(() => {
    fetchPractices();
    fetchGpPractices();
  }, []);

  // Fetch practices - prioritise showing the user's organisation's shared practice details
  const fetchPractices = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get user's practice_id from user_roles
      const { data: userRole } = await supabase
        .from('user_roles')
        .select('practice_id')
        .eq('user_id', user.id)
        .not('practice_id', 'is', null)
        .maybeSingle();

      // Get the user's organisation name from gp_practices
      let orgName: string | null = null;
      if (userRole?.practice_id) {
        const { data: gpPractice } = await supabase
          .from('gp_practices')
          .select('name')
          .eq('id', userRole.practice_id)
          .maybeSingle();
        orgName = gpPractice?.name || null;
      }

      // Fetch practice_details - if user is in an org, show that org's details first
      const { data, error } = await supabase
        .from('practice_details')
        .select('*')
        .order('practice_name');

      if (error) throw error;

      // Filter to show user's organisation's practice details (if exists)
      // or show all if user is a system admin
      let filteredPractices = data || [];
      if (orgName) {
        // Find practice details matching the user's organisation
        const orgPractice = filteredPractices.find(p => 
          p.practice_name?.toLowerCase() === orgName?.toLowerCase()
        );
        if (orgPractice) {
          // Put org practice first, mark as shared
          filteredPractices = [orgPractice, ...filteredPractices.filter(p => p.id !== orgPractice.id)];
        }
      }

      setPractices(filteredPractices);
      
      // Find default practice and notify parent
      const defaultPractice = filteredPractices?.find(p => p.is_default);
      if (onPracticeChange) {
        onPracticeChange(defaultPractice || null);
      }
    } catch (error) {
      console.error('Error fetching practices:', error);
      console.error("Failed to fetch practice details");
    }
  };

  const fetchGpPractices = async () => {
    try {
      const { data, error } = await supabase
        .from('gp_practices')
        .select('practice_code, name, pcn_code, ics_name, organisation_type')
        .order('name');

      if (error) throw error;
      setGpPractices(data || []);
    } catch (error) {
      console.error('Error fetching GP practices:', error);
      console.error("Failed to fetch GP practices");
    }
  };

  const uploadLogo = async (file: File): Promise<string> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const fileExt = file.name.split('.').pop();
    const fileName = `${user.id}/logo-${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('practice-logos')
      .upload(fileName, file);

    if (uploadError) throw uploadError;

    const { data } = supabase.storage
      .from('practice-logos')
      .getPublicUrl(fileName);

    return data.publicUrl;
  };

  const savePractice = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      let logoUrl = formData.logo_url;
      
      // Upload new logo if file is selected
      if (logoFile) {
        logoUrl = await uploadLogo(logoFile);
      }

      const practiceData = {
        practice_name: formData.practice_name,
        address: formData.address,
        website: formData.website,
        phone: formData.phone,
        email: formData.email,
        pcn_code: formData.pcn_code,
        is_default: formData.is_default,
        use_for_all_meetings: formData.use_for_all_meetings,
        logo_url: logoUrl,
        footer_text: formData.footer_text || `${formData.practice_name}\n${formData.address}`,
        show_page_numbers: formData.show_page_numbers
      };

      if (isEditing) {
        // Update existing practice_details record - this will be shared across all users
        const { error } = await supabase
          .from('practice_details')
          .update(practiceData)
          .eq('id', isEditing);

        if (error) throw error;
        toast.success('Organisation details updated - changes visible to all members');
      } else {
        // Check if practice_details already exists for this practice name (shared record)
        const { data: existingPractice } = await supabase
          .from('practice_details')
          .select('id')
          .ilike('practice_name', formData.practice_name)
          .maybeSingle();

        if (existingPractice) {
          // Update existing shared record instead of creating duplicate
          const { error } = await supabase
            .from('practice_details')
            .update(practiceData)
            .eq('id', existingPractice.id);

          if (error) throw error;
          toast.success('Organisation details updated - changes visible to all members');
        } else {
          // Create new practice_details record
          const { error } = await supabase
            .from('practice_details')
            .insert({
              user_id: user.id,
              ...practiceData
            });

          if (error) throw error;
          toast.success('Organisation details saved');
        }
      }

      await fetchPractices();
      resetForm();
    } catch (error) {
      console.error('Error saving practice:', error);
      toast.error(`Failed to save practice details: ${(error as any)?.message || 'Unknown error'}`);
    }
  };

  const deletePractice = async (id: string) => {
    try {
      const { error } = await supabase
        .from('practice_details')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await fetchPractices();
      toast.success("Practice deleted successfully");
      console.log("Practice deleted successfully");
    } catch (error) {
      console.error('Error deleting practice:', error);
      toast.error("Failed to delete practice");
    }
  };

  const editPractice = (practice: PracticeDetail) => {
    setFormData({
      practice_name: practice.practice_name,
      address: practice.address,
      website: practice.website,
      phone: practice.phone,
      email: practice.email,
      pcn_code: practice.pcn_code,
      is_default: practice.is_default,
      use_for_all_meetings: practice.use_for_all_meetings,
      logo_url: practice.logo_url || "",
      footer_text: practice.footer_text || "",
      show_page_numbers: practice.show_page_numbers ?? true
    });
    setLogoPreview(practice.logo_url || "");
    setIsEditing(practice.id);
    setIsAdding(true);
  };

  const resetForm = () => {
    setFormData({
      practice_name: "",
      address: "",
      website: "",
      phone: "",
      email: "",
      pcn_code: "",
      is_default: false,
      use_for_all_meetings: true,
      logo_url: "",
      footer_text: "",
      show_page_numbers: true
    });
    setLogoFile(null);
    setLogoPreview("");
    setIsEditing(null);
    setIsAdding(false);
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Filter practices based on search term
  const filteredPractices = practices.filter(practice => 
    practice.practice_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (practice.pcn_code && practice.pcn_code.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Filter GP practices based on search term  
  const filteredGpPractices = gpPractices.filter(practice => 
    practice.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (practice.practice_code && practice.practice_code.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (practice.pcn_code && practice.pcn_code.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const addFromGpPractices = (gpPractice: any) => {
    setFormData({
      practice_name: gpPractice.name,
      address: "",
      website: "",
      phone: "",
      email: "",
      pcn_code: gpPractice.pcn_code || "",
      is_default: false,
      use_for_all_meetings: true,
      logo_url: "",
      footer_text: "",
      show_page_numbers: true
    });
    setIsAdding(true);
    setShowGpSearch(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building className="h-5 w-5" />
          Practice Management
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add/Edit Form */}
        {isAdding && (
          <div className="p-4 border rounded-lg space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">
                {isEditing ? 'Edit Practice' : 'Add New Practice'}
              </h4>
              <Button variant="ghost" size="sm" onClick={resetForm}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="practice_name">Practice Name</Label>
              <Input
                id="practice_name"
                value={formData.practice_name}
                onChange={(e) => setFormData({...formData, practice_name: e.target.value})}
                placeholder="Practice name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Textarea
                id="address"
                value={formData.address}
                onChange={(e) => setFormData({...formData, address: e.target.value})}
                placeholder="Full practice address"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  placeholder="Phone number"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  placeholder="practice@example.com"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="website">Website</Label>
                <Input
                  id="website"
                  value={formData.website}
                  onChange={(e) => setFormData({...formData, website: e.target.value})}
                  placeholder="https://example.com"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="pcn_code">PCN Code</Label>
                <Input
                  id="pcn_code"
                  value={formData.pcn_code}
                  onChange={(e) => setFormData({...formData, pcn_code: e.target.value})}
                  placeholder="PCN code if applicable"
                />
              </div>
            </div>

            {/* Logo Upload */}
            <div className="space-y-2">
              <Label>Practice Logo</Label>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoChange}
                    className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/80"
                  />
                </div>
                {(logoPreview || formData.logo_url) && (
                  <div className="w-16 h-16 border rounded overflow-hidden">
                    <img 
                      src={logoPreview || formData.logo_url} 
                      alt="Logo preview" 
                      className="w-full h-full object-contain"
                    />
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Upload a logo to be automatically included in Word and PDF meeting outputs (top right)
              </p>
            </div>

            {/* Footer Settings */}
            <div className="space-y-4">
              <Label>Document Footer Settings</Label>
              
              <div className="space-y-2">
                <Label htmlFor="footer_text">Footer Text</Label>
                <Textarea
                  id="footer_text"
                  value={formData.footer_text}
                  onChange={(e) => setFormData({...formData, footer_text: e.target.value})}
                  placeholder={`${formData.practice_name || 'Practice Name'}\n${formData.address || 'Practice Address'}`}
                  rows={3}
                />
                <p className="text-xs text-muted-foreground">
                  This text will appear at the bottom of generated Word and PDF documents
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="show_page_numbers"
                  checked={formData.show_page_numbers}
                  onCheckedChange={(checked) => setFormData({...formData, show_page_numbers: checked})}
                />
                <Label htmlFor="show_page_numbers">Show page numbers in documents</Label>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="is_default"
                  checked={formData.is_default}
                  onChange={(e) => setFormData({...formData, is_default: e.target.checked})}
                  className="rounded"
                />
                <Label htmlFor="is_default">Make this my default practice</Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="use_for_all_meetings"
                  checked={formData.use_for_all_meetings}
                  onChange={(e) => setFormData({...formData, use_for_all_meetings: e.target.checked})}
                  className="rounded"
                />
                <Label htmlFor="use_for_all_meetings">Use for all meetings</Label>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2">
              <Button variant="outline" onClick={resetForm}>Cancel</Button>
              <Button onClick={savePractice}>
                <Check className="h-4 w-4 mr-2" />
                Save
              </Button>
            </div>
          </div>
        )}

        {/* Search and Add Controls */}
        {!isAdding && (
          <div className="space-y-4">
            <div className="flex gap-4 items-center">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Search your practices or GP practices..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button variant="outline" onClick={() => setShowGpSearch(!showGpSearch)}>
                <Database className="h-4 w-4 mr-2" />
                {showGpSearch ? 'Hide' : 'Search'} GP Practices
              </Button>
              <Button variant="outline" onClick={() => setIsAdding(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Practice
              </Button>
            </div>

            {/* GP Practices Search Results */}
            {showGpSearch && searchTerm && (
              <div className="border rounded-lg p-4 bg-accent/20">
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <Database className="h-4 w-4" />
                  GP Practices Database ({filteredGpPractices.length} found)
                </h4>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {filteredGpPractices.slice(0, 20).map((gpPractice, index) => (
                    <div key={index} className="flex items-center justify-between p-2 border rounded text-sm">
                      <div>
                        <div className="font-medium">{gpPractice.name}</div>
                        <div className="text-muted-foreground">
                          K-Code: {gpPractice.practice_code} • PCN: {gpPractice.pcn_code} (U-Code: {gpPractice.pcn_code}) • {gpPractice.ics_name}
                        </div>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => addFromGpPractices(gpPractice)}>
                        <Plus className="h-3 w-3 mr-1" />
                        Add
                      </Button>
                    </div>
                  ))}
                  {filteredGpPractices.length > 20 && (
                    <div className="text-center text-muted-foreground py-2">
                      Showing first 20 results. Refine your search for more specific results.
                    </div>
                  )}
                  {filteredGpPractices.length === 0 && (
                    <div className="text-center text-muted-foreground py-4">
                      No GP practices found matching your search.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Your Practices List */}
        <div className="space-y-4">
          <h4 className="font-medium text-sm text-muted-foreground">Your Practice Details</h4>
          <div className="space-y-2">
          {filteredPractices.map((practice) => (
            <div key={practice.id} className="p-4 border rounded-lg">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="font-medium flex items-center gap-2 mb-2">
                    {practice.practice_name}
                    {practice.is_default && (
                      <Badge variant="secondary" className="text-xs">Default</Badge>
                    )}
                    {practice.use_for_all_meetings && (
                      <Badge variant="outline" className="text-xs">All Meetings</Badge>
                    )}
                  </div>
                  
                  <div className="text-sm text-muted-foreground space-y-1">
                    {practice.address && <div>{practice.address}</div>}
                    <div className="flex items-center gap-4">
                      {practice.phone && <span>📞 {practice.phone}</span>}
                      {practice.email && <span>✉️ {practice.email}</span>}
                    </div>
                    {practice.website && (
                      <div className="flex items-center gap-1">
                        <Globe className="h-3 w-3" />
                        <a href={practice.website} target="_blank" rel="noopener noreferrer" 
                           className="text-primary hover:underline">
                          {practice.website}
                        </a>
                      </div>
                     )}
                     {practice.pcn_code && <div>PCN: {practice.pcn_code}</div>}
                     {practice.logo_url && (
                       <div className="flex items-center gap-2 mt-2">
                         <Image className="h-3 w-3" />
                         <span className="text-xs">Logo configured</span>
                       </div>
                     )}
                   </div>
                 </div>
                
                <div className="space-x-2">
                  <Button variant="ghost" size="sm" onClick={() => editPractice(practice)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => deletePractice(practice.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
          
          {filteredPractices.length === 0 && practices.length > 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No practices found matching your search. Try a different search term.
            </div>
          )}
          
          {practices.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No practices added yet. Click "Add Practice" to get started.
            </div>
          )}
        </div>
      </div>
      </CardContent>
    </Card>
  );
};