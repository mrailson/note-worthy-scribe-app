import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Download, Copy, Check, FileText, Calendar, BookOpen } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { generatePolicyDocx } from "@/utils/generatePolicyDocx";

interface PolicyMetadata {
  title: string;
  version: string;
  effective_date: string;
  review_date: string;
  references: string[];
  changes_summary?: string[];
}

interface PolicyPreviewPanelProps {
  content: string;
  metadata: PolicyMetadata;
  policyName: string;
  generationId: string | null;
  isUpdate?: boolean;
}

export const PolicyPreviewPanel = ({ 
  content, 
  metadata, 
  policyName,
  generationId,
  isUpdate = false 
}: PolicyPreviewPanelProps) => {
  const [copied, setCopied] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

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
      await generatePolicyDocx(content, metadata, policyName);
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

      {/* Content Preview */}
      <div className="border rounded-lg">
        <div className="p-3 bg-muted border-b">
          <p className="text-sm font-medium">Policy Preview</p>
        </div>
        <ScrollArea className="h-[400px]">
          <div className="p-6 prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown>{content}</ReactMarkdown>
          </div>
        </ScrollArea>
      </div>
    </div>
  );
};
