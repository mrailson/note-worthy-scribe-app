import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, FileX, Clock, AlertCircle, ArrowRight, Loader2 } from "lucide-react";

interface GapAnalysis {
  policy_type: string;
  gaps: string[];
  outdated_references: string[];
  missing_sections: string[];
  last_review_date: string | null;
}

interface GapAnalysisResultsProps {
  analysis: GapAnalysis;
  onGenerateUpdated: () => void;
  isGenerating: boolean;
}

export const GapAnalysisResults = ({ analysis, onGenerateUpdated, isGenerating }: GapAnalysisResultsProps) => {
  const totalIssues = analysis.gaps.length + analysis.outdated_references.length + analysis.missing_sections.length;
  const hasIssues = totalIssues > 0;

  return (
    <div className="space-y-6">
      {/* Policy Type Detection */}
      <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
        <div>
          <p className="text-sm text-muted-foreground">Detected Policy Type</p>
          <p className="font-medium text-lg">{analysis.policy_type}</p>
        </div>
        {analysis.last_review_date && (
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Last Review Date</p>
            <p className="font-medium">{analysis.last_review_date}</p>
          </div>
        )}
      </div>

      {/* Summary */}
      <div className="flex items-center gap-4">
        <Badge variant={hasIssues ? "destructive" : "default"} className="text-sm px-3 py-1">
          {totalIssues} {totalIssues === 1 ? 'issue' : 'issues'} found
        </Badge>
        {!hasIssues && (
          <span className="text-sm text-green-600 dark:text-green-400">
            Your policy appears to be up to date
          </span>
        )}
      </div>

      {/* Gaps Identified */}
      {analysis.gaps.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-orange-500" />
            <h3 className="font-medium">Gaps Identified ({analysis.gaps.length})</h3>
          </div>
          <ul className="space-y-2 pl-7">
            {analysis.gaps.map((gap, index) => (
              <li key={index} className="text-sm text-muted-foreground flex items-start gap-2">
                <span className="text-orange-500 mt-1">•</span>
                {gap}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Outdated References */}
      {analysis.outdated_references.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-yellow-500" />
            <h3 className="font-medium">Outdated References ({analysis.outdated_references.length})</h3>
          </div>
          <ul className="space-y-2 pl-7">
            {analysis.outdated_references.map((ref, index) => (
              <li key={index} className="text-sm text-muted-foreground flex items-start gap-2">
                <span className="text-yellow-500 mt-1">•</span>
                {ref}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Missing Sections */}
      {analysis.missing_sections.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <FileX className="h-5 w-5 text-red-500" />
            <h3 className="font-medium">Missing Sections ({analysis.missing_sections.length})</h3>
          </div>
          <ul className="space-y-2 pl-7">
            {analysis.missing_sections.map((section, index) => (
              <li key={index} className="text-sm text-muted-foreground flex items-start gap-2">
                <span className="text-red-500 mt-1">•</span>
                {section}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t">
        <Button onClick={onGenerateUpdated} disabled={isGenerating} className="flex-1 sm:flex-none">
          {isGenerating ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Generating Updated Policy...
            </>
          ) : (
            <>
              Generate Updated Version
              <ArrowRight className="h-4 w-4 ml-2" />
            </>
          )}
        </Button>
        <Button variant="outline" className="flex-1 sm:flex-none">
          Export Gap Analysis
        </Button>
      </div>

      {/* Info */}
      {hasIssues && (
        <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
          <AlertTriangle className="h-5 w-5 text-blue-500 mt-0.5" />
          <div className="text-sm text-blue-700 dark:text-blue-300">
            <p className="font-medium">About the Updated Version</p>
            <p className="mt-1">
              The AI will generate a new version of your policy that addresses the identified gaps,
              updates outdated references, and adds any missing sections while preserving your
              practice-specific content.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
