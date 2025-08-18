import React, { useState } from "react";
import { useDocumentGeneration } from "@/hooks/useDocumentGeneration";
import { Button } from "@/components/ui/button";
import { Copy, FileText, Download } from "lucide-react";
import { toast } from "sonner";

interface GPSoapDisplayProps {
  transcript?: string;
}

export const GPSoapDisplay = ({ transcript }: GPSoapDisplayProps) => {
  const documents = useDocumentGeneration();
  const [mode, setMode] = useState<"shorthand" | "standard">("shorthand");
  const [activeTab, setActiveTab] = useState<"summary" | "patient" | "referral" | "review" | "transcript">("summary");

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied to clipboard");
    } catch (err) {
      console.error("Copy failed:", err);
      toast.error("Failed to copy to clipboard");
    }
  };

  // Check if we have generated content
  const hasGeneratedContent = documents.gpShorthand || documents.standardDetail || documents.patientCopy;
  
  console.log("🔍 GPSoapDisplay render:", {
    hasGeneratedContent,
    gpShorthand: documents.gpShorthand?.substring(0, 50) + "...",
    standardDetail: documents.standardDetail?.substring(0, 50) + "...",
    transcriptLength: transcript?.length || 0
  });

  if (!hasGeneratedContent) {
    return (
      <div className="bg-card rounded-lg border p-8 text-center">
        <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
        <h3 className="text-lg font-semibold mb-2">No Consultation Notes Generated</h3>
        <p className="text-muted-foreground mb-4">
          Import a transcript or start recording to generate consultation notes.
        </p>
      </div>
    );
  }

  const currentContent = mode === "shorthand" ? documents.gpShorthand : documents.standardDetail;

  return (
    <div className="bg-card rounded-lg border">
      {/* Header */}
      <div className="border-b p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold">Generated Consultation Notes</h2>
            <p className="text-sm text-muted-foreground">AI-generated from imported transcript</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => copy(documents.gpSummary || currentContent)}
            >
              <Copy className="h-4 w-4 mr-2" />
              Copy
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => documents.exportToPDF(currentContent, "Consultation Notes")}
            >
              <Download className="h-4 w-4 mr-2" />
              Export PDF
            </Button>
          </div>
        </div>

        {/* Mode Toggle */}
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">Format:</label>
          <div className="flex rounded-lg border bg-background p-1">
            <button
              onClick={() => setMode("shorthand")}
              className={`rounded px-3 py-1 text-sm transition-colors ${
                mode === "shorthand" 
                  ? "bg-primary text-primary-foreground" 
                  : "hover:bg-muted"
              }`}
            >
              GP Shorthand
            </button>
            <button
              onClick={() => setMode("standard")}
              className={`rounded px-3 py-1 text-sm transition-colors ${
                mode === "standard" 
                  ? "bg-primary text-primary-foreground" 
                  : "hover:bg-muted"
              }`}
            >
              Standard Detail
            </button>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b">
        <div className="flex gap-1 p-1">
          {[
            { id: "summary", label: "SOAP Notes" },
            { id: "patient", label: "Patient Copy" },
            { id: "referral", label: "Referral" },
            { id: "review", label: "Review" },
            { id: "transcript", label: "Transcript" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`rounded px-3 py-2 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {activeTab === "summary" && (
          <div className="space-y-4">
            {documents.gpSummary && (
              <div className="bg-muted/50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-sm">Summary Line</h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copy(documents.gpSummary)}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
                <p className="text-sm">{documents.gpSummary}</p>
              </div>
            )}
            
            <div className="bg-background rounded-lg border p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">
                  {mode === "shorthand" ? "GP Shorthand Notes" : "Standard Detail Notes"}
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copy(currentContent)}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
              <div className="whitespace-pre-wrap text-sm font-mono">
                {currentContent || "No content generated"}
              </div>
            </div>
          </div>
        )}

        {activeTab === "patient" && (
          <div className="bg-background rounded-lg border p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">Patient Copy</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copy(documents.patientCopy)}
              >
                <Copy className="h-3 w-3" />
              </Button>
            </div>
            <div className="whitespace-pre-wrap text-sm">
              {documents.patientCopy || "No patient copy generated"}
            </div>
          </div>
        )}

        {activeTab === "referral" && (
          <div className="bg-background rounded-lg border p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">Referral Letter</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copy(documents.referralLetter)}
              >
                <Copy className="h-3 w-3" />
              </Button>
            </div>
            <div className="whitespace-pre-wrap text-sm">
              {documents.referralLetter || "No referral letter generated"}
            </div>
          </div>
        )}

        {activeTab === "review" && (
          <div className="bg-background rounded-lg border p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">AI Review & Recommendations</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copy(documents.traineeFeedback)}
              >
                <Copy className="h-3 w-3" />
              </Button>
            </div>
            <div className="whitespace-pre-wrap text-sm">
              {documents.traineeFeedback || "No review generated"}
            </div>
          </div>
        )}

        {activeTab === "transcript" && (
          <div className="bg-background rounded-lg border p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">Original Transcript</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copy(transcript || "")}
              >
                <Copy className="h-3 w-3" />
              </Button>
            </div>
            <div className="whitespace-pre-wrap text-sm text-muted-foreground">
              {transcript || "No transcript available"}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};