import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Shield, FileText, Clock, Users, Download } from "lucide-react";

export const CSOReportHeader = () => {
  return (
    <>
      {/* Document Header */}
      <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-background border-l-4 border-primary p-6 mb-8 rounded-lg">
        <div className="flex items-center gap-2 mb-2">
          <Shield className="w-6 h-6 text-primary" />
          <Badge variant="outline" className="text-xs">NHS OFFICIAL-SENSITIVE</Badge>
        </div>
        <h1 className="text-3xl font-bold mb-2">Clinical Safety Officer & Data Protection Officer Assessment Report</h1>
        <p className="text-xl text-muted-foreground mb-4">Notewell AI System Services</p>
        <div className="flex flex-wrap gap-4 text-sm">
          <div><span className="font-semibold">Version:</span> 2.2</div>
          <div><span className="font-semibold">Date:</span> 30 January 2026</div>
          <div><span className="font-semibold">Status:</span> <Badge className="bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300">MHRA REGISTERED</Badge></div>
          <div><span className="font-semibold">Medical Device Classification:</span> MHRA Class I Medical Device (UK MDR 2002) - Registered since December 2025 (Manufacturer Self-Certification)</div>
        </div>
      </div>

      {/* Document Badge Component */}
      <Card className="mb-8 border-l-4 border-primary bg-gradient-to-r from-blue-50 to-white dark:from-blue-950/20 dark:to-background">
        <CardContent className="p-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <div className="flex items-center gap-3 mb-3">
                <FileText className="w-6 h-6 text-primary" />
                <h3 className="text-lg font-semibold">Clinical Safety Officer Assessment Report</h3>
              </div>
              <div className="space-y-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  <span><strong>Last updated:</strong> 30 January 2026</span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  <span><strong>Prepared by:</strong> NoteWell Clinical Safety Team</span>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Button 
                className="gap-2"
                asChild
              >
                <a 
                  href="/documents/NoteWell_CSO_Report_v2.2.pdf"
                  download="NoteWell_CSO_Report_v2.2.pdf"
                >
                  <Download className="w-4 h-4" />
                  Download CSO Report (v2.2)
                </a>
              </Button>
              <Badge className="self-end bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300">
                Version 2.2
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
};
