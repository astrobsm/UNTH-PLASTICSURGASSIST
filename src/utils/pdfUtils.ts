/**
 * PDF Utilities for consistent PDF generation across the app
 * Fixes font rendering issues and provides standard styling
 */

import jsPDF from 'jspdf';

// Standard font sizes for consistent styling
export const PDF_FONT_SIZES = {
  title: 16,
  sectionHeader: 12,
  subHeader: 11,
  body: 10,
  small: 9,
  footer: 8
};

// Standard margins
export const PDF_MARGINS = {
  top: 20,
  bottom: 20,
  left: 15,
  right: 15
};

// Clinical colors
export const PDF_COLORS = {
  primary: { r: 14, g: 159, b: 110 },     // Green #0E9F6E
  danger: { r: 220, g: 38, b: 38 },       // Red #DC2626
  warning: { r: 217, g: 119, b: 6 },      // Orange #D97706
  darkRed: { r: 139, g: 0, b: 0 },        // Dark red for headers
  black: { r: 0, g: 0, b: 0 },
  gray: { r: 100, g: 100, b: 100 }
};

/**
 * Creates a properly configured jsPDF instance
 * This ensures fonts are correctly loaded to prevent spacing issues
 */
export function createPDF(orientation: 'portrait' | 'landscape' = 'portrait'): jsPDF {
  const pdf = new jsPDF({
    orientation,
    unit: 'mm',
    format: 'a4',
    putOnlyUsedFonts: true,
    compress: true,
    hotfixes: ['px_scaling'] // Enable pixel scaling fix
  });

  // Set default font - helvetica is built-in and works reliably
  pdf.setFont('helvetica', 'normal');
  
  // Set character spacing to 0 to prevent spacing issues (if method exists)
  if (typeof (pdf as any).setCharSpace === 'function') {
    (pdf as any).setCharSpace(0);
  }
  
  return pdf;
}

/**
 * Adds a styled header to the PDF
 */
export function addPDFHeader(
  pdf: jsPDF,
  title: string,
  subtitle?: string,
  yPos: number = 15
): number {
  const pageWidth = pdf.internal.pageSize.getWidth();
  
  // Main title
  pdf.setFontSize(PDF_FONT_SIZES.title);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(PDF_COLORS.black.r, PDF_COLORS.black.g, PDF_COLORS.black.b);
  pdf.text(title, pageWidth / 2, yPos, { align: 'center' });
  yPos += 7;
  
  // Subtitle
  if (subtitle) {
    pdf.setFontSize(PDF_FONT_SIZES.body);
    pdf.setFont('helvetica', 'normal');
    pdf.text(subtitle, pageWidth / 2, yPos, { align: 'center' });
    yPos += 8;
  }
  
  return yPos;
}

/**
 * Adds a section header with optional underline
 */
export function addSectionHeader(
  pdf: jsPDF,
  title: string,
  yPos: number,
  options?: { color?: { r: number; g: number; b: number }; underline?: boolean }
): number {
  const color = options?.color || PDF_COLORS.black;
  
  pdf.setFontSize(PDF_FONT_SIZES.sectionHeader);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(color.r, color.g, color.b);
  pdf.text(title, PDF_MARGINS.left, yPos);
  
  if (options?.underline) {
    const textWidth = pdf.getTextWidth(title);
    pdf.setDrawColor(color.r, color.g, color.b);
    pdf.setLineWidth(0.5);
    pdf.line(PDF_MARGINS.left, yPos + 1, PDF_MARGINS.left + textWidth, yPos + 1);
  }
  
  pdf.setTextColor(PDF_COLORS.black.r, PDF_COLORS.black.g, PDF_COLORS.black.b);
  return yPos + 7;
}

/**
 * Adds body text with automatic line wrapping
 */
