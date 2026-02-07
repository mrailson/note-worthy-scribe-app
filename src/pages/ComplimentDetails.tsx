import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { SEO } from "@/components/SEO";
import { Header } from "@/components/Header";
import { useAuth } from "@/contexts/AuthContext";
import { LoginForm } from "@/components/LoginForm";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  ArrowLeft,
  Heart,
  Calendar,
  User,
  Users,
  Building,
  Mail,
  Phone,
  Share2,
  Trash2,
  Download,
  Save,
  AlertCircle,
  CheckCircle,
  MapPin,
  FileText,
} from "lucide-react";
import { format } from "date-fns";
import { showToast } from "@/utils/toastWrapper";
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from "docx";
import type { Compliment } from "@/components/compliments/ComplimentsSummaryView";

const SOURCE_LABELS: Record<string, string> = {
  patient: 'Patient',
  nhs_choices: 'NHS Choices Review',
  letter: 'Letter',
  verbal: 'Verbal',
  card: 'Card',
  email: 'Email',
  other: 'Other',
};

const ComplimentDetails = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [compliment, setCompliment] = useState<Compliment | null>(null);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (user && id) {
      fetchCompliment();
    }
  }, [user, id]);

  const fetchCompliment = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('compliments' as any)
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      const complimentData = data as unknown as Compliment;
      setCompliment(complimentData);
      setNotes(complimentData.notes || "");
    } catch (error) {
      console.error('Error fetching compliment:', error);
      showToast.error("Failed to load compliment details");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveNotes = async () => {
    if (!compliment) return;
    try {
      setSaving(true);
      const { error } = await supabase
        .from('compliments' as any)
        .update({ notes } as any)
        .eq('id', compliment.id);

      if (error) throw error;
      showToast.success("Notes saved successfully");
      setCompliment(prev => prev ? { ...prev, notes } : null);
    } catch (error) {
      console.error('Error saving notes:', error);
      showToast.error("Failed to save notes");
    } finally {
      setSaving(false);
    }
  };

  const handleShareWithStaff = async () => {
    if (!compliment) return;
    try {
      setSaving(true);
      const { error } = await supabase
        .from('compliments' as any)
        .update({
          shared_with_staff: true,
          shared_at: new Date().toISOString(),
          status: 'shared',
        } as any)
        .eq('id', compliment.id);

      if (error) throw error;
      showToast.success("Compliment marked as shared with staff");
      setCompliment(prev => prev ? {
        ...prev,
        shared_with_staff: true,
        shared_at: new Date().toISOString(),
        status: 'shared',
      } : null);
    } catch (error) {
      console.error('Error sharing compliment:', error);
      showToast.error("Failed to share compliment");
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async () => {
    if (!compliment) return;
    try {
      setSaving(true);
      const { error } = await supabase
        .from('compliments' as any)
        .update({ status: 'archived' } as any)
        .eq('id', compliment.id);

      if (error) throw error;
      showToast.success("Compliment archived");
      setCompliment(prev => prev ? { ...prev, status: 'archived' } : null);
    } catch (error) {
      console.error('Error archiving compliment:', error);
      showToast.error("Failed to archive compliment");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!compliment) return;
    try {
      setDeleting(true);
      const { error } = await supabase
        .from('compliments' as any)
        .delete()
        .eq('id', compliment.id);

      if (error) throw error;
      showToast.success(`Compliment ${compliment.reference_number} deleted`);
      navigate('/complaints');
    } catch (error) {
      console.error('Error deleting compliment:', error);
      showToast.error("Failed to delete compliment");
    } finally {
      setDeleting(false);
    }
  };

  const handleExportToWord = async () => {
    if (!compliment) return;
    try {
      const doc = new Document({
        sections: [{
          properties: {},
          children: [
            new Paragraph({
              text: `Compliment Record - ${compliment.reference_number}`,
              heading: HeadingLevel.HEADING_1,
            }),
            new Paragraph({
              text: `Generated on: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`,
              spacing: { after: 400 }
            }),
            new Paragraph({
              text: 'Compliment Details',
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 400 }
            }),
            new Paragraph({
              children: [
                new TextRun({ text: 'Title: ', bold: true }),
                new TextRun(compliment.compliment_title),
              ],
            }),
            new Paragraph({
              children: [
                new TextRun({ text: 'Date Received: ', bold: true }),
                new TextRun(format(new Date(compliment.compliment_date), 'dd/MM/yyyy')),
              ],
            }),
            new Paragraph({
              children: [
                new TextRun({ text: 'From: ', bold: true }),
                new TextRun(compliment.patient_name),
              ],
            }),
            new Paragraph({
              children: [
                new TextRun({ text: 'Category: ', bold: true }),
                new TextRun(compliment.category),
              ],
            }),
            new Paragraph({
              children: [
                new TextRun({ text: 'Source: ', bold: true }),
                new TextRun(SOURCE_LABELS[compliment.source] || compliment.source),
              ],
            }),
            new Paragraph({
              children: [
                new TextRun({ text: 'Status: ', bold: true }),
                new TextRun(compliment.status),
              ],
            }),
            ...(compliment.staff_mentioned?.length ? [
              new Paragraph({
                children: [
                  new TextRun({ text: 'Staff Mentioned: ', bold: true }),
                  new TextRun(compliment.staff_mentioned.join(', ')),
                ],
              }),
            ] : []),
            ...(compliment.location_service ? [
              new Paragraph({
                children: [
                  new TextRun({ text: 'Location/Service: ', bold: true }),
                  new TextRun(compliment.location_service),
                ],
              }),
            ] : []),
            new Paragraph({
              text: 'Description',
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 400 }
            }),
            new Paragraph({ text: compliment.compliment_description }),
            ...(compliment.notes ? [
              new Paragraph({
                text: 'Internal Notes',
                heading: HeadingLevel.HEADING_2,
                spacing: { before: 400 }
              }),
              new Paragraph({ text: compliment.notes }),
            ] : []),
          ],
        }],
      });

      const buffer = await Packer.toBuffer(doc);
      const blob = new Blob([new Uint8Array(buffer)], {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `compliment-${compliment.reference_number}-${format(new Date(), 'yyyy-MM-dd')}.docx`;
      a.click();
      URL.revokeObjectURL(url);
      showToast.success('Compliment exported to Word');
    } catch (error) {
      console.error('Error exporting to Word:', error);
      showToast.error('Failed to export compliment');
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-subtle">
        <Header onNewMeeting={() => {}} />
        <div className="container mx-auto px-4 py-8">
          <LoginForm />
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-subtle">
        <Header onNewMeeting={() => {}} />
        <div className="container mx-auto px-4 py-8">
          <div className="text-center text-muted-foreground">Loading compliment details...</div>
        </div>
      </div>
    );
  }

  if (!compliment) {
    return (
      <div className="min-h-screen bg-gradient-subtle">
        <Header onNewMeeting={() => {}} />
        <div className="container mx-auto px-4 py-8">
          <div className="text-center text-muted-foreground">Compliment not found</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <SEO
        title={`Compliment ${compliment.reference_number} | NoteWell AI`}
        description="View compliment details"
      />
      <Header onNewMeeting={() => {}} />
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-8">
        {/* Back Button */}
        <Button
          variant="ghost"
          onClick={() => navigate('/complaints')}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Complaints & Compliments
        </Button>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Heart className="h-6 w-6 text-teal-600" />
              <h1 className="text-2xl font-bold text-foreground">{compliment.reference_number}</h1>
              <Badge
                variant="outline"
                className={
                  compliment.status === 'shared'
                    ? 'bg-green-100 text-green-800 border-green-300'
                    : compliment.status === 'archived'
                    ? 'bg-gray-100 text-gray-800 border-gray-300'
                    : 'bg-blue-100 text-blue-800 border-blue-300'
                }
              >
                {compliment.status === 'shared' ? 'Shared with Staff' : 
                 compliment.status === 'archived' ? 'Archived' : 'Received'}
              </Badge>
            </div>
            <h2 className="text-lg text-muted-foreground">{compliment.compliment_title}</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {!compliment.shared_with_staff && compliment.status !== 'archived' && (
              <Button onClick={handleShareWithStaff} disabled={saving} className="bg-teal-600 hover:bg-teal-700">
                <Share2 className="h-4 w-4 mr-2" />
                Share with Staff
              </Button>
            )}
            {compliment.status !== 'archived' && (
              <Button variant="outline" onClick={handleArchive} disabled={saving}>
                <CheckCircle className="h-4 w-4 mr-2" />
                Archive
              </Button>
            )}
            <Button variant="outline" onClick={handleExportToWord}>
              <Download className="h-4 w-4 mr-2" />
              Export to Word
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowDeleteConfirm(true)}
              className="text-destructive hover:text-destructive-foreground hover:bg-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Description */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Heart className="h-5 w-5 text-teal-600" />
                  Compliment Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h3 className="font-semibold mb-2">{compliment.compliment_title}</h3>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {compliment.compliment_description}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Staff Mentioned */}
            {compliment.staff_mentioned && compliment.staff_mentioned.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-teal-600" />
                    Staff Recognised
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {compliment.staff_mentioned.map((staff, i) => (
                      <Badge key={i} variant="secondary" className="text-sm py-1 px-3">
                        <User className="h-3 w-3 mr-1" />
                        {staff}
                      </Badge>
                    ))}
                  </div>
                  {compliment.shared_with_staff && compliment.shared_at && (
                    <p className="text-sm text-muted-foreground mt-3">
                      <Share2 className="h-3 w-3 inline mr-1" />
                      Shared with staff on {format(new Date(compliment.shared_at), 'dd/MM/yyyy HH:mm')}
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Internal Notes */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Internal Notes
                </CardTitle>
                <CardDescription>Private notes for internal use only</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Add internal notes about this compliment..."
                    rows={4}
                  />
                  <Button onClick={handleSaveNotes} disabled={saving} size="sm">
                    <Save className="h-4 w-4 mr-2" />
                    {saving ? 'Saving...' : 'Save Notes'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="flex items-start gap-2">
                  <User className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground">From</p>
                    <p className="font-medium">{compliment.patient_name}</p>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground">Date Received</p>
                    <p className="font-medium">{format(new Date(compliment.compliment_date), 'dd/MM/yyyy')}</p>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <Building className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground">Category</p>
                    <p className="font-medium">{compliment.category}</p>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground">Source</p>
                    <p className="font-medium">{SOURCE_LABELS[compliment.source] || compliment.source}</p>
                  </div>
                </div>

                {compliment.location_service && (
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-xs text-muted-foreground">Location/Service</p>
                      <p className="font-medium">{compliment.location_service}</p>
                    </div>
                  </div>
                )}

                {compliment.patient_contact_email && (
                  <div className="flex items-start gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-xs text-muted-foreground">Email</p>
                      <p className="font-medium">{compliment.patient_contact_email}</p>
                    </div>
                  </div>
                )}

                {compliment.patient_contact_phone && (
                  <div className="flex items-start gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-xs text-muted-foreground">Phone</p>
                      <p className="font-medium">{compliment.patient_contact_phone}</p>
                    </div>
                  </div>
                )}

                <div className="pt-2 border-t text-xs text-muted-foreground">
                  <p>Created: {format(new Date(compliment.created_at), 'dd/MM/yyyy HH:mm')}</p>
                  <p>Updated: {format(new Date(compliment.updated_at), 'dd/MM/yyyy HH:mm')}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Delete Confirmation Dialog */}
        <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <AlertCircle className="h-5 w-5" />
                Confirm Deletion
              </DialogTitle>
              <DialogDescription>
                This action cannot be undone. This will permanently delete this compliment record.
              </DialogDescription>
            </DialogHeader>
            {compliment && (
              <div className="py-4 space-y-2 text-sm">
                <div><strong>Reference:</strong> {compliment.reference_number}</div>
                <div><strong>Title:</strong> {compliment.compliment_title}</div>
                <div><strong>From:</strong> {compliment.patient_name}</div>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? 'Deleting...' : 'Delete Permanently'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default ComplimentDetails;
