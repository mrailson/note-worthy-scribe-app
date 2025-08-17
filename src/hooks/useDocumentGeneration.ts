import { useState, useCallback } from "react";
import { EditStates, EditContent } from "@/types/gpscribe";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import jsPDF from 'jspdf';
import { generateWordDocument, generatePowerPoint } from "@/utils/documentGenerators";

export const useDocumentGeneration = () => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [gpSummary, setGpSummary] = useState("");
  const [fullNote, setFullNote] = useState("");
  const [patientCopy, setPatientCopy] = useState("");
  const [traineeFeedback, setTraineeFeedback] = useState("");
  const [referralLetter, setReferralLetter] = useState("");

  const [editStates, setEditStates] = useState<EditStates>({
    gpSummary: false,
    fullNote: false,
    patientCopy: false,
    traineeFeedback: false,
    referralLetter: false
  });

  const [editContent, setEditContent] = useState<EditContent>({
    gpSummary: "",
    fullNote: "",
    patientCopy: "",
    traineeFeedback: "",
    referralLetter: ""
  });

  const generateSummary = useCallback(async (
    transcript: string,
    outputLevel: number,
    showSnomedCodes: boolean,
    formatForEmis: boolean,
    formatForSystmOne: boolean,
    consultationType?: string
  ) => {
    if (!transcript.trim()) {
      toast.error("No transcript available for summary generation");
      return;
    }

    try {
      setIsGenerating(true);
      
      const { data, error } = await supabase.functions.invoke('generate-gp-consultation-notes', {
        body: { 
          transcript: transcript.trim(),
          outputLevel,
          showSnomedCodes,
          formatForEmis,
          formatForSystmOne,
          consultationType 
        }
      });

      if (error) throw error;

      setGpSummary(data.gpSummary || "");
      setFullNote(data.fullNote || "");
      setPatientCopy(data.patientCopy || "");
      setTraineeFeedback(data.traineeFeedback || "");

      toast.success("Consultation notes generated successfully");
      return data;
    } catch (error) {
      console.error('Summary generation error:', error);
      toast.error('Failed to generate consultation notes');
      return null;
    } finally {
      setIsGenerating(false);
    }
  }, []);

  const generateReferralLetter = useCallback(async (transcript: string, consultationType?: string) => {
    if (!transcript.trim()) {
      toast.error("No transcript available for referral letter generation");
      return;
    }

    try {
      setIsGenerating(true);
      
      const { data, error } = await supabase.functions.invoke('generate-referral-letter', {
        body: { 
          transcript: transcript.trim(),
          consultationType 
        }
      });

      if (error) throw error;

      setReferralLetter(data.referralLetter || "");
      toast.success("Referral letter generated successfully");
      return data;
    } catch (error) {
      console.error('Referral letter generation error:', error);
      toast.error('Failed to generate referral letter');
      return null;
    } finally {
      setIsGenerating(false);
    }
  }, []);

  const exportToPDF = useCallback((content: string, title: string) => {
    try {
      const pdf = new jsPDF();
      const pageHeight = pdf.internal.pageSize.height;
      const margin = 20;
      const lineHeight = 10;
      let y = margin;

      // Add title
      pdf.setFontSize(16);
      pdf.setFont('helvetica', 'bold');
      pdf.text(title, margin, y);
      y += lineHeight * 2;

      // Add content
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'normal');
      
      const lines = pdf.splitTextToSize(content, pdf.internal.pageSize.width - 2 * margin);
      
      lines.forEach((line: string) => {
        if (y + lineHeight > pageHeight - margin) {
          pdf.addPage();
          y = margin;
        }
        pdf.text(line, margin, y);
        y += lineHeight;
      });

      pdf.save(`${title.toLowerCase().replace(/\s+/g, '-')}.pdf`);
      toast.success("PDF exported successfully");
    } catch (error) {
      console.error('PDF export error:', error);
      toast.error('Failed to export PDF');
    }
  }, []);

  const exportToWord = useCallback(async (content: string, title: string) => {
    try {
      await generateWordDocument(content, title);
      toast.success("Word document exported successfully");
    } catch (error) {
      console.error('Word export error:', error);
      toast.error('Failed to export Word document');
    }
  }, []);

  const exportToPowerPoint = useCallback(async (content: string, title: string) => {
    try {
      await generatePowerPoint(content, title);
      toast.success("PowerPoint presentation exported successfully");
    } catch (error) {
      console.error('PowerPoint export error:', error);
      toast.error('Failed to export PowerPoint presentation');
    }
  }, []);

  const startEdit = useCallback((field: keyof EditStates) => {
    setEditStates(prev => ({ ...prev, [field]: true }));
    setEditContent(prev => ({
      ...prev,
      [field]: eval(field) // Get current value
    }));
  }, [gpSummary, fullNote, patientCopy, traineeFeedback, referralLetter]);

  const cancelEdit = useCallback((field: keyof EditStates) => {
    setEditStates(prev => ({ ...prev, [field]: false }));
    setEditContent(prev => ({ ...prev, [field]: "" }));
  }, []);

  const saveEdit = useCallback((field: keyof EditStates) => {
    const newValue = editContent[field];
    
    switch (field) {
      case 'gpSummary':
        setGpSummary(newValue);
        break;
      case 'fullNote':
        setFullNote(newValue);
        break;
      case 'patientCopy':
        setPatientCopy(newValue);
        break;
      case 'traineeFeedback':
        setTraineeFeedback(newValue);
        break;
      case 'referralLetter':
        setReferralLetter(newValue);
        break;
    }

    setEditStates(prev => ({ ...prev, [field]: false }));
    setEditContent(prev => ({ ...prev, [field]: "" }));
    toast.success("Changes saved successfully");
  }, [editContent]);

  const clearAllContent = useCallback(() => {
    setGpSummary("");
    setFullNote("");
    setPatientCopy("");
    setTraineeFeedback("");
    setReferralLetter("");
    setEditStates({
      gpSummary: false,
      fullNote: false,
      patientCopy: false,
      traineeFeedback: false,
      referralLetter: false
    });
    setEditContent({
      gpSummary: "",
      fullNote: "",
      patientCopy: "",
      traineeFeedback: "",
      referralLetter: ""
    });
  }, []);

  return {
    // States
    isGenerating,
    gpSummary,
    fullNote,
    patientCopy,
    traineeFeedback,
    referralLetter,
    editStates,
    editContent,

    // Actions
    setEditContent,
    setGpSummary,
    setFullNote,
    setPatientCopy,
    setTraineeFeedback,
    setReferralLetter,
    generateSummary,
    generateReferralLetter,
    exportToPDF,
    exportToWord,
    exportToPowerPoint,
    startEdit,
    cancelEdit,
    saveEdit,
    clearAllContent
  };
};