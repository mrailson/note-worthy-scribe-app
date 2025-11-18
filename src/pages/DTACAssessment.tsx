import React, { useState } from "react";
import { Header } from "@/components/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { FileText, Download, Shield, CheckCircle2, AlertCircle, Info } from "lucide-react";
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

const DTACAssessment: React.FC = () => {
  const [activeTab, setActiveTab] = useState("overview");
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Initial empty assessment state
  const [assessment, setAssessment] = useState<Partial<DTACAssessment>>({
    status: 'draft',
    version: '1.0',
    companyInfo: {
      a1_companyName: '',
      a2_productName: '',
      a3_productType: '',
      a4_contactName: '',
      a5_contactEmail: '',
      a6_contactPhone: '',
      a7_companyRegistrationNumber: '',
      a8_registeredAddress: '',
      a9_websiteUrl: '',
      a10_yearsTrading: '',
    },
    valueProposition: {
      b1_targetUsers: '',
      b2_problemSolved: '',
      b3_benefits: '',
      b4_evidenceBase: '',
    },
    clinicalSafety: {
      c1_1_csoName: '',
      c1_1_csoQualifications: '',
      c1_1_csoContact: '',
      c1_2_dcb0129Compliant: false,
      c1_2_dcb0129Evidence: '',
      c1_3_mhraRegistered: false,
      c1_3_mhraDetails: '',
      c1_4_hazardLog: false,
      c1_4_hazardLogSummary: '',
    },
    dataProtection: {
      c2_1_icoRegistered: false,
      c2_1_icoNumber: '',
      c2_2_dpoName: '',
      c2_2_dpoContact: '',
      c2_3_dsptStatus: '',
      c2_3_dsptEvidence: '',
      c2_3_2_dpiaCompleted: false,
      c2_3_2_dpiaDate: '',
      c2_3_2_dpiaSummary: '',
      c2_4_dataMinimisation: '',
      c2_5_dataLocation: '',
      c2_5_dataLocationDetails: '',
    },
    technicalSecurity: {
      c3_1_cyberEssentials: false,
      c3_1_cyberEssentialsPlus: false,
      c3_1_certificateNumber: '',
      c3_2_penetrationTesting: false,
      c3_2_testingFrequency: '',
      c3_2_lastTestDate: '',
      c3_3_vulnerabilityManagement: '',
      c3_4_incidentResponse: '',
    },
    interoperability: {
      c4_1_standardsCompliance: [],
      c4_1_standardsDetails: '',
      c4_2_apiAvailable: false,
      c4_2_apiDocumentation: '',
      c4_3_integrationSupport: '',
    },
    usabilityAccessibility: {
      d1_1_userTesting: false,
      d1_1_userTestingDetails: '',
      d1_2_accessibilityStandard: '',
      d1_2_wcagLevel: '',
      d1_3_accessibilityTesting: '',
      d1_4_userSupport: '',
      d1_5_trainingProvided: false,
      d1_5_trainingDetails: '',
    },
  });

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

export default DTACAssessment;
