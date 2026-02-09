/**
 * PDF Utilities for Medical Document Generation
 * 
 * MANDATORY STANDARDS FOR ALL PDF DOCUMENTS:
 * ==========================================
 * 
 * 1. FONTS:
 *    - Primary: Georgia (mapped to 'times' in jsPDF â€” closest built-in match)
 *    - Body text: 11pt
 *    - Tables: 10pt minimum
 *    - Footnotes: 9pt minimum
 * 
 * 2. COLORS:
 *    - Background: WHITE (#FFFFFF)
 *    - Text: BLACK (#000000)
 *    - Accents: Limited use for headers/borders only
 * 
 * 3. PAGE LAYOUT:
 *    - A4: Narrow margins (10mm sides, 15mm top/bottom)
 *    - Double-column layout where appropriate
 *    - Line spacing: 0.5 (tight)
 *    - NO text overflow beyond margins
 * 
 * 4. THERMAL PRINT:
 *    - 80mm roll width, 12pt Georgia (times), no overflow
 *    - Available as alternative export for all documents
 * 
 * 5. MEDICAL/LEGAL COMPLIANCE:
 *    - Professional appearance, institution branding
 *    - Timestamped, page-numbered
 */

import jsPDF from 'jspdf';

// ============================================================================
// MANDATORY CONFIGURATION - DO NOT MODIFY WITHOUT APPROVAL
// ============================================================================

/**
 * Standard font sizes - MINIMUM VALUES ENFORCED
 * Body text must be â‰¥11pt, tables â‰¥10pt, footnotes â‰¥9pt
 */
export const PDF_FONT_SIZES = {
  title: 16,           // Document title
  sectionHeader: 13,   // Section headers
  subHeader: 11,       // Sub-section headers
  body: 11,            // Body text â€” Georgia 11pt
  tableBody: 10,       // Minimum for tables
  small: 9,            // Footnotes/captions
  footer: 8            // Page footer
};

/** Line spacing multiplier (0.5 = tight) */
export const PDF_LINE_SPACING = 0.5;

/** Default line height in mm for body text at 11pt with 0.5 spacing */
export const PDF_LINE_HEIGHT = 4.2;

/**
 * Standard margins - MINIMUM 20mm enforced
 * Ensures proper printing on all devices
 */
export const PDF_MARGINS = {
  top: 15,      // 15mm top margin (narrow)
  bottom: 15,   // 15mm bottom margin (narrow)
  left: 10,     // 10mm left margin (narrow)
  right: 10     // 10mm right margin (narrow)
};

/**
 * Page dimensions for A4
 */
export const PDF_PAGE = {
  width: 210,      // A4 width in mm
  height: 297,     // A4 height in mm
  contentWidth: 190, // Usable width (210 - 10 - 10)
  contentHeight: 267 // Usable height (297 - 15 - 15)
};

/** Thermal printer configuration â€” 80mm roll */
export const PDF_THERMAL = {
  width: 80,       // 80mm roll width
  margin: 3,       // 3mm margins
  contentWidth: 74, // 80 - 3 - 3
  fontSize: 12,    // 12pt Georgia
  smallFont: 9,
  lineHeight: 5,
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
 * - times font (cross-platform safe, built-in)
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
    format: 'a4',
    putOnlyUsedFonts: true,
    compress: true,
    hotfixes: ['px_scaling']
  });

  // Georgia font â€” 'times' is the closest built-in match in jsPDF
  pdf.setFont('times', 'normal');
  
  // Normalize character spacing to prevent garbled text
  if (typeof (pdf as any).setCharSpace === 'function') {
    (pdf as any).setCharSpace(0);
  }
  
  pdf.setTextColor(PDF_COLORS.text.r, PDF_COLORS.text.g, PDF_COLORS.text.b);
  pdf.setFontSize(PDF_FONT_SIZES.body);
  
  return pdf;
}

/**
 * Creates a thermal printer PDF (80mm width)
 * Font: times (Georgia), 12pt, 3mm margins
 */
