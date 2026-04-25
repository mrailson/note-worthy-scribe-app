import { Link } from "react-router-dom";
import { Beaker, BookOpen, Cog, FileText, Library, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { dashboardTokens } from "./tokens";

type PracticeOption = { key: string; label: string };

interface EditorialHeaderProps {
  practiceName: string;
  patientCount: string;
  dataAsAt: string;
  pcnName?: string;
  selectedPractice: string;
  practices: PracticeOption[];
  onPracticeChange: (practice: string) => void;
  canUploadNarp: boolean;
  showDemoAction: boolean;
  onUpload: () => void;
  onManageExports: () => void;
  onGlossary: () => void;
  onLoadDemo: () => void;
}

export const EditorialHeader = ({
  practiceName,
  patientCount,
  dataAsAt,
  pcnName,
  selectedPractice,
  practices,
  onPracticeChange,
  canUploadNarp,
  showDemoAction,
  onUpload,
  onManageExports,
  onGlossary,
  onLoadDemo,
}: EditorialHeaderProps) => (
  <header className={`border-b-2 ${dashboardTokens.accentBorder} bg-narp-paper px-4 py-[22px] sm:px-9`}>
    <div className="mx-auto flex max-w-[1400px] flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="min-w-0">
        <div className={`mb-1.5 text-[11px] font-bold uppercase tracking-[0.2em] ${dashboardTokens.accent}`}>
          NRES NEW MODELS · RISK STRATIFICATION
        </div>
        <h1 className={`narp-display truncate text-[30px] font-medium leading-tight ${dashboardTokens.ink}`}>
          {practiceName}
        </h1>
        <p className="mt-1 truncate text-[13px] text-narp-ink-2 tabular-nums">
          {patientCount} patients · Data as at {dataAsAt}{pcnName ? ` · ${pcnName}` : ""}
        </p>
      </div>

      <div className="flex items-center gap-3">
        <Select value={selectedPractice} onValueChange={onPracticeChange}>
          <SelectTrigger className={`h-9 w-[240px] ${dashboardTokens.line} bg-card ${dashboardTokens.ink} shadow-none focus:ring-narp-teal/30`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {practices.map((practice) => (
              <SelectItem key={practice.key} value={practice.key}>{practice.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className={`h-9 w-9 ${dashboardTokens.line} bg-card ${dashboardTokens.ink} hover:bg-muted hover:text-narp-ink`}
              aria-label="Open Population Risk settings"
            >
              <Cog className="h-[18px] w-[18px]" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {canUploadNarp && (
              <>
                <DropdownMenuItem onSelect={onUpload}>
                  <Upload className="mr-2 h-4 w-4" /> Upload NARP export
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={onManageExports}>
                  <FileText className="mr-2 h-4 w-4" /> Manage exports
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuItem asChild>
              <Link to="/nres/population-risk/methodology">
                <BookOpen className="mr-2 h-4 w-4" /> About the data
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onGlossary}>
              <Library className="mr-2 h-4 w-4" /> Glossary
            </DropdownMenuItem>
            {showDemoAction && (
              <DropdownMenuItem onSelect={onLoadDemo}>
                <Beaker className="mr-2 h-4 w-4" /> Load demo data
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled>
              <Cog className="mr-2 h-4 w-4" /> Settings
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  </header>
);