export function addBodyText(
  pdf: jsPDF,
  text: string,
  yPos: number,
  options?: { 
    fontSize?: number; 
    bold?: boolean;
    indent?: number;
    maxWidth?: number;
    lineHeight?: number;
  }
): number {
  const fontSize = options?.fontSize || PDF_FONT_SIZES.body;
  const pageWidth = pdf.internal.pageSize.getWidth();
  const maxWidth = options?.maxWidth || (pageWidth - PDF_MARGINS.left - PDF_MARGINS.right);
  const indent = options?.indent || 0;
  const lineHeight = options?.lineHeight || 5;
  
  pdf.setFontSize(fontSize);
  pdf.setFont('helvetica', options?.bold ? 'bold' : 'normal');
  
  const lines = pdf.splitTextToSize(text, maxWidth - indent);
  lines.forEach((line: string) => {
    pdf.text(line, PDF_MARGINS.left + indent, yPos);
    yPos += lineHeight;
  });
  
  return yPos;
}

/**
 * Adds a bullet point list with proper formatting
 */
export function addBulletList(
  pdf: jsPDF,
  items: string[],
  yPos: number,
  options?: {
    bulletChar?: string;
    fontSize?: number;
    lineHeight?: number;
    checkPageBreak?: (neededSpace: number) => boolean;
  }
): number {
  const bulletChar = options?.bulletChar || '•';
  const fontSize = options?.fontSize || PDF_FONT_SIZES.body;
  const lineHeight = options?.lineHeight || 5;
  const pageWidth = pdf.internal.pageSize.getWidth();
  const maxWidth = pageWidth - PDF_MARGINS.left - PDF_MARGINS.right - 10;
  
  pdf.setFontSize(fontSize);
  pdf.setFont('helvetica', 'normal');
  
  items.forEach((item) => {
    if (item.trim()) {
      // Check for page break if function provided
      if (options?.checkPageBreak) {
        options.checkPageBreak(lineHeight * 2);
      }
      
      // Add bullet
      pdf.text(bulletChar, PDF_MARGINS.left + 3, yPos);
      
      // Add text with wrapping
      const lines = pdf.splitTextToSize(item, maxWidth);
      lines.forEach((line: string, lineIndex: number) => {
        pdf.text(line, PDF_MARGINS.left + 8, yPos);
        if (lineIndex < lines.length - 1) {
          yPos += lineHeight;
        }
      });
      yPos += lineHeight + 1;
    }
  });
  
  return yPos;
}

/**
 * Adds a warning/alert box
 */
export function addWarningBox(
  pdf: jsPDF,
  title: string,
  items: string[],
  yPos: number,
  options?: {
    checkPageBreak?: (neededSpace: number) => boolean;
  }
): number {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const boxWidth = pageWidth - PDF_MARGINS.left - PDF_MARGINS.right;
  const estimatedHeight = 15 + (items.length * 6);
  
  // Check for page break
  if (options?.checkPageBreak) {
    options.checkPageBreak(estimatedHeight);
  }
  
  // Draw red border box
  pdf.setDrawColor(PDF_COLORS.danger.r, PDF_COLORS.danger.g, PDF_COLORS.danger.b);
  pdf.setLineWidth(0.5);
  pdf.rect(PDF_MARGINS.left, yPos - 3, boxWidth, estimatedHeight);
  
  // Warning title
  pdf.setFontSize(PDF_FONT_SIZES.subHeader);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(PDF_COLORS.danger.r, PDF_COLORS.danger.g, PDF_COLORS.danger.b);
  pdf.text('⚠ ' + title, PDF_MARGINS.left + 3, yPos + 4);
  yPos += 10;
  
  // Warning items
  pdf.setFontSize(PDF_FONT_SIZES.body);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(PDF_COLORS.black.r, PDF_COLORS.black.g, PDF_COLORS.black.b);
  
  items.forEach((item) => {
    if (item.trim()) {
      pdf.text('• ' + item, PDF_MARGINS.left + 5, yPos);
      yPos += 5;
    }
  });
  
  return yPos + 5;
}

/**
 * Adds an info box with green border
 */
