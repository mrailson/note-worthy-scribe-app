import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Stethoscope, 
  Users, 
  FileText, 
  Shield, 
  CheckCircle, 
  MessageSquare,
  Calendar,
  FolderOpen,
  BarChart3,
  Clock,
  Heart,
  Lock,
  Mic,
  ExternalLink
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import notewellLogo from "@/assets/notewell-logo.png";
import { DemoVideoSection } from "@/components/DemoVideoSection";

export const ServiceOverview = () => {
  const navigate = useNavigate();
  const services = [
    {
      icon: <MessageSquare className="h-6 w-6" />,
      title: "AI4GP Service",
      description: "Advanced AI assistant specifically designed for UK NHS GPs with comprehensive clinical information support",
      benefits: ["NICE guidance finder", "BNF drug lookups", "Clinical information support", "NHS-compliant responses", "Voice-activated queries"]
    },
    {
      icon: <Users className="h-6 w-6" />,
      title: "Ask AI", 
      description: "Intelligent Practice Manager assistant with specialized NHS administrative knowledge",
      benefits: ["ARRS claim guidance", "PCN DES support", "CQC compliance help", "Staff management", "Policy interpretation"]
    },
    {
      icon: <FileText className="h-6 w-6" />,
      title: "Meeting Recording & Management",
      description: "Professional meeting transcription and management for Practice Managers and administrative teams",
      benefits: ["Partnership meeting transcription", "Action item tracking", "Automated meeting summaries", "Staff meeting documentation", "PCN meeting support"]
    },
    {
      icon: <FileText className="h-6 w-6" />,
      title: "Meeting Recorder",
      description: "Professional meeting transcription and summarization",
      benefits: ["Audio transcription", "Action item extraction", "Meeting summaries"]
    },
    {
      icon: <MessageSquare className="h-6 w-6" />,
      title: "Translation Service",
      description: "Professional multilingual translation service for NHS patient communications and documents",
      benefits: ["Medical document translation", "Patient letter translation", "Multilingual voice translation", "NHS-compliant terminology", "Real-time translation support"]
    },
    {
      icon: <BarChart3 className="h-6 w-6" />,
      title: "Complaints Management System",
      description: "Comprehensive patient complaint management system with automated workflows and NHS compliance",
      benefits: ["Automated complaint tracking", "Response template library", "NHS compliance monitoring", "Performance analytics", "Multi-channel complaint capture"]
    },
    {
      icon: <FolderOpen className="h-6 w-6" />,
      title: "CQC Compliance",
      description: "Care Quality Commission readiness and monitoring",
      benefits: ["Compliance tracking", "Documentation support", "Inspection preparation"]
    }
  ];

  // Hide all service cards on logged-out page - they're now shown inline on Index.tsx
  const displayedServices: typeof services = [];


  const securityFeatures = [
    "End-to-end encryption for all data transmission",
    "NHS-compliant data storage and processing",
    "Role-based access controls and audit trails",
    "GDPR and Data Protection Act 2018 compliance",
    "Regular security assessments and updates",
    "ISO 27001 aligned security practices"
  ];

  return (
    <div className="w-full space-y-8">
      {/* Services Grid - Moved to top */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {displayedServices.map((service, index) => (
          <Card key={index} className="h-full hover:shadow-lg transition-shadow duration-300">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                  {service.icon}
                </div>
                <CardTitle className="text-lg">{service.title}</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground text-sm">
                {service.description}
              </p>
              <ul className="space-y-1">
                {service.benefits.map((benefit, idx) => (
                  <li key={idx} className="flex items-center gap-2 text-sm">
                    <CheckCircle className="h-3 w-3 text-success shrink-0" />
                    <span>{benefit}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Hero Section - Moved below services */}
      <div className="text-center space-y-4">
        <h2 className="text-2xl font-semibold text-foreground">
          Practical AI Tools for NHS Primary Care
        </h2>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Secure, clinician-led AI for meetings, complaints, practice management and GP support — designed for real NHS workflows, not experiments
        </p>
        <div className="flex flex-wrap justify-center gap-2 mt-4">
          <Badge variant="secondary" className="text-sm">
            <CheckCircle className="h-3 w-3 mr-1" />
            NHS Compliant
          </Badge>
          <Badge variant="secondary" className="text-sm">
            <Shield className="h-3 w-3 mr-1" />
            Secure & Encrypted
          </Badge>
          <Badge variant="secondary" className="text-sm">
            <Users className="h-3 w-3 mr-1" />
            Built by Primary Care
          </Badge>
        </div>
      </div>


      {/* Combined Features - Tabbed Interface */}
      <Card className="bg-gradient-subtle border-primary/20">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Platform Features & Information</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="primary-care" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="primary-care" className="text-xs sm:text-sm">
                <Heart className="h-3 w-3 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Overview</span>
              </TabsTrigger>
              <TabsTrigger value="security" className="text-xs sm:text-sm">
                <Lock className="h-3 w-3 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Security</span>
              </TabsTrigger>
              <TabsTrigger value="voice" className="text-xs sm:text-sm">
                <Mic className="h-3 w-3 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Voice</span> AI
              </TabsTrigger>
              <TabsTrigger value="neighbourhoods" className="text-xs sm:text-sm">
                <Users className="h-3 w-3 mr-1 sm:mr-2" />
                Neighbourhoods
              </TabsTrigger>
            </TabsList>

            <TabsContent value="primary-care" className="mt-6 space-y-4">
              <div className="text-center space-y-4">
                <h3 className="font-semibold text-lg">Built by Primary Care, for Primary Care</h3>
                <p className="text-muted-foreground text-sm">
                  Our development team consists of practicing healthcare professionals who understand the unique challenges of primary care environments.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
                  <div className="space-y-2">
                    <div className="p-2 rounded-lg bg-primary/10 text-primary mx-auto w-fit">
                      <Users className="h-5 w-5" />
                    </div>
                    <h4 className="font-semibold text-sm">PCN Managers</h4>
                    <p className="text-xs text-muted-foreground">
                      Multi-practice coordination and strategic oversight
                    </p>
                  </div>
                  <div className="space-y-2">
                    <div className="p-2 rounded-lg bg-primary/10 text-primary mx-auto w-fit">
                      <Clock className="h-5 w-5" />
                    </div>
                    <h4 className="font-semibold text-sm">Practice Managers</h4>
                    <p className="text-xs text-muted-foreground">
                      Daily operational efficiency and patient care management
                    </p>
                  </div>
                  <div className="space-y-2">
                    <div className="p-2 rounded-lg bg-primary/10 text-primary mx-auto w-fit">
                      <Stethoscope className="h-5 w-5" />
                    </div>
                    <h4 className="font-semibold text-sm">Clinical Staff</h4>
                    <p className="text-xs text-muted-foreground">
                      Front-line patient care and clinical documentation
                    </p>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="security" className="mt-6 space-y-4">
              <div className="space-y-4">
                <div className="text-center">
                  <h3 className="font-semibold text-lg">NHS Security & IT Governance Compliance</h3>
                  <p className="text-muted-foreground text-sm mt-2">
                    Built with NHS IT governance requirements at the core, ensuring full compliance with healthcare data protection standards.
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {securityFeatures.map((feature, index) => (
                    <div key={index} className="flex items-start gap-2">
                      <Shield className="h-3 w-3 text-success shrink-0 mt-0.5" />
                      <span className="text-xs">{feature}</span>
                    </div>
                  ))}
                </div>
                <div className="p-3 bg-primary/5 rounded-lg border border-primary/20">
                  <p className="text-xs text-center text-muted-foreground">
                    <strong>Data Residency:</strong> All patient and practice data is stored within UK borders in accordance with NHS Digital guidelines and never leaves the UK jurisdiction.
                  </p>
                </div>
                <div className="text-center">
                  <Button 
                    onClick={() => navigate('/compliance/security')}
                    variant="outline" 
                    size="sm"
                    className="gap-2"
                  >
                    <ExternalLink className="h-3 w-3" />
                    More Information
                  </Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="voice" className="mt-6 space-y-4">
              <div className="space-y-4">
                <div className="text-center">
                  <h3 className="font-semibold text-lg">Interactive Voice Assistant</h3>
                  <p className="text-muted-foreground text-sm mt-2">
                    It's like having a highly knowledgeable colleague available 24/7 who always gives excellent advice and follows NHS best practice guidelines.
                  </p>
                </div>
                <div className="p-3 bg-primary/5 rounded-lg border border-primary/20 text-center">
                  <p className="text-xs font-medium text-primary">
                    💬 "Just like talking to your most experienced colleague - but they're always available and never too busy to help!"
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <h4 className="font-semibold text-sm text-center">For Practice Managers</h4>
                    <ul className="space-y-1">
                      <li className="flex items-center gap-2 text-xs">
                        <CheckCircle className="h-2 w-2 text-success shrink-0" />
                        <span>Voice-activated practice policy queries</span>
                      </li>
                      <li className="flex items-center gap-2 text-xs">
                        <CheckCircle className="h-2 w-2 text-success shrink-0" />
                        <span>Staff scheduling and resource management</span>
                      </li>
                      <li className="flex items-center gap-2 text-xs">
                        <CheckCircle className="h-2 w-2 text-success shrink-0" />
                        <span>Compliance guidance and regulatory updates</span>
                      </li>
                    </ul>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-semibold text-sm text-center">For Clinical Staff</h4>
                    <ul className="space-y-1">
                      <li className="flex items-center gap-2 text-xs">
                        <CheckCircle className="h-2 w-2 text-success shrink-0" />
                        <span>Clinical protocol and guideline assistance</span>
                      </li>
                      <li className="flex items-center gap-2 text-xs">
                        <CheckCircle className="h-2 w-2 text-success shrink-0" />
                        <span>Drug interaction and dosage guidance</span>
                      </li>
                      <li className="flex items-center gap-2 text-xs">
                        <CheckCircle className="h-2 w-2 text-success shrink-0" />
                        <span>Patient care pathway recommendations</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="neighbourhoods" className="mt-6 space-y-4">
              <div className="space-y-4">
                <div className="text-center">
                  <h3 className="font-semibold text-lg">Neighbourhoods Ready: Designed for Multi-Agency Working</h3>
                  <p className="text-muted-foreground text-sm mt-2">
                    The platform has been designed to avoid the traditional technical constraints that have historically limited cross-organisational working, while remaining aligned with NHS information governance requirements.
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-2 text-center">
                    <div className="p-2 rounded-lg bg-primary/10 text-primary mx-auto w-fit">
                      <Users className="h-4 w-4" />
                    </div>
                    <h4 className="font-semibold text-xs">Collaboration-ready design</h4>
                    <p className="text-xs text-muted-foreground">
                      Built to support multi-agency workflows as Neighbourhood models mature
                    </p>
                  </div>
                  <div className="space-y-2 text-center">
                    <div className="p-2 rounded-lg bg-primary/10 text-primary mx-auto w-fit">
                      <FolderOpen className="h-4 w-4" />
                    </div>
                    <h4 className="font-semibold text-xs">Standards-aligned architecture</h4>
                    <p className="text-xs text-muted-foreground">
                      Designed around secure, role-based information sharing principles
                    </p>
                  </div>
                  <div className="space-y-2 text-center">
                    <div className="p-2 rounded-lg bg-primary/10 text-primary mx-auto w-fit">
                      <CheckCircle className="h-4 w-4" />
                    </div>
                    <h4 className="font-semibold text-xs">Future-ready platform</h4>
                    <p className="text-xs text-muted-foreground">
                      Prepared for emerging Neighbourhood and ICS operating models
                    </p>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Pilot Context */}
      <div className="p-4 bg-accent/30 rounded-lg border border-accent text-center">
        <p className="text-sm text-muted-foreground">
          Notewell AI is initially in controlled pilot use across GP practices in Northamptonshire, with clinical safety oversight and phased feature rollout. Features and access vary by role and pilot phase.
        </p>
      </div>

      {/* Call to Action */}
      <div className="text-center space-y-4">
        <h3 className="text-xl font-semibold">Ready to Transform Your Practice?</h3>
        <p className="text-muted-foreground">
          Experience the future of primary care administration with intelligent AI assistance designed by healthcare professionals.
        </p>
        <div className="mt-4 p-4 bg-primary/5 rounded-lg border border-primary/20">
          <p className="text-sm font-medium text-foreground mb-2">
            Questions, want to learn more, or try it for yourself?
          </p>
          <p className="text-sm text-muted-foreground">
            Contact: Notewell Team · <a href="mailto:Malcolm.Railson@nhs.net" className="text-primary hover:text-primary-hover font-medium underline">Malcolm.Railson@nhs.net</a> (Pilot Lead)
          </p>
        </div>
      </div>
    </div>
  );
};