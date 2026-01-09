import { useState, useCallback } from "react";
import { EditStates, EditContent } from "@/types/gpscribe";
import { supabase } from "@/integrations/supabase/client";
import { showToast } from "@/utils/toastWrapper";
import jsPDF from 'jspdf';
import { generateWordDocument, generatePowerPoint } from "@/utils/documentGenerators";

export const useDocumentGeneration = () => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [gpSummary, setGpSummary] = useState("");
  const [gpShorthand, setGpShorthand] = useState("");
  const [standardDetail, setStandardDetail] = useState("");
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
    consultationType?: string,
    patientLanguage?: string
  ) => {
    if (!transcript.trim()) {
      showToast.error("No transcript available for summary generation", { section: 'gpscribe' });
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
          consultationType,
          patientLanguage: patientLanguage || 'english'
        }
      });

      if (error) throw error;

      setGpSummary(data.gpSummary || "");
      setFullNote(data.fullNote || "");
      setPatientCopy(data.patientCopy || "");
      setTraineeFeedback(data.traineeFeedback || "");

      showToast.success("Consultation notes generated successfully", { section: 'gpscribe' });
      return data;
    } catch (error) {
      console.error('Summary generation error:', error);
      showToast.error('Failed to generate consultation notes', { section: 'gpscribe' });
      return null;
    } finally {
      setIsGenerating(false);
    }
  }, []);

  const generateReferralLetter = useCallback(async (transcript: string, consultationType?: string) => {
    if (!transcript.trim()) {
      showToast.error("No transcript available for referral letter generation", { section: 'gpscribe' });
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
      showToast.success("Referral letter generated successfully", { section: 'gpscribe' });
      return data;
    } catch (error) {
      console.error('Referral letter generation error:', error);
      showToast.error('Failed to generate referral letter', { section: 'gpscribe' });
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
      showToast.success("PDF exported successfully", { section: 'gpscribe' });
    } catch (error) {
      console.error('PDF export error:', error);
      showToast.error('Failed to export PDF', { section: 'gpscribe' });
    }
  }, []);

  const exportToWord = useCallback(async (content: string, title: string) => {
    try {
      await generateWordDocument(content, title);
      showToast.success("Word document exported successfully", { section: 'gpscribe' });
    } catch (error) {
      console.error('Word export error:', error);
      showToast.error('Failed to export Word document', { section: 'gpscribe' });
    }
  }, []);

  const exportToPowerPoint = useCallback(async (content: string, title: string) => {
    try {
      // Use new edge function approach for better formatting
      const { parseContentToSlides } = await import('@/utils/contentParser');
      const structuredData = parseContentToSlides(content, title);
      
      const { data, error } = await supabase.functions.invoke('json-to-pptx', {
        body: { jsonData: JSON.stringify(structuredData) }
      });

      if (error) {
        console.error('Edge function error:', error);
        // Fallback to local generation
        const { generatePowerPoint } = await import('@/utils/documentGenerators');
        await generatePowerPoint(content, title);
      } else {
        // Handle binary response for download
        const blob = new Blob([data], { 
          type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' 
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${title.toLowerCase().replace(/\s+/g, '-')}.pptx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
      
      showToast.success("PowerPoint presentation exported successfully", { section: 'gpscribe' });
    } catch (error) {
      console.error('PowerPoint export error:', error);
      showToast.error('Failed to export PowerPoint presentation', { section: 'gpscribe' });
    }
  }, []);

  const startEdit = useCallback((field: keyof EditStates) => {
    const stateMap: Record<keyof EditStates, string> = {
      gpSummary,
      fullNote,
      patientCopy,
      traineeFeedback,
      referralLetter
    };
    setEditStates(prev => ({ ...prev, [field]: true }));
    setEditContent(prev => ({
      ...prev,
      [field]: stateMap[field]
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
    showToast.success("Changes saved successfully", { section: 'gpscribe' });
  }, [editContent]);

  const clearAllContent = useCallback(() => {
    console.log("useDocumentGeneration: Clearing all content");
    setGpSummary("");
    setGpShorthand("");
    setStandardDetail("");
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
    console.log("useDocumentGeneration: All content cleared");
  }, []);

  return {
    // States
    isGenerating,
    gpSummary,
    gpShorthand,
    standardDetail,
    fullNote,
    patientCopy,
    traineeFeedback,
    referralLetter,
    editStates,
    editContent,

    // Actions
    setEditContent,
    setGpSummary,
    setGpShorthand,
    setStandardDetail,
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