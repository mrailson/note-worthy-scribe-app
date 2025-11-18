import React, { useState } from "react";
import { Header } from "@/components/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { FileText, Download, Shield, CheckCircle2, AlertCircle, Info, Loader2, ArrowLeft } from "lucide-react";
import { CompanyInfoSection } from "@/components/dtac/CompanyInfoSection";
import { ValuePropositionSection } from "@/components/dtac/ValuePropositionSection";
import { ClinicalSafetySection } from "@/components/dtac/ClinicalSafetySection";
import { DataProtectionSection } from "@/components/dtac/DataProtectionSection";
import { TechnicalSecuritySection } from "@/components/dtac/TechnicalSecuritySection";
import { InteroperabilitySection } from "@/components/dtac/InteroperabilitySection";
import { UsabilitySection } from "@/components/dtac/UsabilitySection";
import { DTACProgress as DTACProgressTracker } from "@/components/dtac/DTACProgress";
import type { DTACAssessment } from "@/types/dtac";
import { generateDTACDocx } from "@/utils/generateDTACDocx";
import { toast } from "sonner";
import { useDTACAssessment } from "@/hooks/useDTACAssessment";
import { useNavigate } from "react-router-dom";

const DTACAssessmentPage: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("overview");
  const [isGenerating, setIsGenerating] = useState(false);
  
  const { assessment, setAssessment, loading } = useDTACAssessment();
  
  if (loading) {
    return (
      <>
        <Header />
        <div className="container mx-auto p-6 flex items-center justify-center min-h-[50vh]">
          <div className="flex items-center gap-2">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span>Loading assessment...</span>
          </div>
        </div>
      </>
    );
  }
  
  if (!assessment) {
    return (
      <>
        <Header />
        <div className="container mx-auto p-6">
          <Alert variant="destructive">
            <AlertDescription>
              Failed to load assessment. Please refresh the page.
            </AlertDescription>
          </Alert>
        </div>
      </>
    );
  }

  const handleDownloadDTAC = async () => {
    setIsGenerating(true);
    toast.info("Generating DTAC document...");
    
    try {
      await generateDTACDocx(assessment as DTACAssessment);
      toast.success("DTAC document generated successfully");
    } catch (error) {
      console.error("Error generating DTAC:", error);
      toast.error("Failed to generate DTAC document");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Back Navigation */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/cso-report')}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to CSO Report
        </Button>

        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
              <Shield className="h-8 w-8 text-primary" />
              DTAC Assessment
            </h1>
            <p className="text-muted-foreground mt-1">
              NHS Digital Technology Assessment Criteria
            </p>
          </div>
          
          <div className="flex gap-2">
            <Button
              onClick={handleDownloadDTAC}
              disabled={isGenerating}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              {isGenerating ? "Generating..." : "Download DTAC"}
            </Button>
          </div>
        </div>

        {/* Status Alert */}
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Assessment Status: Draft</AlertTitle>
          <AlertDescription>
            Complete all sections to submit your DTAC assessment. Progress is saved automatically.
          </AlertDescription>
        </Alert>

        {/* Progress Tracker */}
        <DTACProgressTracker assessment={assessment as DTACAssessment} />

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-4 lg:grid-cols-8">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="company">A: Company</TabsTrigger>
            <TabsTrigger value="value">B: Value</TabsTrigger>
            <TabsTrigger value="clinical">C1: Clinical</TabsTrigger>
            <TabsTrigger value="data">C2: Data</TabsTrigger>
            <TabsTrigger value="security">C3: Security</TabsTrigger>
            <TabsTrigger value="interop">C4: Interop</TabsTrigger>
            <TabsTrigger value="usability">D: Usability</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>DTAC Assessment Overview</CardTitle>
                <CardDescription>
                  NHS Digital Technology Assessment Criteria for health and care technologies
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  The DTAC framework helps NHS organisations assess digital health technologies across key areas:
                </p>
                
                <div className="grid gap-4 md:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Section A: Company Information</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">
                        Basic company and product details, registration information, and contact details.
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Section B: Value Proposition</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">
                        Target users, problems solved, benefits delivered, and supporting evidence.
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Section C1: Clinical Safety</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">
                        Clinical Safety Officer details, DCB0129 compliance, MHRA registration, hazard logs.
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Section C2: Data Protection</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">
                        ICO registration, DPO details, DSPT status, DPIA completion, data location.
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Section C3: Technical Security</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">
                        Cyber Essentials, penetration testing, vulnerability management, incident response.
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Section C4: Interoperability</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">
                        Standards compliance (HL7, FHIR, SNOMED CT), API availability, integration support.
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Section D: Usability & Accessibility</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">
                        User testing, WCAG compliance, accessibility testing, support and training.
                      </p>
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="company">
            <CompanyInfoSection 
              data={assessment.companyInfo!} 
              onChange={(data) => setAssessment({ ...assessment, companyInfo: data })}
            />
          </TabsContent>

          <TabsContent value="value">
            <ValuePropositionSection 
              data={assessment.valueProposition!} 
              onChange={(data) => setAssessment({ ...assessment, valueProposition: data })}
            />
          </TabsContent>

          <TabsContent value="clinical">
            <ClinicalSafetySection 
              data={assessment.clinicalSafety!} 
              onChange={(data) => setAssessment({ ...assessment, clinicalSafety: data })}
            />
          </TabsContent>

          <TabsContent value="data">
            <DataProtectionSection 
              data={assessment.dataProtection!} 
              onChange={(data) => setAssessment({ ...assessment, dataProtection: data })}
            />
          </TabsContent>

          <TabsContent value="security">
            <TechnicalSecuritySection 
              data={assessment.technicalSecurity!} 
              onChange={(data) => setAssessment({ ...assessment, technicalSecurity: data })}
            />
          </TabsContent>

          <TabsContent value="interop">
            <InteroperabilitySection 
              data={assessment.interoperability!} 
              onChange={(data) => setAssessment({ ...assessment, interoperability: data })}
            />
          </TabsContent>

          <TabsContent value="usability">
            <UsabilitySection 
              data={assessment.usabilityAccessibility!} 
              onChange={(data) => setAssessment({ ...assessment, usabilityAccessibility: data })}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default DTACAssessmentPage;
