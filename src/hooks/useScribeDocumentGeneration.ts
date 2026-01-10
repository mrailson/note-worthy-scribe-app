import { useState, useCallback } from "react";
import { ScribeEditStates, ScribeEditContent } from "@/types/scribe";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import jsPDF from 'jspdf';
import { generateWordDocument } from "@/utils/documentGenerators";

export const useScribeDocumentGeneration = () => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [summary, setSummary] = useState("");
  const [actionItems, setActionItems] = useState("");
  const [keyPoints, setKeyPoints] = useState("");

  const [editStates, setEditStates] = useState<ScribeEditStates>({
    summary: false,
    actionItems: false,
    keyPoints: false,
  });

  const [editContent, setEditContent] = useState<ScribeEditContent>({
    summary: "",
    actionItems: "",
    keyPoints: "",
  });

  const generateNotes = useCallback(async (
    transcript: string,
    outputFormat: string = 'summary'
  ) => {
    if (!transcript.trim()) {
      toast.error("No transcript available for notes generation");
      return;
    }

    try {
      setIsGenerating(true);
      
      const { data, error } = await supabase.functions.invoke('generate-scribe-notes', {
        body: { 
          transcript: transcript.trim(),
          outputFormat,
        }
      });

      if (error) throw error;

      setSummary(data.summary || "");
      setActionItems(data.actionItems || "");
      setKeyPoints(data.keyPoints || "");

      toast.success("Notes generated successfully");
      return data;
    } catch (error) {
      console.error('Notes generation error:', error);
      toast.error('Failed to generate notes');
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

  const startEdit = useCallback((field: keyof ScribeEditStates) => {
    const stateMap: Record<keyof ScribeEditStates, string> = {
      summary,
      actionItems,
      keyPoints,
    };
    setEditStates(prev => ({ ...prev, [field]: true }));
    setEditContent(prev => ({
      ...prev,
      [field]: stateMap[field]
    }));
  }, [summary, actionItems, keyPoints]);

  const cancelEdit = useCallback((field: keyof ScribeEditStates) => {
    setEditStates(prev => ({ ...prev, [field]: false }));
    setEditContent(prev => ({ ...prev, [field]: "" }));
  }, []);

  const saveEdit = useCallback((field: keyof ScribeEditStates) => {
    const newValue = editContent[field];
    
    switch (field) {
      case 'summary':
        setSummary(newValue);
        break;
      case 'actionItems':
        setActionItems(newValue);
        break;
      case 'keyPoints':
        setKeyPoints(newValue);
        break;
    }

    setEditStates(prev => ({ ...prev, [field]: false }));
    setEditContent(prev => ({ ...prev, [field]: "" }));
    toast.success("Changes saved successfully");
  }, [editContent]);

  const clearAllContent = useCallback(() => {
    console.log("Scribe: Clearing all content");
    setSummary("");
    setActionItems("");
    setKeyPoints("");
    setEditStates({
      summary: false,
      actionItems: false,
      keyPoints: false,
    });
    setEditContent({
      summary: "",
      actionItems: "",
      keyPoints: "",
    });
  }, []);

  return {
    // States
    isGenerating,
    summary,
    actionItems,
    keyPoints,
    editStates,
    editContent,

    // Actions
    setEditContent,
    setSummary,
    setActionItems,
    setKeyPoints,
    generateNotes,
    exportToPDF,
    exportToWord,
    startEdit,
    cancelEdit,
    saveEdit,
    clearAllContent,
  };
};
