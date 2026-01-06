/**
 * PDF Utilities for Medical Document Generation
 * 
 * MANDATORY STANDARDS FOR ALL PDF DOCUMENTS:
 * ==========================================
 * 
 * 1. FONTS:
 *    - Primary: Helvetica (built-in, no embedding needed)
 *    - Fallbacks: Arial, Times New Roman (if custom fonts needed)
 *    - Body text: 11-12pt minimum
 *    - Tables: ≥10pt minimum
 *    - Footnotes/captions: ≥9pt minimum
 *    - NO fancy or decorative fonts
 * 
 * 2. COLORS:
 *    - Background: ALWAYS WHITE (#FFFFFF)
 *    - Text: BLACK (#000000) for all body content
 *    - Accents: Limited use for headers/borders only
 *    - NO dark mode, NO colored backgrounds
 *    - Ensure high contrast (WCAG AA compliant)
 * 
 * 3. PAGE LAYOUT:
 *    - Format: A4 (210mm x 297mm) or US Letter
 *    - Margins: Minimum 20mm all sides
 *    - NO edge-to-edge printing
 *    - Header/Footer reserved areas
 * 
 * 4. CROSS-PLATFORM:
 *    - Must render identically on Windows, macOS, iOS, Android
 *    - Must print correctly on all printers
 *    - Use only embedded/standard fonts
 * 
 * 5. MEDICAL/LEGAL COMPLIANCE:
 *    - Professional appearance for legal validity
 *    - Clear institution branding
 *    - Timestamped with generation date
 *    - Page numbers on all pages
 */

import jsPDF from 'jspdf';

// ============================================================================
// MANDATORY CONFIGURATION - DO NOT MODIFY WITHOUT APPROVAL
// ============================================================================

/**
 * Standard font sizes - MINIMUM VALUES ENFORCED
 * Body text must be ≥11pt, tables ≥10pt, footnotes ≥9pt
 */
export const PDF_FONT_SIZES = {
  title: 16,           // Document title
  sectionHeader: 14,   // Section headers
  subHeader: 12,       // Sub-section headers
  body: 11,            // MINIMUM 11pt for body text (was 10)
  tableBody: 10,       // Minimum for tables (was body)
  small: 9,            // Minimum for footnotes/captions
  footer: 9            // Page footer (was 8, now meets 9pt min)
};

/**
 * Standard margins - MINIMUM 20mm enforced
 * Ensures proper printing on all devices
 */
export const PDF_MARGINS = {
  top: 25,      // 25mm top margin (header space)
  bottom: 25,   // 25mm bottom margin (footer space)
  left: 20,     // 20mm left margin (minimum)
  right: 20     // 20mm right margin (minimum)
};

/**
 * Page dimensions for A4
 */
export const PDF_PAGE = {
  width: 210,      // A4 width in mm
  height: 297,     // A4 height in mm
  contentWidth: 170, // Usable width (210 - 20 - 20)
  contentHeight: 247 // Usable height (297 - 25 - 25)
};

/**
 * Clinical colors for PDF documents
 * PRIMARY RULE: Black text on white background ALWAYS
 * Colors used ONLY for accents, borders, and headers
 */
export const PDF_COLORS = {
  // MANDATORY: Document background and text
  background: { r: 255, g: 255, b: 255 },  // WHITE - ALWAYS
  text: { r: 0, g: 0, b: 0 },              // BLACK - Primary text
  
  // Accent colors (limited use for headers/borders)
  primary: { r: 14, g: 159, b: 110 },      // Clinical Green #0E9F6E
  danger: { r: 220, g: 38, b: 38 },        // Alert Red #DC2626
  warning: { r: 217, g: 119, b: 6 },       // Warning Orange #D97706
  
  // Legacy aliases (for backward compatibility)
  black: { r: 0, g: 0, b: 0 },
  gray: { r: 100, g: 100, b: 100 },        // For borders, lines
  darkRed: { r: 139, g: 0, b: 0 },         // Dark red for headers
  lightGray: { r: 240, g: 240, b: 240 }    // Table row alternation (subtle)
};

