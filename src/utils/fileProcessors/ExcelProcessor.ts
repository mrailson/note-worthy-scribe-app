import * as XLSX from 'xlsx-js-style';

export class ExcelProcessor {
  static async extractText(file: File): Promise<string> {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      
      let extractedContent = `EXCEL SPREADSHEET CONTENT FROM: ${file.name}\n\n`;
      
      workbook.SheetNames.forEach((sheetName, index) => {
        const sheet = workbook.Sheets[sheetName];
        const csvData = XLSX.utils.sheet_to_csv(sheet);
        
        if (csvData && csvData.trim().length > 0) {
          extractedContent += `=== Sheet ${index + 1}: ${sheetName} ===\n`;
          extractedContent += csvData;
          extractedContent += '\n\n';
        }
      });
      
      extractedContent += '[Extracted using SheetJS Excel processor]';
      
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