import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/Header";
import { FilePlus, RefreshCw, ClipboardList, FileText, Shield, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

const PolicyService = () => {
  const navigate = useNavigate();

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
      title: "Policy Checklist",
      description: "See recommended policies for your practice based on your services and CQC requirements.",
      icon: ClipboardList,
      action: () => navigate('/policy-service/checklist'),
      buttonText: "View Checklist",
      variant: "outline" as const,
    },
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
              Policy Management Service
            </h1>
          </div>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Create, update, and maintain CQC-compliant practice policies using AI-powered generation. 
            Save hours of work with professionally formatted, regulation-aligned documents.
          </p>
        </div>

        {/* Compliance Badge */}
        <div className="flex justify-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full">
            <Shield className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-primary">
              Aligned with CQC Key Lines of Enquiry
            </span>
          </div>
        </div>

        {/* Action Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
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
                <CardTitle className="text-xl">{card.title}</CardTitle>
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
