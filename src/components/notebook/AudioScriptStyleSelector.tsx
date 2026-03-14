import { Briefcase, GraduationCap, ClipboardList, Radio, FileCode, HeartPulse } from "lucide-react";
import { Card } from "@/components/ui/card";

export type ScriptStyle = 
  | 'discussion'
  | 'executive' 
  | 'training' 
  | 'meeting' 
  | 'podcast' 
  | 'technical' 
  | 'patient';

interface ScriptStyleOption {
  id: ScriptStyle;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  characteristics: string[];
}

const SCRIPT_STYLES: ScriptStyleOption[] = [
  {
    id: 'discussion',
    name: 'Two-Host Discussion',
    icon: Radio,
    description: 'NotebookLM-style conversation between two hosts',
    characteristics: ['Two voices', 'Natural dialogue', 'Engaging Q&A flow']
  },
  {
    id: 'executive',
    name: 'Executive Summary',
    icon: Briefcase,
    description: 'High-level strategic overview',
    characteristics: ['Strategic focus', 'Key decisions', 'Leadership tone']
  },
  {
    id: 'training',
    name: 'Training Material',
    icon: GraduationCap,
    description: 'Educational, step-by-step explanations',
    characteristics: ['Clear explanations', 'Examples', 'Instructive tone']
  },
  {
    id: 'meeting',
    name: 'Meeting Notes',
    icon: ClipboardList,
    description: 'Key points, actions, decisions',
    characteristics: ['Concise points', 'Action items', 'Factual tone']
  },
  {
    id: 'podcast',
    name: 'Podcast Style',
    icon: Radio,
    description: 'Conversational, engaging narrative',
    characteristics: ['Conversational', 'Storytelling', 'Engaging flow']
  },
  {
    id: 'technical',
    name: 'Technical Briefing',
    icon: FileCode,
    description: 'Detailed, precise, methodical',
    characteristics: ['Precise terminology', 'Technical detail', 'Professional tone']
  },
  {
    id: 'patient',
    name: 'Patient Information',
    icon: HeartPulse,
    description: 'Clear, empathetic, accessible language',
    characteristics: ['Jargon-free', 'Empathetic', 'Easy to understand']
  }
];

interface AudioScriptStyleSelectorProps {
  selectedStyle: ScriptStyle;
  onStyleSelect: (style: ScriptStyle) => void;
}

export function AudioScriptStyleSelector({ selectedStyle, onStyleSelect }: AudioScriptStyleSelectorProps) {
  return (
    <div className="space-y-3">
      <label className="text-sm font-medium">Script Style</label>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {SCRIPT_STYLES.map((style) => {
          const Icon = style.icon;
          const isSelected = selectedStyle === style.id;
          
          return (
            <Card
              key={style.id}
              className={`p-4 cursor-pointer transition-all hover:shadow-md ${
                isSelected 
                  ? 'border-primary bg-primary/5 shadow-md' 
                  : 'border-border hover:border-primary/50'
              }`}
              onClick={() => onStyleSelect(style.id)}
            >
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-lg ${
                  isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted'
                }`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-sm mb-1">{style.name}</h4>
                  <p className="text-xs text-muted-foreground mb-2">{style.description}</p>
                  <div className="flex flex-wrap gap-1">
                    {style.characteristics.map((char) => (
                      <span 
                        key={char}
                        className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground"
                      >
                        {char}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
