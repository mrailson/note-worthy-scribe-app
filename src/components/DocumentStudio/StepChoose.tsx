import React, { useState, useMemo } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { DOCUMENT_TYPES, CATEGORY_COLOURS, CATEGORY_LABELS, type DocumentType, type DocumentCategory } from './documentTypes';

interface StepChooseProps {
  onSelectType: (docType: DocumentType) => void;
  onFreeFormSelect: (text: string) => void;
  selectedType: DocumentType | null;
  freeFormRequest: string;
  mode?: 'pm' | 'gp';
}

// Top 10 type_keys for Practice Managers
const PM_TOP_10: string[] = [
  'board_report',
  'formal_letter',
  'meeting_minutes',
  'cqc_preparation',
  'policy_summariser',
  'business_case',
  'hr_document',
  'staff_appraisal',
  'risk_assessment',
  'service_change_impact',
];

// Top 10 type_keys for GPs
const GP_TOP_10: string[] = [
  'learning_event',
  'clinical_audit',
  'formal_letter',
  'patient_survey_report',
  'qof_report',
  'nmp_prescribing_review',
  'nmp_case_review',
  'patient_communication',
  'training_needs',
  'meeting_minutes',
];

type FilterCategory = 'top10' | 'all' | DocumentCategory;

const ALL_CATEGORIES: FilterCategory[] = ['top10', 'all', 'nmp', 'clinical', 'governance', 'hr', 'letters', 'finance'];

export const StepChoose: React.FC<StepChooseProps> = ({
  onSelectType,
  onFreeFormSelect,
  selectedType,
  freeFormRequest,
  mode = 'pm',
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<FilterCategory>('top10');
  const [freeFormText, setFreeFormText] = useState(freeFormRequest);

  const top10Keys = mode === 'gp' ? GP_TOP_10 : PM_TOP_10;

  const filteredTypes = useMemo(() => {
    let types = DOCUMENT_TYPES;

    if (activeCategory === 'top10') {
      types = top10Keys
        .map(key => DOCUMENT_TYPES.find(t => t.type_key === key))
        .filter(Boolean) as DocumentType[];
    } else if (activeCategory !== 'all') {
      types = types.filter(t => t.category === activeCategory);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      types = types.filter(t =>
        t.display_name.toLowerCase().includes(q) ||
        t.use_when.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q)
      );
    }
    return types;
  }, [activeCategory, searchQuery, top10Keys]);

  return (
    <div className="space-y-4">
      {/* Free-form input at top */}
      <div>
        <p className="text-xs text-muted-foreground mb-2">Describe what you need in your own words...</p>
        <div className="flex gap-2">
          <Input
            placeholder="e.g. A letter to the ICB requesting additional funding for..."
            value={freeFormText}
            onChange={(e) => setFreeFormText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && freeFormText.trim()) {
                onFreeFormSelect(freeFormText.trim());
              }
            }}
            className="flex-1"
          />
          <button
            onClick={() => freeFormText.trim() && onFreeFormSelect(freeFormText.trim())}
            disabled={!freeFormText.trim()}
            className={cn(
              'px-4 py-2 rounded-[10px] text-sm font-semibold transition-all',
              freeFormText.trim()
                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                : 'bg-muted text-muted-foreground cursor-not-allowed'
            )}
          >
            Go
          </button>
        </div>
      </div>

      <div className="border-t pt-3">
        <p className="text-xs text-muted-foreground mb-2">Or choose a document type...</p>
      </div>

      {/* Category pills */}
      <div className="flex flex-wrap gap-1.5">
        {ALL_CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-medium transition-all',
              activeCategory === cat
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            )}
          >
            {cat === 'top10' ? 'Top 10' : cat === 'all' ? 'All' : CATEGORY_LABELS[cat]}
          </button>
        ))}
      </div>

      {/* Document type grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {filteredTypes.map(docType => {
          const Icon = docType.icon;
          const catColour = CATEGORY_COLOURS[docType.category];
          const isSelected = selectedType?.type_key === docType.type_key;

          return (
            <button
              key={docType.type_key}
              onClick={() => onSelectType(docType)}
              className={cn(
                'flex items-start gap-3 p-3 rounded-xl border text-left transition-all',
                isSelected
                  ? 'border-primary border-2 bg-primary/5'
                  : 'border-border hover:shadow-sm hover:border-border/80'
              )}
            >
              <div
                className="w-10 h-10 rounded-[10px] flex items-center justify-center flex-shrink-0"
                style={{
                  backgroundColor: `${catColour}15`,
                  border: `1px solid ${catColour}30`,
                }}
              >
                <Icon className="w-5 h-5" style={{ color: catColour }} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-foreground">{docType.display_name}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  <span className="text-amber-500 font-medium">Use when: </span>
                  {docType.use_when}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {filteredTypes.length === 0 && searchQuery.trim() && (
        <div className="text-center py-8 text-muted-foreground text-sm">
          No matching document types found.
        </div>
      )}

      {/* Free-form fallback */}
      <div className="pt-2 border-t">
        <p className="text-xs text-muted-foreground mb-2">Or describe what you need in your own words...</p>
        <div className="flex gap-2">
          <Input
            placeholder="e.g. A letter to the ICB requesting additional funding for..."
            value={freeFormText}
            onChange={(e) => setFreeFormText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && freeFormText.trim()) {
                onFreeFormSelect(freeFormText.trim());
              }
            }}
            className="flex-1"
          />
          <button
            onClick={() => freeFormText.trim() && onFreeFormSelect(freeFormText.trim())}
            disabled={!freeFormText.trim()}
            className={cn(
              'px-4 py-2 rounded-[10px] text-sm font-semibold transition-all',
              freeFormText.trim()
                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                : 'bg-muted text-muted-foreground cursor-not-allowed'
            )}
          >
            Go
          </button>
        </div>
      </div>
    </div>
  );
};
