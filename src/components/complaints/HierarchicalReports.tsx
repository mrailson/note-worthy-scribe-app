import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Building2, 
  Network, 
  Layers, 
  Building,
  Download,
  FileText,
  Users,
  Clock,
  AlertCircle,
  TrendingUp,
  BarChart3,
  Target,
  Award,
  Map,
  PieChart,
  DollarSign,
  CheckCircle2,
  Calendar,
  Activity,
  Globe,
  Shield,
  Lightbulb,
  Share2
} from "lucide-react";

interface ReportCard {
  title: string;
  description: string;
  icon: typeof Building2;
}

const PracticeReports: ReportCard[] = [
  {
    title: "Monthly Summary",
    description: "Practice-specific complaint volumes, categories, and response times",
    icon: Calendar
  },
  {
    title: "Staff Analysis",
    description: "Which staff members are mentioned in complaints",
    icon: Users
  },
  {
    title: "Category Trends",
    description: "Breakdown of complaint types at practice level",
    icon: TrendingUp
  },
  {
    title: "Response Times",
    description: "How quickly the practice responds to complaints",
    icon: Clock
  },
  {
    title: "Escalations Report",
    description: "Complaints that were escalated from the practice",
    icon: AlertCircle
  },
  {
    title: "Patient Satisfaction",
    description: "Post-resolution feedback scores",
    icon: Award
  },
  {
    title: "Quarterly Performance",
    description: "CQC-ready quarterly statistics",
    icon: BarChart3
  }
];

const PCNReports: ReportCard[] = [
  {
    title: "PCN-Wide Summary",
    description: "Combined statistics from all member practices",
    icon: Network
  },
  {
    title: "Practice Comparison",
    description: "Benchmarking between practices in the PCN",
    icon: Target
  },
  {
    title: "PCN Trends Analysis",
    description: "Patterns across the network over time",
    icon: TrendingUp
  },
  {
    title: "Shared Learning Report",
    description: "Common issues identified across practices",
    icon: Lightbulb
  },
  {
    title: "Resource Allocation",
    description: "Where PCN support might be needed",
    icon: PieChart
  },
  {
    title: "Best Practice Showcase",
    description: "Highlighting practices with excellent complaint handling",
    icon: Award
  }
];

const NeighbourhoodsReports: ReportCard[] = [
  {
    title: "Neighbourhood Dashboard",
    description: "Overview of all PCNs in the neighbourhood",
    icon: Layers
  },
  {
    title: "Cross-PCN Themes",
    description: "Systemic issues affecting multiple PCNs",
    icon: Share2
  },
  {
    title: "Geographic Hotspots",
    description: "Area-specific complaint patterns",
    icon: Map
  },
  {
    title: "Population Health Insights",
    description: "How complaints relate to local demographics",
    icon: Activity
  },
  {
    title: "Service Gap Analysis",
    description: "Unmet needs identified through complaints",
    icon: Target
  },
  {
    title: "Collaboration Opportunities",
    description: "Where neighbourhoods can work together",
    icon: Users
  },
  {
    title: "Neighbourhood Annual Report",
    description: "Year-on-year trends for strategic planning",
    icon: Calendar
  }
];

const ICBReports: ReportCard[] = [
  {
    title: "ICB Executive Summary",
    description: "High-level metrics for board meetings",
    icon: Building
  },
  {
    title: "Regional Benchmarking",
    description: "How this ICB compares to others nationally",
    icon: Globe
  },
  {
    title: "Strategic Themes",
    description: "System-wide issues requiring ICB intervention",
    icon: Target
  },
  {
    title: "Financial Impact Analysis",
    description: "Costs associated with complaint handling",
    icon: DollarSign
  },
  {
    title: "Quality Improvement Metrics",
    description: "How complaints drive service improvements",
    icon: TrendingUp
  },
  {
    title: "Regulatory Compliance",
    description: "CQC, NHS England reporting requirements",
    icon: Shield
  },
  {
    title: "Annual Governance Report",
    description: "Comprehensive year-end analysis for ICB board",
    icon: CheckCircle2
  }
];

interface ReportCardProps {
  report: ReportCard;
  levelColor: "blue" | "green" | "purple" | "slate";
}

