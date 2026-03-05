import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Header } from "@/components/Header";
import { FilePlus, RefreshCw, FileText, ArrowRight, UserCog, FolderCheck, HelpCircle, Settings, Search, Sparkles, Download } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { usePolicyJobs } from "@/hooks/usePolicyJobs";
import { usePolicyCompletions } from "@/hooks/usePolicyCompletions";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useState } from "react";

const PolicyService = () => {
  const navigate = useNavigate();
  const { activeJobCount } = usePolicyJobs();
  const { completions } = usePolicyCompletions();
  const [howItWorksOpen, setHowItWorksOpen] = useState(false);

  const actionCards = [
    {
      title: "Create New Policy",
      description: "Generate a professional, compliant policy from scratch using your practice profile and current NHS guidance.",
      icon: FilePlus,
      action: () => navigate('/policy-service/create'),
      buttonText: "Get Started",
      variant: "default" as const,
    },
    {
      title: "Update Existing Policy",
      description: "Upload your current policy for gap analysis against latest regulatory standards and generate an updated version.",
      icon: RefreshCw,
      action: () => navigate('/policy-service/update'),
      buttonText: "Upload Policy",
      variant: "outline" as const,
    },
    {
      title: "My Policies",
      description: "View, download and manage your completed policies with review date tracking.",
      icon: FolderCheck,
      action: () => navigate('/policy-service/my-policies'),
      buttonText: "View Policies",
      variant: "outline" as const,
    },
  ];

  const steps = [
    { number: 1, icon: Settings, title: "Set up your profile", description: "Configure your practice details and key personnel (Practice Manager, DPO, Caldicott Guardian, etc.) — only needed once." },
    { number: 2, icon: Search, title: "Choose a policy", description: "Browse 90+ templates across 6 categories covering all CQC key lines of enquiry." },
    { number: 3, icon: Sparkles, title: "Generate", description: "AI creates a CQC-compliant policy tailored to your practice. Takes 5–10 minutes with detailed regulatory review." },
    { number: 4, icon: Download, title: "Review & download", description: "View your completed policy, make any edits, and export as a Word document." },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-4">
            <FileText className="h-10 w-10 text-primary" />
            <h1 className="text-3xl sm:text-4xl font-bold text-foreground">
              Practice Policies
            </h1>
          </div>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            CQC-compliant GP Practice policies generated in minutes
          </p>
        </div>

        {/* Action Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {actionCards.map((card, index) => (
            <Card 
              key={index} 
              className="relative overflow-hidden hover:shadow-lg transition-shadow cursor-pointer group"
              onClick={card.action}
            >
              <CardHeader className="pb-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <card.icon className="h-6 w-6 text-primary" />
                  </div>
                </div>
                <CardTitle className="text-xl flex items-center flex-wrap gap-2">
                  {card.title}
                  {card.title === "My Policies" && completions.length > 0 && (
                    <Badge variant="secondary">{completions.length} {completions.length === 1 ? 'policy' : 'policies'}</Badge>
                  )}
                  {card.title === "My Policies" && activeJobCount > 0 && (
                    <Badge variant="overview">{activeJobCount} in progress</Badge>
                  )}
                </CardTitle>
                <CardDescription className="text-sm min-h-[60px]">
                  {card.description}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button 
                  variant={card.variant} 
                  className="w-full group-hover:bg-primary group-hover:text-primary-foreground transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    card.action();
                  }}
                >
                  {card.buttonText}
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Practice Profile Defaults — one-time setup banner */}
        <div
          className="mb-8 border-2 border-dashed border-muted-foreground/25 rounded-lg bg-muted/30 p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4 cursor-pointer hover:border-primary/40 transition-colors"
          onClick={() => navigate('/policy-service/profile')}
        >
          <div className="p-2.5 bg-primary/10 rounded-lg shrink-0">
            <UserCog className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-semibold text-foreground">Practice Profile Defaults</span>
              <Badge variant="outline" className="text-xs">One-time setup</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Set up key personnel details (Practice Manager, DPO, Caldicott Guardian, SIRO, etc.) so they're automatically inserted into every policy.
            </p>
          </div>
          <Button variant="outline" size="sm" className="shrink-0" onClick={(e) => { e.stopPropagation(); navigate('/policy-service/profile'); }}>
            Configure
            <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </div>

        {/* How This Works — collapsed */}
        <Collapsible open={howItWorksOpen} onOpenChange={setHowItWorksOpen} className="mb-8">
          <CollapsibleTrigger asChild>
            <button className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors mx-auto">
              <HelpCircle className="h-4 w-4" />
              {howItWorksOpen ? "Hide instructions" : "How does this work?"}
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <Card className="mt-4 bg-muted/30 border-muted">
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {steps.map((step) => (
                    <div key={step.number} className="flex flex-col items-center text-center gap-3">
                      <div className="relative">
                        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                          <step.icon className="h-5 w-5 text-primary" />
                        </div>
                        <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">
                          {step.number}
                        </span>
                      </div>
                      <div>
                        <p className="font-semibold text-foreground text-sm mb-1">{step.title}</p>
                        <p className="text-xs text-muted-foreground leading-relaxed">{step.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </CollapsibleContent>
        </Collapsible>

        {/* Info Section */}
        <Card className="bg-muted/50">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
              <div>
                <div className="text-3xl font-bold text-primary mb-1">90+</div>
                <div className="text-sm text-muted-foreground">Policy Templates</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-primary mb-1">6</div>
                <div className="text-sm text-muted-foreground">Categories Covered</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-primary mb-1">5</div>
                <div className="text-sm text-muted-foreground">CQC KLOEs Aligned</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default PolicyService;
