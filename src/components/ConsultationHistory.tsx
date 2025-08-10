import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Eye, Edit, Trash2, Clock, Calendar, FileText, Copy, BookOpen } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

interface ConsultationRecord {
  id: string;
  title: string;
  description: string;
  created_at: string;
  duration_minutes: number;
  meeting_type: string;
  transcript?: string;
  summary?: string;
  full_note?: string;
  patient_copy?: string;
  trainee_feedback?: string;
  referral_letter?: string;
}

export const ConsultationHistory = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [consultations, setConsultations] = useState<ConsultationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedConsultation, setSelectedConsultation] = useState<ConsultationRecord | null>(null);
  const [editingConsultation, setEditingConsultation] = useState<ConsultationRecord | null>(null);
  const [selectedConsultationIds, setSelectedConsultationIds] = useState<Set<string>>(new Set());
  const [editForm, setEditForm] = useState({
    title: "",
    description: ""
  });

  useEffect(() => {
    if (user) {
      fetchConsultations();
    }
  }, [user]);

  const fetchConsultations = async () => {
    try {
      setLoading(true);
      
      // Fetch meetings with their transcripts and summaries
      const { data: meetings, error: meetingsError } = await supabase
        .from('meetings')
        .select(`
          id,
          title,
          description,
          created_at,
          duration_minutes,
          meeting_type
        `)
        .eq('user_id', user?.id)
        .eq('meeting_type', 'gp_consultation')
        .order('created_at', { ascending: false });

      if (meetingsError) throw meetingsError;

      if (!meetings || meetings.length === 0) {
        setConsultations([]);
        return;
      }

      // Fetch transcripts and summaries for each meeting
      const consultationsWithDetails = await Promise.all(
        meetings.map(async (meeting) => {
          // Get transcript
          const { data: transcripts } = await supabase
            .from('meeting_transcripts')
            .select('content')
            .eq('meeting_id', meeting.id)
            .limit(1);

          // Get summary
          const { data: summaries } = await supabase
            .from('meeting_summaries')
            .select('summary, key_points, action_items, next_steps')
            .eq('meeting_id', meeting.id)
            .limit(1);

          return {
            ...meeting,
            transcript: transcripts?.[0]?.content || "",
            summary: summaries?.[0]?.summary || "",
            full_note: summaries?.[0]?.key_points?.[0] || "",
            patient_copy: summaries?.[0]?.action_items?.[0] || "",
            trainee_feedback: summaries?.[0]?.next_steps?.[0] || "",
            referral_letter: ""
          };
        })
      );

      setConsultations(consultationsWithDetails);
    } catch (error) {
      console.error('Error fetching consultations:', error);
      console.error("Failed to load consultation history");
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (consultation: ConsultationRecord) => {
    setEditingConsultation(consultation);
    setEditForm({
      title: consultation.title,
      description: consultation.description
    });
  };

  const handleSaveEdit = async () => {
    if (!editingConsultation) return;

    try {
      const { error } = await supabase
        .from('meetings')
        .update({
          title: editForm.title,
          description: editForm.description
        })
        .eq('id', editingConsultation.id);

      if (error) throw error;

      console.log("Consultation updated successfully");

      setEditingConsultation(null);
      fetchConsultations();
    } catch (error) {
      console.error('Error updating consultation:', error);
      console.error("Failed to update consultation");
    }
  };

  const handleDelete = async (consultationId: string) => {
    try {
      const { error } = await supabase
        .from('meetings')
        .delete()
        .eq('id', consultationId);

      if (error) throw error;

      console.log("Consultation deleted successfully");

      fetchConsultations();
    } catch (error) {
      console.error('Error deleting consultation:', error);
      console.error("Failed to delete consultation");
    }
  };

  const handleMultiDelete = async () => {
    if (selectedConsultationIds.size === 0) return;

    try {
      const { error } = await supabase
        .from('meetings')
        .delete()
        .in('id', Array.from(selectedConsultationIds));

      if (error) throw error;

      console.log(`${selectedConsultationIds.size} consultation(s) deleted successfully`);

      setSelectedConsultationIds(new Set());
      fetchConsultations();
    } catch (error) {
      console.error('Error deleting consultations:', error);
      console.error("Failed to delete consultations");
    }
  };

  const toggleConsultationSelection = (consultationId: string) => {
    const newSelected = new Set(selectedConsultationIds);
    if (newSelected.has(consultationId)) {
      newSelected.delete(consultationId);
    } else {
      newSelected.add(consultationId);
    }
    setSelectedConsultationIds(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedConsultationIds.size === consultations.length) {
      setSelectedConsultationIds(new Set());
    } else {
      setSelectedConsultationIds(new Set(consultations.map(c => c.id)));
    }
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) {
      return `${minutes}m`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString(),
      time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      console.log("Copied to clipboard");
    } catch (error) {
      console.error("Failed to copy to clipboard");
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
              <div className="h-3 bg-muted rounded w-1/2"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (consultations.length === 0) {
    return (
      <div className="text-center py-12">
        <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-2">No consultations yet</h3>
        <p className="text-muted-foreground">
          Your consultation history will appear here after you record and generate notes.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h3 className="text-lg font-semibold">Consultation History</h3>
          <Badge variant="secondary">{consultations.length} consultations</Badge>
        </div>
        
        <div className="flex items-center gap-2">
          {consultations.length > 0 && (
            <>
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={selectedConsultationIds.size === consultations.length && consultations.length > 0}
                  onCheckedChange={toggleSelectAll}
                />
                <span className="text-sm text-muted-foreground">
                  Select all ({selectedConsultationIds.size} selected)
                </span>
              </div>
              
              {selectedConsultationIds.size > 0 && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm">
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete Selected ({selectedConsultationIds.size})
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Multiple Consultations</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to delete {selectedConsultationIds.size} consultation(s)? This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleMultiDelete}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Delete {selectedConsultationIds.size} Consultation(s)
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {consultations.map((consultation) => {
          const { date, time } = formatDate(consultation.created_at);
          
          return (
            <Card key={consultation.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="pt-1">
                    <Checkbox
                      checked={selectedConsultationIds.has(consultation.id)}
                      onCheckedChange={() => toggleConsultationSelection(consultation.id)}
                    />
                  </div>
                  
                  <div className="flex-1">
                    <h4 className="font-medium">{consultation.title}</h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      {consultation.description}
                    </p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {date}
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {time}
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDuration(consultation.duration_minutes)}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 ml-4 flex-wrap">
                    <Button
                      variant="link"
                      size="sm"
                      className="px-0 h-8"
                      onClick={() => navigate('/consultation-summary', { state: { meetingId: consultation.id } })}
                    >
                      <BookOpen className="h-4 w-4 mr-2" /> Open
                    </Button>
                  </div>

                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(consultation)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Edit Consultation</DialogTitle>
                          <DialogDescription>
                            Update the consultation title and description.
                          </DialogDescription>
                        </DialogHeader>
                        
                        <div className="space-y-4">
                          <div>
                            <Label htmlFor="title">Title</Label>
                            <Input
                              id="title"
                              value={editForm.title}
                              onChange={(e) => setEditForm(prev => ({ ...prev, title: e.target.value }))}
                            />
                          </div>
                          
                          <div>
                            <Label htmlFor="description">Description</Label>
                            <Textarea
                              id="description"
                              value={editForm.description}
                              onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                              rows={3}
                            />
                          </div>
                          
                          <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setEditingConsultation(null)}>
                              Cancel
                            </Button>
                            <Button onClick={handleSaveEdit}>
                              Save Changes
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Consultation</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete this consultation? This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(consultation.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};