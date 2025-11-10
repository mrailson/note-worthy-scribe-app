import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ReportDetail } from "@/data/mockReportData";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, Share2, Database, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { useToast } from "@/hooks/use-toast";

interface ReportDetailModalProps {
  report: ReportDetail | null;
  isOpen: boolean;
  onClose: () => void;
}

const COLORS = [
  'hsl(217, 91%, 60%)',  // Vibrant blue
  'hsl(142, 71%, 45%)',  // Vibrant green
  'hsl(280, 65%, 60%)',  // Vibrant purple
  'hsl(25, 95%, 53%)',   // Vibrant orange
  'hsl(340, 82%, 52%)',  // Vibrant pink
  'hsl(45, 93%, 47%)',   // Vibrant yellow
];

const levelColors = {
  Practice: 'blue',
  PCN: 'green',
  Neighbourhoods: 'purple',
  ICB: 'orange',
};

export function ReportDetailModal({ report, isOpen, onClose }: ReportDetailModalProps) {
  const { toast } = useToast();

  if (!report) return null;

  const levelColor = levelColors[report.level];

  const getLevelColorClasses = () => {
    switch (report.level) {
      case 'Practice':
        return {
          border: 'border-blue-500',
          badge: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
          card: 'bg-blue-50/50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800',
        };
      case 'PCN':
        return {
          border: 'border-green-500',
          badge: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
          card: 'bg-green-50/50 dark:bg-green-900/10 border-green-200 dark:border-green-800',
        };
      case 'Neighbourhoods':
        return {
          border: 'border-purple-500',
          badge: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300',
          card: 'bg-purple-50/50 dark:bg-purple-900/10 border-purple-200 dark:border-purple-800',
        };
      case 'ICB':
        return {
          border: 'border-orange-500',
          badge: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300',
          card: 'bg-orange-50/50 dark:bg-orange-900/10 border-orange-200 dark:border-orange-800',
        };
    }
  };

  const colorClasses = getLevelColorClasses();

  const handleDownload = () => {
    toast({
      title: "Download Started",
      description: `Downloading ${report.title} report...`,
    });
  };

  const handleShare = () => {
    toast({
      title: "Share Link Copied",
      description: "Report link copied to clipboard",
    });
  };

  const handleViewData = () => {
    toast({
      title: "Opening Data View",
      description: "Loading raw data table...",
    });
  };

  const getTrendIcon = () => {
    if (!report.heroMetric.trend) return null;
    
    switch (report.heroMetric.trend) {
      case 'up':
        return <TrendingUp className="h-6 w-6 text-green-500" />;
      case 'down':
        return <TrendingDown className="h-6 w-6 text-red-500" />;
      case 'stable':
        return <Minus className="h-6 w-6 text-muted-foreground" />;
    }
  };

  const renderChart = () => {
    if (!report.chartData) return null;

    const { type, data } = report.chartData;

    switch (type) {
      case 'bar':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" fill="hsl(var(--primary))" />
            </BarChart>
          </ResponsiveContainer>
        );
      case 'line':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        );
      case 'pie':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                labelLine={true}
                label={({ name, value }) => `${name}: ${value}%`}
                outerRadius={100}
                fill="hsl(var(--primary))"
                dataKey="value"
                stroke="hsl(var(--background))"
                strokeWidth={2}
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        );
      default:
        return null;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className={`flex items-center gap-3 pb-4 border-b-4 ${colorClasses.border}`}>
            <div className={`px-3 py-1 rounded-full ${colorClasses.badge} text-sm font-semibold`}>
              {report.level}
            </div>
            <DialogTitle className="text-2xl flex-1">{report.title}</DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground pt-2">
            Report Period: {report.reportPeriod} | Generated: {report.generatedDate} | Demo Data - Northamptonshire Rural East & South
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-6">
          {/* Hero Metric */}
          <Card className={colorClasses.card}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <span className="text-5xl font-bold">{report.heroMetric.value}</span>
                    {getTrendIcon()}
                  </div>
                  <p className="text-lg text-muted-foreground mt-2">{report.heroMetric.label}</p>
                  {report.heroMetric.trendValue && (
                    <p className="text-sm text-muted-foreground mt-1">{report.heroMetric.trendValue}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Key Insight */}
          <Card className="bg-accent/50">
            <CardHeader>
              <CardTitle className="text-lg">Key Insight</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-base font-medium">{report.keyInsight}</p>
            </CardContent>
          </Card>

          {/* Chart */}
          {report.chartData && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Visual Analysis</CardTitle>
              </CardHeader>
              <CardContent>
                {renderChart()}
              </CardContent>
            </Card>
          )}

          {/* Detailed Sections */}
          {report.sections.map((section, index) => (
            <Card key={index}>
              <CardHeader>
                <CardTitle className="text-lg">{section.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {section.content.map((item, itemIndex) => (
                    <li key={itemIndex} className="flex items-start gap-2">
                      <span className="text-primary mt-1">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <Button onClick={handleDownload} className="flex-1">
              <Download className="h-4 w-4 mr-2" />
              Download PDF
            </Button>
            <Button onClick={handleShare} variant="outline" className="flex-1">
              <Share2 className="h-4 w-4 mr-2" />
              Share Report
            </Button>
            <Button onClick={handleViewData} variant="outline" className="flex-1">
              <Database className="h-4 w-4 mr-2" />
              View Raw Data
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