const ReportCardComponent = ({ report, levelColor }: ReportCardProps) => {
  const Icon = report.icon;
  
  const colorClasses = {
    blue: {
      border: "hover:border-blue-500",
      bg: "hover:bg-blue-50/50 dark:hover:bg-blue-900/20",
      iconBg: "bg-blue-100 dark:bg-blue-900/30",
      iconColor: "text-blue-600 dark:text-blue-400"
    },
    green: {
      border: "hover:border-green-500",
      bg: "hover:bg-green-50/50 dark:hover:bg-green-900/20",
      iconBg: "bg-green-100 dark:bg-green-900/30",
      iconColor: "text-green-600 dark:text-green-400"
    },
    purple: {
      border: "hover:border-purple-500",
      bg: "hover:bg-purple-50/50 dark:hover:bg-purple-900/20",
      iconBg: "bg-purple-100 dark:bg-purple-900/30",
      iconColor: "text-purple-600 dark:text-purple-400"
    },
    slate: {
      border: "hover:border-slate-500",
      bg: "hover:bg-slate-50/50 dark:hover:bg-slate-900/20",
      iconBg: "bg-slate-200 dark:bg-slate-800/50",
      iconColor: "text-slate-700 dark:text-slate-300"
    }
  };

  const colors = colorClasses[levelColor];
  
  return (
    <Button 
      variant="outline" 
      className={`h-auto flex flex-col gap-3 p-4 ${colors.border} ${colors.bg} transition-all group`}
    >
      <div className={`p-3 rounded-lg ${colors.iconBg} group-hover:scale-110 transition-transform`}>
        <Icon className={`h-6 w-6 ${colors.iconColor}`} />
      </div>
      <div className="flex flex-col gap-1 text-left">
        <span className="font-semibold text-sm">{report.title}</span>
        <span className="text-xs text-muted-foreground leading-tight">{report.description}</span>
      </div>
      <Download className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors ml-auto" />
    </Button>
  );
};

export const HierarchicalReports = () => {
  const [activeLevel, setActiveLevel] = useState("practice");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Complaints Reports & Analytics</CardTitle>
        <CardDescription>
          Hierarchical reporting across Practice, PCN, Neighbourhoods, and ICB levels
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeLevel} onValueChange={setActiveLevel} className="w-full">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 h-auto gap-2 bg-transparent p-0">
            <TabsTrigger 
              value="practice" 
              className="data-[state=active]:bg-blue-600 data-[state=active]:text-white hover:bg-blue-100 dark:hover:bg-blue-900/30 border-2 border-blue-300 dark:border-blue-700 flex items-center gap-2 min-h-[44px]"
            >
              <Building2 className="h-4 w-4" />
              <span className="hidden sm:inline">Practice</span>
            </TabsTrigger>
            <TabsTrigger 
              value="pcn" 
              className="data-[state=active]:bg-green-600 data-[state=active]:text-white hover:bg-green-100 dark:hover:bg-green-900/30 border-2 border-green-300 dark:border-green-700 flex items-center gap-2 min-h-[44px]"
            >
              <Network className="h-4 w-4" />
              <span className="hidden sm:inline">PCN</span>
            </TabsTrigger>
            <TabsTrigger 
              value="neighbourhoods" 
              className="data-[state=active]:bg-purple-600 data-[state=active]:text-white hover:bg-purple-100 dark:hover:bg-purple-900/30 border-2 border-purple-300 dark:border-purple-700 flex items-center gap-2 min-h-[44px]"
            >
              <Layers className="h-4 w-4" />
              <span className="hidden sm:inline">Neighbourhoods</span>
            </TabsTrigger>
            <TabsTrigger 
              value="icb" 
              className="data-[state=active]:bg-slate-700 data-[state=active]:text-white hover:bg-slate-100 dark:hover:bg-slate-800/30 border-2 border-slate-300 dark:border-slate-600 flex items-center gap-2 min-h-[44px]"
            >
              <Building className="h-4 w-4" />
              <span className="hidden sm:inline">ICB</span>
            </TabsTrigger>
          </TabsList>

          {/* Practice Level Reports */}
          <TabsContent value="practice" className="mt-6">
            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                  <Building2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">Practice Level Reports</h3>
                  <p className="text-sm text-muted-foreground">Reports specific to your individual GP practice</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {PracticeReports.map((report) => (
                  <ReportCardComponent key={report.title} report={report} levelColor="blue" />
                ))}
              </div>
            </div>
          </TabsContent>

          {/* PCN Level Reports */}
          <TabsContent value="pcn" className="mt-6">
            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                  <Network className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">PCN Level Reports</h3>
                  <p className="text-sm text-muted-foreground">Aggregated data across all practices within your Primary Care Network</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {PCNReports.map((report) => (
                  <ReportCardComponent key={report.title} report={report} levelColor="green" />
                ))}
              </div>
            </div>
          </TabsContent>

          {/* Neighbourhoods Level Reports */}
          <TabsContent value="neighbourhoods" className="mt-6">
            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                  <Layers className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">Neighbourhoods Level Reports</h3>
                  <p className="text-sm text-muted-foreground">Cross-PCN insights and collaboration opportunities across your neighbourhood</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {NeighbourhoodsReports.map((report) => (
                  <ReportCardComponent key={report.title} report={report} levelColor="purple" />
                ))}
              </div>
            </div>
          </TabsContent>

          {/* ICB Level Reports */}
          <TabsContent value="icb" className="mt-6">
            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-slate-200 dark:bg-slate-800/50">
                  <Building className="h-5 w-5 text-slate-700 dark:text-slate-300" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">ICB Level Reports</h3>
                  <p className="text-sm text-muted-foreground">System-wide strategic reporting for Integrated Care Board</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {ICBReports.map((report) => (
                  <ReportCardComponent key={report.title} report={report} levelColor="slate" />
                ))}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};
