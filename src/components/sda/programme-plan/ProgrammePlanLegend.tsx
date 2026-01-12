import React from "react";

export const ProgrammePlanLegend: React.FC = () => {
  return (
    <div className="flex flex-wrap gap-4 text-xs">
      <div className="flex items-center gap-2">
        <div className="w-4 h-3 rounded-sm bg-[#4EA72E]" />
        <span className="text-muted-foreground">Completed (100%)</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-4 h-3 rounded-sm bg-[#7B7BC7]" />
        <span className="text-muted-foreground">In Progress</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-4 h-3 rounded-sm bg-[#BDD7EE]" />
        <span className="text-muted-foreground">Not Started</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-0.5 h-4 bg-[#AD3815]" />
        <span className="text-muted-foreground">Today</span>
      </div>
    </div>
  );
};
