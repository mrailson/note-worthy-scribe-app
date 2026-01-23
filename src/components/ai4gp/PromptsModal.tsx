import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Stethoscope, Briefcase, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { gpCategories, MainCategory as GPMainCategory, SubCategory as GPSubCategory, PromptItem as GPPromptItem } from './gpPromptCategories';
import { mainCategories as pmCategories, MainCategory as PMMainCategory, SubCategory as PMSubCategory, PromptItem as PMPromptItem } from './pmPromptCategories';
import Fuse from 'fuse.js';

interface PromptsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  setInput: (text: string) => void;
  defaultTab?: 'gp' | 'pm';
}

type PromptItem = GPPromptItem | PMPromptItem;
type SubCategory = GPSubCategory | PMSubCategory;
type MainCategory = GPMainCategory | PMMainCategory;

interface FlattenedPrompt {
  id: string;
  title: string;
  shortTitle: string;
  description: string;
  prompt: string;
  categoryTitle: string;
  subCategoryTitle: string;
  type: 'gp' | 'pm';
}

function flattenPrompts(categories: MainCategory[], type: 'gp' | 'pm'): FlattenedPrompt[] {
  const flattened: FlattenedPrompt[] = [];
  
  for (const category of categories) {
    for (const subCategory of category.subCategories) {
      for (const prompt of subCategory.prompts) {
        flattened.push({
          id: prompt.id,
          title: prompt.title,
          shortTitle: prompt.shortTitle,
          description: prompt.description,
          prompt: prompt.prompt,
          categoryTitle: category.title,
          subCategoryTitle: subCategory.title,
          type
        });
      }
    }
  }
  
  return flattened;
}

export const PromptsModal: React.FC<PromptsModalProps> = ({
  open,
  onOpenChange,
  setInput,
  defaultTab = 'gp'
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'gp' | 'pm'>(defaultTab);
  
  // Flatten all prompts for search
  const allGPPrompts = useMemo(() => flattenPrompts(gpCategories, 'gp'), []);
  const allPMPrompts = useMemo(() => flattenPrompts(pmCategories, 'pm'), []);
  
  // Create Fuse instances for fuzzy search
  const gpFuse = useMemo(() => new Fuse(allGPPrompts, {
    keys: ['title', 'shortTitle', 'description', 'categoryTitle', 'subCategoryTitle'],
    threshold: 0.4,
    includeScore: true
  }), [allGPPrompts]);
  
  const pmFuse = useMemo(() => new Fuse(allPMPrompts, {
    keys: ['title', 'shortTitle', 'description', 'categoryTitle', 'subCategoryTitle'],
    threshold: 0.4,
    includeScore: true
  }), [allPMPrompts]);
  
  // Get filtered results based on search
  const filteredGPPrompts = useMemo(() => {
    if (!searchQuery.trim()) return null;
    return gpFuse.search(searchQuery).map(result => result.item);
  }, [searchQuery, gpFuse]);
  
  const filteredPMPrompts = useMemo(() => {
    if (!searchQuery.trim()) return null;
    return pmFuse.search(searchQuery).map(result => result.item);
  }, [searchQuery, pmFuse]);
  
  const handlePromptClick = (prompt: string) => {
    setInput(prompt);
    onOpenChange(false);
    setSearchQuery('');
  };
  
  const renderSearchResults = (results: FlattenedPrompt[]) => {
    if (results.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          No prompts found matching your search
        </div>
      );
    }
    
    return (
      <div className="space-y-2">
        {results.map((prompt) => (
          <button
            key={prompt.id}
            onClick={() => handlePromptClick(prompt.prompt)}
            className={cn(
              "w-full text-left p-3 rounded-lg border border-border",
              "hover:bg-accent hover:border-primary/30 transition-colors",
              "group"
            )}
          >
            <div className="flex items-start gap-2">
              <ChevronRight className="w-4 h-4 mt-0.5 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
              <div className="min-w-0">
                <div className="font-medium text-sm group-hover:text-primary transition-colors">
                  {prompt.title}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {prompt.categoryTitle} → {prompt.subCategoryTitle}
                </div>
                <div className="text-xs text-muted-foreground/70 mt-1 line-clamp-2">
                  {prompt.description}
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>
    );
  };
  
  const renderCategoryAccordion = (categories: MainCategory[]) => {
    return (
      <Accordion type="multiple" className="space-y-2">
        {categories.map((category) => (
          <AccordionItem 
            key={category.id} 
            value={category.id}
            className="border rounded-lg px-3"
          >
            <AccordionTrigger className="hover:no-underline py-3">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "p-1.5 rounded-md bg-gradient-to-br",
                  category.gradient
                )}>
                  <category.icon className="w-4 h-4 text-white" />
                </div>
                <div className="text-left">
                  <div className="font-medium text-sm">{category.title}</div>
                  <div className="text-xs text-muted-foreground">{category.description}</div>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-3">
              <Accordion type="multiple" className="space-y-1 ml-2">
                {category.subCategories.map((subCategory) => (
                  <AccordionItem 
                    key={subCategory.id} 
                    value={subCategory.id}
                    className="border-l-2 border-muted pl-3"
                  >
                    <AccordionTrigger className="hover:no-underline py-2">
                      <div className="flex items-center gap-2">
                        <subCategory.icon className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-sm">{subCategory.title}</span>
                        <span className="text-xs text-muted-foreground ml-1">
                          ({subCategory.prompts.length})
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pb-2">
                      <div className="space-y-1 ml-2">
                        {subCategory.prompts.map((prompt) => (
                          <button
                            key={prompt.id}
                            onClick={() => handlePromptClick(prompt.prompt)}
                            className={cn(
                              "w-full text-left px-3 py-2 rounded-md text-sm",
                              "hover:bg-accent hover:text-primary transition-colors",
                              "flex items-center gap-2 group"
                            )}
                          >
                            <ChevronRight className="w-3 h-3 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
                            <span className="truncate">{prompt.title}</span>
                          </button>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    );
  };
  
  const gpPromptCount = allGPPrompts.length;
  const pmPromptCount = allPMPrompts.length;
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b flex-shrink-0">
          <DialogTitle>Browse All Prompts</DialogTitle>
        </DialogHeader>
        
        <div className="px-6 py-3 border-b flex-shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search prompts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
        
        <Tabs 
          value={activeTab} 
          onValueChange={(v) => setActiveTab(v as 'gp' | 'pm')}
          className="flex-1 flex flex-col min-h-0"
        >
          <TabsList className="mx-6 mt-3 grid w-auto grid-cols-2 flex-shrink-0">
            <TabsTrigger value="gp" className="gap-2">
              <Stethoscope className="w-4 h-4" />
              <span>GP Clinical</span>
              <span className="text-xs text-muted-foreground">({gpPromptCount})</span>
            </TabsTrigger>
            <TabsTrigger value="pm" className="gap-2">
              <Briefcase className="w-4 h-4" />
              <span>Practice Manager</span>
              <span className="text-xs text-muted-foreground">({pmPromptCount})</span>
            </TabsTrigger>
          </TabsList>
          
          <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4">
            <TabsContent value="gp" className="mt-0 data-[state=inactive]:hidden">
              {filteredGPPrompts !== null ? (
                renderSearchResults(filteredGPPrompts)
              ) : (
                renderCategoryAccordion(gpCategories)
              )}
            </TabsContent>
            
            <TabsContent value="pm" className="mt-0 data-[state=inactive]:hidden">
              {filteredPMPrompts !== null ? (
                renderSearchResults(filteredPMPrompts)
              ) : (
                renderCategoryAccordion(pmCategories)
              )}
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
