import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  Lock
} from "lucide-react";

export const ServiceOverview = () => {
  const services = [
    {
      icon: <Stethoscope className="h-6 w-6" />,
      title: "GP Scribe",
      description: "AI-powered consultation recording and note generation",
      benefits: ["Real-time transcription", "Auto-generated clinical notes", "Time-saving documentation"]
    },
    {
      icon: <MessageSquare className="h-6 w-6" />,
      title: "AI Practice Manager",
      description: "Intelligent assistant for practice management tasks",
      benefits: ["Administrative guidance", "Policy queries", "Workflow optimization"]
    },
    {
      icon: <Users className="h-6 w-6" />,
      title: "Meeting Recorder",
      description: "Professional meeting transcription and summarization",
      benefits: ["Audio transcription", "Action item extraction", "Meeting summaries"]
    },
    {
      icon: <FileText className="h-6 w-6" />,
      title: "Complaints Management",
      description: "Streamlined patient complaint handling and response",
      benefits: ["Automated tracking", "Response templates", "Compliance monitoring"]
    },
    {
      icon: <BarChart3 className="h-6 w-6" />,
      title: "CQC Compliance",
      description: "Care Quality Commission readiness and monitoring",
      benefits: ["Compliance tracking", "Documentation support", "Inspection preparation"]
    },
    {
      icon: <FolderOpen className="h-6 w-6" />,
      title: "Shared Drive",
      description: "Secure document management and collaboration",
      benefits: ["Centralized storage", "Team collaboration", "Version control"]
    }
  ];

  const securityFeatures = [
    "End-to-end encryption for all data transmission",
    "NHS-compliant data storage and processing",
    "Role-based access controls and audit trails",
    "GDPR and Data Protection Act 2018 compliance",
    "Regular security assessments and updates",
    "ISO 27001 aligned security practices"
  ];

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Hero Section */}
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center gap-3 mb-4">
          <Heart className="h-8 w-8 text-primary" />
          <h1 className="text-4xl font-bold bg-gradient-primary bg-clip-text text-transparent">
            NoteWell AI
          </h1>
        </div>
        <h2 className="text-2xl font-semibold text-foreground">
          Intelligent Healthcare Administration Platform
        </h2>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Designed specifically for Primary Care teams by healthcare professionals who understand your daily challenges
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

      {/* Services Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {services.map((service, index) => (
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

      {/* Built by Primary Care Section */}
      <Card className="bg-gradient-subtle border-primary/20">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2 text-xl">
            <Heart className="h-5 w-5 text-primary" />
            Built by Primary Care, for Primary Care
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-muted-foreground">
            Our development team consists of practicing healthcare professionals who understand the unique challenges of primary care environments.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            <div className="space-y-2">
              <div className="p-3 rounded-lg bg-primary/10 text-primary mx-auto w-fit">
                <Users className="h-6 w-6" />
              </div>
              <h4 className="font-semibold">PCN Managers</h4>
              <p className="text-sm text-muted-foreground">
                Multi-practice coordination and strategic oversight
              </p>
            </div>
            <div className="space-y-2">
              <div className="p-3 rounded-lg bg-primary/10 text-primary mx-auto w-fit">
                <Clock className="h-6 w-6" />
              </div>
              <h4 className="font-semibold">Practice Managers</h4>
              <p className="text-sm text-muted-foreground">
                Daily operational efficiency and patient care management
              </p>
            </div>
            <div className="space-y-2">
              <div className="p-3 rounded-lg bg-primary/10 text-primary mx-auto w-fit">
                <Stethoscope className="h-6 w-6" />
              </div>
              <h4 className="font-semibold">Clinical Staff</h4>
              <p className="text-sm text-muted-foreground">
                Front-line patient care and clinical documentation
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Security & Compliance Section */}
      <Card className="bg-gradient-subtle border-primary/20">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2 text-xl">
            <Lock className="h-5 w-5 text-primary" />
            NHS Security & IT Governance Compliance
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-center text-muted-foreground">
            Built with NHS IT governance requirements at the core, ensuring full compliance with healthcare data protection standards.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-6">
            {securityFeatures.map((feature, index) => (
              <div key={index} className="flex items-start gap-3">
                <Shield className="h-4 w-4 text-success shrink-0 mt-0.5" />
                <span className="text-sm">{feature}</span>
              </div>
            ))}
          </div>
          <div className="mt-6 p-4 bg-primary/5 rounded-lg border border-primary/20">
            <p className="text-sm text-center text-muted-foreground">
              <strong>Data Residency:</strong> All patient and practice data is stored within UK borders in accordance with NHS Digital guidelines and never leaves the UK jurisdiction.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Call to Action */}
      <div className="text-center space-y-4">
        <h3 className="text-xl font-semibold">Ready to Transform Your Practice?</h3>
        <p className="text-muted-foreground">
          Join hundreds of Primary Care practices already using NoteWell AI to improve efficiency and patient care.
        </p>
      </div>
    </div>
  );
};