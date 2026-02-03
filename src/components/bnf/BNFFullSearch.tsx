import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Globe, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { TLVocabItem, useTrafficLightVocab } from '@/hooks/useTrafficLightVocab';
import Fuse from 'fuse.js';

interface BNFFullSearchProps {
  onDrugSelect: (drugName: string, trafficLightItem?: TLVocabItem) => void;
}

// Comprehensive list of common UK prescribed drugs (top 500+ by volume)
const COMMON_UK_DRUGS = [
  // Cardiovascular
  "Amlodipine", "Atorvastatin", "Bisoprolol", "Ramipril", "Lisinopril", "Losartan", "Candesartan",
  "Simvastatin", "Pravastatin", "Rosuvastatin", "Ezetimibe", "Aspirin", "Clopidogrel", "Warfarin",
  "Rivaroxaban", "Apixaban", "Edoxaban", "Dabigatran", "Digoxin", "Furosemide", "Bendroflumethiazide",
  "Indapamide", "Spironolactone", "Eplerenone", "Doxazosin", "Felodipine", "Diltiazem", "Verapamil",
  "Isosorbide mononitrate", "Glyceryl trinitrate", "Nicorandil", "Ivabradine", "Ranolazine",
  "Perindopril", "Enalapril", "Irbesartan", "Valsartan", "Olmesartan", "Telmisartan",
  
  // Respiratory
  "Salbutamol", "Beclometasone", "Fluticasone", "Budesonide", "Formoterol", "Salmeterol",
  "Tiotropium", "Ipratropium", "Montelukast", "Theophylline", "Prednisolone", "Carbocisteine",
  "Glycopyrronium", "Umeclidinium", "Vilanterol", "Indacaterol", "Olodaterol", "Aclidinium",
  
  // Diabetes
  "Metformin", "Gliclazide", "Glimepiride", "Sitagliptin", "Linagliptin", "Alogliptin",
  "Empagliflozin", "Dapagliflozin", "Canagliflozin", "Ertugliflozin", "Pioglitazone",
  "Liraglutide", "Semaglutide", "Dulaglutide", "Exenatide", "Insulin glargine", "Insulin aspart",
  "Insulin lispro", "Insulin degludec", "Insulin detemir", "Repaglinide",
  
  // Gastrointestinal
  "Omeprazole", "Lansoprazole", "Esomeprazole", "Pantoprazole", "Rabeprazole", "Ranitidine",
  "Famotidine", "Domperidone", "Metoclopramide", "Ondansetron", "Cyclizine", "Prochlorperazine",
  "Loperamide", "Senna", "Lactulose", "Macrogol", "Movicol", "Docusate", "Bisacodyl",
  "Mebeverine", "Buscopan", "Peppermint oil", "Mesalazine", "Sulfasalazine",
  
  // CNS & Mental Health
  "Paracetamol", "Ibuprofen", "Naproxen", "Diclofenac", "Codeine", "Tramadol", "Morphine",
  "Oxycodone", "Fentanyl", "Buprenorphine", "Pregabalin", "Gabapentin", "Amitriptyline",
  "Nortriptyline", "Duloxetine", "Sertraline", "Fluoxetine", "Citalopram", "Escitalopram",
  "Paroxetine", "Venlafaxine", "Mirtazapine", "Trazodone", "Diazepam", "Lorazepam",
  "Zopiclone", "Zolpidem", "Melatonin", "Promethazine", "Carbamazepine", "Sodium valproate",
  "Lamotrigine", "Levetiracetam", "Topiramate", "Phenytoin", "Clonazepam",
  "Aripiprazole", "Olanzapine", "Quetiapine", "Risperidone", "Haloperidol",
  "Lithium", "Donepezil", "Memantine", "Rivastigmine", "Galantamine",
  
  // Thyroid
  "Levothyroxine", "Liothyronine", "Carbimazole", "Propylthiouracil",
  
  // Infections
  "Amoxicillin", "Co-amoxiclav", "Flucloxacillin", "Phenoxymethylpenicillin", "Clarithromycin",
  "Azithromycin", "Erythromycin", "Doxycycline", "Ciprofloxacin", "Levofloxacin", "Moxifloxacin",
  "Trimethoprim", "Nitrofurantoin", "Cefalexin", "Cefuroxime", "Metronidazole", "Clindamycin",
  "Gentamicin", "Vancomycin", "Fluconazole", "Nystatin", "Terbinafine", "Aciclovir", "Valaciclovir",
  
  // Musculoskeletal
  "Allopurinol", "Colchicine", "Febuxostat", "Alendronic acid", "Risedronate", "Ibandronic acid",
  "Denosumab", "Methotrexate", "Sulfasalazine", "Hydroxychloroquine", "Leflunomide",
  "Adalimumab", "Etanercept", "Infliximab", "Golimumab", "Certolizumab", "Tocilizumab",
  "Baricitinib", "Tofacitinib", "Upadacitinib", "Baclofen", "Tizanidine", "Quinine",
  
  // Dermatology
  "Hydrocortisone", "Betamethasone", "Clobetasol", "Mometasone", "Fusidic acid",
  "Mupirocin", "Emollients", "Aqueous cream", "Dermol", "Doublebase", "Epaderm",
  "Calcipotriol", "Tacrolimus", "Pimecrolimus", "Isotretinoin", "Adapalene",
  
  // Eye
  "Latanoprost", "Timolol", "Brimonidine", "Dorzolamide", "Bimatoprost", "Travoprost",
  "Chloramphenicol", "Fusidic acid eye drops", "Hypromellose", "Carbomer",
  
  // Genitourinary
  "Tamsulosin", "Alfuzosin", "Finasteride", "Dutasteride", "Sildenafil", "Tadalafil",
  "Tolterodine", "Solifenacin", "Oxybutynin", "Mirabegron", "Desmopressin",
  
  // Endocrine
  "Hydrocortisone tablets", "Prednisolone", "Dexamethasone", "Fludrocortisone",
  "Testosterone", "Oestradiol", "Progesterone", "Norethisterone",
  
  // Haematology
  "Ferrous fumarate", "Ferrous sulfate", "Folic acid", "Vitamin B12", "Hydroxocobalamin",
  "Vitamin D", "Colecalciferol", "Alfacalcidol", "Calcium carbonate",
  
  // Allergy & Immunology
  "Cetirizine", "Loratadine", "Fexofenadine", "Chlorphenamine", "Adrenaline",
  "Prednisolone", "Dexamethasone", "EpiPen",
  
  // Vaccines & immunoglobulins
  "Influenza vaccine", "Pneumococcal vaccine", "Shingles vaccine",
  
  // Others
  "Alimemazine", "Hydroxyzine", "Sodium chloride", "Potassium chloride",
  "Magnesium", "Thiamine", "Pyridoxine", "Ascorbic acid",
];