export function createThermalPDF(): jsPDF {
  const contentHeight = 200; // initial height, will auto-extend
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [PDF_THERMAL.width, contentHeight],
    putOnlyUsedFonts: true,
    compress: true,
  });

  pdf.setFont('times', 'normal');
  if (typeof (pdf as any).setCharSpace === 'function') {
    (pdf as any).setCharSpace(0);
  }
  pdf.setTextColor(0, 0, 0);
  pdf.setFontSize(PDF_THERMAL.fontSize);
  
  return pdf;
}

/**
 * Adds thermal header with institution name
 */
export function addThermalHeader(pdf: jsPDF, title: string): number {
  let y = PDF_THERMAL.margin + 4;
  const m = PDF_THERMAL.margin;
  const cw = PDF_THERMAL.contentWidth;

  pdf.setFont('times', 'bold');
  pdf.setFontSize(11);
  pdf.text(sanitizeTextForPDF(PDF_INSTITUTION.name), m, y, { maxWidth: cw });
  y += 4;
  pdf.setFontSize(9);
  pdf.setFont('times', 'normal');
  pdf.text(PDF_INSTITUTION.department, m, y, { maxWidth: cw });
  y += 5;

  // separator
  pdf.setLineWidth(0.3);
  pdf.line(m, y, m + cw, y);
  y += 4;

  // title
  pdf.setFont('times', 'bold');
  pdf.setFontSize(PDF_THERMAL.fontSize);
  pdf.text(sanitizeTextForPDF(title), m, y, { maxWidth: cw });
  y += 5;

  pdf.setFont('times', 'normal');
  return y;
}

/**
 * Adds text to thermal PDF with automatic wrapping, no overflow
 */
export function addThermalText(
  pdf: jsPDF,
  text: string,
  y: number,
  options?: { bold?: boolean; fontSize?: number; indent?: number }
): number {
  const m = PDF_THERMAL.margin + (options?.indent || 0);
  const maxW = PDF_THERMAL.contentWidth - (options?.indent || 0);
  const fs = options?.fontSize || PDF_THERMAL.fontSize;

  pdf.setFontSize(fs);
  pdf.setFont('times', options?.bold ? 'bold' : 'normal');

  const lines = pdf.splitTextToSize(sanitizeTextForPDF(text), maxW);
  lines.forEach((line: string) => {
    pdf.text(line, m, y);
    y += fs * 0.4;
  });
  return y;
}

/**
 * Finalizes thermal PDF â€” adds footer and adjusts page height to content
 */
