import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { FileSignature, Save, Upload, Image, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface ComplaintSignature {
  id?: string;
  user_id: string;
  name: string;
  job_title: string;
  qualifications?: string;
  email: string;
  phone?: string;
  practice_id?: string;
  signature_text?: string;
  signature_image_url?: string;
  is_default: boolean;
  use_for_acknowledgements: boolean;
  use_for_outcome_letters: boolean;
}

interface PracticeDetail {
  id: string;
  practice_name: string;
  address?: string;
  phone?: string;
  email?: string;
  logo_url?: string;
  footer_text?: string;
}

interface ComplaintSignatureManagerProps {
  onSignatureChange?: (signature: ComplaintSignature | null) => void;
}

export const ComplaintSignatureManager = ({ onSignatureChange }: ComplaintSignatureManagerProps) => {
  const { user } = useAuth();
  const [signatures, setSignatures] = useState<ComplaintSignature[]>([]);
  const [practices, setPractices] = useState<PracticeDetail[]>([]);
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [signatureFile, setSignatureFile] = useState<File | null>(null);
  const [signaturePreview, setSignaturePreview] = useState<string>("");
  const [formData, setFormData] = useState<Partial<ComplaintSignature>>({
    name: "",
    job_title: "",
    qualifications: "",
    email: "",
    phone: "",
    practice_id: "",
    signature_text: "",
    signature_image_url: "",
    is_default: false,
    use_for_acknowledgements: true,
    use_for_outcome_letters: true
  });

  useEffect(() => {
    if (user) {
      fetchSignatures();
      fetchPractices();
    }
  }, [user]);

  const fetchSignatures = async () => {
    try {
      const { data, error } = await supabase
        .from('complaint_signatures')
        .select('*')
        .order('is_default', { ascending: false });

      if (error) throw error;
      setSignatures(data || []);
      
      // Find default signature and notify parent
      const defaultSignature = data?.find(s => s.is_default);
      if (onSignatureChange) {
        onSignatureChange(defaultSignature || null);
      }
    } catch (error) {
      console.error('Error fetching signatures:', error);
    }
  };

  const fetchPractices = async () => {
    try {
      const { data, error } = await supabase
        .from('practice_details')
        .select('*')
        .order('practice_name');

      if (error) throw error;
      setPractices(data || []);
    } catch (error) {
      console.error('Error fetching practices:', error);
    }
  };

  const uploadSignatureImage = async (file: File): Promise<string> => {
    if (!user) throw new Error('User not authenticated');

    const fileExt = file.name.split('.').pop();
    const fileName = `${user.id}/signature-${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('practice-logos')
      .upload(fileName, file);

    if (uploadError) throw uploadError;

    const { data } = supabase.storage
      .from('practice-logos')
      .getPublicUrl(fileName);

    return data.publicUrl;
  };

  const handleSignatureImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSignatureFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setSignaturePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const saveSignature = async () => {
    if (!user) return;

    try {
      let signatureImageUrl = formData.signature_image_url;
      
      // Upload new signature image if file is selected
      if (signatureFile) {
        signatureImageUrl = await uploadSignatureImage(signatureFile);
      }

      const signatureData = {
        ...formData,
        user_id: user.id,
        signature_image_url: signatureImageUrl
      } as ComplaintSignature;

      if (isEditing) {
        const { error } = await supabase
          .from('complaint_signatures')
          .update(signatureData)
          .eq('id', isEditing);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('complaint_signatures')
          .insert([signatureData]);

        if (error) throw error;
      }

      fetchSignatures();
      resetForm();
      toast.success(`Signature ${isEditing ? 'updated' : 'created'} successfully`);
    } catch (error: any) {
      console.error('Error saving signature:', error);
      toast.error(`Failed to save signature: ${error.message}`);
    }
  };

  const deleteSignature = async (id: string) => {
    try {
      const { error } = await supabase
        .from('complaint_signatures')
        .delete()
        .eq('id', id);

      if (error) throw error;
      fetchSignatures();
      toast.success("Signature deleted successfully");
    } catch (error: any) {
      console.error('Error deleting signature:', error);
      toast.error(`Failed to delete signature: ${error.message}`);
    }
  };

  const editSignature = (signature: ComplaintSignature) => {
    setFormData(signature);
    setSignaturePreview(signature.signature_image_url || "");
    setIsEditing(signature.id || null);
    setIsAdding(true);
  };

  const resetForm = () => {
    setFormData({
      name: "",
      job_title: "",
      qualifications: "",
      email: "",
      phone: "",
      practice_id: "",
      signature_text: "",
      signature_image_url: "",
      is_default: false,
      use_for_acknowledgements: true,
      use_for_outcome_letters: true
    });
    setSignatureFile(null);
    setSignaturePreview("");
    setIsEditing(null);
    setIsAdding(false);
  };

  const getPracticeName = (practiceId: string) => {
    const practice = practices.find(p => p.id === practiceId);
    return practice?.practice_name || 'Unknown Practice';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSignature className="h-5 w-5" />
          Complaint Signature Management
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add/Edit Form */}
        {isAdding && (
          <div className="p-4 border rounded-lg space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">
                {isEditing ? 'Edit Signature' : 'Create New Signature'}
              </h4>
              <Button variant="ghost" size="sm" onClick={resetForm}>
                ×
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  placeholder="Dr. Sarah Johnson"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="job_title">Job Title</Label>
                <Input
                  id="job_title"
                  value={formData.job_title}
                  onChange={(e) => setFormData({...formData, job_title: e.target.value})}
                  placeholder="Complaints Manager"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  placeholder="sarah.johnson@practice.nhs.uk"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  placeholder="01234 567890"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="qualifications">Qualifications (Optional)</Label>
              <Input
                id="qualifications"
                value={formData.qualifications}
                onChange={(e) => setFormData({...formData, qualifications: e.target.value})}
                placeholder="MBBS, MRCGP"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="practice_id">Associated Practice</Label>
              <Select
                value={formData.practice_id}
                onValueChange={(value) => setFormData({...formData, practice_id: value})}
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

            <div className="space-y-2">
              <Label htmlFor="signature_text">Signature Text Block</Label>
              <Textarea
                id="signature_text"
                value={formData.signature_text}
                onChange={(e) => setFormData({...formData, signature_text: e.target.value})}
                placeholder="Yours sincerely,

Dr. Sarah Johnson
Complaints Manager
Greenfield Medical Practice"
                rows={5}
              />
            </div>

            {/* Signature Image Upload */}
            <div className="space-y-2">
              <Label>Signature Image (Optional)</Label>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={handleSignatureImageChange}
                    className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/80"
                  />
                </div>
                {(signaturePreview || formData.signature_image_url) && (
                  <div className="w-32 h-16 border rounded overflow-hidden bg-background">
                    <img 
                      src={signaturePreview || formData.signature_image_url} 
                      alt="Signature preview" 
                      className="w-full h-full object-contain"
                    />
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Upload a handwritten signature image to be included in letters
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Switch
                  id="is_default"
                  checked={formData.is_default}
                  onCheckedChange={(checked) => setFormData({...formData, is_default: checked})}
                />
                <Label htmlFor="is_default">Make this the default signature</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="use_for_acknowledgements"
                  checked={formData.use_for_acknowledgements}
                  onCheckedChange={(checked) => setFormData({...formData, use_for_acknowledgements: checked})}
                />
                <Label htmlFor="use_for_acknowledgements">Use for acknowledgement letters</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="use_for_outcome_letters"
                  checked={formData.use_for_outcome_letters}
                  onCheckedChange={(checked) => setFormData({...formData, use_for_outcome_letters: checked})}
                />
                <Label htmlFor="use_for_outcome_letters">Use for outcome letters</Label>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2">
              <Button variant="outline" onClick={resetForm}>Cancel</Button>
              <Button onClick={saveSignature} disabled={!formData.name || !formData.email}>
                <Save className="h-4 w-4 mr-2" />
                Save Signature
              </Button>
            </div>
          </div>
        )}

        {/* Controls */}
        {!isAdding && (
          <div className="flex justify-end">
            <Button onClick={() => setIsAdding(true)}>
              <FileSignature className="h-4 w-4 mr-2" />
              Create Signature
            </Button>
          </div>
        )}

        {/* Signatures List */}
        {!isAdding && (
          <div className="space-y-3">
            <h4 className="font-medium">Your Complaint Signatures</h4>
            {signatures.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">
                No signatures created yet. Create one to automatically include in complaint letters.
              </p>
            ) : (
              <div className="space-y-3">
                {signatures.map((signature) => (
                  <div key={signature.id} className="p-4 border rounded-lg space-y-2">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h5 className="font-medium">{signature.name}</h5>
                          {signature.is_default && (
                            <span className="px-2 py-1 bg-primary text-primary-foreground text-xs rounded">
                              Default
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {signature.job_title} • {signature.email}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Practice: {getPracticeName(signature.practice_id || "")}
                        </p>
                        <div className="flex gap-4 text-xs text-muted-foreground">
                          {signature.use_for_acknowledgements && <span>✓ Acknowledgements</span>}
                          {signature.use_for_outcome_letters && <span>✓ Outcome Letters</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => editSignature(signature)}>
                          <Eye className="h-3 w-3" />
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => signature.id && deleteSignature(signature.id)}
                        >
                          <Upload className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    
                    {signature.signature_text && (
                      <div className="mt-2 p-2 bg-muted rounded text-sm whitespace-pre-wrap">
                        {signature.signature_text}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};