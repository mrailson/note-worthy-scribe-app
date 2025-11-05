import DOMPurify from 'dompurify';
import { renderMinutesMarkdown } from './minutesRenderer';

/**
 * NO ACTIONS FORMAT
 * Removes all action items tables and action-related sections from the minutes
 */
export function renderMinutesNoActions(content: string, baseFontSize: number = 13): string {
  if (!content) return '';
  
  // Remove action items tables (markdown and already rendered HTML)
  let noActionsContent = content
    // Remove markdown action tables
    .replace(/#{1,6}\s*ACTION ITEMS[\s\S]*?(?=\n#{1,6}\s|\n\n|$)/gi, '')
    .replace(/#{1,6}\s*Actions[\s\S]*?(?=\n#{1,6}\s|\n\n|$)/gi, '')
    // Remove HTML action tables if already rendered
    .replace(/<h[1-6][^>]*>ACTION ITEMS<\/h[1-6]>[\s\S]*?(?=<h[1-6]|$)/gi, '')
    .replace(/<div class="overflow-x-auto[^"]*">[\s\S]*?Priority[\s\S]*?<\/div>/gi, '')
    // Clean up multiple line breaks
    .replace(/\n{3,}/g, '\n\n');
  
  return renderMinutesMarkdown(noActionsContent, baseFontSize);
}

/**
 * BLACK & WHITE FORMAT
 * Removes all NHS blue colours and styling for print-optimised output
 */
export function renderMinutesBlackWhite(content: string, baseFontSize: number = 13): string {
  if (!content) return '';
  
  // First render with standard formatter
  let html = renderMinutesMarkdown(content, baseFontSize);
  
  // Replace all NHS blue colours with black/grey
  html = html
    .replace(/text-\[#005EB8\]/g, 'text-black')
    .replace(/bg-\[#005EB8\]/g, 'bg-gray-700')
    .replace(/border-\[#005EB8\]/g, 'border-gray-700')
    .replace(/border-l-\[3px\]\s+border-\[#005EB8\]/g, 'border-l-[3px] border-gray-400')
    .replace(/text-\[#768692\]/g, 'text-gray-600')
    .replace(/text-\[#212B32\]/g, 'text-black')
    .replace(/text-\[#425563\]/g, 'text-gray-700')
    .replace(/bg-\[#F0F4F5\]/g, 'bg-gray-100')
    .replace(/bg-\[#E8EDEE\]/g, 'bg-gray-50')
    .replace(/border-\[#768692\]/g, 'border-gray-400')
    // Remove priority badges colours
    .replace(/bg-\[#DA291C\]/g, 'bg-black')
    .replace(/bg-\[#FFB81C\]/g, 'bg-gray-500')
    .replace(/bg-\[#007F3B\]/g, 'bg-gray-600')
    // Remove gradient backgrounds
    .replace(/bg-gradient-to-r from-\[#F0F4F5\] to-white/g, 'bg-white');
  
  // Add print-optimised styling
  html = html.replace(
    '<style>',
    `<style>
      @media print {
        .minutes-content * {
          color: black !important;
          background-color: white !important;
          border-color: #666 !important;
        }
        .minutes-content table th {
          background-color: #e0e0e0 !important;
          color: black !important;
        }
        .minutes-content table tr:nth-child(even) {
          background-color: #f5f5f5 !important;
        }
      }
    `
  );
  
  return html;
}

/**
 * CONCISE FORMAT
 * Condenses content by ~40% - removes verbose explanations, keeps key points
 */
export function renderMinutesConcise(content: string, baseFontSize: number = 13): string {
  if (!content) return '';
  
  let conciseContent = content
    // Remove meeting details section (keep only title)
    .replace(/#{1,6}\s*MEETING DETAILS[\s\S]*?(?=\n#{1,6}\s|\n\n)/gi, '')
    // Condense bullet points - remove explanatory sub-bullets
    .replace(/^([-•]\s+.+)\n\s+([-•]\s+.+\n\s+)+/gm, '$1\n')
    // Remove parenthetical explanations
    .replace(/\s*\([^)]{20,}\)/g, '')
    // Remove "Background" and similar context sections
    .replace(/\*\*Background:\*\*[^\n]+\n?/gi, '')
    // Simplify nested lists to single level
    .replace(/^(\s{2,})([-•])/gm, '$2')
    // Remove redundant phrases
    .replace(/It was (noted|agreed|discussed) that /gi, '')
    .replace(/The team (discussed|reviewed|considered) /gi, '')
    // Clean up
    .replace(/\n{3,}/g, '\n\n');
  
  return renderMinutesMarkdown(conciseContent, baseFontSize);
}

/**
 * DETAILED FORMAT
 * Expands content with more context and explanatory notes
 * Note: This would ideally use AI to expand, but for now adds structural enhancements
 */
export function renderMinutesDetailed(content: string, baseFontSize: number = 13): string {
  if (!content) return '';
  
  // Add more context markers and expand structure
  let detailedContent = content
    // Enhance section headers with context
    .replace(/^(#{1,6}\s+)([A-Z].+)$/gm, '$1$2\n\n**Context:** This section details $2.')
    // Add background notes to decisions
    .replace(/(\*\*Decision:\*\*)/gi, '\n**Background & Rationale:**\nThe following decision was made after careful consideration of all available information.\n\n$1')
    // Expand action items with detail prompts
    .replace(/(\|.*?\|.*?\|.*?\|)/g, '$1');
  
  return renderMinutesMarkdown(detailedContent, baseFontSize);
}

/**
 * EXECUTIVE BRIEF FORMAT
 * Ultra-compact, top 5-7 key points, action items summary, one-page target
 */
export function renderMinutesExecutiveBrief(content: string, baseFontSize: number = 13): string {
  if (!content) return '';
  
  // Extract key components
  const titleMatch = content.match(/^#\s+(.+)/m);
  const title = titleMatch ? titleMatch[1] : 'Meeting Summary';
  
  // Extract key points
  const keyPointsMatch = content.match(/#{1,6}\s*KEY (POINTS|DISCUSSION)[\s\S]*?(?=\n#{1,6}\s|\n\n|$)/i);
  const keyPointsSection = keyPointsMatch ? keyPointsMatch[0] : '';
  
  // Extract decisions
  const decisionsMatch = content.match(/#{1,6}\s*DECISIONS[\s\S]*?(?=\n#{1,6}\s|\n\n|$)/i);
  const decisionsSection = decisionsMatch ? decisionsMatch[0] : '';
  
  // Extract actions
  const actionsMatch = content.match(/#{1,6}\s*ACTION ITEMS[\s\S]*?(?=\n#{1,6}\s|$)/i);
  const actionsSection = actionsMatch ? actionsMatch[0] : '';
  
  // Create executive brief
  const executiveBrief = `
# Executive Brief: ${title}

## Key Highlights
${extractTopPoints(keyPointsSection, 5)}

## Major Decisions
${extractTopPoints(decisionsSection, 3)}

## Action Items Summary
${extractActionsSummary(actionsSection)}

---
*This is a condensed executive summary. Full minutes contain additional detail.*
`;
  
  return renderMinutesMarkdown(executiveBrief, baseFontSize);
}

// Helper function to extract top N points from a section
function extractTopPoints(section: string, count: number): string {
  if (!section) return '- No key points recorded\n';
  
  const points = section.match(/^[-•]\s+(.+)$/gm) || [];
  const topPoints = points.slice(0, count);
  
  if (topPoints.length === 0) {
    // Try to extract from numbered lists
    const numberedPoints = section.match(/^\d+[\.)]\s+(.+)$/gm) || [];
    return numberedPoints.slice(0, count).map((p, i) => `${i + 1}. ${p.replace(/^\d+[\.)]\s+/, '')}`).join('\n') || '- No key points recorded\n';
  }
  
  return topPoints.join('\n');
}

// Helper function to extract actions summary
function extractActionsSummary(actionsSection: string): string {
  if (!actionsSection) return '- No actions assigned\n';
  
  // Try to extract from table format
  const tableMatch = actionsSection.match(/\|(.+?)\|/g);
  if (tableMatch && tableMatch.length > 2) {
    const rows = tableMatch.slice(2); // Skip header rows
    const summary = rows.slice(0, 5).map((row, i) => {
      const cells = row.split('|').map(c => c.trim()).filter(c => c);
      if (cells.length >= 2) {
        return `${i + 1}. ${cells[0]} - ${cells[1]}`;
      }
      return '';
    }).filter(s => s).join('\n');
    
    return summary || '- No actions assigned\n';
  }
  
  // Fallback to bullet points
  const bullets = actionsSection.match(/^[-•]\s+(.+)$/gm) || [];
  return bullets.slice(0, 5).join('\n') || '- No actions assigned\n';
}