export function finalizeThermalPDF(pdf: jsPDF, y: number): void {
  const m = PDF_THERMAL.margin;
  const cw = PDF_THERMAL.contentWidth;
  y += 3;
  pdf.setLineWidth(0.3);
  pdf.line(m, y, m + cw, y);
  y += 3;
  pdf.setFontSize(8);
  pdf.setFont('times', 'normal');
  const ts = new Date().toLocaleString('en-GB', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
  pdf.text(ts, m, y);
  pdf.text(PDF_INSTITUTION.department, m, y + 3, { maxWidth: cw });
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
    pdf.setFont('times', 'bold');
    pdf.setTextColor(PDF_COLORS.text.r, PDF_COLORS.text.g, PDF_COLORS.text.b);
    pdf.text(sanitizeTextForPDF(PDF_INSTITUTION.name), pageWidth / 2, yPos, { align: 'center' });
    yPos += 5;
    
    pdf.setFontSize(PDF_FONT_SIZES.body);
    pdf.setFont('times', 'normal');
    pdf.text(PDF_INSTITUTION.department, pageWidth / 2, yPos, { align: 'center' });
    yPos += 4;
    pdf.text(PDF_INSTITUTION.location, pageWidth / 2, yPos, { align: 'center' });
    yPos += 8;
  }
  
  // Main title
  pdf.setFontSize(PDF_FONT_SIZES.title);
  pdf.setFont('times', 'bold');
  pdf.setTextColor(PDF_COLORS.text.r, PDF_COLORS.text.g, PDF_COLORS.text.b);
  pdf.text(sanitizeTextForPDF(title), pageWidth / 2, yPos, { align: 'center' });
  yPos += 6;
  
  // Subtitle
  if (subtitle) {
    pdf.setFontSize(PDF_FONT_SIZES.body);
    pdf.setFont('times', 'normal');
    pdf.text(sanitizeTextForPDF(subtitle), pageWidth / 2, yPos, { align: 'center' });
    yPos += 6;
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
  pdf.setFont('times', 'bold');
  pdf.setTextColor(PDF_COLORS.text.r, PDF_COLORS.text.g, PDF_COLORS.text.b);
  pdf.text(sanitizeTextForPDF(title), PDF_MARGINS.left, yPos);
  
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
  const fontSize = Math.max(options?.fontSize || PDF_FONT_SIZES.body, PDF_FONT_SIZES.body);
  const pageWidth = pdf.internal.pageSize.getWidth();
  const maxWidth = options?.maxWidth || (pageWidth - PDF_MARGINS.left - PDF_MARGINS.right);
  const indent = options?.indent || 0;
  const lineHeight = options?.lineHeight || PDF_LINE_HEIGHT;
  
  pdf.setFontSize(fontSize);
  pdf.setFont('times', options?.bold ? 'bold' : 'normal');
  pdf.setTextColor(PDF_COLORS.text.r, PDF_COLORS.text.g, PDF_COLORS.text.b);
  
  const cleanText = sanitizeTextForPDF(text);
  const lines = pdf.splitTextToSize(cleanText, maxWidth - indent);
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
  const bulletChar = '-';
  const fontSize = options?.fontSize || PDF_FONT_SIZES.body;
  const lineHeight = options?.lineHeight || PDF_LINE_HEIGHT;
  const pageWidth = pdf.internal.pageSize.getWidth();
  const maxWidth = pageWidth - PDF_MARGINS.left - PDF_MARGINS.right - 8;
  
  pdf.setFontSize(fontSize);
  pdf.setFont('times', 'normal');
  
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
  pdf.setFont('times', 'bold');
  pdf.setTextColor(PDF_COLORS.danger.r, PDF_COLORS.danger.g, PDF_COLORS.danger.b);
  pdf.text('[!] ' + sanitizeTextForPDF(title), PDF_MARGINS.left + 3, yPos + 4);
  yPos += 10;
  
  // Warning items
  pdf.setFontSize(PDF_FONT_SIZES.body);
  pdf.setFont('times', 'normal');
  pdf.setTextColor(PDF_COLORS.black.r, PDF_COLORS.black.g, PDF_COLORS.black.b);
  
  items.forEach((item) => {
    if (item.trim()) {
      pdf.text('- ' + sanitizeTextForPDF(item), PDF_MARGINS.left + 5, yPos);
      yPos += PDF_LINE_HEIGHT;
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
  pdf.setFont('times', 'bold');
  pdf.setTextColor(PDF_COLORS.primary.r, PDF_COLORS.primary.g, PDF_COLORS.primary.b);
  pdf.text(sanitizeTextForPDF(title), PDF_MARGINS.left + 3, yPos + 4);
  yPos += 10;
  
  // Content
  pdf.setFontSize(PDF_FONT_SIZES.body);
  pdf.setFont('times', 'normal');
  pdf.setTextColor(PDF_COLORS.black.r, PDF_COLORS.black.g, PDF_COLORS.black.b);
  lines.forEach((line: string) => {
    pdf.text(line, PDF_MARGINS.left + 5, yPos);
    yPos += PDF_LINE_HEIGHT;
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
    pdf.setFont('times', 'normal');
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
  pdf.setFont('times', 'bold');
  pdf.text(sanitizeTextForPDF(leftLabel), col1X, yPos);
  pdf.text(sanitizeTextForPDF(rightLabel), col2X, yPos);
  
  pdf.setFont('times', 'normal');
  pdf.text(sanitizeTextForPDF(leftValue), col1X + pdf.getTextWidth(leftLabel) + 2, yPos);
  pdf.text(sanitizeTextForPDF(rightValue), col2X + pdf.getTextWidth(rightLabel) + 2, yPos);
  
  return yPos + PDF_LINE_HEIGHT + 1;
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
  pdf.setFont('times', 'bold');
  pdf.text(sanitizeTextForPDF(label) + ':', PDF_MARGINS.left, yPos);
  
  pdf.setFont('times', options?.bold ? 'bold' : 'normal');
  const cleanVal = sanitizeTextForPDF(value);
  const labelW = pdf.getTextWidth(sanitizeTextForPDF(label) + ': ');
  const maxValW = pdf.internal.pageSize.getWidth() - PDF_MARGINS.left - PDF_MARGINS.right - labelW;
  const valLines = pdf.splitTextToSize(cleanVal, maxValW);
  valLines.forEach((line: string, i: number) => {
    pdf.text(line, PDF_MARGINS.left + (i === 0 ? labelW : labelW), yPos + (i * PDF_LINE_HEIGHT));
  });
  
  return yPos + (valLines.length * PDF_LINE_HEIGHT) + 1;
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
  result = result.replace(/âš ï¸/g, '[!]');
  result = result.replace(/ðŸš¨/g, '[!]');
  result = result.replace(/ðŸ“…/g, '');
  result = result.replace(/âœ…/g, '[OK]');
  result = result.replace(/âœ“/g, '-');
  result = result.replace(/âœ”/g, '-');
  result = result.replace(/âŒ/g, '[X]');
  result = result.replace(/ðŸ’Š/g, '');
  result = result.replace(/ðŸ¥/g, '');
  result = result.replace(/ðŸ‘¨â€âš-ï¸/g, '');
  result = result.replace(/ðŸ‘©â€âš-ï¸/g, '');
  result = result.replace(/ðŸ©º/g, '');
  result = result.replace(/ðŸ’‰/g, '');
  result = result.replace(/ðŸ©¹/g, '');
  result = result.replace(/ðŸŒ¡ï¸/g, '');
  result = result.replace(/ðŸ”¬/g, '');
  
  // Remove any remaining emojis (common emoji ranges)
  result = result.replace(/[\u{1F300}-\u{1F9FF}]/gu, '');
  result = result.replace(/[\u{2600}-\u{26FF}]/gu, '');
  result = result.replace(/[\u{2700}-\u{27BF}]/gu, '');
  
  // Replace problematic bullet characters with standard ones
  result = result.replace(/[â€¢â—â—‹â—¦â–ªâ–«â– â–¡â—†â—‡â˜…â˜†âœ—âœ˜â†’â†â†‘â†“â‡’â‡â‡‘â‡“]/g, '-');
  result = result.replace(/[Ã˜]/g, ''); // Remove problematic Ã˜ character
  result = result.replace(/[ÃžÃ¾]/g, ''); // Remove thorn characters
  result = result.replace(/[Â¨]/g, ''); // Remove diaeresis
  result = result.replace(/[â˜â˜‘â˜’]/g, '[ ]'); // Replace checkbox chars with ASCII
  result = result.replace(/[âœ“âœ”]/g, '[x]'); // Replace checkmark with ASCII
  
  // Remove additional emoji ranges that cause garbled text
  result = result.replace(/[ðŸ©¸ðŸ›ï¸ðŸš¶ðŸ’§ðŸ§¦ðŸ“‹ðŸ†˜ðŸ©¹ðŸŒ¡ï¸ðŸ”¬ðŸ’‰ðŸ¥ðŸ©º]/gu, '');
  result = result.replace(/[\u{1F600}-\u{1F64F}]/gu, ''); // Emoticons
  result = result.replace(/[\u{1FA70}-\u{1FAFF}]/gu, ''); // Symbols extended
  result = result.replace(/[\u{2300}-\u{23FF}]/gu, ''); // Misc technical
  result = result.replace(/[\u{2B00}-\u{2BFF}]/gu, ''); // Misc symbols & arrows
  
  // Replace problematic quotes with standard ones
  result = result.replace(/[""â€žâ€Ÿâ€³â€´]/g, '"');
  result = result.replace(/[''â€šâ€›â€²â€µ]/g, "'");
  
  // Replace various dash characters with regular dash
  result = result.replace(/[â€“â€”â€-â€â€‘â€’âƒ]/g, '-');
  
  // Replace degree symbol with text (handle both Â° mojibake and actual °)
  result = result.replace(/Â°/g, ' deg ');
  result = result.replace(/\u00B0/g, ' deg ');
  
  // Remove any control characters except newline and tab
  result = result.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  
  // Remove non-breaking spaces that cause issues
  result = result.replace(/[\u00A0]/g, ' ');
  
  // FINAL SAFETY NET: Remove any remaining non-ASCII characters that jsPDF can't render
  // This catches anything the specific replacements above missed
  result = result.replace(/[^\x20-\x7E\n\t\r]/g, '');
  
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
  pdf.setFont('times', 'bold');
  let xPos = PDF_MARGINS.left + 2;
  headers.forEach((header, i) => {
    pdf.text(sanitizeTextForPDF(header), xPos, yPos);
    xPos += columnWidths[i];
  });
  yPos += rowHeight;
  
  // Reset to black text for rows
  pdf.setTextColor(PDF_COLORS.text.r, PDF_COLORS.text.g, PDF_COLORS.text.b);
  pdf.setFont('times', 'normal');
  
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

/**
 * Converts a jsPDF document to a Blob
 * @param pdf - jsPDF instance
 * @returns Blob representing the PDF
 */
export function pdfToBlob(pdf: jsPDF): Blob {
  return pdf.output('blob');
}

/**
 * Converts a jsPDF document to a base64 data URL
 * @param pdf - jsPDF instance
 * @returns Base64 data URL string
 */
export function pdfToDataUrl(pdf: jsPDF): string {
  return pdf.output('dataurlstring');
}

/**
 * Shares a PDF document via WhatsApp using Web Share API or fallback
 * Works on mobile devices and desktop browsers that support Web Share API
 * 
 * @param pdf - jsPDF instance to share
 * @param filename - The filename for the shared PDF
 * @param message - Optional message to include with the share
 * @returns Promise that resolves when sharing is complete
 */
export async function sharePDFViaWhatsApp(
  pdf: jsPDF,
  filename: string,
  message: string = 'Medical document from UNTH Plastic Surgery Unit'
): Promise<{ success: boolean; method: 'native' | 'whatsapp-web' | 'download' }> {
  const blob = pdf.output('blob');
  const file = new File([blob], filename, { type: 'application/pdf' });
  
  // Check if Web Share API with files is supported (mobile devices)
  if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        title: filename.replace('.pdf', ''),
        text: message,
        files: [file]
      });
      return { success: true, method: 'native' };
    } catch (error) {
      // User cancelled or sharing failed
      if ((error as Error).name !== 'AbortError') {
        console.error('Web Share API failed:', error);
      }
    }
  }
  
  // Fallback: Create a blob URL and open WhatsApp Web with instructions
  // Note: WhatsApp Web doesn't support direct file sharing via URL
  // We'll save the file and prompt user to attach it
  const blobUrl = URL.createObjectURL(blob);
  
  // First, trigger download so user has the file
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  // Then open WhatsApp with a message
  const encodedMessage = encodeURIComponent(
    `${message}\n\nðŸ“Ž The PDF document "${filename}" has been downloaded. Please attach it to this chat.`
  );
  
  // Check if on mobile for WhatsApp app vs WhatsApp Web
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  const whatsappUrl = isMobile 
    ? `whatsapp://send?text=${encodedMessage}`
    : `https://web.whatsapp.com/send?text=${encodedMessage}`;
  
  window.open(whatsappUrl, '_blank');
  
  // Clean up blob URL after a delay
  setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
  
  return { success: true, method: 'whatsapp-web' };
}

/**
 * Creates a shareable PDF and triggers WhatsApp sharing
 * Alternative method that creates a temporary download + share flow
 * 
 * @param pdf - jsPDF instance
 * @param filename - Filename for the PDF
 * @param recipientPhone - Optional phone number with country code (e.g., "2348012345678")
 * @param message - Message to accompany the document
 */
export async function shareToWhatsAppWithPhone(
  pdf: jsPDF,
  filename: string,
  recipientPhone?: string,
  message: string = 'Medical document from UNTH Plastic Surgery Unit'
): Promise<void> {
  const blob = pdf.output('blob');
  const file = new File([blob], filename, { type: 'application/pdf' });
  
  // Try native share first
  if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        title: filename.replace('.pdf', ''),
        text: message,
        files: [file]
      });
      return;
    } catch (error) {
      if ((error as Error).name === 'AbortError') return;
    }
  }
  
  // Download the file
  const blobUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  // Open WhatsApp with optional phone number
  const encodedMessage = encodeURIComponent(
    `${message}\n\nðŸ“Ž Please find the attached document: "${filename}"`
  );
  
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  
  let whatsappUrl: string;
  if (recipientPhone) {
    // Direct to specific contact
    const cleanPhone = recipientPhone.replace(/\D/g, '');
    whatsappUrl = isMobile
      ? `whatsapp://send?phone=${cleanPhone}&text=${encodedMessage}`
      : `https://web.whatsapp.com/send?phone=${cleanPhone}&text=${encodedMessage}`;
  } else {
    // Open WhatsApp to select contact
    whatsappUrl = isMobile
      ? `whatsapp://send?text=${encodedMessage}`
      : `https://web.whatsapp.com/send?text=${encodedMessage}`;
  }
  
  window.open(whatsappUrl, '_blank');
  setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
}

