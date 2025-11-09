import { Clock, TrendingUp, Heart, CheckCircle } from "lucide-react";

export const BenefitsROISlide = () => {
  const metrics = [
    {
      icon: Clock,
      value: "15-20 hours",
      label: "Time Savings",
      sublabel: "Per week per practice",
      color: "from-nhs-blue to-nhs-light-blue"
    },
    {
      icon: TrendingUp,
      value: "£27,000-£41,000",
      label: "Annual Savings",
      sublabel: "Per practice minimum",
      color: "from-green-500 to-green-600"
    },
    {
      icon: Heart,
      value: "85% improvement",
      label: "Staff Satisfaction",
      sublabel: "Reduced admin burden",
      color: "from-purple-500 to-purple-600"
    },
    {
      icon: CheckCircle,
      value: "100%",
      label: "Compliance",
      sublabel: "NHS & CQC standards",
      color: "from-nhs-aqua-blue to-nhs-light-blue"
    }
  ];

  return (
    <div className="h-full flex flex-col items-center justify-center p-12 bg-gradient-to-br from-background via-muted/50 to-background">
      {/* Header */}
      <div className="text-center mb-16">
        <h2 className="text-6xl font-bold text-foreground mb-4">
          Overall Impact & ROI
        </h2>
        <div className="w-32 h-1 bg-nhs-aqua-blue mx-auto mb-6" />
        <p className="text-3xl text-muted-foreground">
          Quantified benefits across all four integrated systems
        </p>
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-2 gap-8 max-w-6xl w-full">
        {metrics.map((metric, index) => {
          const Icon = metric.icon;
          
          return (
            <div
              key={index}
              className="bg-card rounded-2xl p-10 border-2 border-border shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105"
            >
              <div className="flex flex-col items-center text-center">
                <div className={`p-6 rounded-full bg-gradient-to-br ${metric.color} text-white mb-6 shadow-lg`}>
                  <Icon className="h-12 w-12" />
                </div>
                
                <h3 className="text-5xl font-bold text-foreground mb-3">
                  {metric.value}
                </h3>
                
                <p className="text-2xl font-semibold text-foreground mb-2">
                  {metric.label}
                </p>
                
                <p className="text-lg text-muted-foreground">
                  {metric.sublabel}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer note */}
      <div className="mt-16 text-center">
        <p className="text-xl text-muted-foreground italic">
          Evidence-based metrics from pilot implementation across multiple practices
        </p>
      </div>
    </div>
  );
};
