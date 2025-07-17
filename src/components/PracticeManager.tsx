import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Building, Plus, Edit, Trash2, Check, X, Globe, Search, Database } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

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
    use_for_all_meetings: true
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchPractices();
    fetchGpPractices();
  }, []);

  const fetchPractices = async () => {
    try {
      const { data, error } = await supabase
        .from('practice_details')
        .select('*')
        .order('practice_name');

      if (error) throw error;
      setPractices(data || []);
      
      // Find default practice and notify parent
      const defaultPractice = data?.find(p => p.is_default);
      if (onPracticeChange) {
        onPracticeChange(defaultPractice || null);
      }
    } catch (error) {
      console.error('Error fetching practices:', error);
      toast({
        title: "Error",
        description: "Failed to fetch practice details",
        variant: "destructive",
      });
    }
  };

  const fetchGpPractices = async () => {
    try {
      const { data, error } = await supabase
        .from('gp_practices')
        .select(`
          practice_code, 
          name, 
          pcn_code, 
          ics_name, 
          organisation_type,
          primary_care_networks(pcn_name)
        `)
        .order('name');

      if (error) throw error;
      setGpPractices(data || []);
    } catch (error) {
      console.error('Error fetching GP practices:', error);
      toast({
        title: "Error",
        description: "Failed to fetch GP practices",
        variant: "destructive",
      });
    }
  };

  const savePractice = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      if (isEditing) {
        const { error } = await supabase
          .from('practice_details')
          .update({
            practice_name: formData.practice_name,
            address: formData.address,
            website: formData.website,
            phone: formData.phone,
            email: formData.email,
            pcn_code: formData.pcn_code,
            is_default: formData.is_default,
            use_for_all_meetings: formData.use_for_all_meetings
          })
          .eq('id', isEditing);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('practice_details')
          .insert({
            user_id: user.id,
            practice_name: formData.practice_name,
            address: formData.address,
            website: formData.website,
            phone: formData.phone,
            email: formData.email,
            pcn_code: formData.pcn_code,
            is_default: formData.is_default,
            use_for_all_meetings: formData.use_for_all_meetings
          });

        if (error) throw error;
      }

      fetchPractices();
      resetForm();
      toast({
        title: "Success",
        description: `Practice ${isEditing ? 'updated' : 'added'} successfully`,
      });
    } catch (error) {
      console.error('Error saving practice:', error);
      toast({
        title: "Error",
        description: "Failed to save practice details",
        variant: "destructive",
      });
    }
  };

  const deletePractice = async (id: string) => {
    try {
      const { error } = await supabase
        .from('practice_details')
        .delete()
        .eq('id', id);

      if (error) throw error;
      fetchPractices();
      toast({
        title: "Success",
        description: "Practice deleted successfully",
      });
    } catch (error) {
      console.error('Error deleting practice:', error);
      toast({
        title: "Error",
        description: "Failed to delete practice",
        variant: "destructive",
      });
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
      use_for_all_meetings: practice.use_for_all_meetings
    });
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
      use_for_all_meetings: true
    });
    setIsEditing(null);
    setIsAdding(false);
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
      use_for_all_meetings: true
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
                          K-Code: {gpPractice.practice_code} • PCN: {gpPractice.primary_care_networks?.pcn_name || gpPractice.pcn_code} (U-Code: {gpPractice.pcn_code}) • {gpPractice.ics_name}
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