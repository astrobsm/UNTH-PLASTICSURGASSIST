import React, { useState } from 'react';
import { Share2, MessageCircle, Check, Loader2 } from 'lucide-react';
import jsPDF from 'jspdf';
import { sharePDFViaWhatsApp, shareToWhatsAppWithPhone } from '../utils/pdfUtils';

interface WhatsAppShareButtonProps {
  /** The jsPDF document to share */
  getPdf: () => jsPDF;
  /** Filename for the PDF (should include .pdf extension) */
  filename: string;
  /** Optional message to accompany the share */
  message?: string;
  /** Optional recipient phone number with country code */
  recipientPhone?: string;
  /** Button style variant */
  variant?: 'primary' | 'secondary' | 'icon-only';
  /** Additional CSS classes */
  className?: string;
  /** Disabled state */
  disabled?: boolean;
  /** Button size */
  size?: 'sm' | 'md' | 'lg';
}

/**
 * WhatsApp Share Button Component
 * 
 * Allows users to share PDF documents directly to WhatsApp.
 * Uses Web Share API on supported devices, falls back to WhatsApp Web.
 * 
 * Usage:
 * ```tsx
 * <WhatsAppShareButton
 *   getPdf={() => generateMyPDF()}
 *   filename="Patient_Report.pdf"
 *   message="Patient report from UNTH"
 * />
 * ```
 */
export default function WhatsAppShareButton({
  getPdf,
  filename,
  message = 'Medical document from UNTH Plastic Surgery Unit',
  recipientPhone,
  variant = 'primary',
  className = '',
  disabled = false,
  size = 'md'
}: WhatsAppShareButtonProps) {
  const [isSharing, setIsSharing] = useState(false);
  const [shareSuccess, setShareSuccess] = useState(false);

  const handleShare = async () => {
    if (disabled || isSharing) return;

    setIsSharing(true);
    setShareSuccess(false);

    try {
      const pdf = getPdf();
      
      if (recipientPhone) {
        await shareToWhatsAppWithPhone(pdf, filename, recipientPhone, message);
      } else {
        await sharePDFViaWhatsApp(pdf, filename, message);
      }
      
      setShareSuccess(true);
      setTimeout(() => setShareSuccess(false), 3000);
    } catch (error) {
      console.error('Failed to share PDF:', error);
      alert('Failed to share document. Please try downloading and sharing manually.');
    } finally {
      setIsSharing(false);
    }
  };

  // Size classes
  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-2 text-sm',
    lg: 'px-4 py-3 text-base'
  };

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5'
  };

  // Variant classes
  const variantClasses = {
    primary: 'bg-green-500 hover:bg-green-600 text-white',
    secondary: 'bg-white border border-green-500 text-green-600 hover:bg-green-50',
    'icon-only': 'bg-green-500 hover:bg-green-600 text-white p-2 rounded-full'
  };

  if (variant === 'icon-only') {
    return (
      <button
        onClick={handleShare}
        disabled={disabled || isSharing}
        className={`
          ${variantClasses['icon-only']}
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          transition-colors duration-200 flex items-center justify-center
          ${className}
        `}
        title="Share via WhatsApp"
        aria-label="Share via WhatsApp"
      >
        {isSharing ? (
          <Loader2 className={`${iconSizes[size]} animate-spin`} />
        ) : shareSuccess ? (
          <Check className={iconSizes[size]} />
        ) : (
          <MessageCircle className={iconSizes[size]} />
        )}
      </button>
    );
  }

  return (
    <button
      onClick={handleShare}
      disabled={disabled || isSharing}
      className={`
        ${sizeClasses[size]}
        ${variantClasses[variant]}
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        rounded-lg font-medium transition-colors duration-200
        flex items-center gap-2
        ${className}
      `}
    >
      {isSharing ? (
        <>
          <Loader2 className={`${iconSizes[size]} animate-spin`} />
          <span>Sharing...</span>
        </>
      ) : shareSuccess ? (
        <>
          <Check className={iconSizes[size]} />
          <span>Shared!</span>
        </>
      ) : (
        <>
          <MessageCircle className={iconSizes[size]} />
          <span>Share via WhatsApp</span>
        </>
      )}
    </button>
  );
}

/**
 * Inline WhatsApp share icon button for use in action bars
 */
export function WhatsAppShareIcon({
  getPdf,
  filename,
  message,
  recipientPhone,
  className = '',
  disabled = false
}: Omit<WhatsAppShareButtonProps, 'variant' | 'size'>) {
  return (
    <WhatsAppShareButton
      getPdf={getPdf}
      filename={filename}
      message={message}
      recipientPhone={recipientPhone}
      variant="icon-only"
      className={className}
      disabled={disabled}
    />
  );
}

/**
 * Download and Share button group - combines download and WhatsApp share
 */
interface DownloadAndShareProps {
  getPdf: () => jsPDF;
  filename: string;
  message?: string;
  downloadLabel?: string;
  className?: string;
  disabled?: boolean;
}

export function DownloadAndShareButtons({
  getPdf,
  filename,
  message,
  downloadLabel = 'Download PDF',
  className = '',
  disabled = false
}: DownloadAndShareProps) {
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = () => {
    if (disabled) return;
    setIsDownloading(true);
    try {
      const pdf = getPdf();
      pdf.save(filename);
    } catch (error) {
      console.error('Failed to download PDF:', error);
      alert('Failed to download document.');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <button
        onClick={handleDownload}
        disabled={disabled || isDownloading}
        className={`
          px-3 py-2 text-sm rounded-lg font-medium
          bg-green-600 hover:bg-green-700 text-white
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          transition-colors duration-200 flex items-center gap-2
        `}
      >
        {isDownloading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Share2 className="w-4 h-4" />
        )}
        {downloadLabel}
      </button>
      <WhatsAppShareButton
        getPdf={getPdf}
        filename={filename}
        message={message}
        variant="secondary"
        disabled={disabled}
      />
    </div>
  );
}
