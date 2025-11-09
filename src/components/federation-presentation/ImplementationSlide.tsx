import { Rocket, GraduationCap, Headphones, CheckCircle } from "lucide-react";

export const ImplementationSlide = () => {
  const phases = [
    {
      icon: Rocket,
      title: "Rapid Deployment",
      subtitle: "2 weeks to full operation",
      points: [
        "Cloud-based solution - no hardware required",
        "Seamless integration with existing systems",
        "Minimal disruption to daily operations",
        "Pilot practice testing and refinement"
      ],
      color: "from-nhs-blue to-nhs-light-blue"
    },
    {
      icon: GraduationCap,
      title: "Comprehensive Training",
      subtitle: "All staff fully prepared",
      points: [
        "Role-specific training sessions",
        "Interactive demonstrations and hands-on practice",
        "Complete documentation and video tutorials",
        "Train-the-trainer programme for sustainability"
      ],
      color: "from-purple-500 to-purple-600"
    },
    {
      icon: Headphones,
      title: "Ongoing Support",
      subtitle: "Always here to help",
      points: [
        "Dedicated support team (9:00-17:00)",
        "Regular system updates and improvements",
        "Monthly performance reviews",
        "Continuous optimization and feature enhancement"
      ],
      color: "from-green-500 to-green-600"
    }
  ];

  return (
    <div className="h-full flex flex-col p-12 bg-gradient-to-br from-background to-muted">
      {/* Header */}
      <div className="text-center mb-12">
        <h2 className="text-5xl font-bold text-foreground mb-4">
          Implementation & Support
        </h2>
        <div className="w-32 h-1 bg-nhs-aqua-blue mx-auto mb-4" />
        <p className="text-2xl text-muted-foreground">
          Smooth rollout with comprehensive support
        </p>
      </div>

      {/* Three pillars */}
      <div className="grid grid-cols-3 gap-8 flex-1">
        {phases.map((phase, index) => {
          const Icon = phase.icon;
          
          return (
            <div
              key={index}
              className="bg-card rounded-xl p-8 border border-border shadow-lg hover:shadow-xl transition-all duration-300 flex flex-col"
            >
              {/* Icon and title */}
              <div className="text-center mb-6">
                <div className={`inline-flex p-6 rounded-full bg-gradient-to-br ${phase.color} text-white mb-4 shadow-lg`}>
                  <Icon className="h-12 w-12" />
                </div>
                <h3 className="text-3xl font-bold text-foreground mb-2">
                  {phase.title}
                </h3>
                <p className="text-lg text-primary font-medium">
                  {phase.subtitle}
                </p>
              </div>

              {/* Points */}
              <ul className="space-y-4 flex-1">
                {phase.points.map((point, pointIndex) => (
                  <li 
                    key={pointIndex}
                    className="flex items-start gap-3"
                  >
                    <CheckCircle className="h-6 w-6 text-primary flex-shrink-0 mt-1" />
                    <span className="text-lg text-foreground">
                      {point}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      {/* Timeline visual */}
      <div className="mt-12 flex items-center justify-center gap-4">
        <div className="flex-1 h-2 bg-gradient-to-r from-nhs-blue via-purple-500 to-green-500 rounded-full" />
        <span className="text-xl font-semibold text-foreground whitespace-nowrap">
          Your journey to operational excellence
        </span>
        <div className="flex-1 h-2 bg-gradient-to-r from-green-500 via-purple-500 to-nhs-blue rounded-full" />
      </div>
    </div>
  );
};
