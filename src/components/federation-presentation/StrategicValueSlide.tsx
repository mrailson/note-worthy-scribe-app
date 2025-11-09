import { Building2, Users, Shield } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const StrategicValueSlide = () => {
  const stakeholders = [
    {
      id: "icb",
      label: "NHS ICB",
      icon: Building2,
      title: "NHS ICB Northamptonshire",
      benefits: [
        "Standardised complaint handling across all member practices",
        "Real-time compliance monitoring and reporting dashboard",
        "Reduced risk of regulatory issues and improved patient satisfaction",
        "Data-driven insights for quality improvement initiatives",
        "Automated PALS referral pathway and tracking"
      ]
    },
    {
      id: "federation",
      label: "GP Federation",
      icon: Users,
      title: "GP Federation Benefits",
      benefits: [
        "Centralised administrative support reducing practice workload",
        "Consistent quality standards across all member practices",
        "Shared learning from complaint trends and resolution strategies",
        "Enhanced reputation through demonstrable complaint management excellence",
        "Efficient resource allocation through centralized management"
      ]
    },
    {
      id: "lmc",
      label: "LMC",
      icon: Shield,
      title: "Local Medical Committee",
      benefits: [
        "Protection of GP interests through proper complaint documentation",
        "Early identification of systemic issues requiring LMC intervention",
        "Support for GPs facing complaints with comprehensive audit trails",
        "Reduced GP stress through streamlined complaint resolution process",
        "Evidence-based data for negotiations with commissioners"
      ]
    }
  ];

  return (
    <div className="h-full flex flex-col p-12 bg-gradient-to-br from-background to-muted">
      {/* Header */}
      <div className="text-center mb-8">
        <h2 className="text-5xl font-bold text-foreground mb-4">
          Strategic Value for Stakeholders
        </h2>
        <div className="w-32 h-1 bg-nhs-aqua-blue mx-auto mb-4" />
        <p className="text-2xl text-muted-foreground">
          Benefits for funding organisations and practice support
        </p>
      </div>

      {/* Tabbed content */}
      <Tabs defaultValue="icb" className="flex-1 flex flex-col">
        <TabsList className="grid w-full max-w-3xl mx-auto grid-cols-3 mb-8 h-auto">
          {stakeholders.map((stakeholder) => {
            const Icon = stakeholder.icon;
            return (
              <TabsTrigger 
                key={stakeholder.id} 
                value={stakeholder.id}
                className="text-lg py-4 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                <Icon className="h-5 w-5 mr-2" />
                {stakeholder.label}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {stakeholders.map((stakeholder) => {
          const Icon = stakeholder.icon;
          
          return (
            <TabsContent 
              key={stakeholder.id} 
              value={stakeholder.id}
              className="flex-1 mt-0"
            >
              <div className="bg-card rounded-xl p-10 border border-border shadow-lg h-full">
                <div className="flex items-center gap-4 mb-8">
                  <div className="p-4 rounded-lg bg-primary text-primary-foreground">
                    <Icon className="h-10 w-10" />
                  </div>
                  <h3 className="text-4xl font-bold text-foreground">
                    {stakeholder.title}
                  </h3>
                </div>

                <ul className="space-y-4">
                  {stakeholder.benefits.map((benefit, index) => (
                    <li 
                      key={index}
                      className="flex items-start gap-4 text-xl text-foreground p-4 rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <span className="text-primary font-bold text-2xl flex-shrink-0">
                        {index + 1}.
                      </span>
                      <span>{benefit}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
};
