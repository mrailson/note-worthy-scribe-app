import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { FileText, Upload, Clipboard, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface TranscriptImportProps {
  onImportTranscript: (transcript: string) => void;
  disabled?: boolean;
}

export const TranscriptImport = ({ onImportTranscript, disabled = false }: TranscriptImportProps) => {
  const [importText, setImportText] = useState("");
  const [isImporting, setIsImporting] = useState(false);

  const handlePasteTranscript = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text.trim()) {
        toast.error("No text found in clipboard");
        return;
      }
      setImportText(text);
      toast.success("Text pasted from clipboard");
    } catch (error) {
      console.error("Failed to read clipboard:", error);
      toast.error("Failed to read clipboard. Please paste manually.");
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check file type
    if (!file.type.startsWith('text/') && !file.name.endsWith('.txt')) {
      toast.error("Please upload a text file (.txt)");
      return;
    }

    // Check file size (max 1MB)
    if (file.size > 1024 * 1024) {
      toast.error("File too large. Maximum size is 1MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (text) {
        setImportText(text);
        toast.success(`Loaded text from ${file.name}`);
      }
    };
    reader.onerror = () => {
      toast.error("Failed to read file");
    };
    reader.readAsText(file);

    // Reset input
    event.target.value = "";
  };

  const handleImport = async () => {
    if (!importText.trim()) {
      toast.error("No text to import");
      return;
    }

    setIsImporting(true);
    try {
      // Clean up the text a bit
      const cleanedText = importText
        .trim()
        .replace(/\n{3,}/g, '\n\n') // Replace multiple newlines with double newlines
        .replace(/\s{2,}/g, ' '); // Replace multiple spaces with single space

      onImportTranscript(cleanedText);
      toast.success("Transcript imported successfully");
      setImportText(""); // Clear after successful import
    } catch (error) {
      console.error("Import failed:", error);
      toast.error("Failed to import transcript");
    } finally {
      setIsImporting(false);
    }
  };

  const handleClear = () => {
    setImportText("");
    toast.info("Text cleared");
  };

  const wordCount = importText.trim().split(/\s+/).filter(word => word.length > 0).length;

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Import Transcript for Testing
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="text-sm text-muted-foreground">
          Import a sample transcript to test consultation notes generation without recording.
        </div>

        {/* Import Controls */}
        <div className="flex flex-wrap gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handlePasteTranscript}
            disabled={disabled}
          >
            <Clipboard className="h-4 w-4 mr-1" />
            Paste from Clipboard
          </Button>
          
          <div className="relative">
            <input
              type="file"
              accept=".txt,text/plain"
              onChange={handleFileUpload}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              disabled={disabled}
            />
            <Button 
              variant="outline" 
              size="sm"
              disabled={disabled}
            >
              <Upload className="h-4 w-4 mr-1" />
              Upload Text File
            </Button>
          </div>

          {importText && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleClear}
              disabled={disabled}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Clear
            </Button>
          )}
        </div>

        {/* Text Area */}
        <div className="space-y-2">
          <Label htmlFor="import-text">Transcript Text</Label>
          <Textarea
            id="import-text"
            placeholder="Paste or type your transcript here..."
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            className="min-h-[200px] resize-vertical"
            disabled={disabled}
          />
          
          {importText && (
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>{wordCount} words</span>
              <span>{importText.length} characters</span>
            </div>
          )}
        </div>

        {/* Import Button */}
        <div className="flex justify-center">
          <Button
            onClick={handleImport}
            disabled={disabled || !importText.trim() || isImporting}
            className="px-6"
          >
            {isImporting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                Importing...
              </>
            ) : (
              <>
                <FileText className="h-4 w-4 mr-2" />
                Import & Generate Notes
              </>
            )}
          </Button>
        </div>

        {/* Sample Transcript */}
        <div className="border-t pt-4">
          <div className="text-sm font-medium mb-2">Sample Transcript:</div>
          <div className="text-xs text-muted-foreground bg-muted p-3 rounded-lg">
            <button
              onClick={() => setImportText(`Doctor: Good morning. What brings you in today?
Patient: I've been having this sore throat for about three days now.
Doctor: I see. Can you tell me more about your symptoms?
Patient: Well, it started with just a scratchy feeling, but now it's quite painful to swallow.
Doctor: Have you had any fever or chills?
Patient: Yes, I felt quite cold yesterday evening and took some paracetamol.
Doctor: Any difficulty breathing or chest pain?
Patient: No, nothing like that. Just this throat and a bit of a blocked nose.
Doctor: Let me have a look at your throat and check your chest.
Doctor: Your throat is quite red but your chest sounds clear. This looks like a viral infection.
Patient: So I don't need antibiotics?
Doctor: No, antibiotics won't help with a viral infection. I'll give you some advice on managing the symptoms.`)}
              className="text-left hover:bg-muted-foreground/10 p-1 rounded transition-colors"
            >
              Click to load sample URTI consultation transcript...
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};