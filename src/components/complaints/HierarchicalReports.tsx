import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ReportDetailModal } from "./ReportDetailModal";
import { mockReportData, ReportDetail } from "@/data/mockReportData";
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
  Share2,
  ChevronDown,
  ChevronRight
} from "lucide-react";

interface ReportCard {
  title: string;
  description: string;
  icon: typeof Building2;
  reportId: string;
}

const PracticeReports: ReportCard[] = [
  {
    title: "Complaints Overview",
    description: "Practice-specific complaint volumes, categories, and response times",
    icon: Calendar,
    reportId: "complaints-overview"
  },
  {
    title: "Response Times",
    description: "How quickly the practice responds to complaints",
    icon: Clock,
    reportId: "response-times"
  },
  {
    title: "Satisfaction Scores",
    description: "Post-resolution feedback scores",
    icon: Award,
    reportId: "satisfaction-scores"
  },
  {
    title: "Trends Analysis",
    description: "Breakdown of complaint types at practice level",
    icon: TrendingUp,
    reportId: "trends-analysis"
  },
  {
    title: "Staff Training Needs",
    description: "Which staff members need additional training",
    icon: Users,
    reportId: "staff-training"
  },
  {
    title: "Patient Feedback Summary",
    description: "Overall patient feedback and recommendations",
    icon: FileText,
    reportId: "patient-feedback"
  },
  {
    title: "KO41b Annual Return",
    description: "Statutory annual return of written complaints to NHS England (SDCS)",
    icon: BarChart3,
    reportId: "ko41b-annual-return"
  }
];

const PCNReports: ReportCard[] = [
  {
    title: "PCN Complaints Summary",
    description: "Combined statistics from all member practices",
    icon: Network,
    reportId: "pcn-complaints"
  },
  {
    title: "Shared Services Performance",
    description: "Performance of shared PCN services",
    icon: Target,
    reportId: "shared-services"
  },
  {
    title: "Collaboration Metrics",
    description: "How practices work together across the network",
    icon: Lightbulb,
    reportId: "collaboration-metrics"
  },
  {
    title: "Cross-Practice Comparisons",
    description: "Benchmarking between practices in the PCN",
    icon: BarChart3,
    reportId: "cross-practice"
  },
  {
    title: "Resource Sharing",
    description: "Where PCN support might be needed",
    icon: PieChart,
    reportId: "resource-sharing"
  },
  {
    title: "Quality Improvement",
    description: "Highlighting practices with excellent complaint handling",
    icon: Award,
    reportId: "quality-improvement"
  }
];

const NeighbourhoodsReports: ReportCard[] = [
  {
    title: "Neighbourhood Dashboard",
    description: "Overview of all PCNs in the neighbourhood",
    icon: Layers,
    reportId: "neighbourhood-dashboard"
  },
  {
    title: "Cross-PCN Themes",
    description: "Systemic issues affecting multiple PCNs",
    icon: Share2,
    reportId: "cross-pcn-themes"
  },
  {
    title: "Population Health Insights",
    description: "How complaints relate to local demographics",
    icon: Activity,
    reportId: "population-health"
  },
  {
    title: "Service Gap Analysis",
    description: "Unmet needs identified through complaints",
    icon: Target,
    reportId: "service-gap-analysis"
  },
  {
    title: "Quality Patterns",
    description: "Quality indicators across the neighbourhood",
    icon: CheckCircle2,
    reportId: "quality-patterns"
  },
  {
    title: "Resource Allocation",
    description: "Where neighbourhood resources might be needed",
    icon: DollarSign,
    reportId: "resource-allocation"
  }
];

const ICBReports: ReportCard[] = [
  {
    title: "ICB Complaints Overview",
    description: "High-level metrics for board meetings",
    icon: Building,
    reportId: "icb-overview"
  },
  {
    title: "System Performance",
    description: "How this ICB performs across all services",
    icon: TrendingUp,
    reportId: "system-performance"
  },
  {
    title: "Strategic Priorities",
    description: "System-wide issues requiring ICB intervention",
    icon: Target,
    reportId: "strategic-priorities"
  },
  {
    title: "Regional Comparisons",
    description: "How this ICB compares to others nationally",
    icon: Globe,
    reportId: "regional-comparisons"
  },
  {
    title: "Policy Impact Analysis",
    description: "How policies affect complaint handling",
    icon: Shield,
    reportId: "policy-impact"
  },
  {
    title: "Financial Analysis",
    description: "Costs associated with complaint handling",
    icon: DollarSign,
    reportId: "financial-analysis"
  }
];

interface ReportCardProps {
  report: ReportCard;
  levelColor: "blue" | "green" | "purple" | "slate";
  onClick: () => void;
}

