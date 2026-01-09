import { useState } from "react";
import { Header } from "@/components/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  MessageSquareWarning, 
  FileText, 
  Brain, 
  Languages,
  TrendingUp,
  Clock,
  Users,
  Shield,
  Sparkles,
  CheckCircle,
  DollarSign,
  Target,
  BarChart3,
  Lightbulb,
  Zap,
  HeartPulse,
  Building2,
  FileCheck,
  Mail,
  Presentation
} from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function ExecutiveOverview() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("overview");

  const systems = [
    {
      icon: MessageSquareWarning,
      title: "NHS Complaints Management System",
      description: "AI-powered complaint handling with automated acknowledgements, investigation tracking, and outcome generation",
      color: "text-red-600",
      bgColor: "bg-red-50",
      route: "/complaints",
      metrics: [
        { label: "Time Saved", value: "75%", description: "Per complaint" },
        { label: "Compliance Rate", value: "100%", description: "NHS standards" },
        { label: "Response Time", value: "< 3 days", description: "Acknowledgements" },
      ],
      benefits: [
        "Automated acknowledgement letter generation in seconds",
        "Built-in NHS compliance checking and tracking",
        "Comprehensive audit trails for CQC inspections",
        "Intelligent categorisation and priority management",
        "Integration with patient communication systems",
        "Executive audio summaries for management review"
      ],
      roi: "Estimated £8,000-£12,000 annual savings per practice through reduced administrative burden and faster resolution times"
    },
    {
      icon: FileText,
      title: "Intelligent Meeting Notes System",
      description: "Real-time transcription, AI summarisation, and automated action tracking for all practice meetings",
      color: "text-blue-600",
      bgColor: "bg-blue-50",
      route: "/meetings",
      metrics: [
        { label: "Accuracy", value: "98%", description: "Transcription" },
        { label: "Time Saved", value: "90%", description: "Note-taking" },
        { label: "Action Tracking", value: "100%", description: "Automated" },
      ],
      benefits: [
        "Automated real-time transcription of all meetings",
        "AI-generated summaries with key decisions highlighted",
        "Automatic action point extraction and assignment",
        "Searchable archive of all practice meetings",
        "Attendance tracking and participation analytics",
        "Integration with practice management systems"
      ],
      roi: "Save 2-3 hours per week per practice manager, equivalent to £6,000-£9,000 annually"
    },
    {
      icon: Brain,
      title: "AI4GP Clinical Assistant",
      description: "Intelligent AI assistant providing clinical guidance, protocol access, and decision support",
      color: "text-purple-600",
      bgColor: "bg-purple-50",
      route: "/ai4gp",
      metrics: [
        { label: "Queries Handled", value: "1000+", description: "Per month" },
        { label: "Response Time", value: "< 5 sec", description: "Average" },
        { label: "Accuracy", value: "95%", description: "Clinical guidance" },
      ],
      benefits: [
        "Instant access to clinical protocols and guidelines",
        "Evidence-based decision support for complex cases",
        "Drug interaction checking and prescribing guidance",
        "Patient information leaflet generation",
        "Practice policy and procedure quick reference",
        "Continuing professional development support"
      ],
      roi: "Reduce clinical query time by 60%, saving £10,000-£15,000 annually in GP time"
    },
    {
      icon: Languages,
      title: "Multi-Language Translation Service",
      description: "Real-time translation for patient communications, supporting 50+ languages",
      color: "text-green-600",
      bgColor: "bg-green-50",
      route: "/gp-translation",
      metrics: [
        { label: "Languages", value: "50+", description: "Supported" },
        { label: "Translations", value: "Instant", description: "Real-time" },
        { label: "Accuracy", value: "97%", description: "Medical terms" },
      ],
      benefits: [
        "Support for 50+ languages including BSL",
        "Real-time consultation translation",
        "Patient information leaflet translation",
        "Automated letter and document translation",
        "Reduces need for professional interpreter bookings",
        "Improves patient satisfaction and safety"
      ],
      roi: "Save £3,000-£5,000 annually on interpreter costs whilst improving access"
    }
  ];

  const overallMetrics = [
    {
      icon: Clock,
      label: "Time Savings",
      value: "15-20 hours",
      description: "Per week per practice",
      color: "text-blue-600"
    },
    {
      icon: DollarSign,
      label: "Annual Savings",
      value: "£27,000-£41,000",
      description: "Per practice minimum",
      color: "text-green-600"
    },
    {
      icon: Users,
      label: "Staff Satisfaction",
      value: "85% improvement",
      description: "Reduced admin burden",
      color: "text-purple-600"
    },
    {
      icon: Shield,
      label: "Compliance",
      value: "100%",
      description: "NHS & CQC standards",
      color: "text-red-600"
    }
  ];

  const fundingBenefits = {
    icb: [
      "Improves patient safety through better complaint tracking and resolution",
      "Supports PCN collaboration with shared meeting systems",
      "Reduces health inequalities through language access",
      "Provides ICB-level analytics on complaint trends and outcomes",
      "Demonstrates innovation in digital transformation",
      "Supports workforce wellbeing by reducing administrative burden"
    ],
    federation: [
      "Enables federation-wide knowledge sharing and best practice",
      "Provides consistent complaint management across member practices",
      "Facilitates collaborative working through shared systems",
      "Reduces costs through collective purchasing power",
      "Supports practice resilience and sustainability",
      "Creates training opportunities for practice staff"
    ],
    lmc: [
      "Reduces GP administrative workload and burnout",
      "Supports practices with complex complaint management",
      "Provides medico-legal protection through comprehensive audit trails",
      "Demonstrates LMC commitment to practice support",
      "Creates capacity for clinical work rather than admin",
      "Improves work-life balance for GPs and practice teams"
    ]
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-secondary/10 to-background">
      <Header />
      
      <div className="container mx-auto px-4 py-8">
        {/* Hero Section */}
        <div className="text-centre mb-12">
          <Badge className="mb-4 text-lg px-4 py-2" variant="default">
            Executive Overview
          </Badge>
          <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
            Transforming GP Practice Management with AI
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-6">
            An integrated suite of AI-powered systems designed to reduce administrative burden, 
            improve compliance, and enhance patient care across Northamptonshire GP practices
          </p>
          <div className="flex gap-4 justify-centre mb-8 flex-wrap">
            <Button size="lg" onClick={() => navigate('/federation-presentation')} variant="default">
              <Presentation className="mr-2 h-5 w-5" />
              View Presentation
            </Button>
            <Button size="lg" onClick={() => window.location.href = 'mailto:malcolm.railson@nhs.net?subject=Request for Live Demo - Notewell AI Systems'}>
              <Sparkles className="mr-2 h-5 w-5" />
              View Live Demo
            </Button>
            <Button size="lg" variant="outline" onClick={() => window.location.href = 'mailto:malcolm.railson@nhs.net?subject=Request for Full Proposal - Notewell AI Systems'}>
              <FileCheck className="mr-2 h-5 w-5" />
              Request Full Proposal
            </Button>
          </div>
        </div>

        {/* System Details Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-8">
          <TabsList className="grid w-full grid-cols-2 lg:grid-cols-5 h-auto">
            <TabsTrigger value="overview" className="flex flex-col py-3">
              <Target className="h-5 w-5 mb-1" />
              <span className="text-xs">Overview</span>
            </TabsTrigger>
            <TabsTrigger value="complaints" className="flex flex-col py-3">
              <MessageSquareWarning className="h-5 w-5 mb-1" />
              <span className="text-xs">Complaints</span>
            </TabsTrigger>
            <TabsTrigger value="meetings" className="flex flex-col py-3">
              <FileText className="h-5 w-5 mb-1" />
              <span className="text-xs">Meetings</span>
            </TabsTrigger>
            <TabsTrigger value="ai4gp" className="flex flex-col py-3">
              <Brain className="h-5 w-5 mb-1" />
              <span className="text-xs">AI4GP</span>
            </TabsTrigger>
            <TabsTrigger value="translation" className="flex flex-col py-3">
              <Languages className="h-5 w-5 mb-1" />
              <span className="text-xs">Translation</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6 mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {systems.map((system, index) => (
                <Card key={index} className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => setActiveTab(system.title.toLowerCase().split(' ')[0])}>
                  <CardHeader className={system.bgColor}>
                    <div className="flex items-start justify-between">
                      <div className="flex items-centre gap-3">
                        <system.icon className={`h-8 w-8 ${system.color}`} />
                        <div>
                          <CardTitle className="text-xl">{system.title}</CardTitle>
                          <CardDescription className="mt-2">{system.description}</CardDescription>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <div className="grid grid-cols-3 gap-4 mb-4">
                      {system.metrics.map((metric, idx) => (
                        <div key={idx} className="text-centre">
                          <div className="text-2xl font-bold text-primary">{metric.value}</div>
                          <div className="text-xs font-medium">{metric.label}</div>
                          <div className="text-xs text-muted-foreground">{metric.description}</div>
                        </div>
                      ))}
                    </div>
                    <Button 
                      variant="outline" 
                      className="w-full"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(system.route);
                      }}
                    >
                      View System
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {systems.map((system, index) => (
            <TabsContent key={index} value={system.title.toLowerCase().split(' ')[0]} className="space-y-6 mt-6">
              <Card>
                <CardHeader className={system.bgColor}>
                  <div className="flex items-centre gap-3">
                    <system.icon className={`h-10 w-10 ${system.color}`} />
                    <div>
                      <CardTitle className="text-2xl">{system.title}</CardTitle>
                      <CardDescription className="text-base mt-2">{system.description}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-6 space-y-6">
                  {/* Key Metrics */}
                  <div>
                    <h3 className="text-lg font-semibold mb-4 flex items-centre gap-2">
                      <BarChart3 className="h-5 w-5" />
                      Key Performance Metrics
                    </h3>
                    <div className="grid grid-cols-3 gap-6">
                      {system.metrics.map((metric, idx) => (
                        <div key={idx} className="text-centre p-4 rounded-lg bg-secondary/20">
                          <div className="text-3xl font-bold text-primary mb-1">{metric.value}</div>
                          <div className="text-sm font-medium mb-1">{metric.label}</div>
                          <div className="text-xs text-muted-foreground">{metric.description}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Benefits */}
                  <div>
                    <h3 className="text-lg font-semibold mb-4 flex items-centre gap-2">
                      <CheckCircle className="h-5 w-5" />
                      Key Benefits & Features
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {system.benefits.map((benefit, idx) => (
                        <div key={idx} className="flex items-start gap-2">
                          <Zap className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                          <span className="text-sm">{benefit}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* ROI */}
                  <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                    <h3 className="text-lg font-semibold mb-2 flex items-centre gap-2 text-green-800">
                      <DollarSign className="h-5 w-5" />
                      Return on Investment
                    </h3>
                    <p className="text-sm text-green-900">{system.roi}</p>
                  </div>

                  <Button className="w-full" size="lg" onClick={() => navigate(system.route)}>
                    <HeartPulse className="mr-2 h-5 w-5" />
                    Explore {system.title}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>

        {/* Funding Organisation Benefits */}
        <Card className="mb-8">
          <CardHeader className="bg-gradient-to-r from-blue-50 to-purple-50">
            <CardTitle className="text-2xl flex items-centre gap-2">
              <Building2 className="h-6 w-6" />
              Strategic Value for Funding Organisations
            </CardTitle>
            <CardDescription>
              How this system delivers value for NHS ICB Northamptonshire, Federation, and LMC
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <Tabs defaultValue="icb">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="icb">NHS ICB</TabsTrigger>
                <TabsTrigger value="federation">Federation</TabsTrigger>
                <TabsTrigger value="lmc">LMC</TabsTrigger>
              </TabsList>

              <TabsContent value="icb" className="space-y-4 mt-6">
                <h3 className="font-semibold text-lg mb-4">Benefits for NHS ICB Northamptonshire</h3>
                {fundingBenefits.icb.map((benefit, idx) => (
                  <div key={idx} className="flex items-start gap-3 p-3 rounded-lg bg-blue-50">
                    <CheckCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <span>{benefit}</span>
                  </div>
                ))}
              </TabsContent>

              <TabsContent value="federation" className="space-y-4 mt-6">
                <h3 className="font-semibold text-lg mb-4">Benefits for GP Federation</h3>
                {fundingBenefits.federation.map((benefit, idx) => (
                  <div key={idx} className="flex items-start gap-3 p-3 rounded-lg bg-green-50">
                    <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <span>{benefit}</span>
                  </div>
                ))}
              </TabsContent>

              <TabsContent value="lmc" className="space-y-4 mt-6">
                <h3 className="font-semibold text-lg mb-4">Benefits for Local Medical Committee</h3>
                {fundingBenefits.lmc.map((benefit, idx) => (
                  <div key={idx} className="flex items-start gap-3 p-3 rounded-lg bg-purple-50">
                    <CheckCircle className="h-5 w-5 text-purple-600 flex-shrink-0 mt-0.5" />
                    <span>{benefit}</span>
                  </div>
                ))}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Implementation & Support */}
        <Card className="mb-8">
          <CardHeader className="bg-gradient-to-r from-orange-50 to-yellow-50">
            <CardTitle className="text-2xl flex items-centre gap-2">
              <Lightbulb className="h-6 w-6" />
              Implementation & Ongoing Support
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-centre p-6 rounded-lg bg-secondary/20">
                <Zap className="h-12 w-12 mx-auto mb-3 text-primary" />
                <h3 className="font-semibold mb-2">Rapid Deployment</h3>
                <p className="text-sm text-muted-foreground">
                  Cloud-based system ready to deploy within 2 weeks of funding approval
                </p>
              </div>
              <div className="text-centre p-6 rounded-lg bg-secondary/20">
                <Users className="h-12 w-12 mx-auto mb-3 text-primary" />
                <h3 className="font-semibold mb-2">Comprehensive Training</h3>
                <p className="text-sm text-muted-foreground">
                  Full training programme for practice managers and clinical staff included
                </p>
              </div>
              <div className="text-centre p-6 rounded-lg bg-secondary/20">
                <Shield className="h-12 w-12 mx-auto mb-3 text-primary" />
                <h3 className="font-semibold mb-2">Ongoing Support</h3>
                <p className="text-sm text-muted-foreground">
                  Dedicated support team and regular system updates included in subscription
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Call to Action */}
        <Card className="bg-gradient-to-r from-primary to-purple-600 text-white">
          <CardContent className="pt-8 pb-8 text-centre">
            <h2 className="text-3xl font-bold mb-4">Ready to Transform GP Practice Management?</h2>
            <p className="text-lg mb-6 opacity-90">
              Let's discuss how this integrated system can benefit Northamptonshire practices
            </p>
            <div className="flex gap-4 justify-centre flex-wrap">
              <Button size="lg" variant="secondary" onClick={() => window.location.href = 'mailto:malcolm.railson@nhs.net?subject=Schedule a Meeting - Notewell AI Systems'}>
                <Mail className="mr-2 h-5 w-5" />
                Schedule a Meeting
              </Button>
              <Button size="lg" variant="outline" className="bg-white/10 hover:bg-white/20 text-white border-white" onClick={() => window.location.href = 'mailto:malcolm.railson@nhs.net?subject=Request for Full Proposal - Notewell AI Systems'}>
                <FileCheck className="mr-2 h-5 w-5" />
                Request Detailed Proposal
              </Button>
              <Button size="lg" variant="outline" className="bg-white/10 hover:bg-white/20 text-white border-white" onClick={() => window.location.href = 'mailto:malcolm.railson@nhs.net?subject=Request for Live Demo - Notewell AI Systems'}>
                <Sparkles className="mr-2 h-5 w-5" />
                View Live Demonstration
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
