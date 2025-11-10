import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ReportDetail } from "@/data/mockReportData";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, Share2, Database, TrendingUp, TrendingDown, Minus, Mail, X } from "lucide-react";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { useToast } from "@/hooks/use-toast";
import { jsPDF } from "jspdf";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

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
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareEmail, setShareEmail] = useState("");
  const [shareMessage, setShareMessage] = useState("");

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
    try {
      const pdf = new jsPDF();
      const pageWidth = pdf.internal.pageSize.getWidth();
      const margin = 20;
      let yPosition = margin;

      // Title
      pdf.setFontSize(20);
      pdf.setFont("helvetica", "bold");
      pdf.text(report.title, margin, yPosition);
      yPosition += 15;

      // Level badge
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      pdf.text(`Level: ${report.level}`, margin, yPosition);
      yPosition += 10;

      // Report metadata
      pdf.setFontSize(9);
      pdf.setTextColor(100);
      pdf.text(`Report Period: ${report.reportPeriod} | Generated: ${report.generatedDate}`, margin, yPosition);
      yPosition += 15;

      // Hero metric
      pdf.setFontSize(32);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(0);
      pdf.text(report.heroMetric.value, margin, yPosition);
      yPosition += 10;
      
      pdf.setFontSize(12);
      pdf.setFont("helvetica", "normal");
      pdf.text(report.heroMetric.label, margin, yPosition);
      yPosition += 15;

      // Key insight
      pdf.setFontSize(14);
      pdf.setFont("helvetica", "bold");
      pdf.text("Key Insight", margin, yPosition);
      yPosition += 8;
      
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      const insightLines = pdf.splitTextToSize(report.keyInsight, pageWidth - 2 * margin);
      pdf.text(insightLines, margin, yPosition);
      yPosition += insightLines.length * 7 + 10;

      // Sections
      report.sections.forEach((section) => {
        if (yPosition > 250) {
          pdf.addPage();
          yPosition = margin;
        }

        pdf.setFontSize(14);
        pdf.setFont("helvetica", "bold");
        pdf.text(section.title, margin, yPosition);
        yPosition += 8;

        pdf.setFontSize(10);
        pdf.setFont("helvetica", "normal");
        section.content.forEach((item) => {
          const lines = pdf.splitTextToSize(`• ${item}`, pageWidth - 2 * margin - 5);
          if (yPosition + lines.length * 5 > 280) {
            pdf.addPage();
            yPosition = margin;
          }
          pdf.text(lines, margin + 5, yPosition);
          yPosition += lines.length * 5 + 3;
        });
        yPosition += 5;
      });

      pdf.save(`${report.title.replace(/\s+/g, '_')}_Report.pdf`);
      
      toast({
        title: "Download Complete",
        description: `${report.title} report downloaded successfully`,
      });
    } catch (error) {
      toast({
        title: "Download Failed",
        description: "There was an error generating the PDF",
        variant: "destructive",
      });
    }
  };

  const handleShare = () => {
    setShareModalOpen(true);
  };

  const handleSendEmail = () => {
    if (!shareEmail) {
      toast({
        title: "Email Required",
        description: "Please enter an email address",
        variant: "destructive",
      });
      return;
    }

    // Simulate email sending
    toast({
      title: "Report Shared",
      description: `Report sent to ${shareEmail}`,
    });
    
    setShareModalOpen(false);
    setShareEmail("");
    setShareMessage("");
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
    <>
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

    {/* Share Email Modal */}
    <Dialog open={shareModalOpen} onOpenChange={setShareModalOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Share Report via Email
          </DialogTitle>
          <DialogDescription>
            Send this report to colleagues or stakeholders
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="email">Recipient Email Address *</Label>
            <Input
              id="email"
              type="email"
              placeholder="colleague@example.com"
              value={shareEmail}
              onChange={(e) => setShareEmail(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Optional Message</Label>
            <Textarea
              id="message"
              placeholder="Add a personal message..."
              value={shareMessage}
              onChange={(e) => setShareMessage(e.target.value)}
              rows={4}
            />
          </div>

          <div className="bg-muted/50 p-3 rounded-lg">
            <p className="text-sm text-muted-foreground">
              <strong>Report:</strong> {report.title}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {report.reportPeriod} | {report.level}
            </p>
          </div>

          <div className="flex gap-2 pt-2">
            <Button onClick={handleSendEmail} className="flex-1">
              <Mail className="h-4 w-4 mr-2" />
              Send Email
            </Button>
            <Button 
              onClick={() => {
                setShareModalOpen(false);
                setShareEmail("");
                setShareMessage("");
              }} 
              variant="outline"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}
