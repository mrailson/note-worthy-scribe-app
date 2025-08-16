import { useCallback } from 'react';
import { UploadedFile } from '@/types/ai4gp';
import { toast } from 'sonner';

export const usePasteAsFile = () => {
  const convertTextToFile = useCallback((text: string): UploadedFile => {
    const timestamp = new Date().toLocaleString();
    const lines = text.split('\n');
    const firstLine = lines[0].trim();
    
    // Smart naming based on content
    let fileName = `Pasted text (${timestamp})`;
    
    // Detect content type for better naming
    if (text.includes('```') || text.includes('function ') || text.includes('const ') || text.includes('import ')) {
      fileName = `Code snippet (${timestamp})`;
    } else if (text.includes('{') && text.includes('}') && text.includes(':')) {
      fileName = `JSON data (${timestamp})`;
    } else if (text.includes('\t') || text.includes(',')) {
      fileName = `Table data (${timestamp})`;
    } else if (firstLine.length > 0 && firstLine.length < 50) {
      fileName = `${firstLine.substring(0, 30)}... (${timestamp})`;
    }
    
    return {
      name: fileName,
      type: 'text/plain',
      content: `PASTED CONTENT:

${text}

[Pasted from clipboard]`,
      size: text.length,
      source: 'paste'
    };
  }, []);

  const shouldConvertToFile = useCallback((text: string): boolean => {
    // Convert to file if:
    // - More than 3 lines
    // - More than 200 characters
    // - Contains structured data patterns
    const lines = text.split('\n');
    const hasMultipleLines = lines.length > 3;
    const isLongText = text.length > 200;
    const hasStructuredData = text.includes('\t') || text.includes('```') || 
                             (text.includes('{') && text.includes('}')) ||
                             text.includes('|') || // Table format
                             lines.filter(line => line.trim().startsWith('-')).length > 2; // List format
    
    return hasMultipleLines || isLongText || hasStructuredData;
  }, []);

  const handlePaste = useCallback((
    text: string, 
    onAddFile: (file: UploadedFile) => void,
    onConfirm?: () => void
  ) => {
    if (shouldConvertToFile(text)) {
      const file = convertTextToFile(text);
      onAddFile(file);
      toast.success("Large text converted to file attachment", {
        description: "Keeps your prompt box clean and organized"
      });
      onConfirm?.();
      return true; // Indicates paste was handled as file
    }
    return false; // Let normal paste behavior continue
  }, [shouldConvertToFile, convertTextToFile]);

  return {
    handlePaste,
    convertTextToFile,
    shouldConvertToFile
  };
};