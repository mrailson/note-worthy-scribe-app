import jsPDF from 'jspdf';

export interface CertificateData {
  candidateName: string;
  gmcNumber: string;
  certificateNumber: string;
  completionDate: Date;
}

export const generateCSOCertificatePDF = (data: CertificateData): Blob => {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });

  // A4 landscape dimensions: 297mm x 210mm
  const pageWidth = 297;
  const pageHeight = 210;
  
  // Colours
  const primaryColor: [number, number, number] = [41, 98, 255]; // NHS Blue
  const textColor: [number, number, number] = [51, 51, 51];
  const accentColor: [number, number, number] = [0, 136, 206];

  // Add border
  doc.setDrawColor(...accentColor);
  doc.setLineWidth(2);
  doc.rect(10, 10, pageWidth - 20, pageHeight - 20);
  
  doc.setLineWidth(0.5);
  doc.rect(12, 12, pageWidth - 24, pageHeight - 24);

  // Header - PCN Services Limited
  doc.setFontSize(24);
  doc.setTextColor(...primaryColor);
  doc.setFont('helvetica', 'bold');
  doc.text('PCN Services Limited', pageWidth / 2, 30, { align: 'center' });

  // Certificate title
  doc.setFontSize(32);
  doc.setTextColor(...textColor);
  doc.text('Certificate of Completion', pageWidth / 2, 50, { align: 'center' });

  // Subtitle
  doc.setFontSize(18);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...accentColor);
  doc.text('Clinical Safety Officer Level 1 Training', pageWidth / 2, 62, { align: 'center' });

  // Horizontal line
  doc.setDrawColor(...accentColor);
  doc.setLineWidth(0.5);
  doc.line(50, 68, pageWidth - 50, 68);

  // "This is to certify that"
  doc.setFontSize(14);
  doc.setTextColor(...textColor);
  doc.setFont('helvetica', 'normal');
  doc.text('This is to certify that', pageWidth / 2, 82, { align: 'center' });

  // Candidate name (large and bold)
  doc.setFontSize(28);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...primaryColor);
  doc.text(data.candidateName, pageWidth / 2, 95, { align: 'center' });

  // GMC Number
  doc.setFontSize(14);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...textColor);
  doc.text(`GMC Number: ${data.gmcNumber}`, pageWidth / 2, 105, { align: 'center' });

  // Achievement text
  doc.setFontSize(12);
  const achievementText = 'Has successfully completed the Clinical Safety Officer Level 1 Training Programme';
  doc.text(achievementText, pageWidth / 2, 118, { align: 'center', maxWidth: 220 });

  // Certificate number and date
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(`Certificate Number: ${data.certificateNumber}`, pageWidth / 2, 135, { align: 'center' });
  
  const formattedDate = data.completionDate.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
  doc.text(`Date of Completion: ${formattedDate}`, pageWidth / 2, 143, { align: 'center' });

  // No expiry text
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(...accentColor);
  doc.text('This certificate does not expire', pageWidth / 2, 153, { align: 'center' });

  // Horizontal line
  doc.setDrawColor(...accentColor);
  doc.setLineWidth(0.5);
  doc.line(50, 160, pageWidth - 50, 160);

  // Footer - Issued by
  doc.setFontSize(12);
  doc.setTextColor(...textColor);
  doc.setFont('helvetica', 'bold');
  doc.text('Issued by PCN Services Limited', pageWidth / 2, 172, { align: 'center' });

  // Training programme description
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const description = 'This training programme covers DCB0129, DCB0160, Hazard Identification, Risk Assessment, Safety Case Reports, and Incident Management in accordance with NHS Digital clinical safety standards.';
  doc.text(description, pageWidth / 2, 180, { align: 'center', maxWidth: 240 });

  // Official Sensitive notice (smaller at bottom)
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text('Official Sensitive', pageWidth / 2, 195, { align: 'center' });

  // Return as blob
  return doc.output('blob');
};

export const downloadCertificatePDF = (data: CertificateData, filename?: string): void => {
  const blob = generateCSOCertificatePDF(data);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename || `CSO_Certificate_${data.certificateNumber}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