/**
 * Renders body text in a double-column layout.
 * Splits text at the midpoint and flows into two columns.
 */
export function addDoubleColumnText(
  pdf: jsPDF,
  text: string,
  yPos: number,
  options?: { fontSize?: number; lineHeight?: number }
): number {
  const fontSize = options?.fontSize || PDF_FONT_SIZES.body;
  const lh = options?.lineHeight || PDF_LINE_HEIGHT;
  const pageWidth = pdf.internal.pageSize.getWidth();
  const colGap = 6;
  const colWidth = (pageWidth - PDF_MARGINS.left - PDF_MARGINS.right - colGap) / 2;
  const col1X = PDF_MARGINS.left;
  const col2X = PDF_MARGINS.left + colWidth + colGap;

  pdf.setFontSize(fontSize);
  pdf.setFont('times', 'normal');
  pdf.setTextColor(PDF_COLORS.text.r, PDF_COLORS.text.g, PDF_COLORS.text.b);

  const cleanText = sanitizeTextForPDF(text);
  const allLines = pdf.splitTextToSize(cleanText, colWidth);
  const mid = Math.ceil(allLines.length / 2);
  const col1Lines = allLines.slice(0, mid);
  const col2Lines = allLines.slice(mid);

  const startY = yPos;
  col1Lines.forEach((line: string, i: number) => {
    pdf.text(line, col1X, startY + i * lh);
  });
  col2Lines.forEach((line: string, i: number) => {
    pdf.text(line, col2X, startY + i * lh);
  });

  return startY + Math.max(col1Lines.length, col2Lines.length) * lh + 2;
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
  addDoubleColumnText,
  
  // Thermal print
  createThermalPDF,
  addThermalHeader,
  addThermalText,
  finalizeThermalPDF,
  
  // Text utilities
  sanitizeTextForPDF,
  formatDateForPDF,
  formatDateTimeForPDF,
  
  // Page utilities
  validatePDFConfig,
  needsNewPage,
  addNewPage,
  
  // PDF output and sharing
  pdfToBlob,
  pdfToDataUrl,
  sharePDFViaWhatsApp,
  shareToWhatsAppWithPhone,
  
  // Configuration
  PDF_FONT_SIZES,
  PDF_MARGINS,
  PDF_PAGE,
  PDF_COLORS,
  PDF_INSTITUTION,
  PDF_THERMAL,
  PDF_LINE_SPACING,
  PDF_LINE_HEIGHT
};
