import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Copy, Check, FileText, Calendar, BookOpen, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { generatePolicyDocx, PolicyDocxOptions } from "@/utils/generatePolicyDocx";
import { PolicyDocumentPreview } from "./PolicyDocumentPreview";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface PolicyMetadata {
  title: string;
  version: string;
  effective_date: string;
  review_date: string;
  references: string[];
  changes_summary?: string[];
}

interface PracticeDetails {
  practice_name?: string;
  address?: string;
  postcode?: string;
  practice_manager_name?: string;
  lead_gp_name?: string;
}

interface PolicyPreviewPanelProps {
  content: string;
  metadata: PolicyMetadata;
  policyName: string;
  generationId: string | null;
  isUpdate?: boolean;
  practiceDetails?: PracticeDetails;
  practiceLogoUrl?: string | null;
  wasEnhanced?: boolean;
  enhancementWarning?: string | null;
}

const STORAGE_KEY_SHOW_LOGO = 'policy_docx_show_logo';
const STORAGE_KEY_LOGO_POSITION = 'policy_docx_logo_position';
const STORAGE_KEY_SHOW_FOOTER = 'policy_docx_show_footer';
const STORAGE_KEY_SHOW_PAGE_NUMBERS = 'policy_docx_show_page_numbers';

export type LogoPosition = 'left' | 'center' | 'right';

