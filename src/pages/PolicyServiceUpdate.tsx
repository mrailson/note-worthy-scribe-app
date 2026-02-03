import { useState } from "react";
import { Header } from "@/components/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, Check, RefreshCw, Upload, FileText, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useDropzone } from "react-dropzone";
import { GapAnalysisResults } from "@/components/policy/GapAnalysisResults";
import { PolicyPreviewPanel } from "@/components/policy/PolicyPreviewPanel";
import { usePolicyAnalysis } from "@/hooks/usePolicyAnalysis";
import { toast } from "sonner";

interface GapAnalysis {
  policy_type: string;
  gaps: string[];
  outdated_references: string[];
  missing_sections: string[];
  last_review_date: string | null;
}

const PolicyServiceUpdate = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [extractedText, setExtractedText] = useState<string | null>(null);
  const [gapAnalysis, setGapAnalysis] = useState<GapAnalysis | null>(null);
  const [updatedContent, setUpdatedContent] = useState<string | null>(null);
  const [updatedMetadata, setUpdatedMetadata] = useState<any>(null);
  const [generationId, setGenerationId] = useState<string | null>(null);

  const { extractText, analyseGaps, generateUpdatedPolicy, isExtracting, isAnalysing, isGenerating } = usePolicyAnalysis();

  const steps = [
    { number: 1, title: "Upload Document" },
    { number: 2, title: "Gap Analysis" },
    { number: 3, title: "Updated Policy" },
  ];

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/msword': ['.doc'],
    },
    maxSize: 10 * 1024 * 1024, // 10MB
    maxFiles: 1,
    onDrop: async (acceptedFiles) => {
      if (acceptedFiles.length > 0) {
        const file = acceptedFiles[0];
        setUploadedFile(file);
        
        try {
          const text = await extractText(file);
          setExtractedText(text);
        } catch (error) {
          console.error("Extraction error:", error);
          toast.error("Failed to extract text from document");
          setUploadedFile(null);
        }
      }
    },
    onDropRejected: (rejections) => {
      const error = rejections[0]?.errors[0];
      if (error?.code === 'file-too-large') {
        toast.error("File is too large. Maximum size is 10MB.");
      } else if (error?.code === 'file-invalid-type') {
        toast.error("Invalid file type. Please upload a .pdf, .doc, or .docx file.");
      }
    },
  });

  const handleAnalyse = async () => {
    if (!extractedText) {
      toast.error("No document text available");
      return;
    }

    try {
      const analysis = await analyseGaps(extractedText);
      setGapAnalysis(analysis);
      setStep(2);
    } catch (error) {
      console.error("Analysis error:", error);
      toast.error("Failed to analyse document");
    }
  };

  const handleGenerateUpdated = async () => {
    if (!extractedText || !gapAnalysis) {
      toast.error("Missing required data");
      return;
    }

    try {
      const result = await generateUpdatedPolicy(extractedText, gapAnalysis);
      setUpdatedContent(result.content);
      setUpdatedMetadata(result.metadata);
      setGenerationId(result.generationId);
      setStep(3);
    } catch (error) {
      console.error("Generation error:", error);
      toast.error("Failed to generate updated policy");
    }
  };

  const isLoading = isExtracting || isAnalysing || isGenerating;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8 max-w-5xl">
        {/* Back Button */}
        <Button
          variant="ghost"
          onClick={() => navigate('/policy-service')}
          className="mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Practice Policies
        </Button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <RefreshCw className="h-8 w-8 text-primary" />
          <h1 className="text-2xl sm:text-3xl font-bold">Update Existing Policy</h1>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-between mb-8 max-w-lg mx-auto">
          {steps.map((s, index) => (
            <div key={s.number} className="flex items-center">
              <div className="flex flex-col items-center">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                    step > s.number
                      ? "bg-primary text-primary-foreground"
                      : step === s.number
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {step > s.number ? <Check className="h-5 w-5" /> : s.number}
                </div>
                <span className="text-xs mt-2 text-center max-w-[80px]">
                  {s.title}
                </span>
              </div>
              {index < steps.length - 1 && (
                <div
                  className={`w-16 sm:w-24 h-0.5 mx-2 ${
                    step > s.number ? "bg-primary" : "bg-muted"
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step Content */}
        <Card>
          <CardHeader>
            <CardTitle>{steps[step - 1].title}</CardTitle>
            <CardDescription>
              {step === 1 && "Upload your existing policy document for analysis"}
              {step === 2 && "Review the gaps identified in your current policy"}
              {step === 3 && "Review and download your updated policy"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {step === 1 && (
              <div className="space-y-6">
                <div
                  {...getRootProps()}
                  className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
                    isDragActive 
                      ? "border-primary bg-primary/5" 
                      : uploadedFile 
                      ? "border-green-500 bg-green-50 dark:bg-green-950" 
                      : "border-muted-foreground/25 hover:border-primary"
                  }`}
                >
                  <input {...getInputProps()} />
                  {isExtracting ? (
                    <div className="flex flex-col items-center">
                      <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
                      <p className="text-muted-foreground">Extracting document content...</p>
                    </div>
                  ) : uploadedFile ? (
                    <div className="flex flex-col items-center">
                      <FileText className="h-12 w-12 text-green-500 mb-4" />
                      <p className="font-medium">{uploadedFile.name}</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {(uploadedFile.size / 1024).toFixed(1)} KB • Ready for analysis
                      </p>
                      <Button
                        variant="link"
                        className="mt-2"
                        onClick={(e) => {
                          e.stopPropagation();
                          setUploadedFile(null);
                          setExtractedText(null);
                        }}
                      >
                        Choose a different file
                      </Button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center">
                      <Upload className="h-12 w-12 text-muted-foreground mb-4" />
                      <p className="text-lg font-medium">
                        {isDragActive ? "Drop your file here" : "Drag & drop your policy document"}
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        or click to browse (.pdf, .doc, .docx • Max 10MB)
                      </p>
                    </div>
                  )}
                </div>

                {extractedText && (
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground mb-2">Document Preview:</p>
                    <p className="text-sm line-clamp-3">{extractedText.substring(0, 500)}...</p>
                  </div>
                )}
              </div>
            )}

            {step === 2 && gapAnalysis && (
              <GapAnalysisResults
                analysis={gapAnalysis}
                onGenerateUpdated={handleGenerateUpdated}
                isGenerating={isGenerating}
              />
            )}

            {step === 3 && updatedContent && (
              <PolicyPreviewPanel
                content={updatedContent}
                metadata={updatedMetadata}
                policyName={gapAnalysis?.policy_type || "Updated Policy"}
                generationId={generationId}
                isUpdate
              />
            )}
          </CardContent>
        </Card>

        {/* Navigation Buttons */}
        <div className="flex justify-between mt-6">
          <Button 
            variant="outline" 
            onClick={() => step === 1 ? navigate('/policy-service') : setStep(step - 1)}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            {step === 1 ? "Cancel" : "Back"}
          </Button>
          
          {step === 1 && (
            <Button 
              onClick={handleAnalyse} 
              disabled={!extractedText || isLoading}
            >
              {isAnalysing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Analysing...
                </>
              ) : (
                <>
                  Analyse Policy
                  <ArrowRight className="h-4 w-4 ml-2" />
                </>
              )}
            </Button>
          )}

          {step === 3 && (
            <Button onClick={() => navigate('/policy-service')}>
              Done
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          )}
        </div>
      </main>
    </div>
  );
};

export default PolicyServiceUpdate;
