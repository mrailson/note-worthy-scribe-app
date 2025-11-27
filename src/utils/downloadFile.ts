/**
 * Utility to trigger file downloads reliably across browsers
 */
export const downloadFile = (fileUrl: string, fileName: string) => {
  // Create a temporary anchor element
  const link = document.createElement('a');
  link.href = fileUrl;
  link.download = fileName;
  link.style.display = 'none';
  
  // Append to body, click, and remove
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
