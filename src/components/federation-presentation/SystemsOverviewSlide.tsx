import { FileText, MessageSquare, Sparkles, Globe, TrendingUp, Clock, Users, Shield } from "lucide-react";

export const SystemsOverviewSlide = () => {
  const systems = [
    {
      title: "NHS Complaints Management",
      icon: FileText,
      description: "Streamlined 20-day deadline tracking with intelligent workflow automation",
      color: "from-red-500 to-red-600",
      bgColor: "bg-red-50",
      metric: "100% Compliance",
      metricIcon: Shield
    },
    {
      title: "Intelligent Meeting Notes",
      icon: MessageSquare,
      description: "AI-powered transcription and action tracking for all practice meetings",
      color: "from-nhs-blue to-nhs-light-blue",
      bgColor: "bg-blue-50",
      metric: "80% Time Saved",
      metricIcon: Clock
    },
    {
      title: "AI4GP Clinical Assistant",
      icon: Sparkles,
      description: "Real-time clinical decision support and documentation assistance",
      color: "from-purple-500 to-purple-600",
      bgColor: "bg-purple-50",
      metric: "15 min Per Patient",
      metricIcon: TrendingUp
    },
    {
      title: "Multi-Language Translation",
      icon: Globe,
      description: "Real-time translation supporting 100+ languages for patient communication",
      color: "from-green-500 to-green-600",
      bgColor: "bg-green-50",
      metric: "100+ Languages",
      metricIcon: Users
    }
  ];

  return (
    <div className="h-full flex flex-col p-12 bg-gradient-to-br from-background to-muted">
      {/* Header */}
      <div className="text-center mb-12">
        <h2 className="text-5xl font-bold text-foreground mb-4">
          Four Integrated Systems
        </h2>
        <div className="w-32 h-1 bg-nhs-aqua-blue mx-auto mb-4" />
        <p className="text-2xl text-muted-foreground">
          Comprehensive solutions for modern GP practice management
        </p>
      </div>

      {/* Systems grid */}
      <div className="grid grid-cols-2 gap-8 flex-1">
        {systems.map((system, index) => {
          const Icon = system.icon;
          const MetricIcon = system.metricIcon;
          
          return (
            <div
              key={index}
              className={`${system.bgColor} rounded-xl p-8 border border-border shadow-lg hover:shadow-xl transition-all duration-300 flex flex-col`}
            >
              <div className="flex items-start gap-4 mb-4">
                <div className={`p-4 rounded-lg bg-gradient-to-br ${system.color} text-white`}>
                  <Icon className="h-8 w-8" />
                </div>
                <div className="flex-1">
                  <h3 className="text-2xl font-bold text-foreground mb-2">
                    {system.title}
                  </h3>
                  <p className="text-lg text-muted-foreground">
                    {system.description}
                  </p>
                </div>
              </div>

              <div className="mt-auto pt-4 border-t border-border/50 flex items-center gap-2">
                <MetricIcon className="h-5 w-5 text-primary" />
                <span className="text-xl font-semibold text-primary">
                  {system.metric}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