export const PolicyPreviewPanel = ({ 
  content, 
  metadata, 
  policyName,
  generationId,
  isUpdate = false,
  practiceDetails,
  practiceLogoUrl,
  wasEnhanced = false,
  enhancementWarning,
}: PolicyPreviewPanelProps) => {
  const [copied, setCopied] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  
  // Document options with localStorage persistence
  const [showLogo, setShowLogo] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY_SHOW_LOGO);
    return saved !== null ? saved === 'true' : true;
  });

  const [logoPosition, setLogoPosition] = useState<LogoPosition>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_LOGO_POSITION);
    return (saved as LogoPosition) || 'left';
  });
  
  const [showFooter, setShowFooter] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY_SHOW_FOOTER);
    return saved !== null ? saved === 'true' : true;
  });
  
  const [showPageNumbers, setShowPageNumbers] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY_SHOW_PAGE_NUMBERS);
    return saved !== null ? saved === 'true' : true;
  });

  // Persist options to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_SHOW_LOGO, String(showLogo));
  }, [showLogo]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_LOGO_POSITION, logoPosition);
  }, [logoPosition]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_SHOW_FOOTER, String(showFooter));
  }, [showFooter]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_SHOW_PAGE_NUMBERS, String(showPageNumbers));
  }, [showPageNumbers]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      toast.success("Policy content copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error("Failed to copy content");
    }
  };

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const options: PolicyDocxOptions = {
        showLogo,
        logoPosition,
        showFooter,
        showPageNumbers,
        practiceDetails: practiceDetails ? {
          name: practiceDetails.practice_name,
          address: practiceDetails.address,
          postcode: practiceDetails.postcode,
          practiceManagerName: practiceDetails.practice_manager_name,
          leadGpName: practiceDetails.lead_gp_name,
        } : undefined,
        logoUrl: practiceLogoUrl || undefined,
      };
      
      await generatePolicyDocx(content, metadata, policyName, options);
      toast.success("Policy downloaded successfully");
    } catch (error) {
      console.error("Download error:", error);
      toast.error("Failed to download policy");
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Success Message */}
      <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
        <Check className="h-6 w-6 text-green-600" />
        <div>
          <p className="font-medium text-green-800 dark:text-green-200">
            {isUpdate ? "Policy Updated Successfully" : "Policy Generated Successfully"}
          </p>
          <p className="text-sm text-green-600 dark:text-green-400">
            {metadata.title} • Version {metadata.version}
          </p>
        </div>
      </div>

      {/* Metadata */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="flex items-center gap-2 text-sm">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">Effective:</span>
          <span className="font-medium">{metadata.effective_date}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">Review:</span>
          <span className="font-medium">{metadata.review_date}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">Version:</span>
          <span className="font-medium">{metadata.version}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <BookOpen className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">References:</span>
          <span className="font-medium">{metadata.references?.length || 0}</span>
        </div>
      </div>

      {/* Changes Summary (for updates) */}
      {isUpdate && metadata.changes_summary && metadata.changes_summary.length > 0 && (
        <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
          <p className="font-medium text-blue-800 dark:text-blue-200 mb-2">Changes Made:</p>
          <ul className="list-disc list-inside text-sm text-blue-700 dark:text-blue-300 space-y-1">
            {metadata.changes_summary.map((change, index) => (
              <li key={index}>{change}</li>
            ))}
          </ul>
        </div>
      )}

      {/* References */}
      {metadata.references && metadata.references.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">Guidance Sources Used:</p>
          <div className="flex flex-wrap gap-2">
            {metadata.references.map((ref, index) => (
              <Badge key={index} variant="outline" className="text-xs">
                {ref}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Document Options */}
      <Collapsible open={optionsOpen} onOpenChange={setOptionsOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <Settings2 className="h-4 w-4" />
            Document Options
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-4">
          <div className="p-4 border rounded-lg bg-muted/50 space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="show-logo" className="text-sm font-medium">
                  Include Practice Logo
                </Label>
                <p className="text-xs text-muted-foreground">
                  Add your practice logo to the document header
                </p>
              </div>
              <Switch
                id="show-logo"
                checked={showLogo}
                onCheckedChange={setShowLogo}
              />
            </div>

            {showLogo && (
              <div className="flex items-center justify-between pl-4 border-l-2 border-muted">
                <div className="space-y-0.5">
                  <Label htmlFor="logo-position" className="text-sm font-medium">
                    Logo Position
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Where to place the logo on the page
                  </p>
                </div>
                <Select value={logoPosition} onValueChange={(val) => setLogoPosition(val as LogoPosition)}>
                  <SelectTrigger className="w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-background">
                    <SelectItem value="left">Left</SelectItem>
                    <SelectItem value="center">Centre</SelectItem>
                    <SelectItem value="right">Right</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="show-footer" className="text-sm font-medium">
                  Include Practice Footer
                </Label>
                <p className="text-xs text-muted-foreground">
                  Add practice name and address to the footer
                </p>
              </div>
              <Switch
                id="show-footer"
                checked={showFooter}
                onCheckedChange={setShowFooter}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="show-page-numbers" className="text-sm font-medium">
                  Include Page Numbers
                </Label>
                <p className="text-xs text-muted-foreground">
                  Add page numbers to each page footer
                </p>
              </div>
              <Switch
                id="show-page-numbers"
                checked={showPageNumbers}
                onCheckedChange={setShowPageNumbers}
              />
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <Button onClick={handleDownload} disabled={isDownloading} className="flex-1 sm:flex-none">
          <Download className="h-4 w-4 mr-2" />
          {isDownloading ? "Downloading..." : "Download .docx"}
        </Button>
        <Button variant="outline" onClick={handleCopy}>
          {copied ? (
            <>
              <Check className="h-4 w-4 mr-2" />
              Copied
            </>
          ) : (
            <>
              <Copy className="h-4 w-4 mr-2" />
              Copy
            </>
          )}
        </Button>
      </div>

      {/* Content Preview - matches Word document formatting */}
      <div className="border rounded-lg overflow-hidden">
        <div className="p-3 bg-muted border-b">
          <p className="text-sm font-medium">Policy Preview</p>
          <p className="text-xs text-muted-foreground">Preview matches Word document formatting</p>
        </div>
        <ScrollArea className="h-[500px] bg-slate-100 dark:bg-slate-900">
          <div className="p-4">
            <PolicyDocumentPreview
              content={content}
              metadata={metadata}
              practiceDetails={practiceDetails}
              practiceLogoUrl={practiceLogoUrl}
              showLogo={showLogo}
              logoPosition={logoPosition}
              showFooter={showFooter}
              showPageNumbers={showPageNumbers}
            />
          </div>
        </ScrollArea>
      </div>
    </div>
  );
};