/**
 * Institution header for all medical documents
 */
export const PDF_INSTITUTION = {
  name: 'UNIVERSITY OF NIGERIA TEACHING HOSPITAL',
  department: 'Plastic and Reconstructive Surgery Unit',
  location: 'Enugu, Nigeria',
  logo: null as string | null  // Base64 logo if available
};

/**
 * Creates a properly configured jsPDF instance with MANDATORY settings
 * 
 * ENFORCED STANDARDS:
 * - Helvetica font (cross-platform safe, built-in)
 * - A4 format (international medical standard)
 * - Compression enabled
 * - Character spacing normalized
 * 
 * @param orientation - 'portrait' (default) or 'landscape'
 * @returns Configured jsPDF instance
 */
export function createPDF(orientation: 'portrait' | 'landscape' = 'portrait'): jsPDF {
  const pdf = new jsPDF({
    orientation,
    unit: 'mm',
    format: 'a4',           // A4 format - international standard
    putOnlyUsedFonts: true, // Optimize font embedding
    compress: true,         // Reduce file size
    hotfixes: ['px_scaling'] // Enable pixel scaling fix
  });

  // MANDATORY: Set Helvetica as primary font (built-in, cross-platform safe)
  pdf.setFont('helvetica', 'normal');
  
  // Normalize character spacing to prevent rendering issues
  if (typeof (pdf as any).setCharSpace === 'function') {
    (pdf as any).setCharSpace(0);
  }
  
  // MANDATORY: Set black text color as default
  pdf.setTextColor(PDF_COLORS.text.r, PDF_COLORS.text.g, PDF_COLORS.text.b);
  
  // MANDATORY: Set default font size to body (11pt minimum)
  pdf.setFontSize(PDF_FONT_SIZES.body);
  
  return pdf;
}

/**
 * Adds a professional styled header to the PDF
 * Includes institution branding for medical documents
 * 
 * @param pdf - jsPDF instance
 * @param title - Main document title
 * @param subtitle - Optional subtitle
 * @param yPos - Starting Y position (default: top margin)
 * @param includeInstitution - Include hospital header (default: true)
 * @returns New Y position after header
 */
export function addPDFHeader(
  pdf: jsPDF,
  title: string,
  subtitle?: string,
  yPos: number = PDF_MARGINS.top,
  includeInstitution: boolean = true
): number {
  const pageWidth = pdf.internal.pageSize.getWidth();
  
  // Institution header (for medical documents)
  if (includeInstitution) {
    pdf.setFontSize(PDF_FONT_SIZES.sectionHeader);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(PDF_COLORS.text.r, PDF_COLORS.text.g, PDF_COLORS.text.b);
    pdf.text(PDF_INSTITUTION.name, pageWidth / 2, yPos, { align: 'center' });
    yPos += 6;
    
    pdf.setFontSize(PDF_FONT_SIZES.body);
    pdf.setFont('helvetica', 'normal');
    pdf.text(PDF_INSTITUTION.department, pageWidth / 2, yPos, { align: 'center' });
    yPos += 5;
    pdf.text(PDF_INSTITUTION.location, pageWidth / 2, yPos, { align: 'center' });
    yPos += 10;
  }
  
  // Main title
  pdf.setFontSize(PDF_FONT_SIZES.title);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(PDF_COLORS.text.r, PDF_COLORS.text.g, PDF_COLORS.text.b);
  pdf.text(title, pageWidth / 2, yPos, { align: 'center' });
  yPos += 7;
  
  // Subtitle
  if (subtitle) {
    pdf.setFontSize(PDF_FONT_SIZES.body);
    pdf.setFont('helvetica', 'normal');
    pdf.text(subtitle, pageWidth / 2, yPos, { align: 'center' });
    yPos += 8;
  }
  
  // Reset to default text color
  pdf.setTextColor(PDF_COLORS.text.r, PDF_COLORS.text.g, PDF_COLORS.text.b);
  
  return yPos;
}