export function addInfoBox(
  pdf: jsPDF,
  title: string,
  content: string,
  yPos: number
): number {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const boxWidth = pageWidth - PDF_MARGINS.left - PDF_MARGINS.right;
  
  pdf.setFontSize(PDF_FONT_SIZES.body);
  const lines = pdf.splitTextToSize(content, boxWidth - 10);
  const boxHeight = 15 + (lines.length * 5);
  
  // Draw green border box
  pdf.setDrawColor(PDF_COLORS.primary.r, PDF_COLORS.primary.g, PDF_COLORS.primary.b);
  pdf.setLineWidth(0.5);
  pdf.rect(PDF_MARGINS.left, yPos - 3, boxWidth, boxHeight);
  
  // Title
  pdf.setFontSize(PDF_FONT_SIZES.subHeader);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(PDF_COLORS.primary.r, PDF_COLORS.primary.g, PDF_COLORS.primary.b);
  pdf.text(title, PDF_MARGINS.left + 3, yPos + 4);
  yPos += 10;
  
  // Content
  pdf.setFontSize(PDF_FONT_SIZES.body);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(PDF_COLORS.black.r, PDF_COLORS.black.g, PDF_COLORS.black.b);
  lines.forEach((line: string) => {
    pdf.text(line, PDF_MARGINS.left + 5, yPos);
    yPos += 5;
  });
  
  return yPos + 5;
}

/**
 * Creates a page break handler function
 */
export function createPageBreakHandler(pdf: jsPDF, headerCallback?: () => number): {
  checkPageBreak: (neededSpace: number) => boolean;
  getYPos: () => number;
  setYPos: (y: number) => void;
} {
  const pageHeight = pdf.internal.pageSize.getHeight();
  let currentY = PDF_MARGINS.top;
  
  return {
    checkPageBreak: (neededSpace: number): boolean => {
      if (currentY + neededSpace > pageHeight - PDF_MARGINS.bottom) {
        pdf.addPage();
        currentY = headerCallback ? headerCallback() : PDF_MARGINS.top;
        return true;
      }
      return false;
    },
    getYPos: () => currentY,
    setYPos: (y: number) => { currentY = y; }
  };
}

/**
 * Adds a horizontal line separator
 */
export function addSeparator(pdf: jsPDF, yPos: number, color?: { r: number; g: number; b: number }): number {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const c = color || PDF_COLORS.gray;
  
  pdf.setDrawColor(c.r, c.g, c.b);
  pdf.setLineWidth(0.3);
  pdf.line(PDF_MARGINS.left, yPos, pageWidth - PDF_MARGINS.right, yPos);
  
  return yPos + 5;
}

/**
 * Adds footer with page numbers
 */
export function addFooter(pdf: jsPDF, text?: string): void {
  const pageCount = (pdf as any).internal.getNumberOfPages();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const pageWidth = pdf.internal.pageSize.getWidth();
  
  for (let i = 1; i <= pageCount; i++) {
    pdf.setPage(i);
    pdf.setFontSize(PDF_FONT_SIZES.footer);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(PDF_COLORS.gray.r, PDF_COLORS.gray.g, PDF_COLORS.gray.b);
    
    // Page number
    pdf.text('Page ' + i + ' of ' + pageCount, pageWidth / 2, pageHeight - 10, { align: 'center' });
    
    // Custom text
    if (text) {
      pdf.text(text, PDF_MARGINS.left, pageHeight - 10);
    }
  }
}

/**
 * Adds a two-column layout
 */
export function addTwoColumnText(
  pdf: jsPDF,
  leftLabel: string,
  leftValue: string,
  rightLabel: string,
  rightValue: string,
  yPos: number
): number {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const col1X = PDF_MARGINS.left;
  const col2X = pageWidth / 2;
  
  pdf.setFontSize(PDF_FONT_SIZES.body);
  pdf.setFont('helvetica', 'bold');
  pdf.text(leftLabel, col1X, yPos);
  pdf.text(rightLabel, col2X, yPos);
  
  pdf.setFont('helvetica', 'normal');
  pdf.text(leftValue, col1X + pdf.getTextWidth(leftLabel) + 2, yPos);
  pdf.text(rightValue, col2X + pdf.getTextWidth(rightLabel) + 2, yPos);
  
  return yPos + 6;
}

/**
 * Adds a labeled field
 */
export function addLabeledField(
  pdf: jsPDF,
  label: string,
  value: string,
  yPos: number,
  options?: { bold?: boolean }
): number {
  pdf.setFontSize(PDF_FONT_SIZES.body);
  pdf.setFont('helvetica', 'bold');
  pdf.text(label + ':', PDF_MARGINS.left, yPos);
  
  pdf.setFont('helvetica', options?.bold ? 'bold' : 'normal');
  pdf.text(value, PDF_MARGINS.left + pdf.getTextWidth(label + ': '), yPos);
  
  return yPos + 6;
}

