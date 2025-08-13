import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const ServiceOverview = () => {
  const navigate = useNavigate();
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
      description: "Intelligent assistant for practice management tasks with voice interaction",
      benefits: ["Voice-activated queries", "Administrative guidance", "Policy support", "Workflow optimization"]
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

  // Show only key services on the logged-out page
  const allowedServices = new Set(['AI Practice Manager','Meeting Recorder','Complaints Management']);
  const displayedServices = services.filter(s => allowedServices.has(s.title));

  // Latest NHS News (Pulse and BBC News only)
  type NewsArticle = { id: string; title: string; summary: string; url: string; source: string; published_at: string; image_url?: string; };
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [newsLoading, setNewsLoading] = useState(true);
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const { data, error } = await supabase
          .from('news_articles')
          .select('*')
          .or('source.ilike.%pulse%,source.ilike.%bbc%')
          .order('published_at', { ascending: false })
          .limit(20);
        if (error) throw error;
        if (mounted) setNews((data || []).slice(0, 6));
      } catch (e) {
        console.error('Failed to load latest news', e);
      } finally {
        if (mounted) setNewsLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, []);

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

      {/* Latest NHS News */}
      <section aria-label="Latest NHS News" className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Latest NHS News</h2>
          <Button variant="outline" size="sm" onClick={() => navigate('/ai-4-pm')}>View all</Button>
        </div>
        {newsLoading ? (
          <p className="text-sm text-muted-foreground">Loading latest news…</p>
        ) : news.length === 0 ? (
          <p className="text-sm text-muted-foreground">No recent articles from Pulse or BBC News.</p>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {news.map(a => (
              <Card key={a.id} className="h-full">
                <CardHeader className="pb-2">
                  <div className="text-sm text-muted-foreground">{a.source}</div>
                  <CardTitle className="text-base">{a.title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {a.image_url && (
                    <img src={a.image_url} alt={`${a.source} article image: ${a.title}`} className="w-full h-36 object-cover rounded-md" loading="lazy" />
                  )}
                  <p className="text-sm text-muted-foreground line-clamp-3">{a.summary}</p>
                  <Button asChild variant="outline" size="sm" className="mt-1">
                    <a href={a.url} target="_blank" rel="noopener noreferrer" aria-label={`Read on ${a.source}`}>Read article</a>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

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
          <div className="text-center mt-6">
            <Button 
              onClick={() => navigate('/security-compliance')}
              variant="outline" 
              className="gap-2"
            >
              <ExternalLink className="h-4 w-4" />
              More Information on Security & Compliance
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Interactive Voice Facility Section */}
      <Card className="bg-gradient-subtle border-primary/20">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2 text-xl">
            <Mic className="h-5 w-5 text-primary" />
            Interactive Voice Assistant
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-center text-muted-foreground">
            It's like having a highly knowledgeable colleague available 24/7 who always gives excellent advice and follows NHS best practice guidelines. You can feel completely reassured asking anything you need!
          </p>
          <div className="mt-6 p-4 bg-primary/5 rounded-lg border border-primary/20 text-center">
            <p className="text-sm font-medium text-primary">
              💬 "Just like talking to your most experienced colleague - but they're always available and never too busy to help!"
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
            <div className="space-y-4">
              <h4 className="font-semibold text-center">For Practice Managers</h4>
              <ul className="space-y-2">
                <li className="flex items-center gap-2 text-sm">
                  <CheckCircle className="h-3 w-3 text-success shrink-0" />
                  <span>Voice-activated practice policy queries</span>
                </li>
                <li className="flex items-center gap-2 text-sm">
                  <CheckCircle className="h-3 w-3 text-success shrink-0" />
                  <span>Staff scheduling and resource management</span>
                </li>
                <li className="flex items-center gap-2 text-sm">
                  <CheckCircle className="h-3 w-3 text-success shrink-0" />
                  <span>Compliance guidance and regulatory updates</span>
                </li>
                <li className="flex items-center gap-2 text-sm">
                  <CheckCircle className="h-3 w-3 text-success shrink-0" />
                  <span>Financial reporting and budget queries</span>
                </li>
              </ul>
            </div>
            <div className="space-y-4">
              <h4 className="font-semibold text-center">For Clinical Staff</h4>
              <ul className="space-y-2">
                <li className="flex items-center gap-2 text-sm">
                  <CheckCircle className="h-3 w-3 text-success shrink-0" />
                  <span>Clinical protocol and guideline assistance</span>
                </li>
                <li className="flex items-center gap-2 text-sm">
                  <CheckCircle className="h-3 w-3 text-success shrink-0" />
                  <span>Drug interaction and dosage guidance</span>
                </li>
                <li className="flex items-center gap-2 text-sm">
                  <CheckCircle className="h-3 w-3 text-success shrink-0" />
                  <span>Patient care pathway recommendations</span>
                </li>
                <li className="flex items-center gap-2 text-sm">
                  <CheckCircle className="h-3 w-3 text-success shrink-0" />
                  <span>Real-time clinical decision support</span>
                </li>
              </ul>
            </div>
          </div>
          <div className="mt-6 p-4 bg-primary/5 rounded-lg border border-primary/20 text-center">
            <p className="text-sm text-muted-foreground">
              <strong>Hands-Free Operation:</strong> Perfect for busy clinical environments where hands-free interaction is essential. Simply speak your questions and receive immediate, accurate responses.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Neighbourhoods Ready Section */}
      <Card className="bg-gradient-subtle border-primary/20">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2 text-xl">
            <Users className="h-5 w-5 text-primary" />
            Neighbourhoods Ready: Multi-Agency Collaboration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-center text-muted-foreground">
            All systems have been developed to meet the needs of the impending Neighbourhoods with a multi-agency ready system to collaborate and share without the historic IT challenges that always stifled efficient collaboration.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            <div className="space-y-2 text-center">
              <div className="p-3 rounded-lg bg-primary/10 text-primary mx-auto w-fit">
                <Users className="h-6 w-6" />
              </div>
              <h4 className="font-semibold">Seamless Integration</h4>
              <p className="text-sm text-muted-foreground">
                Built for multi-agency collaboration from the ground up
              </p>
            </div>
            <div className="space-y-2 text-center">
              <div className="p-3 rounded-lg bg-primary/10 text-primary mx-auto w-fit">
                <FolderOpen className="h-6 w-6" />
              </div>
              <h4 className="font-semibold">Unified Data Sharing</h4>
              <p className="text-sm text-muted-foreground">
                Secure, standardized data exchange across organizations
              </p>
            </div>
            <div className="space-y-2 text-center">
              <div className="p-3 rounded-lg bg-primary/10 text-primary mx-auto w-fit">
                <CheckCircle className="h-6 w-6" />
              </div>
              <h4 className="font-semibold">Future-Proof Design</h4>
              <p className="text-sm text-muted-foreground">
                Ready for tomorrow's healthcare collaboration models
              </p>
            </div>
          </div>
          <div className="mt-6 p-4 bg-primary/5 rounded-lg border border-primary/20">
            <p className="text-sm text-center text-muted-foreground">
              <strong>Breaking Down IT Barriers:</strong> Our platform eliminates the traditional IT silos that have historically hindered effective multi-agency collaboration, enabling truly integrated care delivery.
            </p>
          </div>
        </CardContent>
      </Card>

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
            Contact: <a href="mailto:Malcolm.Railson@nhs.net" className="text-primary hover:text-primary-hover font-medium underline">Malcolm.Railson@nhs.net</a>
          </p>
        </div>
      </div>
    </div>
  );
};