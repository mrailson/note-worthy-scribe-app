import React from 'react';
import { Card } from '@/components/ui/card';
import { useIsIPhone, useIsMobile } from '@/hooks/use-mobile';

interface TableRow {
  [key: string]: string;
}

interface MobileResponsiveTableProps {
  headers: string[];
  rows: TableRow[];
  className?: string;
}

export const MobileResponsiveTable: React.FC<MobileResponsiveTableProps> = ({
  headers,
  rows,
  className = ''
}) => {
  const isIPhone = useIsIPhone();
  const isMobile = useIsMobile();

  // Mobile card-based layout for iPhone
  if (isIPhone) {
    return (
      <div className={`space-y-3 ${className}`}>
        {rows.map((row, rowIndex) => {
          return (
            <Card key={rowIndex} className="p-4 shadow-sm border-border">
              {/* Table content */}
              <div className="space-y-2.5">
                {headers.map((header, headerIndex) => {
                  const cellValue = Object.values(row)[headerIndex];
                  
                  // Skip priority column
                  if (header.toLowerCase().includes('priority')) {
                    return null;
                  }

                  return (
                    <div key={headerIndex}>
                      <div className="text-xs font-semibold text-primary mb-1">
                        {header}
                      </div>
                      <div className="text-sm text-foreground leading-relaxed">
                        {cellValue}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          );
        })}
      </div>
    );
  }

  // Standard table for desktop/tablet with horizontal scroll
  return (
    <div className="overflow-x-auto my-4 shadow-sm rounded-lg relative">
      {/* Scroll indicator shadows */}
      <div className="absolute inset-y-0 left-0 w-4 bg-gradient-to-r from-background to-transparent pointer-events-none z-10" />
      <div className="absolute inset-y-0 right-0 w-4 bg-gradient-to-l from-background to-transparent pointer-events-none z-10" />
      
      <table className={`w-full border-collapse border border-border ${className}`}>
        <thead>
          <tr>
            {headers.map((header, index) => (
              <th
                key={index}
                className="border border-border px-4 py-3 bg-primary text-primary-foreground font-semibold text-left text-sm whitespace-nowrap"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr
              key={rowIndex}
              className={`${
                rowIndex % 2 === 0 ? 'bg-card' : 'bg-muted/30'
              } hover:bg-muted/50 transition-colors`}
            >
              {Object.entries(row).map(([key, value], cellIndex) => {
                const header = headers[cellIndex];
                
                // Skip priority column
                if (header?.toLowerCase().includes('priority')) {
                  return null;
                }

                return (
                  <td
                    key={cellIndex}
                    className="border border-border px-4 py-3 text-sm text-card-foreground leading-relaxed"
                  >
                    {value}
                  </td>
                );

                return (
                  <td
                    key={cellIndex}
                    className="border border-border px-4 py-3 text-sm text-card-foreground leading-relaxed"
                  >
                    {value}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

function renderPriorityBadge(priority: string): React.ReactElement {
  const priorityLower = priority.toLowerCase();
  
  if (priorityLower.includes('high')) {
    return (
      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-destructive text-destructive-foreground">
        🔴 High
      </span>
    );
  } else if (priorityLower.includes('medium')) {
    return (
      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-warning text-warning-foreground">
        🟡 Medium
      </span>
    );
  } else if (priorityLower.includes('low')) {
    return (
      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-success text-success-foreground">
        🟢 Low
      </span>
    );
  }
  
  return <span className="text-sm">{priority}</span>;
}