/**
 * Sanitizes text for PDF - removes problematic characters that might cause spacing issues
 * This function handles various encoding issues that cause text to display with strange spacing
 */
export function sanitizeTextForPDF(text: string): string {
  if (!text) return '';
  
  let result = text;
  
  // First, normalize unicode characters (converts composed characters to standard form)
  result = result.normalize('NFKC');
  
  // Remove zero-width characters that cause spacing issues
  result = result.replace(/[\u200B-\u200F\u2028-\u202F\uFEFF\u00AD]/g, '');
  
  // Remove other invisible formatting characters
  result = result.replace(/[\u2060-\u206F]/g, '');
  
  // Remove variation selectors
  result = result.replace(/[\uFE00-\uFE0F]/g, '');
  
  // Replace emojis with text equivalents (jsPDF doesn't handle emojis well)
  result = result.replace(/⚠️/g, '[!]');
  result = result.replace(/🚨/g, '[!]');
  result = result.replace(/📅/g, '');
  result = result.replace(/✅/g, '[OK]');
  result = result.replace(/✓/g, '-');
  result = result.replace(/✔/g, '-');
  result = result.replace(/❌/g, '[X]');
  result = result.replace(/💊/g, '');
  result = result.replace(/🏥/g, '');
  result = result.replace(/👨‍⚕️/g, '');
  result = result.replace(/👩‍⚕️/g, '');
  result = result.replace(/🩺/g, '');
  result = result.replace(/💉/g, '');
  result = result.replace(/🩹/g, '');
  result = result.replace(/🌡️/g, '');
  result = result.replace(/🔬/g, '');
  
  // Remove any remaining emojis (common emoji ranges)
  result = result.replace(/[\u{1F300}-\u{1F9FF}]/gu, '');
  result = result.replace(/[\u{2600}-\u{26FF}]/gu, '');
  result = result.replace(/[\u{2700}-\u{27BF}]/gu, '');
  
  // Replace problematic bullet characters with standard ones
  result = result.replace(/[•●○◦▪▫■□◆◇★☆✗✘→←↑↓⇒⇐⇑⇓]/g, '-');
  result = result.replace(/[Ø]/g, ''); // Remove problematic Ø character
  result = result.replace(/[Þþ]/g, ''); // Remove thorn characters
  result = result.replace(/[¨]/g, ''); // Remove diaeresis
  
  // Replace problematic quotes with standard ones
  result = result.replace(/[""„‟″‴]/g, '"');
  result = result.replace(/[''‚‛′‵]/g, "'");
  
  // Replace various dash characters with regular dash
  result = result.replace(/[–—―‐‑‒⁃]/g, '-');
  
  // Replace degree symbol with text
  result = result.replace(/°/g, ' deg ');
  
  // Remove any control characters except newline and tab
  result = result.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  
  // Remove non-breaking spaces that cause issues
  result = result.replace(/[\u00A0]/g, ' ');
  
  // Clean up excessive spacing (multiple spaces to single space)
  result = result.replace(/  +/g, ' ');
  
  // Clean up spacing around punctuation
  result = result.replace(/ +,/g, ',');
  result = result.replace(/ +\./g, '.');
  result = result.replace(/ +:/g, ':');
  
  return result.trim();
}

/**
 * Formats a date for PDF display
 */
export function formatDateForPDF(date: Date | string): string {
  if (!date) return 'N/A';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

/**
 * Formats date and time for PDF display
 */
export function formatDateTimeForPDF(date: Date | string): string {
  if (!date) return 'N/A';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export default {
  createPDF,
  addPDFHeader,
  addSectionHeader,
  addBodyText,
  addBulletList,
  addWarningBox,
  addInfoBox,
  createPageBreakHandler,
  addSeparator,
  addFooter,
  addTwoColumnText,
  addLabeledField,
  sanitizeTextForPDF,
  formatDateForPDF,
  formatDateTimeForPDF,
  PDF_FONT_SIZES,
  PDF_MARGINS,
  PDF_COLORS
};