const ReportCardComponent = ({ report, levelColor, onClick }: ReportCardProps) => {
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
      onClick={onClick}
      className={`h-auto flex flex-col gap-3 p-4 ${colors.border} ${colors.bg} transition-all group cursor-pointer`}
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
  const [selectedReport, setSelectedReport] = useState<ReportDetail | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isRuralEastSouthExpanded, setIsRuralEastSouthExpanded] = useState(false);
  const [isWellingboroughExpanded, setIsWellingboroughExpanded] = useState(false);

  const navigate = useNavigate();

  const handleReportClick = (reportId: string) => {
    if (reportId === "ko41b-annual-return") {
      navigate("/complaints/ko41b-report");
      return;
    }
    const reportDetail = mockReportData[reportId];
    if (reportDetail) {
      setSelectedReport(reportDetail);
      setIsModalOpen(true);
    }
  };

  return (
    <>
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
                  <ReportCardComponent 
                    key={report.title} 
                    report={report} 
                    levelColor="blue" 
                    onClick={() => handleReportClick(report.reportId)}
                  />
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
                  <ReportCardComponent 
                    key={report.title} 
                    report={report} 
                    levelColor="green" 
                    onClick={() => handleReportClick(report.reportId)}
                  />
                ))}
              </div>
            </div>
          </TabsContent>

          {/* Neighbourhoods Level Reports */}
          <TabsContent value="neighbourhoods" className="mt-6">
            <div className="space-y-4">
              {/* Northamptonshire - Rural East & South */}
              <Card className="bg-purple-50/50 dark:bg-purple-900/10 border-purple-200 dark:border-purple-800">
                <CardHeader className="pb-3">
                  <button
                    onClick={() => setIsRuralEastSouthExpanded(!isRuralEastSouthExpanded)}
                    className="w-full flex items-center gap-3 hover:opacity-80 transition-opacity"
                  >
                    {isRuralEastSouthExpanded ? (
                      <ChevronDown className="h-5 w-5 text-purple-600 dark:text-purple-400 flex-shrink-0" />
                    ) : (
                      <ChevronRight className="h-5 w-5 text-purple-600 dark:text-purple-400 flex-shrink-0" />
                    )}
                    <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                      <Layers className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div className="flex-1 text-left">
                      <h3 className="font-semibold text-lg">Northamptonshire - Rural East & South</h3>
                      <p className="text-sm text-muted-foreground">Cross-PCN insights and collaboration opportunities across your neighbourhood</p>
                    </div>
                  </button>
                </CardHeader>
                
                {isRuralEastSouthExpanded && (
                  <CardContent className="space-y-4 animate-accordion-down">
                    {/* Participating Practices */}
                    <Card className="bg-background border-purple-200 dark:border-purple-700">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                          Participating Practices
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex flex-col gap-2 text-xs">
                          <div className="flex items-center justify-between p-2 rounded bg-muted/50">
                            <span className="font-medium">Brackley Medical Centre</span>
                            <span className="text-muted-foreground">16,128</span>
                          </div>
                          <div className="flex items-center justify-between p-2 rounded bg-muted/50">
                            <span className="font-medium">Bugbrooke Surgery</span>
                            <span className="text-muted-foreground">10,773</span>
                          </div>
                          <div className="flex items-center justify-between p-2 rounded bg-muted/50">
                            <span className="font-medium">Denton Village Surgery</span>
                            <span className="text-muted-foreground">6,277</span>
                          </div>
                          <div className="flex items-center justify-between p-2 rounded bg-muted/50">
                            <span className="font-medium">Springfield Surgery</span>
                            <span className="text-muted-foreground">12,649</span>
                          </div>
                          <div className="flex items-center justify-between p-2 rounded bg-muted/50">
                            <span className="font-medium">The Brook Health Centre</span>
                            <span className="text-muted-foreground">8,983</span>
                          </div>
                          <div className="flex items-center p-2 rounded bg-muted/50 pl-6">
                            <span className="text-muted-foreground">→ Silverstone Surgery</span>
                          </div>
                          <div className="flex items-center justify-between p-2 rounded bg-muted/50">
                            <span className="font-medium">The Parks Medical Practice</span>
                            <span className="text-muted-foreground">22,689</span>
                          </div>
                          <div className="flex items-center p-2 rounded bg-muted/50 pl-6">
                            <span className="text-muted-foreground">→ Grange Park</span>
                          </div>
                          <div className="flex items-center p-2 rounded bg-muted/50 pl-6">
                            <span className="text-muted-foreground">→ Hanslope Surgery</span>
                          </div>
                          <div className="flex items-center p-2 rounded bg-muted/50 pl-6">
                            <span className="text-muted-foreground">→ Roade Medical Centre</span>
                          </div>
                          <div className="flex items-center justify-between p-2 rounded bg-muted/50">
                            <span className="font-medium">Towcester Medical Centre</span>
                            <span className="text-muted-foreground">11,439</span>
                          </div>
                          <div className="flex items-center p-2 rounded bg-muted/50 pl-6">
                            <span className="text-muted-foreground">→ Paulerspury Surgery</span>
                          </div>
                        </div>
                        <div className="mt-4 pt-3 border-t border-purple-200 dark:border-purple-700 flex items-center justify-between font-semibold text-sm">
                          <span>Total</span>
                          <span>88,938</span>
                        </div>
                      </CardContent>
                    </Card>
                  </CardContent>
                )}
              </Card>

              {/* Wellingborough */}
              <Card className="bg-purple-50/50 dark:bg-purple-900/10 border-purple-200 dark:border-purple-800">
                <CardHeader className="pb-3">
                  <button
                    onClick={() => setIsWellingboroughExpanded(!isWellingboroughExpanded)}
                    className="w-full flex items-center gap-3 hover:opacity-80 transition-opacity"
                  >
                    {isWellingboroughExpanded ? (
                      <ChevronDown className="h-5 w-5 text-purple-600 dark:text-purple-400 flex-shrink-0" />
                    ) : (
                      <ChevronRight className="h-5 w-5 text-purple-600 dark:text-purple-400 flex-shrink-0" />
                    )}
                    <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                      <Layers className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div className="flex-1 text-left">
                      <h3 className="font-semibold text-lg">Wellingborough</h3>
                      <p className="text-sm text-muted-foreground">Cross-PCN insights and collaboration opportunities across your neighbourhood</p>
                    </div>
                  </button>
                </CardHeader>
                
                {isWellingboroughExpanded && (
                  <CardContent className="space-y-4 animate-accordion-down">
                    {/* Participating Practices */}
                    <Card className="bg-background border-purple-200 dark:border-purple-700">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                          Participating Practices
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex flex-col gap-2 text-xs">
                          <div className="flex items-center justify-between p-2 rounded bg-muted/50">
                            <span className="font-medium">Abbey Medical Practice</span>
                            <span className="text-muted-foreground">27,264</span>
                          </div>
                          <div className="flex items-center justify-between p-2 rounded bg-muted/50 pl-6">
                            <span className="text-muted-foreground">→ Broad Street Surgery</span>
                            <span className="text-muted-foreground">0</span>
                          </div>
                          <div className="flex items-center justify-between p-2 rounded bg-muted/50">
                            <span className="font-medium">Albany House Medical Centre</span>
                            <span className="text-muted-foreground">20,458</span>
                          </div>
                          <div className="flex items-center justify-between p-2 rounded bg-muted/50 pl-6">
                            <span className="text-muted-foreground">→ Wollaston</span>
                            <span className="text-muted-foreground">0</span>
                          </div>
                          <div className="flex items-center justify-between p-2 rounded bg-muted/50">
                            <span className="font-medium">Dr Pasquali</span>
                            <span className="text-muted-foreground">4,040</span>
                          </div>
                          <div className="flex items-center justify-between p-2 rounded bg-muted/50">
                            <span className="font-medium">Earls Barton & Penvale Park</span>
                            <span className="text-muted-foreground">5,603</span>
                          </div>
                          <div className="flex items-center justify-between p-2 rounded bg-muted/50">
                            <span className="font-medium">Queensway Medical Centre</span>
                            <span className="text-muted-foreground">14,651</span>
                          </div>
                          <div className="flex items-center justify-between p-2 rounded bg-muted/50">
                            <span className="font-medium">Redwell Medical Centre</span>
                            <span className="text-muted-foreground">12,305</span>
                          </div>
                          <div className="flex items-center justify-between p-2 rounded bg-muted/50">
                            <span className="font-medium">Summerlee Medical Centre</span>
                            <span className="text-muted-foreground">1,819</span>
                          </div>
                          <div className="flex items-center justify-between p-2 rounded bg-muted/50">
                            <span className="font-medium">Woodsend Medical Centre</span>
                            <span className="text-muted-foreground">TBC</span>
                          </div>
                          <div className="flex items-center justify-between p-2 rounded bg-muted/50 pl-6">
                            <span className="text-muted-foreground">→ Bozeat Surgery</span>
                            <span className="text-muted-foreground">0</span>
                          </div>
                          <div className="flex items-center justify-between p-2 rounded bg-muted/50 pl-6">
                            <span className="text-muted-foreground">→ Wollaston Surgery</span>
                            <span className="text-muted-foreground">5,310</span>
                          </div>
                        </div>
                        <div className="mt-4 pt-3 border-t border-purple-200 dark:border-purple-700 flex items-center justify-between font-semibold text-sm">
                          <span>Total</span>
                          <span>91,450</span>
                        </div>
                      </CardContent>
                    </Card>
                  </CardContent>
                )}
              </Card>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
                {NeighbourhoodsReports.map((report) => (
                  <ReportCardComponent 
                    key={report.title} 
                    report={report} 
                    levelColor="purple" 
                    onClick={() => handleReportClick(report.reportId)}
                  />
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
                  <ReportCardComponent 
                    key={report.title} 
                    report={report} 
                    levelColor="slate" 
                    onClick={() => handleReportClick(report.reportId)}
                  />
                ))}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
    <ReportDetailModal
      report={selectedReport}
      isOpen={isModalOpen}
      onClose={() => setIsModalOpen(false)}
    />
    </>
  );
};
