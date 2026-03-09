/**
 * Client-side validation for AI document analysis responses.
 * Detects when Gemini fails to read a document or potentially hallucinates.
 */

const FAILURE_PHRASES = [
  "unable to read",
  "cannot access the content",
  "no text visible",
  "cannot see any content",
  "document appears to be empty",
  "i was unable to read this document",
  "i was unable to read the content",
];

const GENERIC_NHS_PHRASES = [
  "greenhouse gas",
  "duty of candour",
  "agenda for change",
  "one-third of the total membership",
];

export interface DocumentValidationResult {
  isValid: boolean;
  couldNotRead: boolean;
  possibleHallucination: boolean;
  warningPrefix?: string;
  errorMessage?: string;
}

export function validateDocumentResponse(response: string, hasUploadedFiles: boolean): DocumentValidationResult {
  if (!hasUploadedFiles) {
    return { isValid: true, couldNotRead: false, possibleHallucination: false };
  }

  const lowerResponse = response.toLowerCase();

  // Check if Gemini admitted it couldn't read the document
  const couldNotRead = FAILURE_PHRASES.some(phrase => lowerResponse.includes(phrase));

  if (couldNotRead) {
    return {
      isValid: false,
      couldNotRead: true,
      possibleHallucination: false,
      errorMessage:
        "Document reading failed. This can happen with some PDF formats. Try one of these:\n\n" +
        "1. Re-upload the same file\n" +
        "2. Open the PDF in your browser and use 'Print to PDF' to create a new copy\n" +
        "3. Save the document as a Word file (.docx) and upload that instead",
    };
  }

  // Check for suspiciously generic responses
  const genericCount = GENERIC_NHS_PHRASES.filter(phrase => lowerResponse.includes(phrase)).length;

  if (genericCount >= 2) {
    console.warn("POSSIBLE HALLUCINATION DETECTED - response contains multiple generic NHS phrases");
    return {
      isValid: true,
      couldNotRead: false,
      possibleHallucination: true,
      warningPrefix:
        "⚠️ Note: This response may contain general NHS information rather than " +
        "details from your specific document. If the summary doesn't match your document, " +
        "please try re-uploading the file.\n\n",
    };
  }

  return { isValid: true, couldNotRead: false, possibleHallucination: false };
}