interface SearchItem {
  name: string;
  type: 'icb' | 'bnf';
  trafficLightItem?: TLVocabItem;
}

export const BNFFullSearch: React.FC<BNFFullSearchProps> = ({ onDrugSelect }) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const { vocab: icbDrugs, isLoading } = useTrafficLightVocab();

  // Create combined search list
  const searchItems = useMemo(() => {
    const items: SearchItem[] = [];
    
    // Add ICB drugs
    icbDrugs.forEach(drug => {
      items.push({
        name: drug.name,
        type: 'icb',
        trafficLightItem: drug
      });
    });

    // Add BNF drugs that aren't in ICB
    const icbNames = new Set(icbDrugs.map(d => d.name.toLowerCase()));
    COMMON_UK_DRUGS.forEach(drugName => {
      if (!icbNames.has(drugName.toLowerCase())) {
        items.push({
          name: drugName,
          type: 'bnf'
        });
      }
    });

    return items;
  }, [icbDrugs]);

  // Create Fuse instance
  const fuse = useMemo(() => {
    return new Fuse(searchItems, {
      keys: ['name'],
      threshold: 0.3,
      distance: 100,
      minMatchCharLength: 2,
      includeScore: true,
    });
  }, [searchItems]);

  // Search results
  const results = useMemo(() => {
    if (query.length < 2) return [];

    const searchResults = fuse.search(query);

    // Sort by score and prefix match, with ICB results first
    return searchResults
      .map(result => ({
        ...result,
        prefixMatch: result.item.name.toLowerCase().startsWith(query.toLowerCase()),
      }))
      .sort((a, b) => {
        // ICB results first
        if (a.item.type === 'icb' && b.item.type !== 'icb') return -1;
        if (a.item.type !== 'icb' && b.item.type === 'icb') return 1;
        // Then prefix matches
        if (a.prefixMatch && !b.prefixMatch) return -1;
        if (!a.prefixMatch && b.prefixMatch) return 1;
        // Then by score
        return (a.score || 0) - (b.score || 0);
      })
      .slice(0, 15)
      .map(r => r.item);
  }, [query, fuse]);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || results.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % results.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + results.length) % results.length);
        break;
      case 'Enter':
        e.preventDefault();
        if (results[selectedIndex]) {
          handleSelect(results[selectedIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        break;
    }
  };

  const handleSelect = (item: SearchItem) => {
    onDrugSelect(item.name, item.trafficLightItem);
    setQuery('');
    setIsOpen(false);
    setSelectedIndex(0);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        listRef.current &&
        !listRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Reset selected index when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [results]);

  return (
    <div className="relative">
      <div className="relative">
        <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          type="text"
          placeholder="Search all drugs (BNF + ICB)..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(e.target.value.length >= 2);
          }}
          onFocus={() => query.length >= 2 && setIsOpen(true)}
          onKeyDown={handleKeyDown}
          className="pl-10 pr-10"
        />
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground animate-spin" />
        )}
      </div>

      {/* Dropdown results */}
      {isOpen && results.length > 0 && (
        <div
          ref={listRef}
          className={cn(
            "absolute top-full left-0 right-0 mt-1 z-50",
            "bg-popover border rounded-lg shadow-lg",
            "max-h-[300px] overflow-y-auto"
          )}
        >
          {results.map((item, index) => (
            <button
              key={`${item.type}-${item.name}`}
              onClick={() => handleSelect(item)}
              className={cn(
                "w-full flex items-center justify-between px-3 py-2",
                "text-left text-sm",
                "hover:bg-accent transition-colors",
                index === selectedIndex && "bg-accent"
              )}
            >
              <span className="font-medium text-foreground truncate flex-1 mr-2">
                {item.name}
              </span>
              <Badge
                variant="outline"
                className={cn(
                  "text-xs shrink-0",
                  item.type === 'icb'
                    ? "bg-blue-50 text-blue-700 border-blue-200"
                    : "bg-slate-50 text-slate-600 border-slate-200"
                )}
              >
                {item.type === 'icb' ? 'ICB' : 'BNF'}
              </Badge>
            </button>
          ))}
        </div>
      )}

      {/* No results message */}
      {isOpen && query.length >= 2 && results.length === 0 && !isLoading && (
        <div className={cn(
          "absolute top-full left-0 right-0 mt-1 z-50",
          "bg-popover border rounded-lg shadow-lg",
          "px-3 py-4 text-center text-sm text-muted-foreground"
        )}>
          No drugs found matching "{query}" - try the full drug name
        </div>
      )}
    </div>
  );
};
