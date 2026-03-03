import * as XLSX from 'xlsx-js-style';

export class ExcelProcessor {
  static async extractText(file: File): Promise<string> {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      
      let extractedContent = `EXCEL SPREADSHEET DATA FROM: ${file.name}\n\n`;
      
      workbook.SheetNames.forEach((sheetName, index) => {
        const sheet = workbook.Sheets[sheetName];
        const jsonData: string[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
        
        if (!jsonData || jsonData.length === 0) return;
        
        // Filter out completely empty rows
        const rows = jsonData.filter(row => row.some(cell => String(cell).trim() !== ''));
        if (rows.length === 0) return;
        
        extractedContent += `=== Sheet ${index + 1}: ${sheetName} ===\n\n`;
        
        // First row as headers
        const headers = rows[0].map(cell => String(cell).trim());
        const dataRows = rows.slice(1);
        
        // Calculate column widths for alignment
        const colWidths = headers.map((h, colIdx) => {
          const values = [h, ...dataRows.map(r => String(r[colIdx] ?? '').trim())];
          return Math.max(...values.map(v => v.length), 3);
        });
        
        // Build Markdown table
        const headerLine = '| ' + headers.map((h, i) => h.padEnd(colWidths[i])).join(' | ') + ' |';
        const separatorLine = '| ' + colWidths.map(w => '-'.repeat(w)).join(' | ') + ' |';
        
        extractedContent += headerLine + '\n';
        extractedContent += separatorLine + '\n';
        
        dataRows.forEach(row => {
          const cells = headers.map((_, i) => String(row[i] ?? '').trim().padEnd(colWidths[i]));
          extractedContent += '| ' + cells.join(' | ') + ' |\n';
        });
        
        extractedContent += `\nSummary: ${headers.length} columns, ${dataRows.length} rows of data\n\n`;
      });
      
      extractedContent += '[Extracted using SheetJS Excel processor — Markdown table format]';
      
      if (extractedContent.length < 100) {
        throw new Error('No meaningful content extracted from Excel file');
      }
      
      return extractedContent;
    } catch (error) {
      console.error('Excel processing error:', error);
      throw new Error(`Failed to process Excel file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