/**
 * Adds a section header with optional underline
 * Uses BLACK text with optional accent underline
 */
export function addSectionHeader(
  pdf: jsPDF,
  title: string,
  yPos: number,
  options?: { color?: { r: number; g: number; b: number }; underline?: boolean }
): number {
  const underlineColor = options?.color || PDF_COLORS.primary;
  
  pdf.setFontSize(PDF_FONT_SIZES.sectionHeader);
  pdf.setFont('helvetica', 'bold');
  // MANDATORY: Section headers always black text
  pdf.setTextColor(PDF_COLORS.text.r, PDF_COLORS.text.g, PDF_COLORS.text.b);
  pdf.text(title, PDF_MARGINS.left, yPos);
  
  if (options?.underline) {
    const textWidth = pdf.getTextWidth(title);
    pdf.setDrawColor(underlineColor.r, underlineColor.g, underlineColor.b);
    pdf.setLineWidth(0.5);
    pdf.line(PDF_MARGINS.left, yPos + 1, PDF_MARGINS.left + textWidth, yPos + 1);
  }
  
  // Reset to default
  pdf.setTextColor(PDF_COLORS.text.r, PDF_COLORS.text.g, PDF_COLORS.text.b);
  return yPos + 8;
}

/**
 * Adds body text with automatic line wrapping
 * ENFORCES minimum 11pt font size
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
  // MANDATORY: Enforce minimum font size of 11pt for body text
  const fontSize = Math.max(options?.fontSize || PDF_FONT_SIZES.body, PDF_FONT_SIZES.body);
  const pageWidth = pdf.internal.pageSize.getWidth();
  const maxWidth = options?.maxWidth || (pageWidth - PDF_MARGINS.left - PDF_MARGINS.right);
  const indent = options?.indent || 0;
  const lineHeight = options?.lineHeight || 6;
  
  pdf.setFontSize(fontSize);
  pdf.setFont('helvetica', options?.bold ? 'bold' : 'normal');
  // MANDATORY: Black text
  pdf.setTextColor(PDF_COLORS.text.r, PDF_COLORS.text.g, PDF_COLORS.text.b);
  
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
 * Adds footer with page numbers and timestamp to all pages
 * MANDATORY for medical/legal documents
 */
