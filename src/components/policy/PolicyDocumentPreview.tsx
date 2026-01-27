import React from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface PolicyMetadata {
  title: string;
  version: string;
  effective_date: string;
  review_date: string;
  references: string[];
}

interface PracticeDetails {
  practice_name?: string;
  address?: string;
  postcode?: string;
  practice_manager_name?: string;
  lead_gp_name?: string;
}

interface PolicyDocumentPreviewProps {
  content: string;
  metadata: PolicyMetadata;
  practiceDetails?: PracticeDetails;
  practiceLogoUrl?: string | null;
  showLogo?: boolean;
  logoPosition?: 'left' | 'center' | 'right';
  showFooter?: boolean;
  showPageNumbers?: boolean;
}

// Colours matching the Word document
const COLORS = {
  nhsBlue: "#005EB8",
  headingBlue: "#1E3A8A",
  subHeadingBlue: "#2563EB",
  textGrey: "#374151",
  lightGrey: "#6B7280",
  tableBorder: "#D1D5DB",
  tableHeaderBg: "#EFF6FF",
};

const parseMarkdownContent = (content: string): React.ReactNode[] => {
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let listItems: string[] = [];
  let inTable = false;
  let tableLines: string[] = [];
  let keyIndex = 0;

  const flushList = () => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={`list-${keyIndex++}`} className="list-disc list-inside space-y-1 mb-4 ml-4">
          {listItems.map((item, i) => (
            <li key={i} className="text-sm leading-relaxed" style={{ color: COLORS.textGrey }}>
              {formatInlineText(item)}
            </li>
          ))}
        </ul>
      );
      listItems = [];
    }
  };

  const flushTable = () => {
    if (tableLines.length > 0) {
      elements.push(renderTable(tableLines, keyIndex++));
      tableLines = [];
      inTable = false;
    }
  };

  const formatInlineText = (text: string): React.ReactNode => {
    // Handle bold text with **
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i}>{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();

    // Skip empty lines
    if (!trimmedLine) {
      flushList();
      flushTable();
      continue;
    }

    // Skip horizontal rules (---, ***, ___)
    if (/^[-*_]{3,}$/.test(trimmedLine)) {
      flushList();
      flushTable();
      continue;
    }

    // Skip DOCUMENT CONTROL section heading (we render our own table)
    if (trimmedLine === 'DOCUMENT CONTROL' || trimmedLine === '**DOCUMENT CONTROL**') {
      continue;
    }
    
    // Skip duplicate policy title (we render our own in the header)
    // This catches titles like "CONTRACEPTION AND SEXUAL HEALTH SERVICES POLICY" 
    // followed by practice name line
    if (/^[A-Z][A-Z\s&]+POLICY$/.test(trimmedLine) || 
        /^[A-Z][A-Z\s&]+PROCEDURE$/.test(trimmedLine)) {
      continue;
    }
    
    // Skip practice name with ODS code line (e.g. "Oak Lane Medical Practice (ODS: K85999)")
    if (/\(ODS:\s*[A-Z0-9]+\)/.test(trimmedLine)) {
      continue;
    }

    // Handle table lines
    if (trimmedLine.startsWith('|') && trimmedLine.endsWith('|')) {
      flushList();
      inTable = true;
      tableLines.push(trimmedLine);
      continue;
    } else if (inTable) {
      flushTable();
    }

    // Handle headings
    if (trimmedLine.startsWith('### ')) {
      flushList();
      elements.push(
        <h3 
          key={`h3-${keyIndex++}`} 
          className="text-base font-semibold mt-4 mb-2"
          style={{ color: COLORS.subHeadingBlue }}
        >
          {trimmedLine.slice(4)}
        </h3>
      );
      continue;
    }

    if (trimmedLine.startsWith('## ')) {
      flushList();
      elements.push(
        <h2 
          key={`h2-${keyIndex++}`} 
          className="text-lg font-bold mt-5 mb-2"
          style={{ color: COLORS.subHeadingBlue }}
        >
          {trimmedLine.slice(3)}
        </h2>
      );
      continue;
    }

    if (trimmedLine.startsWith('# ')) {
      flushList();
      elements.push(
        <h1 
          key={`h1-${keyIndex++}`} 
          className="text-xl font-bold mt-6 mb-3"
          style={{ color: COLORS.headingBlue }}
        >
          {trimmedLine.slice(2)}
        </h1>
      );
      continue;
    }

    // Handle numbered headings like "1. PURPOSE AND SCOPE"
    const numberedHeadingMatch = trimmedLine.match(/^(\d+)\.\s+([A-Z][A-Z\s]+)$/);
    if (numberedHeadingMatch) {
      flushList();
      elements.push(
        <h2 
          key={`nh-${keyIndex++}`} 
          className="text-lg font-bold mt-5 mb-2"
          style={{ color: COLORS.headingBlue }}
        >
          {trimmedLine}
        </h2>
      );
      continue;
    }

    // Handle sub-numbered headings like "1.1 Purpose"
    const subNumberedMatch = trimmedLine.match(/^(\d+\.\d+)\s+(.+)$/);
    if (subNumberedMatch) {
      flushList();
      elements.push(
        <h3 
          key={`snh-${keyIndex++}`} 
          className="text-base font-semibold mt-3 mb-2"
          style={{ color: COLORS.subHeadingBlue }}
        >
          {trimmedLine}
        </h3>
      );
      continue;
    }

    // Handle bullet points
    if (trimmedLine.startsWith('- ') || trimmedLine.startsWith('• ') || trimmedLine.startsWith('* ')) {
      listItems.push(trimmedLine.slice(2));
      continue;
    }

    // Regular paragraph
    flushList();
    elements.push(
      <p 
        key={`p-${keyIndex++}`} 
        className="text-sm leading-relaxed mb-3"
        style={{ color: COLORS.textGrey }}
      >
        {formatInlineText(trimmedLine)}
      </p>
    );
  }

  flushList();
  flushTable();

  return elements;
};

