import { Link } from "react-router-dom";
import { BookOpen, ClipboardList, FlaskConical, HelpCircle, Settings, Upload, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type PracticeOption = { key: string; label: string };

interface EditorialHeaderProps {
  practiceName: string;
  patientCount: string;
  dataAsAt: string;
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
  <header className="border-b-4 border-narp-teal bg-narp-ink px-4 py-5 text-primary-foreground sm:px-9">
    <div className="mx-auto flex max-w-[1400px] flex-col gap-4 lg:h-12 lg:flex-row lg:items-center lg:justify-between">
      <div className="min-w-0">
        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary-foreground/55">
          NRES NEW MODELS · RISK STRATIFICATION
        </div>
        <h1 className="narp-display truncate text-[28px] font-medium leading-tight text-primary-foreground">
          {practiceName}
        </h1>
        <p className="truncate text-[13px] text-primary-foreground/75">
          {patientCount} patients · Data as at {dataAsAt} · Bugbrooke · Blue PCN
        </p>
      </div>

      <div className="flex items-center gap-2">
        <Select value={selectedPractice} onValueChange={onPracticeChange}>
          <SelectTrigger className="h-9 w-[240px] border-primary-foreground/15 bg-primary-foreground/10 text-primary-foreground shadow-none focus:ring-primary-foreground/30">
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
              className="h-9 w-9 border-primary-foreground/15 bg-primary-foreground/10 text-primary-foreground hover:bg-primary-foreground/15 hover:text-primary-foreground"
              aria-label="Open Population Risk settings"
            >
              <Settings className="h-[18px] w-[18px]" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {canUploadNarp && (
              <>
                <DropdownMenuItem onSelect={onUpload}>
                  <Upload className="mr-2 h-4 w-4" /> Upload NARP export
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={onManageExports}>
                  <ClipboardList className="mr-2 h-4 w-4" /> Manage exports
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
              <HelpCircle className="mr-2 h-4 w-4" /> Glossary
            </DropdownMenuItem>
            {showDemoAction && (
              <DropdownMenuItem onSelect={onLoadDemo}>
                <FlaskConical className="mr-2 h-4 w-4" /> Load demo data
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled>
              <Wrench className="mr-2 h-4 w-4" /> Settings
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  </header>
);