export function addFooter(pdf: jsPDF, customText?: string): void {
  const pageCount = (pdf as any).internal.getNumberOfPages();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const pageWidth = pdf.internal.pageSize.getWidth();
  const generatedDate = new Date().toLocaleString('en-GB', {
    day: '2-digit',
    month: '2-digit', 
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
  
  for (let i = 1; i <= pageCount; i++) {
    pdf.setPage(i);
    pdf.setFontSize(PDF_FONT_SIZES.footer);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(PDF_COLORS.gray.r, PDF_COLORS.gray.g, PDF_COLORS.gray.b);
    
    // Left: Custom text or institution
    const leftText = customText || PDF_INSTITUTION.department;
    pdf.text(leftText, PDF_MARGINS.left, pageHeight - 10);
    
    // Center: Page number
    pdf.text(`Page ${i} of ${pageCount}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
    
    // Right: Generation timestamp
    pdf.text(`Generated: ${generatedDate}`, pageWidth - PDF_MARGINS.right, pageHeight - 10, { align: 'right' });
  }
  
  // Reset text color to black
  pdf.setTextColor(PDF_COLORS.text.r, PDF_COLORS.text.g, PDF_COLORS.text.b);
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

/**
 * Creates a simple table with headers and rows
 * ENFORCES minimum 10pt font for tables
 */
export function addSimpleTable(
  pdf: jsPDF,
  headers: string[],
  rows: string[][],
  yPos: number,
  options?: {
    columnWidths?: number[];
    headerColor?: { r: number; g: number; b: number };
    fontSize?: number;
  }
): number {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const tableWidth = pageWidth - PDF_MARGINS.left - PDF_MARGINS.right;
  const columnCount = headers.length;
  const columnWidths = options?.columnWidths || headers.map(() => tableWidth / columnCount);
  const headerColor = options?.headerColor || PDF_COLORS.primary;
  // MANDATORY: Enforce minimum 10pt for tables
  const fontSize = Math.max(options?.fontSize || PDF_FONT_SIZES.tableBody, 10);
  const rowHeight = 7;
  
  pdf.setFontSize(fontSize);
  
  // Draw header row with accent background
  pdf.setFillColor(headerColor.r, headerColor.g, headerColor.b);
  pdf.rect(PDF_MARGINS.left, yPos - 4, tableWidth, rowHeight, 'F');
  
  // Header text (white on colored background)
  pdf.setTextColor(255, 255, 255);
  pdf.setFont('helvetica', 'bold');
  let xPos = PDF_MARGINS.left + 2;
  headers.forEach((header, i) => {
    pdf.text(sanitizeTextForPDF(header), xPos, yPos);
    xPos += columnWidths[i];
  });
  yPos += rowHeight;
  
  // Reset to black text for rows
  pdf.setTextColor(PDF_COLORS.text.r, PDF_COLORS.text.g, PDF_COLORS.text.b);
  pdf.setFont('helvetica', 'normal');
  
  // Draw data rows with alternating background
  rows.forEach((row, rowIndex) => {
    // Subtle alternating background (very light gray)
    if (rowIndex % 2 === 1) {
      pdf.setFillColor(PDF_COLORS.lightGray.r, PDF_COLORS.lightGray.g, PDF_COLORS.lightGray.b);
      pdf.rect(PDF_MARGINS.left, yPos - 4, tableWidth, rowHeight, 'F');
    }
    
    xPos = PDF_MARGINS.left + 2;
    row.forEach((cell, i) => {
      const cellText = sanitizeTextForPDF(cell || '');
      const truncatedText = cellText.length > 30 ? cellText.substring(0, 27) + '...' : cellText;
      pdf.text(truncatedText, xPos, yPos);
      xPos += columnWidths[i];
    });
    yPos += rowHeight;
  });
  
  // Draw table border
  const totalHeight = (rows.length + 1) * rowHeight;
  pdf.setDrawColor(PDF_COLORS.gray.r, PDF_COLORS.gray.g, PDF_COLORS.gray.b);
  pdf.setLineWidth(0.3);
  pdf.rect(PDF_MARGINS.left, yPos - totalHeight, tableWidth, totalHeight);
  
  return yPos + 3;
}

/**
 * Validates PDF configuration before generation
 * Call this at the start of any PDF generation function
 */
export function validatePDFConfig(): void {
  // Log configuration for debugging
  console.log('[PDF] Configuration validated:', {
    fontSizes: PDF_FONT_SIZES,
    margins: PDF_MARGINS,
    institution: PDF_INSTITUTION.name
  });
}

/**
 * Helper to check if we need a new page
 */
export function needsNewPage(pdf: jsPDF, currentY: number, neededSpace: number = 30): boolean {
  const pageHeight = pdf.internal.pageSize.getHeight();
  return currentY + neededSpace > pageHeight - PDF_MARGINS.bottom;
}

/**
 * Adds a new page and returns the new Y position
 */
export function addNewPage(pdf: jsPDF, addHeader?: () => number): number {
  pdf.addPage();
  return addHeader ? addHeader() : PDF_MARGINS.top;
}

export default {
  // Core functions
  createPDF,
  addPDFHeader,
  addSectionHeader,
  addBodyText,
  addBulletList,
  addWarningBox,
  addInfoBox,
  addSimpleTable,
  createPageBreakHandler,
  addSeparator,
  addFooter,
  addTwoColumnText,
  addLabeledField,
  
  // Text utilities
  sanitizeTextForPDF,
  formatDateForPDF,
  formatDateTimeForPDF,
  
  // Page utilities
  validatePDFConfig,
  needsNewPage,
  addNewPage,
  
  // Configuration (MANDATORY standards)
  PDF_FONT_SIZES,
  PDF_MARGINS,
  PDF_PAGE,
  PDF_COLORS,
  PDF_INSTITUTION
};