const formatInlineTextStatic = (text: string): React.ReactNode => {
  // Handle bold text with ** and strip them
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return part;
  });
};

const renderTable = (lines: string[], key: number): React.ReactNode => {
  const rows: string[][] = [];
  let isHeader = true;

  for (const line of lines) {
    // Skip separator lines
    if (/^[\s|:-]+$/.test(line.replace(/\|/g, '').trim()) && line.includes('-')) {
      isHeader = false;
      continue;
    }

    const cells = line.split('|')
      .map(cell => cell.trim())
      .filter(cell => cell.length > 0);

    if (cells.length > 0) {
      rows.push(cells);
    }
  }

  if (rows.length === 0) return null;

  // Check if this is the document control table (skip it - we render our own)
  const allCellsJoined = rows.flat().join(' ').toLowerCase();
  if (allCellsJoined.includes('version') && allCellsJoined.includes('effective date') && 
      (allCellsJoined.includes('review date') || allCellsJoined.includes('author'))) {
    return null;
  }

  return (
    <div key={`table-${key}`} className="my-4 overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            {rows[0]?.map((cell, i) => (
              <th 
                key={i}
                className="border px-3 py-2 text-left font-semibold"
                style={{ 
                  borderColor: COLORS.tableBorder,
                  backgroundColor: COLORS.tableHeaderBg 
                }}
              >
                {formatInlineTextStatic(cell)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.slice(1).map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, cellIndex) => {
                // Check if cell looks like a header (contains bold markers)
                const isHeaderCell = cell.startsWith('**') && cell.endsWith('**');
                return (
                  <td 
                    key={cellIndex}
                    className={`border px-3 py-2 ${isHeaderCell ? 'font-semibold' : ''}`}
                    style={{ 
                      borderColor: COLORS.tableBorder,
                      backgroundColor: isHeaderCell ? COLORS.tableHeaderBg : undefined,
                      color: COLORS.textGrey 
                    }}
                  >
                    {formatInlineTextStatic(cell)}
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

export const PolicyDocumentPreview: React.FC<PolicyDocumentPreviewProps> = ({
  content,
  metadata,
  practiceDetails,
  practiceLogoUrl,
  showLogo = true,
  logoPosition = 'left',
  showFooter = true,
  showPageNumbers = true,
}) => {
  const today = new Date().toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  const logoAlignmentClass = {
    left: 'justify-start',
    center: 'justify-center',
    right: 'justify-end',
  }[logoPosition];

  const parsedContent = parseMarkdownContent(content);

  return (
    <div 
      className="bg-white rounded-lg shadow-sm border"
      style={{ 
        fontFamily: 'Calibri, sans-serif',
        padding: '40px',
        maxWidth: '210mm', // A4 width approximation
        margin: '0 auto',
      }}
    >
      {/* Header with Logo */}
      {showLogo && practiceLogoUrl && (
        <div className={cn("flex mb-6", logoAlignmentClass)}>
          <img 
            src={practiceLogoUrl} 
            alt="Practice Logo" 
            className="max-h-16 object-contain"
          />
        </div>
      )}

      {/* Policy Title */}
      <h1 
        className="text-center font-bold mb-6"
        style={{ 
          fontSize: '24px',
          color: COLORS.nhsBlue,
        }}
      >
        {metadata.title}
      </h1>

      {/* Document Control Table */}
      <div className="mb-6">
        <table className="w-full border-collapse text-sm">
          <tbody>
            {/* Practice Name Row - spans full width */}
            <tr>
              <td 
                className="border px-3 py-2 font-semibold w-1/5"
                style={{ 
                  borderColor: COLORS.tableBorder,
                  backgroundColor: COLORS.tableHeaderBg 
                }}
              >
                Practice
              </td>
              <td 
                className="border px-3 py-2"
                colSpan={3}
                style={{ 
                  borderColor: COLORS.tableBorder,
                  color: COLORS.textGrey 
                }}
              >
                {[practiceDetails?.practice_name, practiceDetails?.address, practiceDetails?.postcode]
                  .filter(Boolean)
                  .join(', ') || '[Practice Name, Address, Postcode]'}
              </td>
            </tr>
            <tr>
              <td 
                className="border px-3 py-2 font-semibold w-1/5"
                style={{ 
                  borderColor: COLORS.tableBorder,
                  backgroundColor: COLORS.tableHeaderBg 
                }}
              >
                Version
              </td>
              <td 
                className="border px-3 py-2 w-[30%]"
                style={{ 
                  borderColor: COLORS.tableBorder,
                  color: COLORS.textGrey 
                }}
              >
                {metadata.version}
              </td>
              <td 
                className="border px-3 py-2 font-semibold w-1/5"
                style={{ 
                  borderColor: COLORS.tableBorder,
                  backgroundColor: COLORS.tableHeaderBg 
                }}
              >
                Effective Date
              </td>
              <td 
                className="border px-3 py-2 w-[30%]"
                style={{ 
                  borderColor: COLORS.tableBorder,
                  color: COLORS.textGrey 
                }}
              >
                {metadata.effective_date}
              </td>
            </tr>
            <tr>
              <td 
                className="border px-3 py-2 font-semibold"
                style={{ 
                  borderColor: COLORS.tableBorder,
                  backgroundColor: COLORS.tableHeaderBg 
                }}
              >
                Review Date
              </td>
              <td 
                className="border px-3 py-2"
                style={{ 
                  borderColor: COLORS.tableBorder,
                  color: COLORS.textGrey 
                }}
              >
                {metadata.review_date}
              </td>
              <td 
                className="border px-3 py-2 font-semibold"
                style={{ 
                  borderColor: COLORS.tableBorder,
                  backgroundColor: COLORS.tableHeaderBg 
                }}
              >
                Generated
              </td>
              <td 
                className="border px-3 py-2"
                style={{ 
                  borderColor: COLORS.tableBorder,
                  color: COLORS.textGrey 
                }}
              >
                {today}
              </td>
            </tr>
            <tr>
              <td 
                className="border px-3 py-2 font-semibold"
                style={{ 
                  borderColor: COLORS.tableBorder,
                  backgroundColor: COLORS.tableHeaderBg 
                }}
              >
                Author
              </td>
              <td 
                className="border px-3 py-2"
                style={{ 
                  borderColor: COLORS.tableBorder,
                  color: COLORS.textGrey 
                }}
              >
                {practiceDetails?.practice_manager_name || '[Practice Manager]'}
              </td>
              <td 
                className="border px-3 py-2 font-semibold"
                style={{ 
                  borderColor: COLORS.tableBorder,
                  backgroundColor: COLORS.tableHeaderBg 
                }}
              >
                Approved By
              </td>
              <td 
                className="border px-3 py-2"
                style={{ 
                  borderColor: COLORS.tableBorder,
                  color: COLORS.textGrey 
                }}
              >
                {practiceDetails?.lead_gp_name || '[Lead GP]'}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Policy Content */}
      <div className="mb-8">
        {parsedContent}
      </div>

      {/* References Section */}
      {metadata.references && metadata.references.length > 0 && (
        <div className="mt-8 pt-4 border-t" style={{ borderColor: COLORS.tableBorder }}>
          <h2 
            className="text-lg font-bold mb-3"
            style={{ color: COLORS.headingBlue }}
          >
            References & Legislation
          </h2>
          <ul className="list-disc list-inside space-y-1 ml-4">
            {metadata.references.map((ref, index) => (
              <li 
                key={index} 
                className="text-sm"
                style={{ color: COLORS.textGrey }}
              >
                {ref}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Footer */}
      {(showFooter || showPageNumbers) && (
        <div 
          className="mt-8 pt-4 border-t flex items-center justify-between text-xs"
          style={{ 
            borderColor: COLORS.tableBorder,
            color: COLORS.lightGrey,
          }}
        >
          <div></div>
          {showFooter && practiceDetails?.practice_name && (
            <div className="text-center">
              {[
                practiceDetails.practice_name,
                practiceDetails.address,
                practiceDetails.postcode
              ].filter(Boolean).join(' • ')}
            </div>
          )}
          {showPageNumbers && (
            <div className="text-right">
              Page 1 of 1
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PolicyDocumentPreview;
